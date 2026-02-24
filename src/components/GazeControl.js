import React, { useEffect, useRef, useState, useCallback } from 'react';
import './GazeControl.css';

const PYTHON_BACKEND = 'http://localhost:5001';
const DWELL_TIME_MS = 1400;  // ms hold to trigger click
const DWELL_RADIUS = 45;    // px radius for dwell zone

// ── Helpers ───────────────────────────────────────────────────────────────────
const dist2D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function classifyHandGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;

  const thumbTip = landmarks[4], indexTip = landmarks[8];
  const middleTip = landmarks[12], ringTip = landmarks[16], pinkyTip = landmarks[20];
  const wrist = landmarks[0];
  const indexMcp = landmarks[5], middleMcp = landmarks[9];
  const ringMcp = landmarks[13], pinkyMcp = landmarks[17];

  const pinchDist = dist2D(thumbTip, indexTip);
  const palmSpan = (dist2D(wrist, indexTip) + dist2D(wrist, middleTip) +
    dist2D(wrist, ringTip) + dist2D(wrist, pinkyTip)) / 4;

  if (palmSpan > 0 && pinchDist < palmSpan * 0.28) return 'pinch';

  const fingersExtended =
    indexTip.y < indexMcp.y &&
    middleTip.y < middleMcp.y &&
    ringTip.y < ringMcp.y &&
    pinkyTip.y < pinkyMcp.y;

  if (fingersExtended && palmSpan > 0.15 && pinchDist > palmSpan * 0.4) return 'palm';
  return null;
}

// ── Circumference constant ────────────────────────────────────────────────────
const R = 22;
const CIRCUM = 2 * Math.PI * R;

