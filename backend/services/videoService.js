const pool =
    require("../config/db");

async function createVideo(
    filename
) {

    const query = `

        INSERT INTO videos
        (
            filename
        )

        VALUES
        (
            $1
        )

        RETURNING id

    `;

    const result =
        await pool.query(

            query,

            [
                filename
            ]
        );

    return result.rows[0];
}

async function getLatestVideo() {

    const result = await pool.query(
        `
        SELECT id, filename, processed
        FROM videos
        ORDER BY id DESC
        LIMIT 1
        `
    );

    return result.rows[0] || null;
}

async function markProcessed(
    videoId
) {

    await pool.query(

        `
        UPDATE videos
        SET processed = TRUE
        WHERE id = $1
        `,

        [
            videoId
        ]
    );
}

module.exports = {

    createVideo,

    getLatestVideo,

    markProcessed
};