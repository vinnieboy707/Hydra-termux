import React, { useState, useEffect } from 'react';

export const useSequenceDetector = (sequence, onMatch) => {
    const [input, setInput] = useState([]);

    const addInput = (key) => {
        const nextInput = [...input, key];
        if (nextInput.length > sequence.length) {
            nextInput.shift();
        }
        setInput(nextInput);
    };

    useEffect(() => {
        if (JSON.stringify(input) === JSON.stringify(sequence)) {
            onMatch();
            setInput([]);
        }
    }, [input, sequence, onMatch]);

    return { addInput };
};
