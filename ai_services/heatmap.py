import cv2
import numpy as np
import os
import sys

from db import get_connection

video_id = int(sys.argv[1])

conn = get_connection()
cur = conn.cursor()

cur.execute(
    """
    SELECT x, y
    FROM trajectories
    WHERE video_id = %s
    """,
    (video_id,)
)
rows = cur.fetchall()

cap = cv2.VideoCapture("backend/public/processed.mp4")
ret, frame = cap.read()
cap.release()

if not ret:
    print("Cannot read video")
    cur.close()
    conn.close()
    sys.exit()

height, width = frame.shape[:2]

heatmap = np.zeros((height, width), dtype=np.float32)

for row in rows:
    x = int(row[0])
    y = int(row[1])

    if 0 <= x < width and 0 <= y < height:
        heatmap[y, x] += 1

heatmap = cv2.GaussianBlur(heatmap, (101, 101), 0)

max_value = np.max(heatmap)
if max_value <= 0:
    max_value = 1

heatmap = np.uint8(255 * heatmap / max_value)

heatmap_color = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

overlay = cv2.addWeighted(frame, 0.6, heatmap_color, 0.4, 0)

cv2.imwrite("backend/public/heatmap.png", overlay)

cur.close()
conn.close()

print("Heatmap generated")
