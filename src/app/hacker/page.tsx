"use client";

import React from 'react';
import MatrixRain from '@/components/MatrixRain';
import TerminalText from '@/components/TerminalText';
import GlitchOverlay from '@/components/GlitchOverlay';
import { motion } from 'framer-motion';

const commands = [
  "Initializing connection to remote host...",
  "Bypassing firewall...",
  "Accessing mainframe...",
  "Decrypting database credentials...",
  "Root access granted.",
  "Downloading sensitive data...",
  "Transferring files to /tmp/data...",
  "Cleaning up logs...",
  "Connection closed. Goodbye.",
];

const HackerPage = () => {
  return (
    <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-black">
      <MatrixRain color="#00FF00" />
      <GlitchOverlay />
      
      <div className="relative z-10 w-full flex flex-col items-center justify-center px-4">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-4xl md:text-6xl font-black mb-8 text-green-500 tracking-tighter uppercase italic"
          style={{ textShadow: '0 0 10px rgba(0, 255, 0, 0.7), 0 0 20px rgba(0, 255, 0, 0.5)' }}
        >
          System Breach Detected
        </motion.h1>

        <TerminalText commands={commands} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 15, duration: 1 }}
          className="mt-8 text-green-500/40 text-sm font-mono"
        >
          &copy; 1994-2026 CYBER_NETWORKS_INC. ALL RIGHTS RESERVED.
        </motion.div>
      </div>

      {/* Decorative corner elements */}
      <div className="fixed top-4 left-4 text-green-500/30 font-mono text-xs">
        [ STATUS: ACTIVE ]<br />
        [ NODE: 0x4F2A ]
      </div>
      <div className="fixed top-4 right-4 text-green-500/30 font-mono text-xs text-right">
        [ UPTIME: 00:42:09 ]<br />
        [ LATENCY: 12ms ]
      </div>
      <div className="fixed bottom-4 left-4 text-green-500/30 font-mono text-xs">
        [ CPU: 98% ]
      </div>
      <div className="fixed bottom-4 right-4 text-green-500/30 font-mono text-xs text-right">
        [ MEM: 64GB ]<br />
        [ THREAT: HIGH ]
      </div>
    </main>
  );
};

export default HackerPage;
