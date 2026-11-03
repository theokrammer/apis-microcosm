/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PlayerBeeState, ColonyResources, WeatherType, GameMode } from '../types/game';
import { Volume2, VolumeX, Droplets, Sun, Wind, CloudRain, Sparkles, Shield, Compass, Hammer, Crown, LogOut, AlertTriangle, Heart } from 'lucide-react';

interface HUDProps {
  player: PlayerBeeState;
  colony: ColonyResources;
  weather: WeatherType;
  gameMode: GameMode;
  logMessage: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onActionClick: () => void;
  onQuitToMenu: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  player,
  colony,
  weather,
  gameMode,
  logMessage,
  isMuted,
  onToggleMute,
  onActionClick,
  onQuitToMenu,
}) => {
  let actionPrompt: { label: string; icon: React.ReactNode; active: boolean } = {
    label: 'Explore Meadow',
    icon: <Compass className="w-4 h-4" />,
    active: false,
  };

  if (player.role === 'guard') {
    actionPrompt = {
      label: 'Sting Attack [Space]',
      icon: <Shield className="w-4 h-4 text-rose-400" />,
      active: true,
    };
  } else if (player.nearFlowerId) {
    actionPrompt = {
      label: 'Sip Nectar & Pollen [Space]',
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      active: true,
    };
  } else if (player.nearHive && (player.nectarCarried > 0 || player.pollenCarried > 0)) {
    actionPrompt = {
      label: 'Deposit Resources [Space]',
      icon: <Droplets className="w-4 h-4 text-amber-500" />,
      active: true,
    };
  } else if (player.role === 'builder') {
    actionPrompt = {
      label: 'Expand Comb [Space / B]',
      icon: <Hammer className="w-4 h-4 text-yellow-300" />,
      active: true,
    };
  } else if (player.role === 'queen') {
    if (gameMode === 'spring_founding' && player.nearFoundingSite) {
      actionPrompt = {
        label: 'Found New Hive [Space]',
        icon: <Crown className="w-4 h-4 text-amber-300" />,
        active: true,
      };
    } else if (player.nearHive) {
      actionPrompt = {
        label: 'Lay Royal Egg [Space]',
        icon: <Crown className="w-4 h-4 text-amber-300" />,
        active: true,
      };
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-10">
      {/* TOP BAR: Perimeter Clusters */}
      <div className="flex items-start justify-between w-full">
        {/* Top-Left: Colony Vitality Cluster & Player Health */}
        <div className="pointer-events-auto bg-[#181410]/90 border border-amber-950/40 rounded-xl p-3.5 shadow-xl max-w-sm">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-amber-900/30">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400/90">
              {gameMode === 'spring_founding' ? 'Founding Queen' : 'Colony Hive Vitality'}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-mono">
              <Heart className="w-3.5 h-3.5 fill-current" />
              <span>{Math.round(player.health)}% HP</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div className="text-stone-400 text-[11px]">Honey</div>
              <div className="font-semibold text-amber-300 font-mono tabular-nums text-sm">
                {colony.honey} <span className="text-[10px] text-amber-500 font-sans">units</span>
              </div>
            </div>
            <div>
              <div className="text-stone-400 text-[11px]">Pollen</div>
              <div className="font-semibold text-yellow-400 font-mono tabular-nums text-sm">
                {colony.pollen} <span className="text-[10px] text-yellow-600 font-sans">units</span>
              </div>
            </div>
            <div>
              <div className="text-stone-400 text-[11px]">Wax</div>
              <div className="font-semibold text-amber-200 font-mono tabular-nums text-sm">
                {colony.wax} <span className="text-[10px] text-amber-400 font-sans">scales</span>
              </div>
            </div>
          </div>

          {/* Bee's personal payload */}
          <div className="mt-2.5 pt-2 border-t border-amber-900/20 flex items-center justify-between text-[11px]">
            <span className="text-stone-400">Pollen Baskets:</span>
            <div className="flex items-center gap-3">
              <span className="text-amber-300 font-mono tabular-nums">
                {player.nectarCarried}/30 Nectar
              </span>
              <span className="text-stone-600">·</span>
              <span className="text-yellow-400 font-mono tabular-nums">
                {player.pollenCarried}/20 Pollen
              </span>
            </div>
          </div>
        </div>

        {/* Top-Right: Weather, Telemetry, Audio & Main Menu Button */}
        <div className="pointer-events-auto flex items-start gap-2.5">
          <div className="bg-[#181410]/85 border border-stone-800/60 rounded-xl p-3 shadow-xl flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              {weather === 'sunny' && <Sun className="w-4 h-4 text-amber-400" />}
              {weather === 'breezy' && <Wind className="w-4 h-4 text-cyan-300" />}
              {weather === 'rain' && <CloudRain className="w-4 h-4 text-blue-400" />}
              {weather === 'spring_thaw' && <Sparkles className="w-4 h-4 text-purple-300" />}
              <span className="capitalize text-stone-200 font-medium">{weather.replace('_', ' ')}</span>
            </div>

            <div className="h-4 w-[1px] bg-stone-800" />

            <div className="flex items-center gap-2 font-mono tabular-nums text-stone-300">
              <span>{player.speed} <span className="text-[10px] text-stone-500">SPD</span></span>
              <span className="text-stone-600">·</span>
              <span>{player.altitude}m <span className="text-[10px] text-stone-500">ALT</span></span>
            </div>
          </div>

          <button
            onClick={onToggleMute}
            className="bg-[#181410]/85 hover:bg-[#251F18] border border-stone-800/60 text-stone-300 hover:text-white rounded-xl p-3 shadow-xl transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label="Toggle Audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          <button
            onClick={onQuitToMenu}
            className="bg-[#181410]/85 hover:bg-stone-900 border border-stone-800/60 text-stone-300 hover:text-amber-400 rounded-xl px-3 py-3 shadow-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-medium"
            title="Return to Main Menu (Esc)"
          >
            <LogOut className="w-4 h-4 text-stone-400" />
            <span className="hidden sm:inline font-mono">Menu [Esc]</span>
          </button>
        </div>
      </div>

      {/* CENTER HUD: Threat Warning, Reticle & Context Action Prompt */}
      <div className="self-center flex flex-col items-center gap-3">
        {/* Dynamic Ecological Threat Warning */}
        {player.threatWarning && (
          <div className="pointer-events-none px-4 py-2 bg-rose-950/90 border border-rose-500/80 text-rose-200 text-xs font-extrabold rounded-xl shadow-2xl flex items-center gap-2 tracking-wide uppercase animate-pulse">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{player.threatWarning}</span>
          </div>
        )}

        {/* Microscopic Flight Reticle */}
        <div className="w-6 h-6 border border-white/25 rounded-full flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-1.5 bg-amber-400/80 rounded-full" />
        </div>

        {/* Action button */}
        {actionPrompt.active && (
          <button
            onClick={onActionClick}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-900 font-bold text-xs uppercase tracking-wider rounded-lg shadow-2xl transition-transform active:scale-95 cursor-pointer"
          >
            {actionPrompt.icon}
            <span>{actionPrompt.label}</span>
          </button>
        )}
      </div>

      {/* BOTTOM-LEFT: Atmospheric Notification Log */}
      <div className="flex items-end justify-between w-full">
        <div className="pointer-events-none max-w-md">
          {logMessage && (
            <div className="inline-block bg-[#120F0C]/90 border border-amber-900/40 text-stone-200 text-xs px-3.5 py-1.5 rounded-lg shadow-lg">
              {logMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
