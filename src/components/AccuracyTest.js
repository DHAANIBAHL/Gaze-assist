import React, { useEffect, useRef, useState } from 'react';
import './AccuracyTest.css';

const AccuracyTest = ({ gazeTracker, onBack }) => {
  const [gazePoint, setGazePoint] = useState(null);
  const animationFrameRef = useRef(null);

  // Use the same 3x3 grid as calibration for targets
  const targets = [
    { id: 1, x: 0.1, y: 0.1 },
    { id: 2, x: 0.5, y: 0.1 },
    { id: 3, x: 0.9, y: 0.1 },
    { id: 4, x: 0.1, y: 0.5 },
    { id: 5, x: 0.5, y: 0.5 },
    { id: 6, x: 0.9, y: 0.5 },
    { id: 7, x: 0.1, y: 0.9 },
    { id: 8, x: 0.5, y: 0.9 },
    { id: 9, x: 0.9, y: 0.9 },
  ];

  useEffect(() => {
    const track = async () => {
      if (!gazeTracker) {
        animationFrameRef.current = requestAnimationFrame(track);
        return;
      }

      try {
        const hasWebgazer =
          typeof window !== 'undefined' &&
          window.webgazer &&
          typeof window.webgazer.getCurrentPrediction === 'function';

        if (hasWebgazer) {
          const prediction = await window.webgazer.getCurrentPrediction();
          if (prediction) {
            const rawGaze = {
              x: prediction.x / window.innerWidth,
              y: prediction.y / window.innerHeight,
              rawX: prediction.x,
              rawY: prediction.y,
            };

            const mapped = gazeTracker.mapGazeToScreen(
              rawGaze,
              window.innerWidth,
              window.innerHeight
            );

            setGazePoint(mapped);
          }
        }
      } catch (error) {
        console.error('AccuracyTest tracking error:', error);
      }

      animationFrameRef.current = requestAnimationFrame(track);
    };

    track();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gazeTracker]);

  let nearestTarget = null;
  let distancePx = null;

  if (gazePoint) {
    const absoluteTargets = targets.map((t) => ({
      ...t,
      absX: t.x * window.innerWidth,
      absY: t.y * window.innerHeight,
    }));

    absoluteTargets.forEach((t) => {
      const dx = gazePoint.x - t.absX;
      const dy = gazePoint.y - t.absY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (!nearestTarget || d < distancePx) {
        nearestTarget = t;
        distancePx = d;
      }
    });
  }

  return (
    <div className="accuracy-container">
      <div className="accuracy-overlay">
        {targets.map((point) => (
          <div
            key={point.id}
            className="accuracy-target"
            style={{
              left: `${point.x * 100}%`,
              top: `${point.y * 100}%`,
            }}
          >
            <div className="target-outer">
              <div className="target-inner">{point.id}</div>
            </div>
          </div>
        ))}

        {gazePoint && (
          <div
            className="accuracy-gaze-point"
            style={{ left: `${gazePoint.x}px`, top: `${gazePoint.y}px` }}
          />
        )}
      </div>

      <div className="accuracy-info">
        <div className="info-card">
          <h2>Accuracy Test</h2>
          <p>Look at each numbered circle. The blue dot shows where the system thinks you are looking.</p>

          <div className="metrics">
            <div className="metric-row">
              <span className="metric-label">Gaze (px):</span>
              <span className="metric-value">
                {gazePoint
                  ? `${Math.round(gazePoint.x)}, ${Math.round(gazePoint.y)}`
                  : 'No gaze yet'}
              </span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Nearest target:</span>
              <span className="metric-value">
                {nearestTarget ? `#${nearestTarget.id}` : 'N/A'}
              </span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Distance to target:</span>
              <span className="metric-value">
                {distancePx != null ? `${Math.round(distancePx)} px` : 'N/A'}
              </span>
            </div>
          </div>

          <div className="actions">
            <button className="btn-secondary" onClick={onBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccuracyTest;
