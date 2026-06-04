from collections import defaultdict
from ultralytics import YOLO
import zones
import cv2
import sys
import os

from db import get_connection

# =========================
# INPUTS
# =========================

video_path = sys.argv[1]
video_id = int(sys.argv[2])

# =========================
# LOAD MODEL
# =========================

model = YOLO("yolov8n.pt")

# =========================
# VIDEO INFO
# =========================

cap = cv2.VideoCapture(video_path)

if not cap.isOpened():

    print(
        "ERROR: Cannot open input video"
    )

    sys.exit(1)

width = int(
    cap.get(cv2.CAP_PROP_FRAME_WIDTH)
)

height = int(
    cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
)

fps = cap.get(
    cv2.CAP_PROP_FPS
)

if fps <= 0:
    fps = 30

if width <= 0 or height <= 0:

    print(
        "ERROR: Invalid video dimensions"
    )

    cap.release()

    sys.exit(1)

# =========================
# LOAD ZONES
# =========================

zones.load_zones(
    video_id,
    width,
    height
)

print("LOADED ZONES:")
print(zones.ZONES)

# =========================
# OUTPUT PATH
# =========================

output_video = (
    r"D:\SE\backend\public\processed.mp4"
)

# =========================
# REMOVE OLD VIDEO
# =========================

if os.path.exists(output_video):

    try:

        os.remove(output_video)

    except Exception as e:

        print(
            "Cannot remove old video:",
            e
        )

# =========================
# VIDEO WRITER
# =========================

fourcc = cv2.VideoWriter_fourcc(
    *"avc1"
)

out = cv2.VideoWriter(

    output_video,

    fourcc,

    fps,

    (width, height)
)

if not out.isOpened():

    print(
        "ERROR: VideoWriter failed"
    )

    cap.release()

    sys.exit(1)

print(
    f"VideoWriter initialized "
    f"{width}x{height} @ {fps}fps"
)

# =========================
# DATABASE
# =========================

conn = get_connection()
cur = conn.cursor()

cur.execute(

    """
    DELETE FROM trajectories
    WHERE video_id = %s
    """,

    (video_id,)
)

conn.commit()

# =========================
# YOLO TRACKING
# =========================

results = model.track(

    source=video_path,

    tracker="bytetrack.yaml",

    stream=True,

    persist=True
)

# =========================
# TRAJECTORY HISTORY
# =========================

track_history = defaultdict(list)

frame_id = 0

# =========================
# MAIN LOOP
# =========================

for result in results:

    frame = result.orig_img.copy()

    if frame is None:

        print(
            f"Frame {frame_id} is None"
        )

        continue

    boxes = result.boxes

    if (

        boxes.id is not None

        and

        boxes.cls is not None

    ):

        ids = boxes.id.cpu().numpy()

        coords = (
            boxes.xyxy.cpu().numpy()
        )

        classes = (
            boxes.cls.cpu().numpy()
        )

        for i in range(len(ids)):

            if int(classes[i]) != 0:
                continue

            person_id = int(ids[i])

            x1, y1, x2, y2 = coords[i]

            center_x = int(
                (x1 + x2) / 2
            )

            center_y = int(
                (y1 + y2) / 2
            )

            zone = zones.get_zone(
                center_x,
                center_y
            )

            cur.execute(

                """
                INSERT INTO trajectories
                (
                    video_id,
                    frame,
                    person_id,
                    x,
                    y,
                    zone
                )
                VALUES
                (
                    %s,%s,%s,%s,%s,%s
                )
                """,

                (

                    video_id,

                    frame_id,

                    person_id,

                    center_x,

                    center_y,

                    zone
                )
            )

            cv2.rectangle(

                frame,

                (
                    int(x1),
                    int(y1)
                ),

                (
                    int(x2),
                    int(y2)
                ),

                (
                    0,
                    255,
                    0
                ),

                2
            )

            cv2.putText(

                frame,

                f"ID {person_id}",

                (
                    int(x1),
                    int(y1) - 10
                ),

                cv2.FONT_HERSHEY_SIMPLEX,

                0.6,

                (
                    0,
                    255,
                    0
                ),

                2
            )

            track = track_history[
                person_id
            ]

            track.append(
                (
                    center_x,
                    center_y
                )
            )

            if len(track) > 30:

                track.pop(0)

            for j in range(
                1,
                len(track)
            ):

                cv2.line(

                    frame,

                    track[j - 1],

                    track[j],

                    (
                        0,
                        0,
                        255
                    ),

                    2
                )

    # =========================
    # DRAW ZONES
    # =========================

    for zone_name, (

        zx1,
        zy1,
        zx2,
        zy2

    ) in zones.ZONES.items():

        cv2.rectangle(

            frame,

            (
                zx1,
                zy1
            ),

            (
                zx2,
                zy2
            ),

            (
                255,
                0,
                0
            ),

            2
        )

        cv2.putText(

            frame,

            zone_name,

            (
                zx1 + 5,
                zy1 + 20
            ),

            cv2.FONT_HERSHEY_SIMPLEX,

            0.6,

            (
                255,
                0,
                0
            ),

            2
        )

    # =========================
    # ENSURE SIZE
    # =========================

    frame = cv2.resize(

        frame,

        (
            width,
            height
        )
    )

    out.write(frame)

    frame_id += 1

    if frame_id % 500 == 0:

        conn.commit()

        print(
            f"Processed {frame_id} frames"
        )

# =========================
# NO FRAME CASE
# =========================

if frame_id == 0:

    print(
        "ERROR: No frames processed"
    )

    cur.close()
    conn.close()

    cap.release()
    out.release()

    sys.exit(1)

# =========================
# CLEANUP
# =========================

conn.commit()

cur.close()
conn.close()

cap.release()
out.release()

cv2.destroyAllWindows()

# =========================
# VERIFY OUTPUT
# =========================

if os.path.exists(output_video):

    size = os.path.getsize(
        output_video
    )

    print(
        f"Output video size: "
        f"{size / 1024 / 1024:.2f} MB"
    )

    test = cv2.VideoCapture(
        output_video
    )

    print(
        "Output video readable:",
        test.isOpened()
    )

    test.release()

print("Tracking completed")
print("Processed video saved")