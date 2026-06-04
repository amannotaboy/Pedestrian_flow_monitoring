import json
import os
import sys

from db import get_connection

video_id = int(sys.argv[1])

conn = get_connection()
cur = conn.cursor()

cur.execute(
    """
    SELECT person_id, zone, frame
    FROM trajectories
    WHERE video_id = %s
    ORDER BY person_id, frame
    """,
    (video_id,)
)
rows = cur.fetchall()

if len(rows) == 0:
    stats = {
        "total_people": 0,
        "most_crowded_zone": "-",
        "popular_path": "No movement",
        "zone_counts": {},
        "congestion_alert": "Normal"
    }
else:
    person_ids = sorted({row[0] for row in rows})
    total_people = len(person_ids)

    zone_frequency = {}
    for _, zone, _ in rows:
        zone_frequency[zone] = zone_frequency.get(zone, 0) + 1

    most_crowded_zone = max(zone_frequency, key=zone_frequency.get)

    person_paths = {}
    for person_id in person_ids:
        person_zones = [
            zone
            for row_person_id, zone, _ in rows
            if row_person_id == person_id
        ]

        cleaned = []
        for z in person_zones:
            if len(cleaned) == 0 or cleaned[-1] != z:
                cleaned.append(z)

        if len(cleaned) >= 2:
            path = cleaned[0] + " -> " + cleaned[-1]
            person_paths[path] = person_paths.get(path, 0) + 1

    if len(person_paths) > 0:
        popular_path = max(person_paths, key=person_paths.get)
    else:
        popular_path = "No movement"

    zone_counts = {}
    for zone in zone_frequency.keys():
        unique_people = len({
            row_person_id
            for row_person_id, row_zone, _ in rows
            if row_zone == zone
        })
        zone_counts[zone] = int(unique_people)

    congestion_alert = "Normal"
    for zone, count in zone_counts.items():
        if count > 15:
            congestion_alert = f"High congestion in {zone}"
            break
        elif count > 10:
            congestion_alert = f"Moderate traffic in {zone}"

    stats = {
        "total_people": total_people,
        "most_crowded_zone": most_crowded_zone,
        "popular_path": popular_path,
        "zone_counts": zone_counts,
        "congestion_alert": congestion_alert
    }

cur.execute(
    """
    INSERT INTO analytics (video_id, data)
    VALUES (%s, %s::jsonb)
    ON CONFLICT (video_id)
    DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
    """,
    (video_id, json.dumps(stats))
)

conn.commit()
cur.close()
conn.close()

print("Analytics completed")
