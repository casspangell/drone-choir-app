import React from 'react';
import './App.css';
import DroneChoirPerformer from './DroneChoirPerformer';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Drone Choir Performance System</h1>
      </header>
      <main>
        <DroneChoirPerformer />
      </main>
      <footer>
        <p>2025</p>
      </footer>
    </div>
  );
}

export default App;