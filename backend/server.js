const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");

const analyticsRoutes = require("./routes/analytics");
const zonesRoutes = require("./routes/zones");
const { getRealtimeStats } = require("./services/realtimeService");
const {
    setCurrentVideoId, 
    getCurrentVideoId 
} = require("./state/currentVideo");
const {
    createVideo,
    getLatestVideo,
    markProcessed
} = require("./services/videoService");

const app = express();
// =========================
// TEMP: TEST STATS ROUTE/
// =========================
const statsRoutes = require("./routes/stats");

app.use("/api", statsRoutes);
// =========================
// RESET OLD FILES
// =========================

const filesToDelete = [
    "backend/public/processed.mp4",
    "backend/public/heatmap.png"
];

filesToDelete.forEach((file) => {
    if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`Deleted: ${file}`);
    }
});

// =========================
// MIDDLEWARE
// =========================

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", analyticsRoutes);
app.use("/api", zonesRoutes);

// =========================
// MULTER STORAGE
// =========================

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "backend/uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({
    storage: storage
});

function clearGeneratedMedia() {
    const generatedFiles = [
        "backend/public/processed.mp4",
        "backend/public/heatmap.png"
    ];

    generatedFiles.forEach((filePath) => {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    });
}

function assertNonEmptyFile(filePath, label) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`${label} was not generated`);
    }

    const stats = fs.statSync(filePath);
    if (!stats.size || stats.size <= 0) {
        throw new Error(`${label} is empty`);
    }
}

function runPython(command) {
    return new Promise((resolve, reject) => {

        exec(command, (error, stdout, stderr) => {

            console.log("==========");
            console.log(command);
            console.log(stdout);
            console.log(stderr);

            if (error) {
                console.error(error);
                reject(error);
                return;
            }

            resolve(stdout);
        });

    });
}

// =========================
// UPLOAD ROUTE
// =========================

app.post("/upload", upload.single("video"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "No file uploaded"
            });
        }

        const videoPath = `backend/uploads/${req.file.filename}`;
        const videoRecord = await createVideo(req.file.filename);
        setCurrentVideoId(videoRecord.id);

        clearGeneratedMedia();

        console.log("Processing video...");

        await runPython(`python ai_services/extract_preview.py "${videoPath}"`);
        await runPython(`python ai_services/tracking.py "${videoPath}" ${videoRecord.id}`);
        assertNonEmptyFile("backend/public/processed.mp4", "Processed video");
        await runPython(`python ai_services/analytics.py ${videoRecord.id}`);
        await runPython(`python ai_services/heatmap.py ${videoRecord.id}`);
        assertNonEmptyFile("backend/public/heatmap.png", "Heatmap image");

        await markProcessed(videoRecord.id);

        return res.json({
            message: "Processing completed",
            videoId: videoRecord.id
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: "Processing failed"
        });
    }
});

app.post("/api/reprocess", async (req, res) => {
    try {
        const activeVideoId = getCurrentVideoId() || (await getLatestVideo())?.id || null;

        if (!activeVideoId) {
            return res.status(400).json({
                error: "No active video"
            });
        }

        const latestVideo = await getLatestVideo();

        if (!latestVideo) {
            return res.status(400).json({
                error: "No active video"
            });
        }

        const videoPath = `backend/uploads/${latestVideo.filename}`;

        clearGeneratedMedia();

        await runPython(`python ai_services/tracking.py "${videoPath}" ${activeVideoId}`);
        assertNonEmptyFile("backend/public/processed.mp4", "Processed video");
        await runPython(`python ai_services/analytics.py ${activeVideoId}`);
        await runPython(`python ai_services/heatmap.py ${activeVideoId}`);
        assertNonEmptyFile("backend/public/heatmap.png", "Heatmap image");
        await markProcessed(activeVideoId);

        return res.json({
            message: "Reprocessed",
            videoId: activeVideoId
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: "Reprocess failed"
        });
    }
});

// =========================
// ANALYTICS ROUTE(realtime stats)
// =========================

app.get("/api/stats", async (req, res) => {
    try {
        const videoId = getCurrentVideoId();

        if (!videoId) {
            return res.json({
                total_people: 0,
                most_crowded_zone: "-",
                popular_path: "-",
                zone_counts: {},
                congestion_alert: "Normal"
            });
        }

        const stats = await getRealtimeStats(videoId);

        return res.json(stats);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "stats failed" });
    }
});

// =========================
// SERVER
// =========================

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
