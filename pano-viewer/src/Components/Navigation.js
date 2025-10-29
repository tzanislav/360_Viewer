import React from 'react';
import '../CSS/Navigation.css';

const Navigation = () => {
    return (
        <nav className="navigation">
            <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/projects">Projects</a></li>
                <li><a href="/about">About</a></li>
            </ul>
        </nav>
    );
};

export default Navigation;