const express = require("express");
const router = express.Router();
const pool =
    require("../config/db");
const {
    getAnalytics,
    getLatestAnalytics
} = require("../services/analyticsService");

const {
    getCurrentVideoId
} = require("../state/currentVideo");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);

function getPopularPath(rows) {
    const pathsByPerson = new Map();

    rows.forEach((row) => {
        if (!row.zone || row.zone === "Unknown") {
            return;
        }

        if (!pathsByPerson.has(row.person_id)) {
            pathsByPerson.set(row.person_id, []);
        }

        const path = pathsByPerson.get(row.person_id);
        const lastZone = path[path.length - 1];

        if (lastZone !== row.zone) {
            path.push(row.zone);
        }
    });

    const pathCounts = {};

    pathsByPerson.forEach((path) => {
        if (path.length < 2) {
            return;
        }

        const pathLabel = `${path[0]} -> ${path[path.length - 1]}`;
        pathCounts[pathLabel] = (pathCounts[pathLabel] || 0) + 1;
    });

    const labels = Object.keys(pathCounts);

    if (labels.length === 0) {
        return "-";
    }

    return labels.reduce((a, b) =>
        pathCounts[a] > pathCounts[b]
            ? a
            : b
    );
}

router.get("/stats/:videoId", async (req, res) => {
    try {
        const videoId = Number(req.params.videoId);

        if (!videoId) {
            return res.status(400).json({
                error: "Invalid videoId"
            });
        }

        const analytics = await getAnalytics(videoId);

        if (!analytics) {
            return res.json({
                total_people: 0,
                most_crowded_zone: "-",
                popular_path: "-",
                zone_counts: {},
                congestion_alert: "Normal"
            });
        }

        return res.json(analytics);

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: "Failed to load stats"
        });
    }
});
router.get("/stats", async (req, res) => {

    try {

        const latestVideo =
            await require("../services/videoService")
                .getLatestVideo();

        const requestedVideoId =
            Number(req.query.videoId || 0);

        const videoId =
            requestedVideoId
            || getCurrentVideoId()
            || latestVideo?.id
            || null;

        if (!videoId) {

            return res.json({
                total_people: 0,
                most_crowded_zone: "-",
                popular_path: "-",
                zone_counts: {},
                congestion_alert: "Normal"
            });
        }

        const fps = 25;

        const currentTime =
            Number(req.query.time || 0);

        const currentFrame =
            Math.floor(currentTime * fps);

        const result =
            await pool.query(
                `
                SELECT
                    person_id,
                    zone
                FROM trajectories
                WHERE video_id = $1
                AND frame = $2
                `,
                [
                    videoId,
                    currentFrame
                ]
            );

        const rows =
            result.rows;

        const pathResult =
            await pool.query(
                `
                SELECT
                    person_id,
                    zone
                FROM trajectories
                WHERE video_id = $1
                AND frame <= $2
                ORDER BY person_id, frame
                `,
                [
                    videoId,
                    currentFrame
                ]
            );

        const uniquePeople =
            new Set(
                rows.map(
                    r => r.person_id
                )
            );

        const zoneCounts = {};

        rows.forEach(row => {

            zoneCounts[row.zone] =
                (zoneCounts[row.zone] || 0)
                + 1;
        });

        let mostCrowdedZone = "-";

        if (
            Object.keys(zoneCounts).length
        ) {

            mostCrowdedZone =
                Object.keys(zoneCounts)
                    .reduce((a, b) =>
                        zoneCounts[a] >
                        zoneCounts[b]
                            ? a
                            : b
                    );
        }

        let congestion =
            "Normal";

        const maxCount =
            Math.max(
                0,
                ...Object.values(
                    zoneCounts
                )
            );

        if (maxCount > 15) {

            congestion =
                "High congestion";

        } else if (maxCount > 10) {

            congestion =
                "Moderate traffic";
        }

        return res.json({

            total_people:
                uniquePeople.size,

            most_crowded_zone:
                mostCrowdedZone,

            popular_path:
                getPopularPath(pathResult.rows),

            zone_counts:
                zoneCounts,

            congestion_alert:
                congestion
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: "Failed"
        });
    }
});

module.exports = router;
