import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { FlightInputState } from '../types/game';
import { simWasm } from '../wasm/beeSimWasm';

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

export class BeePhysicsEngine {
  private rapier: typeof RAPIER | null = null;
  private world: RAPIER.World | null = null;
  private playerBody: RAPIER.RigidBody | null = null;
  private isWasmReady: boolean = false;

  // Immovable environment colliders (trees, rocks, stems, trowel, hive)
  private obstacles: WorldObstacle[] = [];
  private beeRadius: number = 0.38;

  // Flight kinematics & state
  private pos = new THREE.Vector3(0, 4.5, 8);
  private vel = new THREE.Vector3(0, 0, 0);
  private quat = new THREE.Quaternion();
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Flight parameters
  private readonly maxForwardSpeed = 15.0;
  private readonly sprintMultiplier = 1.7;
  private readonly turnSpeed = 2.6;
  private readonly verticalSpeed = 8.0;
  private hoverTime = 0;

  public setObstacles(obstacles: WorldObstacle[]) {
    this.obstacles = obstacles;
    simWasm.setObstacles(obstacles);

    // If Rapier is initialized, also register static colliders
    if (this.isWasmReady && this.world && this.rapier) {
      for (const obs of obstacles) {
        if (obs.type === 'cylinder') {
          const halfHeight = (obs.yMax - obs.yMin) / 2;
          const centerY = obs.yMin + halfHeight;
          const colDesc = this.rapier.ColliderDesc.cylinder(halfHeight, obs.radius)
            .setTranslation(obs.x, centerY, obs.z);
          this.world.createCollider(colDesc);
        } else if (obs.type === 'sphere') {
          const colDesc = this.rapier.ColliderDesc.ball(obs.radius)
            .setTranslation(obs.x, (obs.yMin + obs.yMax) / 2, obs.z);
          this.world.createCollider(colDesc);
        }
      }
    }
  }

  public async init(): Promise<boolean> {
    try {
      await RAPIER.init();
      this.rapier = RAPIER;

      // Gravity scaled for small insect aerodynamics (0 in mid-air hover mode)
      const gravity = new RAPIER.Vector3(0.0, 0.0, 0.0);
      this.world = new RAPIER.World(gravity);

      // Ground plane collider at Y = 0
      const groundColliderDesc = RAPIER.ColliderDesc.cuboid(240.0, 0.5, 240.0).setTranslation(0, -0.5, 0);
      this.world.createCollider(groundColliderDesc);

      // Player Bee RigidBody (Kinematic position-based or high-damping dynamic)
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(this.pos.x, this.pos.y, this.pos.z)
        .setLinearDamping(4.0)
        .setAngularDamping(5.0)
        .setCanSleep(false);

      this.playerBody = this.world.createRigidBody(bodyDesc);
      const beeColliderDesc = RAPIER.ColliderDesc.ball(this.beeRadius).setRestitution(0.1);
      this.world.createCollider(beeColliderDesc, this.playerBody);

      this.isWasmReady = true;

      // Register any obstacles that were added before WASM finished initializing
      if (this.obstacles.length > 0) {
        this.setObstacles(this.obstacles);
      }

      return true;
    } catch (e) {
      console.warn('Rapier3D WASM init fallback to Euler physics:', e);
      this.isWasmReady = false;
      return false;
    }
  }

  public update(dt: number, input: FlightInputState): PhysicsState {
    const clampedDt = Math.min(dt, 0.05);
    this.hoverTime += clampedDt;

    // Check if within meadow grass layer (Y <= 3.2m in meadow field)
    const isInGrass = this.pos.y <= 3.2;

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

    // Forward and upward orientation vectors
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat);

    // 3. Thrust Calculations
    let targetSpeed = 0;
    if (input.forward) targetSpeed += this.maxForwardSpeed * (input.sprint ? this.sprintMultiplier : 1.0);
    if (input.backward) targetSpeed -= this.maxForwardSpeed * 0.5;

    // Horizontal target velocity
    const targetHorizVel = forward.clone().multiplyScalar(targetSpeed);

    // Apply grass aerodynamic drag if flying low in meadow grass
    if (isInGrass) {
      targetHorizVel.multiplyScalar(0.72); // 28% reduction in top speed through stalks
    }

    // 4. Vertical Altitude Control (CRITICAL: ZERO PHANTOM RISING)
    let targetVy = 0;
    if (input.up) {
      targetVy = this.verticalSpeed * (input.sprint ? 1.3 : 1.0);
    } else if (input.down) {
      targetVy = -this.verticalSpeed;
    } else {
      // Natural, subtle organic hover oscillation without gaining altitude
      targetVy = Math.sin(this.hoverTime * 4.0) * 0.18;
    }

    // Blend current velocity toward target velocity smoothly
    const accelRate = (input.forward || input.backward) ? 4.5 : 6.0;
    this.vel.x = THREE.MathUtils.damp(this.vel.x, targetHorizVel.x, accelRate, clampedDt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, targetHorizVel.z, accelRate, clampedDt);
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
      }
    }

    // 5. Integrate Position
    this.pos.addScaledVector(this.vel, clampedDt);

    // Hard ground clamp & ceiling limit
    if (this.pos.y < 0.45) {
      this.pos.y = 0.45;
      if (this.vel.y < 0) this.vel.y = 0;
    }
    if (this.pos.y > 32.0) {
      this.pos.y = 32.0;
      if (this.vel.y > 0) this.vel.y = 0;
    }

    // 6. Immovable Obstacle Collisions via Native WebAssembly
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

    // 7. Sync with Rapier WASM if active
    if (this.isWasmReady && this.world && this.playerBody && this.rapier) {
      this.playerBody.setTranslation(new this.rapier.Vector3(this.pos.x, this.pos.y, this.pos.z), true);
      this.playerBody.setLinvel(new this.rapier.Vector3(this.vel.x, this.vel.y, this.vel.z), true);
      const rQuat = new this.rapier.Quaternion(this.quat.x, this.quat.y, this.quat.z, this.quat.w);
      this.playerBody.setRotation(rQuat, true);

      this.world.timestep = clampedDt;
      this.world.step();
    }

    const currentSpeed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    const altitude = Math.max(0, this.pos.y);
    const isGrounded = altitude <= 0.6;

    return {
      position: this.pos.clone(),
      velocity: this.vel.clone(),
      rotation: this.quat.clone(),
      speed: currentSpeed,
      altitude,
      isGrounded,
      isInGrass,
      hasCollidedObstacle,
      lastImpactSpeed,
    };
  }

  public setPosition(x: number, y: number, z: number) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    if (this.playerBody && this.rapier) {
      this.playerBody.setTranslation(new this.rapier.Vector3(x, y, z), true);
      this.playerBody.setLinvel(new this.rapier.Vector3(0, 0, 0), true);
    }
  }

  public applyImpulse(impulse: THREE.Vector3) {
    this.vel.add(impulse);
    if (this.playerBody && this.rapier) {
      this.playerBody.applyImpulse(new this.rapier.Vector3(impulse.x, impulse.y, impulse.z), true);
    }
  }

  public getIsWasmReady(): boolean {
    return this.isWasmReady;
  }
}
