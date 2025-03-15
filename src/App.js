// src/App.js
import React, { useEffect, useState } from 'react';
import './App.css';
import DroneChoirPerformer from './DroneChoirPerformer';
import TenorPage from './TenorPage';
import AltoPage from './AltoPage';

function App() {
  const [currentView, setCurrentView] = useState('main');
  
  // Check URL parameters on component mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const voice = params.get('voice');
    
    if (voice === 'tenor') {
      setCurrentView('tenor');
    } else if (voice === 'alto') {
      setCurrentView('alto');
    } else {
      setCurrentView('main');
    }
  }, []);
  
  // Render the appropriate view based on the URL parameter
  return (
    <div className="App">
      {currentView === 'tenor' ? (
        <TenorPage />
      ) : currentView === 'alto' ? (
        <AltoPage />
      ) : (
        <>
          <header className="App-header">
            <h1>Transmission Performance System</h1>
          </header>
          <main>
            <DroneChoirPerformer />
          </main>
          <footer>
            <p>Transmission - 2025</p>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;