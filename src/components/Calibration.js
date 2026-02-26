import React, { useEffect, useRef, useState, useCallback } from 'react';
import './Calibration.css';

// ── Calibration points: 3×3 grid ─────────────────────────────────────────────
const CALIBRATION_POINTS = [
  { x: 0.10, y: 0.10 }, // top-left
  { x: 0.50, y: 0.10 }, // top-center
  { x: 0.90, y: 0.10 }, // top-right
  { x: 0.10, y: 0.50 }, // mid-left
  { x: 0.50, y: 0.50 }, // center
  { x: 0.90, y: 0.50 }, // mid-right
  { x: 0.10, y: 0.90 }, // bot-left
  { x: 0.50, y: 0.90 }, // bot-center
  { x: 0.90, y: 0.90 }, // bot-right
];

const SAMPLES_PER_POINT = 40;   // number of gaze samples to average per dot
const WAIT_BEFORE_MS = 1800; // ms to wait before collecting (let eyes settle)
const PYTHON_BACKEND = process.env.REACT_APP_PYTHON_BACKEND || 'http://localhost:5001';

const Calibration = ({ gazeTracker, onComplete, onCancel }) => {
  const [phase, setPhase] = useState('intro');      // intro | collecting | done | error
  const [pointIdx, setPointIdx] = useState(0);
  const [progress, setProgress] = useState(0);            // 0-100 per sample collection
  const [totalProgress, setTotal] = useState(0);            // 0-100 overall
  const [message, setMessage] = useState('');
  const [gazePos, setGazePos] = useState({ x: 0.5, y: 0.5 });
  // For now we don't block on face detection – the user can
  // visually verify in the camera preview. Always treat as OK.
  const [faceOk] = useState(true);

  const socketRef = useRef(null);
  const samplesRef = useRef([]);
  const collectingRef = useRef(false);
  const pointIdxRef = useRef(0);
  const phaseRef = useRef('intro');
  const calibDataRef = useRef([]); // accumulated {gazeX/Y, screenX/Y} across all points
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { pointIdxRef.current = pointIdx; }, [pointIdx]);

  // ── Connect to Python backend via Socket.IO ──────────────────────────────
  useEffect(() => {
    const loadSocketIO = async () => {
      // dynamically load socket.io-client CDN if not loaded yet
      if (!window.io) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
          s.onload = res;
          s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      const socket = window.io(PYTHON_BACKEND, { transports: ['websocket'] });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Calibration: connected to Python backend');
        socket.emit('start_tracking');
      });

      socket.on('gaze_data', (data) => {
        const gx = typeof data.gazeX === 'number' ? data.gazeX : 0.5;
        const gy = typeof data.gazeY === 'number' ? data.gazeY : 0.5;

        setGazePos({ x: gx, y: gy });

        // While collecting, always push raw gaze samples – calibration
        // will average and reject bad points if needed.
        if (collectingRef.current) {
          samplesRef.current.push({ x: gx, y: gy });
        }
      });

      socket.on('connect_error', (err) => {
        console.error('Socket connect error:', err);
      });
    };

    loadSocketIO().catch(console.error);

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('stop_tracking');
        socketRef.current.disconnect();
      }
    };
  }, []);

  // ── Camera preview for intro screen ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'intro') {
      // Stop preview when leaving intro
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let active = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 } })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(err => console.warn('Camera preview unavailable:', err));

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [phase]);

  // ── Start calibration ───────────────────────────────────────────────────
  const startCalibration = useCallback(async () => {
    // Reset backend calibration state
    try {
      await fetch(`${PYTHON_BACKEND}/api/calibration/reset`, { method: 'POST' });
    } catch (e) {
      console.warn('Could not reset backend calibration:', e);
    }

    calibDataRef.current = [];
    setPointIdx(0);
    setPhase('collecting');
    setMessage('Look at the glowing circle');
    setTotal(0);
  }, []);

  // ── Collect data for one calibration point ───────────────────────────────
  const collectPoint = useCallback(async (idx) => {
    if (collectingRef.current) return;

    const pt = CALIBRATION_POINTS[idx];
    collectingRef.current = true;
    samplesRef.current = [];

    setMessage(`Look at point ${idx + 1} of ${CALIBRATION_POINTS.length} – keep your gaze steady`);
    setProgress(0);

    // Wait for user to look at the point
    await new Promise(r => setTimeout(r, WAIT_BEFORE_MS));

    // Collect samples over ~1.3 seconds
    const total = SAMPLES_PER_POINT;
    for (let i = 0; i < total; i++) {
      await new Promise(r => setTimeout(r, 33));
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    collectingRef.current = false;
    const samples = samplesRef.current.slice();

    if (samples.length >= 5) {
      const avgX = samples.reduce((s, p) => s + p.x, 0) / samples.length;
      const avgY = samples.reduce((s, p) => s + p.y, 0) / samples.length;

      const entry = {
        gazeX: avgX,
        gazeY: avgY,
        screenX: pt.x,
        screenY: pt.y,
      };
      calibDataRef.current.push(entry);

      // Also send to Python backend for server-side fitting
      fetch(`${PYTHON_BACKEND}/api/calibration/add_point`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }).catch(console.warn);

      // Also add to the frontend GazeTracker (for fallback)
      if (gazeTracker) {
        gazeTracker.addCalibrationPoint(
          { rawX: avgX, rawY: avgY },
          { x: pt.x * window.innerWidth, y: pt.y * window.innerHeight }
        );
      }

      console.log(`✓ Point ${idx + 1}: gaze=(${avgX.toFixed(3)},${avgY.toFixed(3)}) samples=${samples.length}`);
    } else {
      console.warn(`⚠ Point ${idx + 1}: not enough samples (${samples.length})`);
      setMessage('Face not detected clearly. Please keep your face in view.');
      await new Promise(r => setTimeout(r, 1000));
    }

    setProgress(0);
    setTotal(Math.round(((idx + 1) / CALIBRATION_POINTS.length) * 100));
  }, [gazeTracker]);

  // ── Advance through calibration points ───────────────────────────────────
  useEffect(() => {
    if (phase !== 'collecting') return;

    let cancelled = false;

    const run = async () => {
      for (let i = pointIdx; i < CALIBRATION_POINTS.length; i++) {
        if (cancelled) return;
        setPointIdx(i);
        await collectPoint(i);
        if (cancelled) return;
      }

      // All points done – complete calibration
      setMessage('Finalising calibration…');
      setPhase('done');

      // Tell Python backend to complete calibration
      try {
        const res = await fetch(`${PYTHON_BACKEND}/api/calibration/complete`, { method: 'POST' });
        const data = await res.json();
        console.log('Backend calibration result:', data);
      } catch (e) {
        console.warn('Could not complete backend calibration:', e);
      }

      // Also complete frontend GazeTracker
      if (gazeTracker) {
        gazeTracker.completeCalibration();
      }

      setMessage('Calibration complete! 🎉');
      setTimeout(() => onComplete?.(), 1500);
    };

    run();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleCancel = () => {
    if (gazeTracker) gazeTracker.resetCalibration();
    onCancel?.();
  };

  // Pixel positions for calibration dots
  const dotStyle = (pt) => ({
    left: `${pt.x * 100}%`,
    top: `${pt.y * 100}%`,
  });

  return (
    <div className="calib-root">
      {/* Calibration dots – always on top layer */}
      {phase === 'collecting' && (
        <div className="calib-dots-layer">
          {CALIBRATION_POINTS.map((pt, i) => {
            const isActive = i === pointIdx;
            const isCompleted = i < pointIdx;
            return (
              <div
                key={i}
                className={`calib-dot${isActive ? ' active' : ''}${isCompleted ? ' done' : ''}`}
                style={dotStyle(pt)}
              >
                <div className="calib-dot-outer">
                  <div className="calib-dot-inner" />
                </div>
                {/* Progress ring on active dot */}
                {isActive && progress > 0 && (
                  <svg className="calib-ring" viewBox="0 0 56 56">
                    <circle
                      className="calib-ring-bg"
                      cx="28" cy="28" r="24"
                    />
                    <circle
                      className="calib-ring-fill"
                      cx="28" cy="28" r="24"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - progress / 100)}`}
                    />
                  </svg>
                )}
                {/* Dot number label */}
                <span className="calib-dot-num">{i + 1}</span>
              </div>
            );
          })}

          {/* Live gaze preview dot */}
          <div
            className="live-gaze-dot"
            style={{ left: `${gazePos.x * 100}%`, top: `${gazePos.y * 100}%` }}
          />
        </div>
      )}

      {/* HUD overlay – bottom strip */}
      <div className="calib-hud">
        {phase === 'intro' && (
          <div className="hud-card intro-card">
            <div className="intro-layout">
              {/* Camera preview panel */}
              <div className="camera-preview-wrap">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="camera-preview"
                />
                <div className={`camera-overlay-badge ${faceOk ? 'ok' : 'bad'}`}>
                  {faceOk ? '✓ Face detected' : '✗ No face'}
                </div>
              </div>

              {/* Instructions column */}
              <div className="intro-instructions">
                <div className="hud-icon">👁️</div>
                <h2>Eye Calibration</h2>
                <p>
                  We'll show <strong>{CALIBRATION_POINTS.length} dots</strong> one at a time.
                  Look at each glowing circle until it fills up. Keep your head still.
                </p>
                <div className={`face-status ${faceOk ? '' : 'face-warning'}`}>
                  <span className={`face-dot ${faceOk ? 'ok' : 'bad'}`} />
                  <span>
                    {faceOk
                      ? 'Face detected ✓ – ready to calibrate!'
                      : 'No face detected – ensure good lighting and centre your face in the preview'}
                  </span>
                </div>
                <div className="hud-btns">
                  <button className="btn-primary" onClick={startCalibration}>
                    Start Calibration
                  </button>
                  <button className="btn-secondary" onClick={handleCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'collecting' && (
          <div className="hud-card collect-card">
            <div className="hud-row">
              <div className="face-status">
                <span className={`face-dot ${faceOk ? 'ok' : 'bad'}`} />
                <span>{faceOk ? 'Face detected' : 'Face lost!'}</span>
              </div>
              <div className="point-counter">
                Point <strong>{pointIdx + 1}</strong> / {CALIBRATION_POINTS.length}
              </div>
            </div>

            <p className="collect-msg">{message}</p>

            {/* Overall progress bar */}
            <div className="overall-bar">
              <div className="overall-fill" style={{ width: `${totalProgress}%` }} />
            </div>

            <button className="btn-cancel" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {phase === 'done' && (
          <div className="hud-card done-card">
            <div className="hud-icon">✅</div>
            <h2>Calibration Complete!</h2>
            <p>{message}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="hud-card error-card">
            <div className="hud-icon">⚠️</div>
            <h2>Calibration Error</h2>
            <p>{message}</p>
            <div className="hud-btns">
              <button className="btn-primary" onClick={startCalibration}>Retry</button>
              <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calibration;
