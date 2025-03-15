// src/App.js
import React, { useEffect, useState } from 'react';
import './App.css';
import DroneChoirPerformer from './DroneChoirPerformer';
import TenorPage from './TenorPage';

function App() {
  const [currentView, setCurrentView] = useState('main');
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const voice = params.get('voice');
    
    if (voice === 'tenor') {
      setCurrentView('tenor');
    } else {
      setCurrentView('main');
    }
  }, []);
  
  return (
    <div className="App">
      {currentView === 'tenor' ? (
        <TenorPage />
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