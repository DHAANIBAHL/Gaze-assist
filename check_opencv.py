"""
OpenCV + Camera + MediaPipe diagnostic script.
Run with: python check_opencv.py
"""
import sys
import os

os.environ['OPENCV_LOG_LEVEL'] = 'SILENT'

import cv2
import numpy as np

SEP = '-' * 52

lines = []
lines.append(SEP)
lines.append('  OpenCV / Camera Diagnostic')
lines.append(SEP)
lines.append(f'  Python   : {sys.version.split()[0]}')
lines.append(f'  OpenCV   : {cv2.__version__}')
lines.append(f'  NumPy    : {np.__version__}')

try:
    import mediapipe as mp
    lines.append(f'  MediaPipe: {mp.__version__}')
    mp_ok = True
except Exception as e:
    lines.append(f'  MediaPipe: MISSING ({e})')
    mp_ok = False

lines.append(SEP)
lines.append('  Camera probe (indices 0-2)')
lines.append(SEP)

found_camera = False
for idx in [0, 1, 2]:
    # CAP_DSHOW = DirectShow on Windows (avoids obs-sensor noise)
    cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
    if not cap.isOpened():
        lines.append(f'  [{idx}] NOT available')
        continue

    w   = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h   = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    ret, frame = cap.read()
    cap.release()

    if ret and frame is not None:
        lines.append(f'  [{idx}] OPENED  {w}x{h} @ {fps:.0f}fps  shape={frame.shape}  [OK]')
        found_camera = True
    else:
        lines.append(f'  [{idx}] OPENED but could not grab frame  [FAIL]')

lines.append(SEP)

if mp_ok:
    lines.append('  MediaPipe model files:')
    model_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             'python_backend', 'models')
    for fname in ['face_landmarker.task', 'hand_landmarker.task']:
        path   = os.path.join(model_dir, fname)
        status = 'FOUND' if os.path.exists(path) else 'MISSING (will download on first run)'
        lines.append(f'    {fname}: {status}')
    lines.append(SEP)

lines.append('')
if found_camera:
    lines.append('  RESULT: OpenCV is working and camera is accessible.')
else:
    lines.append('  RESULT: OpenCV installed but no camera opened.')
    lines.append('    -> Check another app is not locking the camera.')
    lines.append('    -> Check Windows Settings > Privacy > Camera permissions.')
lines.append('')

print('\n'.join(lines))
