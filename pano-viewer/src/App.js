import './CSS/App.css';
import React from 'react';
//react router
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Pages/Home';
import UploadTest from './Pages/UploadTest';
import PanophotoList from './Pages/PanophotoList';
import Panoviewer from './Components/Panoviewer';
import Navigation from './Components/Navigation';


function App() {
  return (
    <Router>
      <div className="App">
      
        <Navigation />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload-test" element={<UploadTest />} />
          <Route path="/panophotos" element={<PanophotoList />} />
          <Route path="/viewer" element={<Panoviewer />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
