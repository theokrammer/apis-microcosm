// WebAssembly High-Performance Simulation Kernel for Apis: Microcosm
// Compiled to native WASM with AssemblyScript -O3

// Shared memory layout:
// Offset 0 .. 4095: Player state & parameters
// Offset 4096 .. 16383: Pollen particle positions (x, y, z)
// Offset 16384 .. 24575: Raindrop positions and velocities (x, y, z, vx, vy, vz)
// Offset 24576 .. 40959: Obstacles list (type, x, z, yMin, yMax, radius)

export function updatePollen(count: i32, dt: f32, windX: f32): void {
  // Pollen buffer starts at byte offset 4096
  let ptr = 4096;
  for (let i = 0; i < count; i++) {
    let px = load<f32>(ptr);
    let py = load<f32>(ptr + 4);
    let pz = load<f32>(ptr + 8);

    py -= dt * 0.25;
    px += windX * dt * 0.5;

    // Boundary wrap
    if (py < 0.2) py = 18.0;
    if (px > 45.0) px = -45.0;
    if (px < -45.0) px = 45.0;

    store<f32>(ptr, px);
    store<f32>(ptr + 4, py);
    store<f32>(ptr + 8, pz);

    ptr += 12; // 3 floats * 4 bytes
  }
}

export function updateRain(
  count: i32,
  dt: f32,
  windX: f32,
  windZ: f32,
  playerX: f32,
  playerY: f32,
  playerZ: f32
): i32 {
  // Rain buffer starts at byte offset 16384
  // Each drop has 6 floats: x, y, z, vx, vy, vz (24 bytes)
  let ptr = 16384;
  let splashCount: i32 = 0;

  for (let i = 0; i < count; i++) {
    let x = load<f32>(ptr);
    let y = load<f32>(ptr + 4);
    let z = load<f32>(ptr + 8);
    let vx = load<f32>(ptr + 12);
    let vy = load<f32>(ptr + 16);
    let vz = load<f32>(ptr + 20);

    y += vy * dt;
    x += (vx + windX) * dt;
    z += (vz + windZ) * dt;

    // Reset when hitting ground
    if (y < 0.2) {
      y = playerY + 16.0 + (f32(i % 15));
      x = playerX + (f32((i * 17) % 60) - 30.0);
      z = playerZ + (f32((i * 23) % 60) - 30.0);
    }

    // Check player collision distance squared
    let dx = x - playerX;
    let dy = y - playerY;
    let dz = z - playerZ;
    let distSq = dx * dx + dy * dy + dz * dz;
    if (distSq < 1.0) {
      splashCount++;
      y = playerY + 22.0;
    }

    store<f32>(ptr, x);
    store<f32>(ptr + 4, y);
    store<f32>(ptr + 8, z);

    ptr += 24;
  }

  return splashCount;
}

// Immovable Obstacle Collision Resolver in WebAssembly
// Player state at byte 0:
// [0]: posX, [4]: posY, [8]: posZ
// [12]: velX, [16]: velY, [20]: velZ
// Returns: impact speed (f32 as bits or stored)
export function resolveObstacleCollisions(obsCount: i32, beeRadius: f32): f32 {
  let px = load<f32>(0);
  let py = load<f32>(4);
  let pz = load<f32>(8);
  let vx = load<f32>(12);
  let vy = load<f32>(16);
  let vz = load<f32>(20);

  let maxImpact: f32 = 0.0;
  let obsPtr = 24576;

  // Obstacle structure (24 bytes):
  // [0]: type (0 = cylinder, 1 = sphere)
  // [4]: x, [8]: z, [12]: yMin, [16]: yMax, [20]: radius
  for (let i = 0; i < obsCount; i++) {
    let type = load<f32>(obsPtr);
    let ox = load<f32>(obsPtr + 4);
    let oz = load<f32>(obsPtr + 8);
    let yMin = load<f32>(obsPtr + 12);
    let yMax = load<f32>(obsPtr + 16);
    let radius = load<f32>(obsPtr + 20);

    let minDist = radius + beeRadius;

    if (type < 0.5) {
      // Cylinder obstacle (tree trunk, stem, hive)
      if (py >= yMin - 0.3 && py <= yMax + 0.3) {
        let dx = px - ox;
        let dz = pz - oz;
        let distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist) {
          let dist = Mathf.sqrt(distSq);
          if (dist < 0.0001) dist = 0.0001;
          let nx = dx / dist;
          let nz = dz / dist;

          // Push out
          px = ox + nx * minDist;
          pz = oz + nz * minDist;

          // Velocity bounce
          let vDotN = vx * nx + vz * nz;
          if (vDotN < 0.0) {
            let impact = Mathf.abs(vDotN);
            if (impact > maxImpact) maxImpact = impact;
            vx -= 1.35 * vDotN * nx;
            vz -= 1.35 * vDotN * nz;
            vy += 0.4;
          }
        }
      }
    } else {
      // Sphere obstacle (boulder, burl)
      let centerY = (yMin + yMax) * 0.5;
      let dx = px - ox;
      let dy = py - centerY;
      let dz = pz - oz;
      let distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < minDist * minDist) {
        let dist = Mathf.sqrt(distSq);
        if (dist < 0.0001) dist = 0.0001;
        let nx = dx / dist;
        let ny = dy / dist;
        let nz = dz / dist;

        px = ox + nx * minDist;
        py = centerY + ny * minDist;
        pz = oz + nz * minDist;

        let vDotN = vx * nx + vy * ny + vz * nz;
        if (vDotN < 0.0) {
          let impact = Mathf.abs(vDotN);
          if (impact > maxImpact) maxImpact = impact;
          vx -= 1.35 * vDotN * nx;
          vy -= 1.35 * vDotN * ny;
          vz -= 1.35 * vDotN * nz;
        }
      }
    }

    obsPtr += 24;
  }

  // Store back updated player position & velocity
  store<f32>(0, px);
  store<f32>(4, py);
  store<f32>(8, pz);
  store<f32>(12, vx);
  store<f32>(16, vy);
  store<f32>(20, vz);

  return maxImpact;
}

// Grass flight aerodynamic simulation (resistance and turbulence in WASM)
export function updateGrassAerodynamics(dt: f32, currentSpeed: f32): void {
  let vx = load<f32>(12);
  let vz = load<f32>(20);

  // Exponential drag decay in WASM: 0.78 ^ (dt * 8)
  let damp = Mathf.pow(0.78, dt * 8.0);
  vx *= damp;
  vz *= damp;

  if (currentSpeed > 0.6) {
    // Deterministic fast pseudo-random turbulence perturbation
    let seed: f32 = load<f32>(0) * 12.9898 + load<f32>(8) * 78.233;
    let angle: f32 = f32((seed - Mathf.floor(seed)) * 6.283185);
    let perturbStrength: f32 = (0.7 + currentSpeed * 0.35) * dt * 3.8;

    vx += Mathf.cos(angle) * perturbStrength;
    vz += Mathf.sin(angle) * perturbStrength;
  }

  store<f32>(12, vx);
  store<f32>(20, vz);
}