// ── Component ─────────────────────────────────────────────────────────────────
const GazeControl = ({ gazeTracker, onRecalibrate }) => {
  // React state – only for HUD elements (infrequently updated)
  const [faceDetected, setFaceDetected] = useState(false);
  const [gesture, setGesture] = useState(null);
  const [backendOk, setBackendOk] = useState(false);

  // DOM refs for high-frequency cursor updates (no re-renders)
  const cursorWrapRef = useRef(null);  // gaze-cursor wrapper
  const dwellSvgRef = useRef(null);  // dwell SVG container
  const dwellFillRef = useRef(null);  // dwell progress circle
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const handsRef = useRef(null);  // last JS gesture result

  // Tracking refs
  const dwellStartRef = useRef(null);
  const lastPosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const gestureTimerRef = useRef(null);
  const gestureActiveRef = useRef(null); // avoid repeated fires for same gesture

  // ── Low-level cursor move (direct DOM, zero React overhead) ──────────────────
  const moveCursor = useCallback((x, y) => {
    if (!cursorWrapRef.current) return;
    cursorWrapRef.current.style.transform =
      `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
  }, []);

  // ── Dwell ring update ─────────────────────────────────────────────────────────
  const setDwellRing = useCallback((progress) => {
    if (!dwellSvgRef.current || !dwellFillRef.current) return;
    if (progress <= 0) {
      dwellSvgRef.current.style.opacity = '0';
      return;
    }
    dwellSvgRef.current.style.opacity = '1';
    dwellFillRef.current.style.strokeDashoffset = `${CIRCUM * (1 - progress / 100)}`;
  }, []);

  // ── Click simulation ──────────────────────────────────────────────────────────
  const simulateClick = useCallback((px) => {
    const ripple = document.createElement('div');
    ripple.className = 'click-ripple';
    ripple.style.left = `${px.x}px`;
    ripple.style.top = `${px.y}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);

    const target = document.elementFromPoint(px.x, px.y);
    if (target && target !== cursorWrapRef.current &&
      !cursorWrapRef.current?.contains(target)) {
      target.click();
    }
  }, []);

  // ── Dwell detection ───────────────────────────────────────────────────────────
  const handleDwell = useCallback((px) => {
    if (!dwellStartRef.current) {
      dwellStartRef.current = { px, t: Date.now() };
      setDwellRing(0);
      return;
    }

    const moved = dist2D(px, dwellStartRef.current.px);
    if (moved > DWELL_RADIUS) {
      dwellStartRef.current = { px, t: Date.now() };
      setDwellRing(0);
      return;
    }

    const elapsed = Date.now() - dwellStartRef.current.t;
    const progress = Math.min((elapsed / DWELL_TIME_MS) * 100, 100);
    setDwellRing(progress);

    if (progress >= 100) {
      simulateClick(px);
      // brief lockout
      dwellStartRef.current = { px, t: Date.now() + 700 };
      setDwellRing(0);
    }
  }, [setDwellRing, simulateClick]);

  // ── Camera init (for local hand detection video element) ─────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        console.warn('Camera error (non-fatal):', e.message);
      }
    })();

    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Local MediaPipe Hands fallback (JS) ───────────────────────────────────────
  useEffect(() => {
    if (!window.Hands) return;
    let active = true;

    const waitForVideo = setInterval(() => {
      if (!videoRef.current?.readyState >= 2) return;
      clearInterval(waitForVideo);

      const hands = new window.Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`,
      });
      hands.setOptions({
        maxNumHands: 1, modelComplexity: 0,
        minDetectionConfidence: 0.65, minTrackingConfidence: 0.55,
      });
      hands.onResults(res => {
        handsRef.current = res.multiHandLandmarks?.length
          ? classifyHandGesture(res.multiHandLandmarks[0])
          : null;
      });

      const loop = async () => {
        if (!active || !videoRef.current) return;
        try { await hands.send({ image: videoRef.current }); } catch (_) { }
        if (active) requestAnimationFrame(loop);
      };
      loop();

      return () => { active = false; hands.close?.(); };
    }, 500);

    return () => { active = false; clearInterval(waitForVideo); };
  }, []);

  // ── Python backend WebSocket ──────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      if (!window.io) {
        await new Promise((res, rej) => {
          const s = document.createElement('script');
          s.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      if (!mounted) return;

      const socket = window.io(PYTHON_BACKEND, {
        transports: ['websocket'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        if (!mounted) return;
        setBackendOk(true);
        socket.emit('start_tracking');
        console.log('[GazeControl] Python backend connected');
      });

      socket.on('disconnect', () => {
        if (!mounted) return;
        setBackendOk(false);
        setFaceDetected(false);
        setDwellRing(0);
      });

      socket.on('connect_error', () => {
        if (!mounted) return;
        setBackendOk(false);
      });

      socket.on('gaze_data', (data) => {
        if (!mounted) return;

        // ── Update face status indicator ─────────────────────────────────────
        setFaceDetected(prev => {
          if (prev !== data.faceDetected) return data.faceDetected;
          return prev;
        });

        // ── Map gaze → screen pixels ─────────────────────────────────────────
        let sx, sy;
        if (gazeTracker?.isCalibrated) {
          sx = data.gazeX * window.innerWidth;
          sy = data.gazeY * window.innerHeight;
        } else if (gazeTracker) {
          const mapped = gazeTracker.mapGazeToScreen(
            { x: data.gazeX, y: data.gazeY, rawX: data.gazeX, rawY: data.gazeY },
            window.innerWidth, window.innerHeight
          );
          sx = mapped.x; sy = mapped.y;
        } else {
          sx = data.gazeX * window.innerWidth;
          sy = data.gazeY * window.innerHeight;
        }

        const px = { x: sx, y: sy };
        lastPosRef.current = px;

        // Move cursor (direct DOM – no state update)
        moveCursor(sx, sy);

        // Dwell
        if (data.faceDetected) {
          handleDwell(px);
        } else {
          dwellStartRef.current = null;
          setDwellRing(0);
        }

        // ── Gesture handling ─────────────────────────────────────────────────
        const finalGesture = data.gesture || handsRef.current || null;

        if (finalGesture && finalGesture !== gestureActiveRef.current) {
          gestureActiveRef.current = finalGesture;
          setGesture(finalGesture);
          clearTimeout(gestureTimerRef.current);

          if (finalGesture === 'pinch') {
            simulateClick(lastPosRef.current);
          } else if (finalGesture === 'palm' && typeof onRecalibrate === 'function') {
            onRecalibrate();
          }

          gestureTimerRef.current = setTimeout(() => {
            gestureActiveRef.current = null;
            setGesture(null);
          }, 900);
        }
      });
    };

    connect().catch(err => console.error('Socket connect error:', err));

    return () => {
      mounted = false;
      socketRef.current?.emit('stop_tracking');
      socketRef.current?.disconnect();
      clearTimeout(gestureTimerRef.current);
    };
  }, [gazeTracker, handleDwell, moveCursor, setDwellRing, simulateClick, onRecalibrate]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="gaze-ctrl-root">
      {/* Hidden camera feed for local hand gesture detection */}
      <video ref={videoRef} className="cam-preview" playsInline muted />

      {/* ── Status bar ── */}
      <div className="gc-status-bar">
        <div className="gc-badge">
          <span className={`gc-dot ${faceDetected ? 'ok' : 'off'}`} />
          <span>{faceDetected ? 'Eyes Tracked' : 'No Face Detected'}</span>
        </div>

        <div className="gc-badge">
          <span className={`gc-dot ${backendOk ? 'ok' : 'warn'}`} />
          <span>{backendOk ? 'Tracker Active' : 'Connecting…'}</span>
        </div>

        {gesture && (
          <div className="gc-badge gesture">
            <span>{gesture === 'pinch' ? '🤏' : '✋'} {gesture.toUpperCase()}</span>
          </div>
        )}

        <button className="gc-recalib-btn" onClick={onRecalibrate}>
          ↺ Recalibrate
        </button>
      </div>

      {/* ── Info panel ── */}
      <div className="gc-info-panel">
        <h2>Gaze Control Active</h2>
        <p>Look around to move the cursor</p>
        <ul className="gc-instructions">
          <li><span className="ic">👁️</span> Hold gaze for 1.4 s to click</li>
          <li><span className="ic">🤏</span> Pinch gesture for instant click</li>
          <li><span className="ic">✋</span> Open palm to recalibrate</li>
        </ul>
      </div>

      {/* ── Gaze cursor (positioned via direct DOM in moveCursor) ── */}
      <div
        ref={cursorWrapRef}
        className="gaze-cursor"
        style={{ position: 'fixed', left: 0, top: 0, willChange: 'transform' }}
      >
        <div className="cursor-core" />

        {/* Dwell ring SVG (shown/hidden via opacity in setDwellRing) */}
        <svg
          ref={dwellSvgRef}
          className="dwell-svg"
          viewBox="0 0 50 50"
          style={{ opacity: 0 }}
        >
          <circle className="dwell-bg" cx="25" cy="25" r={R} />
          <circle
            ref={dwellFillRef}
            className="dwell-fill"
            cx="25" cy="25" r={R}
            strokeDasharray={CIRCUM}
            strokeDashoffset={CIRCUM}
          />
        </svg>
      </div>
    </div>
  );
};

export default GazeControl;
