from db import get_connection

ZONES = {}


def load_zones(video_id, video_width, video_height):

    global ZONES

    conn = get_connection()

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT grid_size, zone_name, grid_position
                FROM zones
                WHERE video_id = %s
                ORDER BY grid_position
                """,
                (video_id,)
            )
            rows = cur.fetchall()

        if len(rows) == 0:
            print("No zones found")
            ZONES = {}
            return {}

        grid_size = rows[0][0]
        saved_zones = [
            {
                "name": row[1],
                "grid_position": row[2]
            }
            for row in rows
        ]

        cell_width = video_width // grid_size
        cell_height = video_height // grid_size

        zones = {}

        for zone in saved_zones:
            index = zone["grid_position"]
            row = index // grid_size
            col = index % grid_size

            x1 = col * cell_width
            y1 = row * cell_height
            x2 = x1 + cell_width
            y2 = y1 + cell_height

            zones[zone["name"]] = (
                x1,
                y1,
                x2,
                y2
            )

        ZONES = zones

        print(
            "Loaded",
            len(ZONES),
            "zones"
        )

        return zones
    finally:
        conn.close()


def get_zone(x, y):

    for zone_name, (
        x1,
        y1,
        x2,
        y2
    ) in ZONES.items():

        if (
            x1 <= x <= x2
            and
            y1 <= y <= y2
        ):
            return zone_name

    return "Unknown"
