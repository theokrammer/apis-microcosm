/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { BeeGameEngine } from './game/gameEngine';
import { audioEngine } from './game/audio';
import { PlayerBeeState, ColonyResources, WeatherType, GameMode, BeeRole, FlowerData, InsectEntity } from './types/game';
import { HUD } from './components/HUD';
import { BottomDock } from './components/BottomDock';
import { TitleScreen } from './components/TitleScreen';
import { Minimap } from './components/Minimap';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BeeGameEngine | null>(null);

  const [isTitleScreen, setIsTitleScreen] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [logMessage, setLogMessage] = useState('Welcome to Apis: Microcosm. Press Space to act.');

  // Simulation state mirrored to React for HUD & Minimap display
  const [playerState, setPlayerState] = useState<PlayerBeeState>({
    role: 'forager',
    health: 100,
    stamina: 100,
    nectarCarried: 0,
    pollenCarried: 0,
    speed: 0,
    altitude: 4.5,
    position: [0, 4.5, 8],
    yaw: 0,
    isLanded: false,
    nearFlowerId: null,
    nearHive: false,
    nearFoundingSite: false,
    stingingCooldown: 0,
    threatWarning: null,
  });

  const [colonyState, setColonyState] = useState<ColonyResources>({
    nectar: 45,
    honey: 65,
    pollen: 40,
    wax: 30,
    population: {
      foragers: 16,
      guards: 8,
      builders: 10,
      larvae: 6,
      eggs: 5,
    },
    hiveWarmth: 90,
  });

  const [weatherState, setWeatherState] = useState<WeatherType>('sunny');
  const [gameMode, setGameMode] = useState<GameMode>('colony_active');
  const [flowers, setFlowers] = useState<FlowerData[]>([]);
  const [insects, setInsects] = useState<InsectEntity[]>([]);
  const [hivePos, setHivePos] = useState<[number, number, number]>([0, 0, -25]);

  // Initialize 3D Engine on mount in background
  useEffect(() => {
    if (!mountRef.current) return;

    audioEngine.init();

    const engine = new BeeGameEngine(
      mountRef.current,
      {
        onStateUpdate: (player, colony, mode, weather, fList, iList, hPos) => {
          setPlayerState(player);
          setColonyState(colony);
          setGameMode(mode);
          setWeatherState(weather);
          setFlowers(fList);
          setInsects(iList);
          setHivePos(hPos);
        },
        onLogMessage: (msg) => {
          setLogMessage(msg);
        },
      },
      'colony_active'
    );

    engine.init();
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Escape key handler to return to Main Menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setIsTitleScreen(true);
        engineRef.current?.setPaused(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStartGame = (mode: GameMode) => {
    audioEngine.ensureRunning();
    setIsTitleScreen(false);

    if (engineRef.current) {
      engineRef.current.setPaused(false);
      engineRef.current.setGameMode(mode);
      if (mode === 'spring_founding') {
        engineRef.current.setWeather('spring_thaw');
      } else {
        engineRef.current.setWeather('sunny');
      }
    }
  };

  const handleSelectRole = (role: BeeRole) => {
    engineRef.current?.switchRole(role);
  };

  const handleSelectWeather = (weather: WeatherType) => {
    engineRef.current?.setWeather(weather);
  };

  const handleToggleMute = () => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  };

  const handleActionClick = () => {
    engineRef.current?.executeContextAction();
  };

  const handleExpandComb = () => {
    engineRef.current?.buildNewCombCell();
  };

  const handleQuitToMenu = () => {
    setIsTitleScreen(true);
    engineRef.current?.setPaused(true);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#120F0C] select-none font-['Manrope',sans-serif]">
      {/* Isolated 3D Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen Overlay */}
      {isTitleScreen ? (
        <TitleScreen onStart={handleStartGame} />
      ) : (
        <>
          {/* Low-Occlusion HUD Overlay */}
          <HUD
            player={playerState}
            colony={colonyState}
            weather={weatherState}
            gameMode={gameMode}
            logMessage={logMessage}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onActionClick={handleActionClick}
            onQuitToMenu={handleQuitToMenu}
          />

          {/* Real-Time Micro-Radar Minimap */}
          <div className="absolute top-20 right-4 md:right-6 z-20 pointer-events-none">
            <Minimap
              playerPos={playerState.position}
              playerYaw={playerState.yaw}
              flowers={flowers}
              insects={insects}
              hivePos={hivePos}
            />
          </div>

          {/* Collapsible Bottom Control Dock */}
          <BottomDock
            currentRole={playerState.role}
            onSelectRole={handleSelectRole}
            currentWeather={weatherState}
            onSelectWeather={handleSelectWeather}
            onExpandComb={handleExpandComb}
          />
        </>
      )}
    </div>
  );
}
