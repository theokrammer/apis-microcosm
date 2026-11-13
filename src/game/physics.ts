import * as THREE from 'three';
import { FlightInputState } from '../types/game';
import { simWasm } from '../wasm/beeSimWasm';
import { terrainHeightAt } from './terrain';

export interface WorldObstacle {
  id: string;
  type: 'cylinder' | 'sphere' | 'box';
  x: number;
  z: number;
  yMin: number;
  yMax: number;
  radius: number;
  halfExtents?: [number, number, number];
}

export interface PhysicsState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Quaternion;
  speed: number;
  altitude: number;
  isGrounded: boolean;
  isInGrass: boolean;
  hasCollidedObstacle: boolean;
  lastImpactSpeed: number;
}

// Pre-allocated math helpers for zero-GC per-frame updates
const _forward = new THREE.Vector3();
const _targetHorizVel = new THREE.Vector3();

export class BeePhysicsEngine {
  // Immovable environment colliders (trees, rocks, stems, trowel, hive walls)
  private obstacles: WorldObstacle[] = [];
  private readonly beeRadius: number = 0.38;
  private readonly maxArenaRadius: number = 108;

  // Flight kinematics & state
  private pos = new THREE.Vector3(0, 3.8, -2.5);
  private vel = new THREE.Vector3(0, 0, 0);
  private quat = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  private readonly stateSnapshot: PhysicsState = {
    position: this.pos,
    velocity: this.vel,
    rotation: this.quat,
    speed: 0,
    altitude: 0,
    isGrounded: false,
    isInGrass: false,
    hasCollidedObstacle: false,
    lastImpactSpeed: 0,
  };

  // Flight parameters
  private readonly maxForwardSpeed = 15.0;
  private readonly sprintMultiplier = 1.7;
  private readonly turnSpeed = 2.6;
  private readonly verticalSpeed = 8.0;
  private hoverTime = 0;

  public setObstacles(obstacles: WorldObstacle[]) {
    this.obstacles = obstacles;
    simWasm.setObstacles(obstacles);
  }

  public async init(): Promise<boolean> {
    return simWasm.getIsReady();
  }

