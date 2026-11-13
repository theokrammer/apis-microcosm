/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Shared analytical terrain height function so terrain mesh, flora, trees,
 * distant horizon, and flight physics ground-clamping agree everywhere.
 */
export function terrainHeightAt(x: number, z: number): number {
  const r = Math.sqrt(x * x + z * z);

  // Flatten the immediate hive glade (around x=0, z=-25) so roots, landing board,
  // and hollow interior sit cleanly without uneven ground clipping
  const dxHive = x;
  const dzHive = z + 25;
  const distToHiveSq = dxHive * dxHive + dzHive * dzHive;
  const hiveFlatten = Math.min(1.0, Math.max(0.0, (Math.sqrt(distToHiveSq) - 18) / 14));

  // Micro rolling earth mounds in inner meadow
  let y =
    (Math.sin(x * 0.04) * Math.cos(z * 0.04) * 0.75 +
      Math.sin(x * 0.14 + z * 0.09) * 0.25) *
    hiveFlatten;

  // Outer perimeter rises into verdant woodland hills and glade basin walls
  if (r > 100) {
    const hillBlend = Math.min(1.0, (r - 100) / 180);
    const hillWave = Math.sin(Math.atan2(z, x) * 5) * 6.0 + Math.cos(r * 0.03) * 4.0;
    y += hillBlend * hillBlend * (22.0 + hillWave);
  }

  return y;
}

let cachedSoftwareGl: boolean | null = null;

export function detectSoftwareWebGL(): boolean {
  if (cachedSoftwareGl !== null) return cachedSoftwareGl;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) {
      cachedSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    cachedSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    cachedSoftwareGl = false;
  }
  return cachedSoftwareGl;
}
