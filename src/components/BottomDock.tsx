/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BeeRole, WeatherType } from '../types/game';
import { ChevronDown, ChevronUp, Sun, Wind, CloudRain, Sparkles, Compass, Shield, Hammer, Crown } from 'lucide-react';

interface BottomDockProps {
  currentRole: BeeRole;
  onSelectRole: (role: BeeRole) => void;
  currentWeather: WeatherType;
  onSelectWeather: (weather: WeatherType) => void;
  onExpandComb: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  currentRole,
  onSelectRole,
  currentWeather,
  onSelectWeather,
  onExpandComb,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Keyboard shortcut 'H' to toggle dock
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat) {
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const roles: Array<{ id: BeeRole; label: string; key: string; icon: React.ReactNode }> = [
    { id: 'forager', label: 'Forager', key: '1', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'guard', label: 'Guard', key: '2', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'builder', label: 'Builder', key: '3', icon: <Hammer className="w-3.5 h-3.5" /> },
    { id: 'queen', label: 'Queen', key: '4', icon: <Crown className="w-3.5 h-3.5" /> },
  ];

  const weatherOptions: Array<{ id: WeatherType; label: string; icon: React.ReactNode }> = [
    { id: 'sunny', label: 'Sunny', icon: <Sun className="w-3.5 h-3.5" /> },
    { id: 'breezy', label: 'Breezy', icon: <Wind className="w-3.5 h-3.5" /> },
    { id: 'rain', label: 'Rain', icon: <CloudRain className="w-3.5 h-3.5" /> },
    { id: 'spring_thaw', label: 'Spring', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[min(940px,96vw)] w-full transition-all duration-300">
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="mb-1.5 flex items-center gap-1.5 px-3 py-1 bg-[#181410]/90 hover:bg-[#251F18] border border-amber-950/40 text-stone-300 hover:text-white rounded-t-lg text-[11px] font-medium shadow-md transition-colors cursor-pointer"
        aria-label={isCollapsed ? 'Show Controls' : 'Hide Controls'}
      >
        {isCollapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Show Dock [H]</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
            <span>Zen Mode [H]</span>
          </>
        )}
      </button>

      {/* Dock Content Body */}
      {!isCollapsed && (
        <div className="w-full bg-[#181410]/95 border border-amber-950/50 rounded-2xl p-2.5 md:p-3 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          {/* Left: Role Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-900/80 rounded-xl border border-stone-800">
            <span className="text-[11px] font-semibold text-stone-400 px-2 uppercase tracking-wider">
              Caste
            </span>
            {roles.map((r) => {
              const active = currentRole === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectRole(r.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-amber-600 text-stone-950 font-bold shadow-md'
                      : 'text-stone-300 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  {r.icon}
                  <span>{r.label}</span>
                  <span className={`text-[10px] ml-0.5 ${active ? 'text-stone-900' : 'text-stone-500'}`}>[{r.key}]</span>
                </button>
              );
            })}
          </div>

          {/* Center: Quick Comb Expand (for builders) */}
          {currentRole === 'builder' && (
            <button
              onClick={onExpandComb}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-300 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap"
            >
              <Hammer className="w-3.5 h-3.5 text-yellow-400" />
              <span>Expand Hex Comb [B]</span>
            </button>
          )}

          {/* Right: Weather Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-stone-900/80 rounded-xl border border-stone-800">
            <span className="text-[11px] font-semibold text-stone-400 px-2 uppercase tracking-wider">
              Weather
            </span>
            {weatherOptions.map((w) => {
              const active = currentWeather === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => onSelectWeather(w.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-stone-100 text-stone-900 font-bold shadow-md'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                >
                  {w.icon}
                  <span className="hidden sm:inline">{w.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Control hints */}
      <div className="mt-1 text-[11px] text-stone-400/90 font-mono tracking-tight drop-shadow">
        WASD Flight Thrust · Space Context Action · F Boost/Heal · Q/E Altitude · Shift Sprint
      </div>
    </div>
  );
};
