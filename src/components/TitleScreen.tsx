/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { GameMode } from '../types/game';
import { Wind, Users, Crown, Play } from 'lucide-react';

interface TitleScreenProps {
  onStart: (mode: GameMode) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart }) => {
  const [selectedMode, setSelectedMode] = React.useState<GameMode>('colony_active');

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        e.preventDefault();
        onStart(selectedMode);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedMode, onStart]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-6 md:p-12 bg-gradient-to-t from-stone-950/92 via-stone-950/45 to-stone-950/25">
      {/* Top Brand & Biological Note */}
      <div className="flex items-center gap-3 text-xs tracking-widest uppercase text-amber-400 font-semibold">
        <span>WebAssembly Physics</span>
        <span>·</span>
        <span>Macro Microcosm</span>
        <span>·</span>
        <span>Real-Time Hive Simulation</span>
      </div>

      {/* Hero Title Lockup with Bespoke SVG */}
      <div className="flex flex-col items-center text-center max-w-2xl my-auto">
        {/* Bespoke Geometric Bee Silhouette / Hexagon SVG */}
        <div className="mb-4">
          <svg width="72" height="72" viewBox="0 0 100 100" fill="none" className="text-amber-500 drop-shadow-lg">
            <polygon points="50 5, 90 27.5, 90 72.5, 50 95, 10 72.5, 10 27.5" stroke="currentColor" strokeWidth="4" fill="rgba(245, 158, 11, 0.15)" />
            {/* Minimalist Bee Wings & Abdomen */}
            <path d="M50 32 Q32 20 25 35 Q30 50 48 42" stroke="#FDE68A" strokeWidth="3" fill="rgba(254, 243, 199, 0.3)" />
            <path d="M50 32 Q68 20 75 35 Q70 50 52 42" stroke="#FDE68A" strokeWidth="3" fill="rgba(254, 243, 199, 0.3)" />
            <ellipse cx="50" cy="45" rx="7" ry="10" fill="#78350F" />
            <ellipse cx="50" cy="64" rx="9" ry="16" fill="#D97706" />
            <line x1="42" y1="58" x2="58" y2="58" stroke="#1C1917" strokeWidth="2.5" />
            <line x1="41" y1="64" x2="59" y2="64" stroke="#1C1917" strokeWidth="2.5" />
            <line x1="43" y1="70" x2="57" y2="70" stroke="#1C1917" strokeWidth="2.5" />
            <polygon points="50 82, 48 88, 52 88" fill="#1C1917" />
          </svg>
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold text-stone-100 tracking-tight font-['Plus_Jakarta_Sans',sans-serif] drop-shadow-md">
          APIS: MICROCOSM
        </h1>

        <p className="mt-3 text-stone-300 text-sm md:text-base max-w-lg leading-relaxed drop-shadow">
          Experience flight at a 15-millimeter scale. Soar through towering clover meadows, gather nectar, defend against predatory wasps, and construct the hive comb.
        </p>

        {/* Mode Selector */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
          <button
            onClick={() => setSelectedMode('colony_active')}
            className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
              selectedMode === 'colony_active'
                ? 'bg-amber-600/30 border-amber-500 text-white shadow-lg'
                : 'bg-stone-900/75 border-stone-800 text-stone-400 hover:border-stone-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-stone-100">
              <Users className="w-4 h-4 text-amber-400" />
              <span>Colony Simulation</span>
            </div>
            <div className="mt-1 text-xs text-stone-300 leading-snug">
              Control Forager, Guard, Builder, and Queen inside an established hive.
            </div>
          </button>

          <button
            onClick={() => setSelectedMode('spring_founding')}
            className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
              selectedMode === 'spring_founding'
                ? 'bg-amber-600/30 border-amber-500 text-white shadow-lg'
                : 'bg-stone-900/75 border-stone-800 text-stone-400 hover:border-stone-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-stone-100">
              <Crown className="w-4 h-4 text-yellow-400" />
              <span>Spring Founding</span>
            </div>
            <div className="mt-1 text-xs text-stone-300 leading-snug">
              Emerge post-winter as a lone queen to scout a cavity, build initial comb, and lay eggs.
            </div>
          </button>

          <button
            onClick={() => setSelectedMode('swarm_migration')}
            className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${
              selectedMode === 'swarm_migration'
                ? 'bg-amber-600/30 border-amber-500 text-white shadow-lg'
                : 'bg-stone-900/75 border-stone-800 text-stone-400 hover:border-stone-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-stone-100">
              <Wind className="w-4 h-4 text-amber-300" />
              <span>Swarm Migration</span>
            </div>
            <div className="mt-1 text-xs text-stone-300 leading-snug">
              Lead a migrating swarm queen with loyal workers across the meadow to establish a new oak nest.
            </div>
          </button>
        </div>

        {/* Primary Start Button */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            onClick={() => onStart(selectedMode)}
            className="flex items-center gap-2.5 px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-2xl transition-transform active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Take Flight (Enter / Space)</span>
          </button>
        </div>
      </div>

      {/* Control-Hint Footer Line */}
      <div className="text-xs text-stone-400 font-mono tracking-tight drop-shadow">
        WASD Flight Thrust · Space Context Action · Q/E Altitude · Shift Sprint · 1-4 Caste Switch · H Zen Mode
      </div>
    </div>
  );
};
