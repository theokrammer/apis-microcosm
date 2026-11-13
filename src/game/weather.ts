/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { WeatherType } from '../types/game';
import { audioEngine } from './audio';
import { simWasm } from '../wasm/beeSimWasm';
import { detectSoftwareWebGL } from './terrain';

export interface WeatherController {
  currentWeather: WeatherType;
  wind: THREE.Vector3;
  update: (dt: number, playerPos: THREE.Vector3) => void;
  setWeather: (weather: WeatherType) => void;
  dispose: () => void;
}

export function setupWeatherSystem(
  scene: THREE.Scene,
  sunLight: THREE.DirectionalLight,
  hemiLight: THREE.HemisphereLight
): WeatherController {
  let currentWeather: WeatherType = 'sunny';
  const wind = new THREE.Vector3(0.5, 0, 0.2);
  const isSoftwareGl = detectSoftwareWebGL();

  // Rain particle system
  const maxRainDrops = 140;
  const rainGeo = new THREE.SphereGeometry(0.12, 6, 6);
  rainGeo.scale(0.8, 2.5, 0.8); // Teardrop elongation
  const rainMat = new THREE.MeshPhysicalMaterial({
    color: 0xBAE6FD,
    transmission: isSoftwareGl ? 0 : 0.9,
    roughness: 0.1,
    transparent: true,
    opacity: isSoftwareGl ? 0.55 : 0.75,
  });

  const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, maxRainDrops);
  rainMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rainMesh.visible = false;
  rainMesh.frustumCulled = false;
  scene.add(rainMesh);

  // Rain drop positions & velocities
  const dropData: Array<{ x: number; y: number; z: number; vy: number; vx: number; vz: number }> = [];
  const dummy = new THREE.Object3D();

  for (let i = 0; i < maxRainDrops; i++) {
    dropData.push({
      x: (Math.random() - 0.5) * 80,
      y: Math.random() * 30 + 10,
      z: (Math.random() - 0.5) * 80,
      vy: -(22 + Math.random() * 8),
      vx: wind.x * 2,
      vz: wind.z * 2,
    });
  }
  simWasm.seedRain(dropData);

  function applyWeatherLighting(weather: WeatherType) {
    currentWeather = weather;
    audioEngine.updateWeatherAudio(weather);

    if (weather === 'sunny') {
      sunLight.color.setHex(0xFFFBEB);
      sunLight.intensity = 2.4;
      hemiLight.color.setHex(0xECFDF5);
      hemiLight.groundColor.setHex(0x27190F);
      hemiLight.intensity = 0.95;
      scene.fog = new THREE.Fog(0xD1FAE5, 220, 750);
      rainMesh.visible = false;
      wind.set(0.4, 0, 0.2);
    } else if (weather === 'breezy') {
      sunLight.color.setHex(0xFEF3C7);
      sunLight.intensity = 2.0;
      hemiLight.color.setHex(0xE0F2FE);
      hemiLight.groundColor.setHex(0x20150B);
      hemiLight.intensity = 0.9;
      scene.fog = new THREE.Fog(0xC7EBD9, 210, 720);
      rainMesh.visible = false;
      wind.set(3.2, 0, 1.5);
    } else if (weather === 'rain') {
      sunLight.color.setHex(0x94A3B8);
      sunLight.intensity = 0.85;
      hemiLight.color.setHex(0x64748B);
      hemiLight.groundColor.setHex(0x1C1917);
      hemiLight.intensity = 0.6;
      scene.fog = new THREE.Fog(0x64748B, 130, 520);
      rainMesh.visible = true;
      wind.set(1.8, 0, 0.9);
    } else if (weather === 'spring_thaw') {
      sunLight.color.setHex(0xFDE68A);
      sunLight.intensity = 1.7;
      hemiLight.color.setHex(0xD8B4FE);
      hemiLight.groundColor.setHex(0x3B281B);
      hemiLight.intensity = 0.8;
      scene.fog = new THREE.Fog(0xDDF0E6, 210, 720);
      rainMesh.visible = false;
      wind.set(0.6, 0, 0.3);
    }
  }

  // Initial setup
  applyWeatherLighting('sunny');

  let timeAcc = 0;

  return {
    get currentWeather() {
      return currentWeather;
    },
    wind,
    setWeather(w: WeatherType) {
      applyWeatherLighting(w);
    },
    update(dt: number, playerPos: THREE.Vector3) {
      timeAcc += dt;

      // Bounded gentle wind gust oscillation (avoids unbounded wind.x drift)
      const baseWindX = currentWeather === 'breezy' ? 3.2 : currentWeather === 'rain' ? 1.8 : 0.4;
      wind.x = baseWindX + Math.sin(timeAcc * 1.1) * (currentWeather === 'breezy' ? 1.1 : 0.3);

      if (currentWeather === 'rain' && rainMesh.visible) {
        if (simWasm.getIsReady()) {
          const splashes = simWasm.updateRain(maxRainDrops, dt, wind.x, wind.z, playerPos);
          if (splashes > 0) {
            audioEngine.playRaindropImpact();
          }
          const rainBuf = simWasm.rainFloats;
          for (let i = 0; i < maxRainDrops; i++) {
            const o = i * 6;
            dummy.position.set(rainBuf[o], rainBuf[o + 1], rainBuf[o + 2]);
            dummy.rotation.x = 0.1;
            dummy.rotation.z = -wind.x * 0.05;
            dummy.updateMatrix();
            rainMesh.setMatrixAt(i, dummy.matrix);
          }
        } else {
          for (let i = 0; i < maxRainDrops; i++) {
            const d = dropData[i];
            d.y += d.vy * dt;
            d.x += (d.vx + wind.x) * dt;
            d.z += (d.vz + wind.z) * dt;

            if (d.y < 0.2) {
              d.y = playerPos.y + 15 + Math.random() * 15;
              d.x = playerPos.x + (Math.random() - 0.5) * 45;
              d.z = playerPos.z + (Math.random() - 0.5) * 45;
            }

            const dx = d.x - playerPos.x;
            const dy = d.y - playerPos.y;
            const dz = d.z - playerPos.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < 0.8) {
              audioEngine.playRaindropImpact();
              d.y = playerPos.y + 20;
            }

            dummy.position.set(d.x, d.y, d.z);
            dummy.rotation.x = 0.1;
            dummy.rotation.z = -wind.x * 0.05;
            dummy.updateMatrix();
            rainMesh.setMatrixAt(i, dummy.matrix);
          }
        }
        rainMesh.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      rainMesh.geometry.dispose();
      (rainMesh.material as THREE.Material).dispose();
      scene.remove(rainMesh);
    },
  };
}
