/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type BeeRole = 'forager' | 'guard' | 'builder' | 'queen';

export type GameMode = 'spring_founding' | 'colony_active' | 'swarm_migration';

export type WeatherType = 'sunny' | 'breezy' | 'rain' | 'spring_thaw';

export type FlowerType = 'clover' | 'dandelion' | 'seedhead' | 'poppy' | 'bluebell' | 'thistle' | 'lavender';

export interface FlowerData {
  id: string;
  type: FlowerType;
  position: [number, number, number];
  nectar: number; // 0 to 100
  pollen: number; // 0 to 100
  petalColor: number;
  hasSpider?: boolean;
}

export type InsectType = 'wasp' | 'mantis' | 'spider' | 'ladybug' | 'butterfly';

export interface InsectEntity {
  id: string;
  type: InsectType;
  position: [number, number, number];
  velocity: [number, number, number];
  health: number;
  state: 'idle' | 'stalking' | 'attacking' | 'striking' | 'fleeing' | 'fluttering' | 'crawling';
  target?: 'player' | 'hive' | 'flower' | null;
  wingPhase?: number;
  animTimer?: number;
}

export type CellType = 'empty' | 'honey' | 'pollen' | 'brood';
export type BroodStage = 'egg' | 'larva' | 'pupa' | 'mature';

export interface CombCell {
  q: number; // axial hex coordinate q
  r: number; // axial hex coordinate r
  type: CellType;
  fillAmount: number; // 0 to 100
  broodStage?: BroodStage;
  broodTimer?: number;
}

export interface ColonyResources {
  nectar: number;
  honey: number;
  pollen: number;
  wax: number;
  population: {
    foragers: number;
    guards: number;
    builders: number;
    larvae: number;
    eggs: number;
  };
  hiveWarmth: number; // 0 to 100
}

export interface PlayerBeeState {
  role: BeeRole;
  health: number; // 0 to 100
  stamina: number; // 0 to 100
  nectarCarried: number; // 0 to 30
  pollenCarried: number; // 0 to 20
  speed: number;
  altitude: number;
  position: [number, number, number];
  yaw: number;
  isLanded: boolean;
  nearFlowerId: string | null;
  nearHive: boolean;
  nearFoundingSite: boolean;
  stingingCooldown: number;
  threatWarning: string | null; // E.g. "MANTIS STRIKE DANGER! EVADE [SHIFT]!"
}

export interface FlightInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  sprint: boolean;
  actionPrimary: boolean; // Sip / Sting / Build / Lay
  actionSecondary: boolean; // Deposit / Pheromone
}
