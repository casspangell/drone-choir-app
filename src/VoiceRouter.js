// File: src/VoiceRouter.js
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import TenorVoicePage from './TenorVoicePage';
import { VOICE_RANGES } from './voiceTypes';

// Components for other voice types - to be implemented
const BassVoicePage = () => <div>Bass Voice Page (Not Yet Implemented)</div>;
const AltoVoicePage = () => <div>Alto Voice Page (Not Yet Implemented)</div>;
const SopranoVoicePage = () => <div>Soprano Voice Page (Not Yet Implemented)</div>;

// Main app component that renders when no voice is specified
const MainApp = () => {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Transmission Performance System</h1>
      </header>
      <main>
        <h2>Voice Module Selection</h2>
        <div className="voice-module-links">
          <a href="/?voice=tenor" className="voice-link">Tenor Module</a>
          <a href="/?voice=bass" className="voice-link">Bass Module</a>
          <a href="/?voice=alto" className="voice-link">Alto Module</a>
          <a href="/?voice=soprano" className="voice-link">Soprano Module</a>
        </div>
      </main>
      <footer>
        <p>Transmission - 2025</p>
      </footer>
    </div>
  );
};

// Route handler that checks the URL query parameter
const VoiceRouteHandler = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const voiceType = params.get('voice');
  
  // Render the appropriate voice module based on the voice parameter
  switch (voiceType) {
    case 'tenor':
      return <TenorVoicePage />;
    case 'bass':
      return <BassVoicePage />;
    case 'alto':
      return <AltoVoicePage />;
    case 'soprano':
      return <SopranoVoicePage />;
    default:
      return <MainApp />;
  }
};

// Main router component
const VoiceRouter = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<VoiceRouteHandler />} />
      </Routes>
    </Router>
  );
};

export default VoiceRouter;