/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { WorldObstacle } from '../game/physics';

export interface SimWasmExports {
  memory: WebAssembly.Memory;
  updatePollen: (count: number, dt: number, windX: number) => void;
  updateRain: (
    count: number,
    dt: number,
    windX: number,
    windZ: number,
    playerX: number,
    playerY: number,
    playerZ: number
  ) => number;
  resolveObstacleCollisions: (obsCount: number, beeRadius: number) => number;
  updateGrassAerodynamics: (dt: number, currentSpeed: number) => void;
}

export class BeeSimWasmEngine {
  private wasmInstance: SimWasmExports | null = null;
  private isReady: boolean = false;

  // Shared Memory Offsets (in bytes)
  // 0 .. 4095: Player state
  // 4096 .. 16383: Pollen particle positions (450 * 3 floats = 5400 bytes)
  // 16384 .. 24575: Rain data (140 * 6 floats = 3360 bytes)
  // 24576 .. 40959: Obstacles buffer (up to 120 obstacles * 6 floats = 2880 bytes)
  public pollenFloats!: Float32Array;
  public rainFloats!: Float32Array;
  public obstaclesFloats!: Float32Array;
  private playerFloats!: Float32Array;
  private obstacleCount: number = 0;

  public async init(): Promise<boolean> {
    try {
      const response = await fetch('/bee_sim.wasm');
      const buffer = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(buffer);

      this.wasmInstance = instance.exports as unknown as SimWasmExports;
      const memBuffer = this.wasmInstance.memory.buffer;

      this.playerFloats = new Float32Array(memBuffer, 0, 16);
      this.pollenFloats = new Float32Array(memBuffer, 4096, 450 * 3);
      this.rainFloats = new Float32Array(memBuffer, 16384, 140 * 6);
      this.obstaclesFloats = new Float32Array(memBuffer, 24576, 120 * 6);

      this.isReady = true;
      return true;
    } catch (err) {
      console.warn('WASM Sim Engine fallback to JS:', err);
      this.isReady = false;
      return false;
    }
  }

  public getIsReady(): boolean {
    return this.isReady;
  }

  public setObstacles(obstacles: WorldObstacle[]) {
    this.obstacleCount = Math.min(obstacles.length, 120);
    if (!this.isReady) return;

    for (let i = 0; i < this.obstacleCount; i++) {
      const obs = obstacles[i];
      const offset = i * 6;
      this.obstaclesFloats[offset] = obs.type === 'cylinder' ? 0.0 : 1.0;
      this.obstaclesFloats[offset + 1] = obs.x;
      this.obstaclesFloats[offset + 2] = obs.z;
      this.obstaclesFloats[offset + 3] = obs.yMin;
      this.obstaclesFloats[offset + 4] = obs.yMax;
      this.obstaclesFloats[offset + 5] = obs.radius;
    }
  }

  public seedPollen(positions: Float32Array): void {
    if (!this.isReady || !this.pollenFloats) return;
    this.pollenFloats.set(positions.subarray(0, this.pollenFloats.length));
  }

  public seedRain(drops: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number }>): void {
    if (!this.isReady || !this.rainFloats) return;
    const count = Math.min(drops.length, 140);
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      const d = drops[i];
      this.rainFloats[o] = d.x;
      this.rainFloats[o + 1] = d.y;
      this.rainFloats[o + 2] = d.z;
      this.rainFloats[o + 3] = d.vx;
      this.rainFloats[o + 4] = d.vy;
      this.rainFloats[o + 5] = d.vz;
    }
  }

  public updatePollen(count: number, dt: number, windX: number): void {
    if (!this.isReady || !this.wasmInstance) return;
    this.wasmInstance.updatePollen(count, dt, windX);
  }

  public updateRain(
    count: number,
    dt: number,
    windX: number,
    windZ: number,
    playerPos: THREE.Vector3
  ): number {
    if (!this.isReady || !this.wasmInstance) return 0;
    return this.wasmInstance.updateRain(count, dt, windX, windZ, playerPos.x, playerPos.y, playerPos.z);
  }

  public resolveObstacles(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    beeRadius: number
  ): { hasCollided: boolean; impactSpeed: number } {
    if (!this.isReady || !this.wasmInstance || this.obstacleCount === 0) {
      return { hasCollided: false, impactSpeed: 0 };
    }

    // Write player pos & vel into WASM memory
    this.playerFloats[0] = pos.x;
    this.playerFloats[1] = pos.y;
    this.playerFloats[2] = pos.z;
    this.playerFloats[3] = vel.x;
    this.playerFloats[4] = vel.y;
    this.playerFloats[5] = vel.z;

    const maxImpact = this.wasmInstance.resolveObstacleCollisions(this.obstacleCount, beeRadius);

    // Read resolved state back from WASM memory
    pos.x = this.playerFloats[0];
    pos.y = this.playerFloats[1];
    pos.z = this.playerFloats[2];
    vel.x = this.playerFloats[3];
    vel.y = this.playerFloats[4];
    vel.z = this.playerFloats[5];

    return {
      hasCollided: maxImpact > 0.6,
      impactSpeed: maxImpact,
    };
  }

  public updateGrassAerodynamics(dt: number, vel: THREE.Vector3, currentSpeed: number): void {
    if (!this.isReady || !this.wasmInstance) return;

    this.playerFloats[3] = vel.x;
    this.playerFloats[5] = vel.z;

    this.wasmInstance.updateGrassAerodynamics(dt, currentSpeed);

    vel.x = this.playerFloats[3];
    vel.z = this.playerFloats[5];
  }
}

export const simWasm = new BeeSimWasmEngine();
