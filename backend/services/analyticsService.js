const pool = require("../config/db");

// =====================================
// SAVE ANALYTICS
// =====================================
async function saveAnalytics(videoId, analytics) {

    await pool.query(
        `
        INSERT INTO analytics
        (
            video_id,
            data
        )
        VALUES
        (
            $1,
            $2
        )
        ON CONFLICT (video_id)
        DO UPDATE SET
            data = EXCLUDED.data,
            updated_at = NOW()
        `,
        [
            videoId,
            analytics
        ]
    );
}

// =====================================
// GET ANALYTICS BY VIDEO ID
// =====================================
async function getAnalytics(videoId) {

    const result = await pool.query(
        `
        SELECT data
        FROM analytics
        WHERE video_id = $1
        `,
        [videoId]
    );

    return result.rows[0]?.data || null;
}

// =====================================
// GET LATEST (optional fallback)

async function getLatestAnalytics() {

    const result = await pool.query(
        `
        SELECT data
        FROM analytics
        ORDER BY video_id DESC
        LIMIT 1
        `
    );

    return result.rows[0]?.data || null;
}

module.exports = {
    saveAnalytics,
    getAnalytics,
    getLatestAnalytics
};