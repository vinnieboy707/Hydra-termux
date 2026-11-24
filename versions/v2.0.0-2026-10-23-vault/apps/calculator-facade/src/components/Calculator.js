import React, { useState } from 'react';
import { useSequenceDetector } from '../hooks/useSequenceDetector';

const Calculator = ({ onUnlock }) => {
    const [display, setDisplay] = useState('0');
    const { addInput } = useSequenceDetector(['1', '3', '3', '7'], onUnlock);

    const handleButtonClick = (value) => {
        setDisplay(prev => prev === '0' ? value : prev + value);
        addInput(value);
    };

    return (
        <div className="calculator p-4 bg-gray-800 rounded shadow-lg text-white">
            <div className="display mb-4 p-2 bg-black text-right text-2xl">{display}</div>
            <div className="grid grid-cols-4 gap-2">
                {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', 'C', '=', '+'].map(btn => (
                    <button 
                        key={btn} 
                        className="p-4 bg-gray-600 hover:bg-gray-500 rounded"
                        onClick={() => handleButtonClick(btn)}
                    >
                        {btn}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default Calculator;
