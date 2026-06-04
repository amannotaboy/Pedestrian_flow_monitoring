const express = require("express");

const {
    saveZones,
    getZones
} = require("../services/zoneService");
const {
    getCurrentVideoId
} = require("../state/currentVideo");
const {
    getLatestVideo
} = require("../services/videoService");
const {
    authenticate,
    requireAdmin
} = require("../middleware/auth");

const router = express.Router();

async function getActiveVideoId() {
    const latestVideo = await getLatestVideo();
    return getCurrentVideoId() || latestVideo?.id || null;
}

router.post("/zones", authenticate, requireAdmin, async (req, res) => {

    try {

        const payload = req.body;
        const zones = payload.zones || [];
        const gridSize = Number(payload.grid_size) || 0;
        const videoId = await getActiveVideoId();

        if (!videoId) {
            return res.status(400).json({
                error: "No active video"
            });
        }

        await saveZones(videoId, gridSize, zones);

        return res.json({
            message: "Zones saved successfully"
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: "Failed to save zones"
        });
    }
});

router.get("/zones", authenticate, async (req, res) => {

    try {

        const videoId = await getActiveVideoId();

        if (!videoId) {
            return res.json({
                grid_size: 0,
                zones: []
            });
        }

        const dbZones = await getZones(videoId);

        if (dbZones && dbZones.length > 0) {
            return res.json({
                grid_size: dbZones[0].grid_size,
                zones: dbZones.map((zone) => ({
                    name: zone.zone_name,
                    grid_position: zone.grid_position
                }))
            });
        }

        return res.json({
            grid_size: 0,
            zones: []
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: "Failed to load zones"
        });
    }
});

module.exports = router;
