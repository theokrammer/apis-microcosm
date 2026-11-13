/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FlowerData, InsectEntity } from '../types/game';
import { Maximize2, Minimize2, Compass as CompassIcon } from 'lucide-react';

interface MinimapProps {
  playerPos: [number, number, number];
  playerYaw: number;
  flowers: FlowerData[];
  insects: InsectEntity[];
  hivePos: [number, number, number];
}

export const Minimap: React.FC<MinimapProps> = ({
  playerPos,
  playerYaw,
  flowers,
  insects,
  hivePos,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const mapRadius = isExpanded ? 75 : 55; // World meters covered in radar radius
  const size = isExpanded ? 220 : 150; // Canvas pixel size
  const center = size / 2;
  const scale = (center - 10) / mapRadius;

  // Convert world (x, z) relative to player into radar pixel coords
  const toRadar = (wx: number, wz: number) => {
    const dx = wx - playerPos[0];
    const dz = wz - playerPos[2];
    const rx = center + dx * scale;
    const ry = center + dz * scale;
    return { x: rx, y: ry, inBounds: dx * dx + dz * dz <= mapRadius * mapRadius };
  };

  const hiveRadar = toRadar(hivePos[0], hivePos[2]);

  return (
    <div className="pointer-events-auto flex flex-col items-end">
      {/* Radar Container */}
      <div
        className="relative bg-[#15110D]/90 border border-amber-950/60 rounded-full shadow-2xl overflow-hidden"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="w-full h-full">
          {/* Radar background grid & concentric range rings */}
          <circle cx={center} cy={center} r={center - 2} fill="#14100D" stroke="#451A03" strokeWidth="1.5" />
          <circle cx={center} cy={center} r={(center - 10) * 0.33} fill="none" stroke="#78350F" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
          <circle cx={center} cy={center} r={(center - 10) * 0.66} fill="none" stroke="#78350F" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.6" />
          <circle cx={center} cy={center} r={center - 10} fill="none" stroke="#92400E" strokeWidth="1" opacity="0.7" />

          {/* Crosshairs */}
          <line x1={center} y1={6} x2={center} y2={size - 6} stroke="#78350F" strokeWidth="0.8" opacity="0.4" />
          <line x1={6} y1={center} x2={size - 6} y2={center} stroke="#78350F" strokeWidth="0.8" opacity="0.4" />

          {/* Compass labels */}
          <text x={center} y={15} fill="#D97706" fontSize="9" fontWeight="bold" textAnchor="middle">N</text>
          <text x={size - 12} y={center + 3} fill="#78350F" fontSize="8" textAnchor="middle">E</text>
          <text x={center} y={size - 6} fill="#78350F" fontSize="8" textAnchor="middle">S</text>
          <text x={12} y={center + 3} fill="#78350F" fontSize="8" textAnchor="middle">W</text>

          {/* Hive Tree Location (Golden Hexagon) */}
          {hiveRadar.inBounds ? (
            <g transform={`translate(${hiveRadar.x}, ${hiveRadar.y})`}>
              <polygon points="0,-7 6,-3 6,4 0,8 -6,4 -6,-3" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1.2" />
              <text x={0} y={15} fill="#FDE68A" fontSize="8" fontWeight="bold" textAnchor="middle">HIVE</text>
            </g>
          ) : (
            // Off-radar hive pointer
            (() => {
              const dx = hivePos[0] - playerPos[0];
              const dz = hivePos[2] - playerPos[2];
              const angle = Math.atan2(dz, dx);
              const edgeR = center - 14;
              const px = center + Math.cos(angle) * edgeR;
              const py = center + Math.sin(angle) * edgeR;
              return (
                <circle cx={px} cy={py} r="4" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1" />
              );
            })()
          )}

          {/* Flowers */}
          {flowers.map((f) => {
            const r = toRadar(f.position[0], f.position[2]);
            if (!r.inBounds) return null;
            const color =
              f.type === 'clover' ? '#F43F5E' :
              f.type === 'dandelion' ? '#FACC15' :
              f.type === 'seedhead' ? '#E2E8F0' :
              f.type === 'poppy' ? '#EF4444' :
              f.type === 'bluebell' ? '#818CF8' :
              f.type === 'thistle' ? '#C084FC' : '#A855F7';
            return (
              <circle
                key={f.id}
                cx={r.x}
                cy={r.y}
                r="3.5"
                fill={color}
                stroke="#1C1917"
                strokeWidth="0.8"
                opacity="0.95"
              />
            );
          })}

          {/* Predators & Insects */}
          {insects.map((ins) => {
            const r = toRadar(ins.position[0], ins.position[2]);
            if (!r.inBounds) return null;

            if (ins.type === 'wasp') {
              return (
                <g key={ins.id} transform={`translate(${r.x}, ${r.y})`}>
                  <circle cx="0" cy="0" r="4.5" fill="#EF4444" stroke="#7F1D1D" strokeWidth="1" />
                  <circle cx="0" cy="0" r="2" fill="#FEE2E2" />
                </g>
              );
            }
            if (ins.type === 'mantis') {
              return (
                <polygon
                  key={ins.id}
                  points={`${r.x},${r.y - 5} ${r.x + 5},${r.y + 4} ${r.x - 5},${r.y + 4}`}
                  fill="#F97316"
                  stroke="#7C2D12"
                  strokeWidth="1"
                />
              );
            }
            if (ins.type === 'butterfly') {
              return (
                <circle key={ins.id} cx={r.x} cy={r.y} r="2.5" fill="#38BDF8" opacity="0.8" />
              );
            }
            return null;
          })}

          {/* Player Bee Position & Heading Arrow at Center */}
          <g transform={`translate(${center}, ${center}) rotate(${(-playerYaw * 180) / Math.PI})`}>
            {/* Field of vision cone */}
            <polygon points="0,0 -16,-38 16,-38" fill="rgba(245, 158, 11, 0.12)" />
            {/* Bee glyph */}
            <path d="M0 -8 L5 6 L0 3 L-5 6 Z" fill="#FBBF24" stroke="#FFFBEB" strokeWidth="1.2" />
            <circle cx="0" cy="0" r="2.2" fill="#78350F" />
          </g>
        </svg>

        {/* Expand / Minimize radar toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute top-2 right-2 bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
          title={isExpanded ? 'Minimize Radar' : 'Expand Radar'}
        >
          {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
        </button>
      </div>

      {/* Legend strip below radar */}
      <div className="mt-1 flex items-center gap-2 px-2 py-0.5 bg-[#15110D]/85 border border-amber-950/40 rounded-lg text-[9px] text-stone-400 font-mono">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> Hive
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> Flowers
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Threat
        </span>
      </div>
    </div>
  );
};
