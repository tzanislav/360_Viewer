import React from 'react';
import { Link } from 'react-router-dom';
import '../CSS/Navigation.css';

const Navigation = () => {
    return (
        <nav className="navigation">
            <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/projects">Projects</Link></li>
                <li><Link to="/projects/editor">Project Editor</Link></li>
                <li><Link to="/about">About</Link></li>
                <li><Link to="/panophotos">Pano Photos</Link></li>
            </ul>
        </nav>
    );
};

export default Navigation;