import './CSS/App.css';
import React from 'react';
//react router
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Pages/Home';
import PanophotoList from './Pages/PanophotoList';
import Panoviewer from './Pages/Panoviewer';
import ProjectEditor from './Pages/ProjectEditor';
import Projects from './Pages/Projects';
import Navigation from './Components/Navigation';


function App() {
  return (
    <Router>
      <div className="App">
      
        <Navigation />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/panophotos" element={<PanophotoList />} />
          <Route path="/viewer" element={<Panoviewer />} />
          <Route path="/projects/editor" element={<ProjectEditor />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
