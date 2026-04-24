"use client";

import React from 'react';

const GlitchOverlay: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Scanlines */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{
          background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 2px, 3px 100%'
        }}
      />
      
      {/* CRT Flicker effect */}
      <div className="absolute inset-0 animate-pulse opacity-10 bg-white" />

      {/* Glitch lines */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-full h-[1px] bg-green-500/20 top-1/4 animate-glitch-line" />
        <div className="absolute w-full h-[1px] bg-green-500/10 top-1/2 animate-[glitch-line_7s_infinite]" />
        <div className="absolute w-full h-[1px] bg-green-500/20 top-3/4 animate-[glitch-line_5s_infinite]" />
      </div>
    </div>
  );
};

export default GlitchOverlay;
