"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface TerminalTextProps {
  commands: string[];
  speed?: number;
}

const TerminalText: React.FC<TerminalTextProps> = ({ commands, speed = 50 }) => {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (currentLineIndex >= commands.length) {
      // Loop back to the beginning after a delay
      const timer = setTimeout(() => {
        setCurrentLineIndex(0);
        setDisplayText('');
      }, 2000);
      return () => clearTimeout(timer);
    }

    const fullCommand = commands[currentLineIndex];
    let currentIndex = 0;
    setIsTyping(true);

    const typingInterval = setInterval(() => {
      if (currentIndex < fullCommand.length) {
        setDisplayText((prev) => prev + fullCommand.charAt(currentIndex));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
        // Wait a bit before moving to the next command
        setTimeout(() => {
          setCurrentLineIndex((prev) => prev + 1);
          setDisplayText('');
        }, 1000);
      }
    }, speed);

    return () => clearInterval(typingInterval);
  }, [currentLineIndex, commands, speed]);

  return (
    <div className="font-mono text-green-500 text-lg md:text-2xl p-4 bg-black/50 backdrop-blur-sm border border-green-500/30 rounded-md shadow-lg shadow-green-500/20 max-w-2xl mx-auto w-full">
      <div className="flex items-center space-x-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-red-500/50" />
        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
        <div className="w-3 h-3 rounded-full bg-green-500/50" />
        <span className="text-xs text-green-500/50 ml-2">bash — 80x24</span>
      </div>
      <div className="min-h-[1.5em]">
        <span className="text-green-700 mr-2">guest@hacker:~$</span>
        <span>{displayText}</span>
        {isTyping && <span className="inline-block w-2 h-5 ml-1 bg-green-500 animate-pulse" />}
      </div>
    </div>
  );
};

export default TerminalText;
