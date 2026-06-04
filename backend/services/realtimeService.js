const pool = require("../config/db");

async function getRealtimeStats(videoId) {

    const result = await pool.query(
        `
        SELECT person_id, zone
        FROM trajectories
        WHERE video_id = $1
        `,
        [videoId]
    );

    const rows = result.rows;

    if (rows.length === 0) {
        return {
            total_people: 0,
            most_crowded_zone: "-",
            popular_path: "-",
            zone_counts: {},
            congestion_alert: "Normal"
        };
    }

    const personSet = new Set();
    const zoneFreq = {};

    for (const r of rows) {
        personSet.add(r.person_id);
        zoneFreq[r.zone] = (zoneFreq[r.zone] || 0) + 1;
    }

    const total_people = personSet.size;

    const most_crowded_zone =
        Object.keys(zoneFreq).length > 0
            ? Object.keys(zoneFreq).reduce((a, b) =>
                zoneFreq[a] > zoneFreq[b] ? a : b
            )
            : "-";

    // simple congestion logic
    let congestion_alert = "Normal";
    for (const z in zoneFreq) {
        if (zoneFreq[z] > 15) {
            congestion_alert = `High congestion in ${z}`;
            break;
        } else if (zoneFreq[z] > 10) {
            congestion_alert = `Moderate traffic in ${z}`;
        }
    }

    return {
        total_people,
        most_crowded_zone,
        popular_path: "-", // giữ đơn giản trước
        zone_counts: zoneFreq,
        congestion_alert
    };
}

module.exports = { getRealtimeStats };