  public update(dt: number, input: FlightInputState, canSprint: boolean = true): PhysicsState {
    const clampedDt = Math.min(dt, 0.05);
    this.hoverTime += clampedDt;

    const groundY = terrainHeightAt(this.pos.x, this.pos.z);
    // Check if within meadow grass layer (<= 3.2m above local ground)
    const isInGrass = this.pos.y - groundY <= 3.2;

    // 1. Heading Rotation (Yaw) & Banking (Roll)
    let yawDelta = 0;
    let rollTarget = 0;

    if (input.left) {
      yawDelta += this.turnSpeed * clampedDt;
      rollTarget += 0.45; // Bank into left turn
    }
    if (input.right) {
      yawDelta -= this.turnSpeed * clampedDt;
      rollTarget -= 0.45; // Bank into right turn
    }

    this.euler.y += yawDelta;

    // 2. Pitch Control
    let pitchTarget = 0;
    if (input.forward) pitchTarget -= 0.18; // Lean nose down when thrusting forward
    if (input.backward) pitchTarget += 0.15; // Lean nose up when braking

    if (input.up) pitchTarget += 0.25;
    if (input.down) pitchTarget -= 0.25;

    this.euler.x = THREE.MathUtils.damp(this.euler.x, pitchTarget, 5.0, clampedDt);
    this.euler.z = THREE.MathUtils.damp(this.euler.z, rollTarget, 6.0, clampedDt);

    this.quat.setFromEuler(this.euler);

    // Forward vector without allocations
    _forward.set(0, 0, -1).applyQuaternion(this.quat);

    // 3. Thrust Calculations
    const isSprinting = input.sprint && canSprint;
    let targetSpeed = 0;
    if (input.forward) targetSpeed += this.maxForwardSpeed * (isSprinting ? this.sprintMultiplier : 1.0);
    if (input.backward) targetSpeed -= this.maxForwardSpeed * 0.5;

    _targetHorizVel.copy(_forward).multiplyScalar(targetSpeed);

    // Apply grass aerodynamic drag if flying low in meadow grass
    if (isInGrass) {
      _targetHorizVel.multiplyScalar(0.72); // 28% reduction in top speed through stalks
    }

    // 4. Vertical Altitude Control
    let targetVy = 0;
    if (input.up) {
      targetVy = this.verticalSpeed * (isSprinting ? 1.3 : 1.0);
    } else if (input.down) {
      targetVy = -this.verticalSpeed;
    } else {
      // Natural, subtle organic hover oscillation without gaining altitude
      targetVy = Math.sin(this.hoverTime * 4.0) * 0.18;
    }

    // Blend current velocity toward target velocity smoothly
    const accelRate = input.forward || input.backward ? 4.5 : 6.0;
    this.vel.x = THREE.MathUtils.damp(this.vel.x, _targetHorizVel.x, accelRate, clampedDt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, _targetHorizVel.z, accelRate, clampedDt);
    this.vel.y = THREE.MathUtils.damp(this.vel.y, targetVy, 6.0, clampedDt);

    // Dynamic grass friction drag & turbulence ("knock me off the path")
    if (isInGrass) {
      const currentHorizSpeed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
      if (simWasm.getIsReady()) {
        simWasm.updateGrassAerodynamics(clampedDt, this.vel, currentHorizSpeed);
      } else {
        const grassDamp = Math.pow(0.78, clampedDt * 8.0);
        this.vel.x *= grassDamp;
        this.vel.z *= grassDamp;
      }

      if (currentHorizSpeed > 0.6) {
        this.euler.z += (Math.random() - 0.5) * 0.08;
        this.euler.y += (Math.random() - 0.5) * 0.04;
        this.quat.setFromEuler(this.euler);
      }
    }

    // 5. Integrate Position
    this.pos.addScaledVector(this.vel, clampedDt);

    // Terrain-following ground clamp & ceiling limit
    const newGroundY = terrainHeightAt(this.pos.x, this.pos.z);
    if (this.pos.y < newGroundY + 0.45) {
      this.pos.y = newGroundY + 0.45;
      if (this.vel.y < 0) this.vel.y = 0;
    }
    if (this.pos.y > 36.0) {
      this.pos.y = 36.0;
      if (this.vel.y > 0) this.vel.y = 0;
    }

    // Soft natural meadow boundary wall before distant woodland perimeter
    const horizDistSq = this.pos.x * this.pos.x + this.pos.z * this.pos.z;
    if (horizDistSq > this.maxArenaRadius * this.maxArenaRadius) {
      const horizDist = Math.sqrt(horizDistSq);
      const nx = this.pos.x / horizDist;
      const nz = this.pos.z / horizDist;
      this.pos.x = nx * this.maxArenaRadius;
      this.pos.z = nz * this.maxArenaRadius;
      const vDotN = this.vel.x * nx + this.vel.z * nz;
      if (vDotN > 0) {
        this.vel.x -= vDotN * nx;
        this.vel.z -= vDotN * nz;
      }
    }

    // 6. Immovable Obstacle Collisions via Native WebAssembly (with JS fallback)
    let hasCollidedObstacle = false;
    let lastImpactSpeed = 0;

    if (simWasm.getIsReady() && this.obstacles.length > 0) {
      const res = simWasm.resolveObstacles(this.pos, this.vel, this.beeRadius);
      if (res.hasCollided) {
        hasCollidedObstacle = true;
        lastImpactSpeed = res.impactSpeed;
      }
    } else {
      for (const obs of this.obstacles) {
        if (obs.type === 'cylinder') {
          if (this.pos.y >= obs.yMin - 0.3 && this.pos.y <= obs.yMax + 0.3) {
            const dx = this.pos.x - obs.x;
            const dz = this.pos.z - obs.z;
            const distSq = dx * dx + dz * dz;
            const minDist = obs.radius + this.beeRadius;

            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq) || 0.001;
              const nx = dx / dist;
              const nz = dz / dist;

              this.pos.x = obs.x + nx * minDist;
              this.pos.z = obs.z + nz * minDist;

              const vDotN = this.vel.x * nx + this.vel.z * nz;
              if (vDotN < 0) {
                const impact = Math.abs(vDotN);
                if (impact > 0.6) {
                  hasCollidedObstacle = true;
                  lastImpactSpeed = Math.max(lastImpactSpeed, impact);
                }
                this.vel.x -= 1.35 * vDotN * nx;
                this.vel.z -= 1.35 * vDotN * nz;
                this.vel.y += 0.4;
              }
            }
          }
        } else if (obs.type === 'sphere') {
          const centerY = (obs.yMin + obs.yMax) / 2;
          const dx = this.pos.x - obs.x;
          const dy = this.pos.y - centerY;
          const dz = this.pos.z - obs.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          const minDist = obs.radius + this.beeRadius;

          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 0.001;
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            this.pos.x = obs.x + nx * minDist;
            this.pos.y = centerY + ny * minDist;
            this.pos.z = obs.z + nz * minDist;

            const vDotN = this.vel.x * nx + this.vel.y * ny + this.vel.z * nz;
            if (vDotN < 0) {
              const impact = Math.abs(vDotN);
              if (impact > 0.6) {
                hasCollidedObstacle = true;
                lastImpactSpeed = Math.max(lastImpactSpeed, impact);
              }
              this.vel.x -= 1.35 * vDotN * nx;
              this.vel.y -= 1.35 * vDotN * ny;
              this.vel.z -= 1.35 * vDotN * nz;
            }
          }
        }
      }
    }

    const currentSpeed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    const altitude = Math.max(0, this.pos.y - newGroundY);
    const isGrounded = altitude <= 0.65;

    this.stateSnapshot.speed = currentSpeed;
    this.stateSnapshot.altitude = altitude;
    this.stateSnapshot.isGrounded = isGrounded;
    this.stateSnapshot.isInGrass = isInGrass;
    this.stateSnapshot.hasCollidedObstacle = hasCollidedObstacle;
    this.stateSnapshot.lastImpactSpeed = lastImpactSpeed;

    return this.stateSnapshot;
  }

  public setPosition(x: number, y: number, z: number, yaw?: number) {
    const minY = terrainHeightAt(x, z) + 0.45;
    this.pos.set(x, Math.max(y, minY), z);
    this.vel.set(0, 0, 0);
    if (yaw !== undefined) {
      this.euler.set(0, yaw, 0, 'YXZ');
      this.quat.setFromEuler(this.euler);
    }
  }

  public applyImpulse(impulse: THREE.Vector3) {
    this.vel.add(impulse);
  }
}
