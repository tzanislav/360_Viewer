import React, { useState } from "react";
import Panoviewer from "../Components/Panoviewer";
import ErrorBoundary from "../Components/ErrorBoundary";
import StartOverlay from "../Components/StartOverlay";

const Home = () => {
    const [showOverlay, setShowOverlay] = useState(true);

    const handleStart = () => {
        setShowOverlay(false);
    };

    return (
        <div>
            {showOverlay && <StartOverlay onStart={handleStart} />}
            <ErrorBoundary>
                <Panoviewer />
            </ErrorBoundary>
        </div>
    );
};
export default Home;