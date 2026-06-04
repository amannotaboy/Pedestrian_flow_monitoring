const express = require("express");

const {
    getAnalytics,
} = require("../services/analyticsService");
const {
    getCurrentVideoId
} = require("../state/currentVideo");
const {
    getLatestVideo
} = require("../services/videoService");

const router = express.Router();

router.get("/stats", async (req, res) => {

    try {

        const latestVideo = await getLatestVideo();
        const videoId = getCurrentVideoId() || latestVideo?.id || null;

        if (videoId) {

            const analytics = await getAnalytics(videoId);

            if (analytics) {
                return res.json(analytics);
            }
        }

        return res.status(404).json({
            error: "No analytics available"
        });

    } catch (err) {

        return res.status(500).json({
            error: "Cannot load stats"
        });
    }
});

module.exports = router;
