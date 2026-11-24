import React, { useState } from 'react';
import Calculator from './components/Calculator';

function App() {
    const [mode, setMode] = useState('FACADE');

    const handleUnlock = () => {
        console.log('Unlock sequence detected! Transitioning to Elite Mode...');
        setMode('ELITE');
    };

    return (
        <div className="App min-h-screen bg-gray-900 flex items-center justify-center">
            {mode === 'FACADE' ? (
                <Calculator onUnlock={handleUnlock} />
            ) : (
                <div className="elite-mode text-white text-4xl">Chronos OS Elite Interface Loaded</div>
            )}
        </div>
    );
}

export default App;
