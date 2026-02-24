import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import Calibration from './components/Calibration';
import GazeControl from './components/GazeControl';
import AccuracyTest from './components/AccuracyTest';
import GazeTracker from './utils/gazeTracker';
import './App.css';

function App() {
  const [gazeTracker, setGazeTracker] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeTracker = async () => {
      setIsLoading(true);
      const tracker = new GazeTracker();
      const success = await tracker.initialize();
      
      if (success) {
        setGazeTracker(tracker);
        setIsInitialized(true);
      } else {
        console.error('Failed to initialize GazeTracker');
        alert('Failed to initialize gaze tracking. Please refresh the page.');
      }
      setIsLoading(false);
    };

    initializeTracker();

    return () => {
      if (gazeTracker) {
        gazeTracker.dispose();
      }
    };
  }, []);

  // Initialize WebGazer.js for eye-gaze tracking (if available)
  // The CDN script may still be loading when React mounts, so we poll briefly.
  useEffect(() => {
    let ended = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 15; // ~3 seconds total

    const tryInit = () => {
      if (ended) return;
      if (typeof window === 'undefined') return;

      if (!window.webgazer) {
        if (attempts < MAX_ATTEMPTS) {
          attempts++;
          setTimeout(tryInit, 200);
        } else {
          console.warn('[GazeAssist] WebGazer.js not available – using Python backend only.');
        }
        return;
      }

      try {
        window.webgazer
          .showVideo(false)
          .showFaceOverlay(false)
          .showPredictionPoints(false)
          .setGazeListener(() => {})
          .begin();
        console.log('[GazeAssist] WebGazer initialised successfully.');
      } catch (err) {
        console.warn('[GazeAssist] WebGazer init failed (non-fatal):', err.message);
      }
    };

    tryInit();

    return () => {
      ended = true;
      try {
        if (window.webgazer && typeof window.webgazer.end === 'function') {
          window.webgazer.end();
        }
      } catch (_) {}
    };
  }, []);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <div className="spinner"></div>
          <h2>Initializing GazeAssist...</h2>
          <p>Loading AI models for face and hand tracking</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
            path="/calibration" 
            element={
              <CalibrationWrapper 
                gazeTracker={gazeTracker} 
                isInitialized={isInitialized} 
              />
            } 
          />
          <Route 
            path="/gaze-control" 
            element={
              <GazeControlWrapper 
                gazeTracker={gazeTracker} 
                isInitialized={isInitialized} 
              />
            } 
          />
          <Route
            path="/accuracy-test"
            element={
              <AccuracyTestWrapper
                gazeTracker={gazeTracker}
                isInitialized={isInitialized}
              />
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

function Navigation() {
  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/" className="logo-link">
          <img src="/logo.jpg" alt="GazeAssist Logo" className="logo" />
          <div className="brand-info">
            <div className="brand">GazeAssist</div>
            <div className="tagline">Unlock the power of gaze</div>
          </div>
        </Link>
      </div>

      <ul className="nav-links">
        <li><Link to="/">Home</Link></li>
        <li><Link to="/calibration">Calibration</Link></li>
        <li><Link to="/gaze-control">Gaze Control</Link></li>
        <li><Link to="/accuracy-test">Accuracy Test</Link></li>
      </ul>

      <div className="nav-right">
        <button className="btn-sign">Sign In</button>
      </div>
    </nav>
  );
}

function CalibrationWrapper({ gazeTracker, isInitialized }) {
  const navigate = useNavigate();

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <h2>GazeTracker not initialized</h2>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <Calibration
      gazeTracker={gazeTracker}
      onComplete={() => navigate('/gaze-control')}
      onCancel={() => navigate('/')}
    />
  );
}

function AccuracyTestWrapper({ gazeTracker, isInitialized }) {
  const navigate = useNavigate();

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <h2>GazeTracker not initialized</h2>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  if (!gazeTracker.isCalibrated) {
    return (
      <div className="loading-screen">
        <h2>Please calibrate first</h2>
        <p>Calibration is required before running the accuracy test</p>
        <button className="cta-primary" onClick={() => navigate('/calibration')}>
          Start Calibration
        </button>
      </div>
    );
  }

  return (
    <AccuracyTest
      gazeTracker={gazeTracker}
      onBack={() => navigate('/gaze-control')}
    />
  );
}

function GazeControlWrapper({ gazeTracker, isInitialized }) {
  const navigate = useNavigate();

  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <h2>GazeTracker not initialized</h2>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <GazeControl
      gazeTracker={gazeTracker}
      onRecalibrate={() => navigate('/calibration')}
    />
  );
}

export default App;
