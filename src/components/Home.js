import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* Hero Section */}
      <header className="hero">
        <div className="hero-content">
          <span className="eye-label">Unlock the Power of Your Gaze</span>
          <h1>Hands-free control with smart eye-tracking</h1>
          <p>
            Experience hands-free digital control with advanced AI-driven gaze tracking.
            Calibrate in seconds and navigate apps, communication boards and the web using only your eyes.
          </p>
          <div className="hero-ctas">
            <button className="cta-primary" onClick={() => navigate('/calibration')}>
              Start Calibration
            </button>
            <button 
              className="cta-ghost" 
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
            >
              Learn More
            </button>
          </div>
        </div>
        <div className="hero-card">
          <h4>Quick calibration</h4>
          <p>Start a 10-second calibration to personalize gaze mapping for accurate control across lighting conditions.</p>
        </div>
      </header>

      {/* Features Section */}
      <main className="features-section" id="features">
        <div className="features-header">
          <h2>Why GazeAssist?</h2>
          <p>Designed to empower users with dependable, accessible gaze-based control.</p>
        </div>

        <div className="features-grid">
          <div className="feature">
            <div className="icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M11 4a7 7 0 100 14 7 7 0 000-14z" stroke="#0a3d62" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M21 21l-4.35-4.35" stroke="#0a3d62" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h3>Enhanced Clarity</h3>
              <p>Robust gaze detection with noise filtering for accurate cursor and control mapping.</p>
            </div>
          </div>

          <div className="feature">
            <div className="icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v12" stroke="#0a3d62" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 7l4-4 4 4" stroke="#0a3d62" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="13" width="18" height="7" rx="2" stroke="#0a3d62" strokeWidth="1.6"/>
              </svg>
            </div>
            <div>
              <h3>Seamless Navigation</h3>
              <p>Navigate apps and web pages with simple fixation and dwell gestures — no touch required.</p>
            </div>
          </div>

          <div className="feature">
            <div className="icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v18" stroke="#0a3d62" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 7a4 4 0 00-4 4v2a4 4 0 004 4" stroke="#0a3d62" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 7a4 4 0 014 4v2a4 4 0 01-4 4" stroke="#0a3d62" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h3>Inclusive Design</h3>
              <p>Created with accessibility standards in mind so everyone can interact independently.</p>
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="how-it-works">
          <h2>How It Works</h2>
          <div className="steps-grid">
            <div className="step-card">
              <img src="/step1.svg" alt="Position camera" />
              <h3>1. Position Your Camera</h3>
              <p>Place your camera at eye level for best tracking accuracy.</p>
            </div>
            <div className="step-card">
              <img src="/step2.svg" alt="Proper lighting" />
              <h3>2. Ensure Proper Lighting</h3>
              <p>Avoid strong backlight and keep your face clearly visible.</p>
            </div>
            <div className="step-card">
              <img src="/step3.svg" alt="Follow calibration" />
              <h3>3. Follow Calibration Points</h3>
              <p>Look at each point until the circle completes.</p>
            </div>
            <div className="step-card">
              <img src="/step4.svg" alt="Start tracking" />
              <h3>4. Start Using Gaze Control</h3>
              <p>Move your eyes to control the cursor naturally.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} GazeAssist • Built with accessibility in mind.</p>
      </footer>
    </div>
  );
};

export default Home;
