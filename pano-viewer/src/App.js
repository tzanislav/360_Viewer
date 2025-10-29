import './CSS/App.css';
import React from 'react';
//react router
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Pages/Home';
import Navigation from './Components/Navigation';


function App() {
  return (
    <Router>
      <div className="App">
      
        <Navigation />

        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
