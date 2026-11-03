/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { BeeRole, CellType, BroodStage, FlowerType } from '../types/game';

// ----------------------------------------------------
// PHOTOREALISTIC MACRO TEXTURE CACHE
// ----------------------------------------------------

const textureLoader = new THREE.TextureLoader();
const cachedTextures: Record<string, THREE.Texture> = {};

export const MACRO_TEXTURES = {
  DANDELION: '/src/assets/images/dandelion_petal_macro_1793556696638.jpg',
  POPPY: '/src/assets/images/poppy_petal_macro_1793556825161.jpg',
  BLUEBELL: '/src/assets/images/bluebell_petal_macro_1793556698114.jpg',
  THISTLE: '/src/assets/images/thistle_floret_macro_1793556698038.jpg',
  STEM: '/src/assets/images/plant_stem_macro_1793556698094.jpg',
  MOSS: '/src/assets/images/moss_carpet_macro_1793556698914.jpg',
  BRACKET_FUNGUS: '/src/assets/images/bracket_fungus_macro_1793556699656.jpg',
  MANTIS_CHITIN: '/src/assets/images/mantis_chitin_macro_1793556699664.jpg',
  BEE_CHITIN: '/src/assets/images/bee_chitin_macro_1793462761277.jpg',
  WASP_CHITIN: '/src/assets/images/wasp_chitin_macro_1793462777912.jpg',
  BOTANICAL_LEAF: '/src/assets/images/botanical_leaf_macro_1793462790946.jpg',
  GRASS_BLADE: '/src/assets/images/grass_blade_macro_1793462745561.jpg',
  OAK_BARK: '/src/assets/images/oak_bark_macro_1793461527415.jpg',
  SOIL: '/src/assets/images/forest_soil_macro_1793461527125.jpg',
  OAK_LEAF_SPRAY: '/src/assets/images/oak_leaves_branch_macro_1793559703701.jpg',
  PINE_NEEDLE_SPRAY: '/src/assets/images/pine_needles_branch_macro_1793559715728.jpg',
  BIRCH_LEAF_SPRAY: '/src/assets/images/birch_leaves_branch_macro_1793559728022.jpg',
  FOREST_PANORAMA: '/src/assets/images/woodland_forest_panorama_1793560173704.jpg',
  MEADOW_TURF: '/src/assets/images/meadow_turf_macro_1793560187403.jpg',
};

export function getMacroTexture(path: string, repeatX = 1, repeatY = 1): THREE.Texture {
  const key = `${path}_${repeatX}_${repeatY}`;
  if (!cachedTextures[key]) {
    const tex = textureLoader.load(path);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    cachedTextures[key] = tex;
  }
  return cachedTextures[key];
}

const cachedCutoutTextures: Record<string, THREE.CanvasTexture> = {};

export function getCutoutLeafTexture(path: string, threshold = 22, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const key = `cutout_${path}_${threshold}_${repeatX}_${repeatY}`;
  if (cachedCutoutTextures[key]) {
    return cachedCutoutTextures[key];
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#166534';
  ctx.fillRect(0, 0, 512, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  cachedCutoutTextures[key] = texture;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const maxVal = Math.max(r, g, b);
      if (maxVal < threshold) {
        data[i + 3] = 0;
      } else if (maxVal < threshold + 30) {
        data[i + 3] = Math.floor(((maxVal - threshold) / 30) * 255);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    texture.needsUpdate = true;
  };
  img.src = path;

  return texture;
}

// ----------------------------------------------------
// PROCEDURAL BOTANICAL & ANATOMICAL TEXTURES (ZERO 404s)
// ----------------------------------------------------

export function createFuzzyThoraxTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
  grad.addColorStop(0, '#B45309');
  grad.addColorStop(0.5, '#78350F');
  grad.addColorStop(1, '#292524');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const len = 4 + Math.random() * 8;
    const angle = Math.random() * Math.PI * 2;
    const isGold = Math.random() > 0.35;
    ctx.strokeStyle = isGold
      ? `rgba(251, 191, 36, ${0.15 + Math.random() * 0.3})`
      : `rgba(41, 37, 36, ${0.2 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createStripedAbdomenTexture(isWasp: boolean = false): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isWasp ? '#FACC15' : '#D97706';
  ctx.fillRect(0, 0, 512, 512);

  const bands = isWasp ? 8 : 6;
  const bandH = 512 / bands;

  for (let i = 0; i < bands; i++) {
    if (i % 2 === 1) {
      ctx.fillStyle = '#171717';
      ctx.fillRect(0, i * bandH, 512, bandH * 0.72);
      ctx.fillStyle = '#B45309';
      ctx.fillRect(0, i * bandH + bandH * 0.72, 512, bandH * 0.08);
    }
  }

  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createIridescentWingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 512, 1024);
  grad.addColorStop(0, 'rgba(254, 243, 199, 0.45)');
  grad.addColorStop(0.3, 'rgba(224, 242, 254, 0.5)');
  grad.addColorStop(0.7, 'rgba(250, 232, 255, 0.45)');
  grad.addColorStop(1, 'rgba(219, 234, 254, 0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 1024);

  ctx.strokeStyle = 'rgba(50, 40, 30, 0.7)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(256, 1024);
  ctx.quadraticCurveTo(140, 500, 100, 50);
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(256, 1024);
  ctx.quadraticCurveTo(280, 550, 340, 150);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(220, 600);
  ctx.quadraticCurveTo(380, 500, 440, 350);
  ctx.moveTo(180, 400);
  ctx.quadraticCurveTo(280, 320, 380, 220);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(70, 55, 45, 0.45)';
  for (let y = 150; y < 900; y += 45) {
    ctx.beginPath();
    ctx.moveTo(120, y);
    ctx.lineTo(380, y + (Math.sin(y) * 25));
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCloverLeafTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#15803D';
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(236, 253, 245, 0.6)';
  ctx.lineWidth = 28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(256, 380, 210, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const angle = Math.PI * 1.1 + (i / 18) * Math.PI * 0.8;
    ctx.beginPath();
    ctx.moveTo(256, 500);
    ctx.lineTo(256 + Math.cos(angle) * 240, 500 + Math.sin(angle) * 240);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBirchBarkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E5E7EB';
  ctx.fillRect(0, 0, 256, 512);

  // Dark horizontal lenticels
  ctx.fillStyle = '#1F2937';
  for (let i = 0; i < 180; i++) {
    const y = Math.random() * 512;
    const x = Math.random() * 200;
    const w = 15 + Math.random() * 45;
    const h = 2 + Math.random() * 3;
    ctx.fillRect(x, y, w, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function createButterflyWingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Swallowtail tiger yellow base
  ctx.fillStyle = '#FDE047';
  ctx.fillRect(0, 0, 512, 512);

  // Black zebra stripes
  ctx.fillStyle = '#0F172A';
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 90, 0);
    ctx.lineTo(i * 90 + 35, 0);
    ctx.lineTo(i * 60 + 60, 512);
    ctx.lineTo(i * 60 + 10, 512);
    ctx.fill();
  }

  // Blue submarginal eye spots
  ctx.fillStyle = '#38BDF8';
  for (let x = 60; x < 460; x += 70) {
    ctx.beginPath();
    ctx.arc(x, 460, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ----------------------------------------------------
// CURVED GRASS GEOMETRY (NO CONES)
// ----------------------------------------------------

export function createCurvedGrassGeometry(): THREE.BufferGeometry {
  const segments = 6;
  const height = 6.5;
  const baseWidth = 0.32;
  const curveStrength = 1.35;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const y = Math.sin(t * Math.PI * 0.5) * height;
    const z = Math.pow(t, 2.0) * curveStrength;
    const w = (1.0 - t * 0.95) * baseWidth;

    positions.push(-w, y, z);
    uvs.push(0, t);

    positions.push(0, y, z + w * 0.25);
    uvs.push(0.5, t);

    positions.push(w, y, z);
    uvs.push(1, t);
  }

  for (let i = 0; i < segments; i++) {
    const row1 = i * 3;
    const row2 = (i + 1) * 3;

    indices.push(row1, row2, row1 + 1);
    indices.push(row1 + 1, row2, row2 + 1);

    indices.push(row1 + 1, row2 + 1, row1 + 2);
    indices.push(row1 + 2, row2 + 1, row2 + 2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ----------------------------------------------------
// PROCEDURAL BEE
// ----------------------------------------------------

export interface BeeMeshGroup extends THREE.Group {
  leftWing?: THREE.Mesh;
  rightWing?: THREE.Mesh;
  pollenBaskets?: THREE.Mesh[];
  stinger?: THREE.Mesh;
  antennae?: THREE.Group[];
  role: BeeRole;
  wingPhase: number;
}

export function createProceduralBee(role: BeeRole = 'forager'): BeeMeshGroup {
  const bee = new THREE.Group() as BeeMeshGroup;
  bee.role = role;
  bee.wingPhase = 0;

  const isQueen = role === 'queen';
  const isGuard = role === 'guard';
  const scale = isQueen ? 1.5 : isGuard ? 1.2 : 1.0;

  const textureLoader = new THREE.TextureLoader();
  const beeChitinTex = textureLoader.load('/src/assets/images/bee_chitin_macro_1793462761277.jpg');
  beeChitinTex.colorSpace = THREE.SRGBColorSpace;
  beeChitinTex.wrapS = THREE.RepeatWrapping;
  beeChitinTex.wrapT = THREE.RepeatWrapping;
  beeChitinTex.repeat.set(1.5, 1.5);

  const wingTex = createIridescentWingTexture();

  // Thorax with photorealistic honeybee velvet and chitin
  const thoraxGeo = new THREE.SphereGeometry(0.48 * scale, 18, 14);
  thoraxGeo.scale(0.92, 0.95, 1.25);
  const thoraxMat = new THREE.MeshStandardMaterial({
    map: beeChitinTex,
    color: isQueen ? 0xF59E0B : isGuard ? 0x78350F : 0xD97706,
    roughness: 0.85,
    metalness: 0.08,
  });
  const thorax = new THREE.Mesh(thoraxGeo, thoraxMat);
  thorax.castShadow = true;
  bee.add(thorax);

  // Abdomen with glossy macro cuticle segments
  const abdomenLength = isQueen ? 1.6 : 1.1;
  const abdomenGeo = new THREE.SphereGeometry(0.52 * scale, 20, 18);
  abdomenGeo.scale(0.85, 0.82, abdomenLength * scale);
  const abdomenMat = new THREE.MeshStandardMaterial({
    map: beeChitinTex,
    roughness: 0.35,
    metalness: 0.18,
  });
  const abdomen = new THREE.Mesh(abdomenGeo, abdomenMat);
  abdomen.position.set(0, -0.05, 0.95 * scale * (isQueen ? 1.25 : 1.0));
  abdomen.rotation.x = 0.12;
  abdomen.castShadow = true;
  bee.add(abdomen);

  // Stinger
  const stingerGeo = new THREE.ConeGeometry(0.05 * scale, 0.3 * scale, 10);
  const stingerMat = new THREE.MeshStandardMaterial({
    color: isGuard ? 0xEF4444 : 0x0A0A0A,
    roughness: 0.2,
    metalness: 0.7,
    emissive: isGuard ? 0xB91C1C : 0x000000,
    emissiveIntensity: isGuard ? 0.7 : 0,
  });
  const stinger = new THREE.Mesh(stingerGeo, stingerMat);
  stinger.position.set(0, -0.1, 0.88 * scale * abdomenLength);
  stinger.rotation.x = -Math.PI / 2;
  abdomen.add(stinger);
  bee.stinger = stinger;

  // Head
  const headGeo = new THREE.SphereGeometry(0.38 * scale, 16, 14);
  headGeo.scale(1.15, 0.92, 0.88);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    roughness: 0.65,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 0.06, -0.58 * scale);
  bee.add(head);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.2 * scale, 16, 14);
  eyeGeo.scale(0.68, 1.3, 0.95);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x09090B,
    roughness: 0.08,
    metalness: 0.8,
  });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.28 * scale, 0.06, -0.12 * scale);
  leftEye.rotation.y = -0.32;
  head.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.28 * scale, 0.06, -0.12 * scale);
  rightEye.rotation.y = 0.32;
  head.add(rightEye);

  // Antennae
  const antennae: THREE.Group[] = [];
  [-1, 1].forEach((side) => {
    const antGroup = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.12, 0.22, -0.2),
      new THREE.Vector3(side * 0.22, 0.38, -0.42),
      new THREE.Vector3(side * 0.3, 0.48, -0.55),
    ]);
    const antGeo = new THREE.TubeGeometry(curve, 10, 0.022 * scale, 6, false);
    const antMat = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.7 });
    const antMesh = new THREE.Mesh(antGeo, antMat);
    antGroup.position.set(side * 0.1 * scale, 0.18 * scale, -0.28 * scale);
    antGroup.add(antMesh);
    head.add(antGroup);
    antennae.push(antGroup);
  });
  bee.antennae = antennae;

  // Wings
  const wingMat = new THREE.MeshPhysicalMaterial({
    map: wingTex,
    transparent: true,
    opacity: 0.88,
    roughness: 0.15,
    metalness: 0.1,
    transmission: 0.72,
    ior: 1.45,
    side: THREE.DoubleSide,
  });

  // Authentic curved organic bee forewing shape
  const beeWingShape = new THREE.Shape();
  beeWingShape.moveTo(0, 0);
  beeWingShape.bezierCurveTo(0.12 * scale, 0.3 * scale, 0.26 * scale, 0.8 * scale, 0.2 * scale, 1.35 * scale);
  beeWingShape.quadraticCurveTo(0.06 * scale, 1.5 * scale, -0.12 * scale, 1.35 * scale);
  beeWingShape.bezierCurveTo(-0.32 * scale, 0.9 * scale, -0.22 * scale, 0.35 * scale, 0, 0);

  const forewingGeo = new THREE.ShapeGeometry(beeWingShape, 12);

  const leftWing = new THREE.Mesh(forewingGeo, wingMat);
  leftWing.position.set(-0.28 * scale, 0.38 * scale, -0.06);
  leftWing.rotation.x = Math.PI / 2;
  leftWing.rotation.z = -Math.PI / 4.8;
  bee.add(leftWing);
  bee.leftWing = leftWing;

  const rightWing = new THREE.Mesh(forewingGeo, wingMat);
  rightWing.position.set(0.28 * scale, 0.38 * scale, -0.06);
  rightWing.rotation.x = Math.PI / 2;
  rightWing.rotation.z = Math.PI / 4.8;
  rightWing.scale.x = -1; // Mirror right wing
  bee.add(rightWing);
  bee.rightWing = rightWing;

  // Legs & Corbiculae
  const legMat = new THREE.MeshStandardMaterial({ color: 0x27272A, roughness: 0.75 });
  const pollenBaskets: THREE.Mesh[] = [];

  [-1, 1].forEach((side) => {
    const hindLeg = new THREE.Group();
    hindLeg.position.set(side * 0.32 * scale, -0.25 * scale, 0.38);

    const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.03, 0.45 * scale, 6), legMat);
    femur.rotation.x = 0.4;
    hindLeg.add(femur);

    const tibia = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.025, 0.52 * scale, 6), legMat);
    tibia.position.set(0, -0.32 * scale, 0.12);
    tibia.rotation.x = -0.7;
    hindLeg.add(tibia);

    const basketGeo = new THREE.SphereGeometry(0.18 * scale, 12, 10);
    basketGeo.scale(0.85, 1.4, 0.85);
    const basketMat = new THREE.MeshStandardMaterial({
      color: 0xFACC15,
      roughness: 0.85,
    });
    const basket = new THREE.Mesh(basketGeo, basketMat);
    basket.position.set(side * 0.08, -0.25 * scale, 0);
    basket.scale.set(0.01, 0.01, 0.01);
    tibia.add(basket);
    pollenBaskets.push(basket);

    bee.add(hindLeg);
  });
  bee.pollenBaskets = pollenBaskets;

  return bee;
}

// ----------------------------------------------------
// PREDATORS & INSECTS (MANTIS, SPIDER, WASP, LADYBUG, BUTTERFLY)
// ----------------------------------------------------

export interface WaspMeshGroup extends THREE.Group {
  leftWing?: THREE.Mesh;
  rightWing?: THREE.Mesh;
  wingPhase: number;
}

export function createProceduralWasp(): WaspMeshGroup {
  const wasp = new THREE.Group() as WaspMeshGroup;
  wasp.wingPhase = 0;

  const textureLoader = new THREE.TextureLoader();
  const waspChitinTex = textureLoader.load('/src/assets/images/wasp_chitin_macro_1793462777912.jpg');
  waspChitinTex.colorSpace = THREE.SRGBColorSpace;
  waspChitinTex.wrapS = THREE.RepeatWrapping;
  waspChitinTex.wrapT = THREE.RepeatWrapping;
  waspChitinTex.repeat.set(1.5, 2.0);

  const thoraxGeo = new THREE.SphereGeometry(0.44, 16, 14);
  thoraxGeo.scale(0.8, 0.92, 1.25);
  const thoraxMat = new THREE.MeshStandardMaterial({
    map: waspChitinTex,
    color: 0x27272A,
    roughness: 0.35,
    metalness: 0.25,
  });
  const thorax = new THREE.Mesh(thoraxGeo, thoraxMat);
  wasp.add(thorax);

  const petiole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.35, 8), thoraxMat);
  petiole.position.set(0, -0.05, 0.65);
  petiole.rotation.x = Math.PI / 2;
  wasp.add(petiole);

  const abdomenGeo = new THREE.ConeGeometry(0.5, 1.5, 16);
  const abdomenMat = new THREE.MeshStandardMaterial({
    map: waspChitinTex,
    roughness: 0.22,
    metalness: 0.3,
  });
  const abdomen = new THREE.Mesh(abdomenGeo, abdomenMat);
  abdomen.position.set(0, -0.12, 1.5);
  abdomen.rotation.x = -Math.PI / 2;
  wasp.add(abdomen);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), thoraxMat);
  head.position.set(0, 0.05, -0.58);
  wasp.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xEF4444,
    emissive: 0x991B1B,
    emissiveIntensity: 0.6,
    roughness: 0.15,
  });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), eyeMat);
  eyeL.position.set(-0.28, 0.08, -0.12);
  head.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), eyeMat);
  eyeR.position.set(0.28, 0.08, -0.12);
  head.add(eyeR);

  // Aerodynamic curved wasp wing shape
  const waspWingShape = new THREE.Shape();
  waspWingShape.moveTo(0, 0);
  waspWingShape.bezierCurveTo(0.12, 0.35, 0.24, 0.9, 0.18, 1.55);
  waspWingShape.quadraticCurveTo(0.08, 1.7, -0.06, 1.55);
  waspWingShape.bezierCurveTo(-0.25, 1.05, -0.16, 0.45, 0, 0);

  const wingGeo = new THREE.ShapeGeometry(waspWingShape, 12);
  const wingMat = new THREE.MeshPhysicalMaterial({
    transparent: true,
    opacity: 0.78,
    roughness: 0.1,
    transmission: 0.75,
    side: THREE.DoubleSide,
    color: 0xFEF08A,
  });

  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.set(-0.25, 0.35, -0.05);
  leftWing.rotation.x = Math.PI / 2;
  leftWing.rotation.z = -0.5;
  wasp.add(leftWing);
  wasp.leftWing = leftWing;

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(0.25, 0.35, -0.05);
  rightWing.rotation.x = Math.PI / 2;
  rightWing.rotation.z = 0.5;
  rightWing.scale.x = -1; // Mirror right wing
  wasp.add(rightWing);
  wasp.rightWing = rightWing;

  return wasp;
}

export interface MantisMeshGroup extends THREE.Group {
  leftArm?: THREE.Group;
  rightArm?: THREE.Group;
  head?: THREE.Group;
  strikeProgress: number;
}

export function createProceduralMantis(): MantisMeshGroup {
  // Master Ambush Predator: Camouflaged green on stems, strikes with raptorial forelegs!
  const mantis = new THREE.Group() as MantisMeshGroup;
  mantis.strikeProgress = 0;

  const mantisTex = getMacroTexture(MACRO_TEXTURES.MANTIS_CHITIN, 2, 2);
  const greenMat = new THREE.MeshStandardMaterial({
    map: mantisTex,
    color: 0x86EFAC, // Camouflaged fresh mantis green
    roughness: 0.38,
    metalness: 0.12,
  });

  // Slender elongated prothorax (neck)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 2.8, 8), greenMat);
  neck.position.set(0, 1.4, 0);
  neck.rotation.x = 0.25;
  mantis.add(neck);

  // Triangular mobile head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.8, 0.35);

  const headGeo = new THREE.ConeGeometry(0.45, 0.7, 3);
  headGeo.rotateZ(Math.PI);
  const headMesh = new THREE.Mesh(headGeo, greenMat);
  headGroup.add(headMesh);

  // Bulging compound eyes
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x15803D, roughness: 0.2, metalness: 0.3 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), eyeMat);
  eyeL.position.set(-0.35, 0.1, 0);
  headGroup.add(eyeL);

  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), eyeMat);
  eyeR.position.set(0.35, 0.1, 0);
  headGroup.add(eyeR);

  mantis.add(headGroup);
  mantis.head = headGroup;

  // Slender Abdomen
  const abdomenGeo = new THREE.CylinderGeometry(0.38, 0.2, 3.6, 8);
  const abdomen = new THREE.Mesh(abdomenGeo, greenMat);
  abdomen.position.set(0, -0.6, -1.5);
  abdomen.rotation.x = -Math.PI / 3.5;
  mantis.add(abdomen);

  // Raptorial Forelegs (Spined ambush arms held in prayer)
  const createRaptorialArm = (side: number) => {
    const arm = new THREE.Group();
    // Coxa
    const coxa = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 6), greenMat);
    coxa.position.set(0, -0.5, 0);
    arm.add(coxa);

    // Spined Femur (grasps prey!)
    const femur = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 1.5, 6), greenMat);
    femur.position.set(0, -1.4, 0.2);
    femur.rotation.x = 1.6;
    arm.add(femur);

    // Spined Tibia blade
    const tibia = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.3, 5), greenMat);
    tibia.position.set(0, -1.0, 0.8);
    tibia.rotation.x = -1.8;
    arm.add(tibia);

    arm.position.set(side * 0.35, 2.4, 0.2);
    arm.rotation.y = side * 0.3;
    return arm;
  };

  const leftArm = createRaptorialArm(-1);
  const rightArm = createRaptorialArm(1);
  mantis.add(leftArm);
  mantis.add(rightArm);
  mantis.leftArm = leftArm;
  mantis.rightArm = rightArm;

  mantis.scale.setScalar(1.2);
  return mantis;
}

export function createProceduralSpider(): THREE.Group {
  // Crab Spider (Misumena vatia) camouflaged on petals
  const spider = new THREE.Group();

  const creamMat = new THREE.MeshStandardMaterial({
    color: 0xFEF3C7, // Creamy yellow flower petal camouflage
    roughness: 0.4,
  });

  // Cephalothorax
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), creamMat);
  thorax.scale.set(1.2, 0.7, 1.0);
  spider.add(thorax);

  // Bulbous Abdomen
  const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), creamMat);
  abdomen.position.set(0, 0.15, 0.65);
  abdomen.scale.set(1.15, 0.85, 1.3);
  spider.add(abdomen);

  // 8 Crab-like legs (first two pairs held wide in ambush)
  const legMat = new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.5 });
  for (let s of [-1, 1]) {
    // Huge front hunting legs
    const frontLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 1.6, 5), legMat);
    frontLeg1.position.set(s * 0.8, -0.05, -0.4);
    frontLeg1.rotation.z = s * 1.3;
    frontLeg1.rotation.y = s * 0.4;
    spider.add(frontLeg1);

    const frontLeg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 1.4, 5), legMat);
    frontLeg2.position.set(s * 0.75, -0.05, 0.1);
    frontLeg2.rotation.z = s * 1.2;
    spider.add(frontLeg2);

    // Rear walking legs
    const backLeg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.8, 5), legMat);
    backLeg1.position.set(s * 0.45, -0.05, 0.5);
    backLeg1.rotation.z = s * 0.8;
    spider.add(backLeg1);
  }

  spider.scale.setScalar(0.85);
  return spider;
}

export function createProceduralLadybug(): THREE.Group {
  // Peaceful Ladybird Beetle climbing on grass
  const ladybug = new THREE.Group();

  // Glossy Scarlet Elytra Shell
  const elytraGeo = new THREE.SphereGeometry(0.38, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const elytraMat = new THREE.MeshStandardMaterial({
    color: 0xDC2626, // Vivid scarlet red
    roughness: 0.15,
    metalness: 0.2,
  });
  const elytra = new THREE.Mesh(elytraGeo, elytraMat);
  elytra.scale.set(1.0, 0.85, 1.2);
  ladybug.add(elytra);

  // 7 Black spots
  const spotMat = new THREE.MeshStandardMaterial({ color: 0x09090B, roughness: 0.2 });
  const spotGeo = new THREE.CircleGeometry(0.07, 8);

  const spotPositions = [
    { x: -0.18, y: 0.2, z: 0.1 },
    { x: 0.18, y: 0.2, z: 0.1 },
    { x: -0.22, y: 0.15, z: -0.2 },
    { x: 0.22, y: 0.15, z: -0.2 },
    { x: -0.15, y: 0.22, z: 0.35 },
    { x: 0.15, y: 0.22, z: 0.35 },
    { x: 0.0, y: 0.28, z: -0.05 },
  ];

  spotPositions.forEach((p) => {
    const s = new THREE.Mesh(spotGeo, spotMat);
    s.position.set(p.x, p.y, p.z);
    s.rotation.x = -Math.PI / 2.5;
    ladybug.add(s);
  });

  // Black head & pronotum
  const headMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.3 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), headMat);
  head.position.set(0, 0.02, -0.42);
  ladybug.add(head);

  ladybug.scale.setScalar(0.9);
  return ladybug;
}

export interface ButterflyMeshGroup extends THREE.Group {
  leftWing?: THREE.Mesh;
  rightWing?: THREE.Mesh;
  wingPhase: number;
}

export function createProceduralButterfly(): ButterflyMeshGroup {
  // Swallowtail pollinator flitting gracefully between flowers
  const bfly = new THREE.Group() as ButterflyMeshGroup;
  bfly.wingPhase = 0;

  const wingTex = createButterflyWingTexture();
  const wingMat = new THREE.MeshStandardMaterial({
    map: wingTex,
    roughness: 0.4,
    side: THREE.DoubleSide,
  });

  // Body
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 1.2, 6), bodyMat);
  body.rotation.x = Math.PI / 2;
  bfly.add(body);

  // Authentic Swallowtail butterfly wing shape (curved forewing + scalloped hindwing with tail)
  const bflyWingShape = new THREE.Shape();
  bflyWingShape.moveTo(0, 0); // Root hinge
  bflyWingShape.bezierCurveTo(0.3, 0.6, 0.8, 1.4, 1.6, 1.75); // Leading curved margin to apex
  bflyWingShape.quadraticCurveTo(1.9, 1.55, 1.7, 1.1); // Apical curve
  bflyWingShape.quadraticCurveTo(1.4, 0.7, 1.5, 0.35); // Scalloped margin
  bflyWingShape.quadraticCurveTo(1.65, 0.05, 1.85, -0.35); // Swallowtail tail extension!
  bflyWingShape.quadraticCurveTo(1.7, -0.45, 1.45, -0.15); // Tail notch
  bflyWingShape.bezierCurveTo(1.1, -0.35, 0.4, -0.25, 0, 0); // Inner margin back to root

  const wingGeo = new THREE.ShapeGeometry(bflyWingShape, 16);

  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.position.set(-0.05, 0.05, 0);
  leftWing.rotation.y = Math.PI;
  bfly.add(leftWing);
  bfly.leftWing = leftWing;

  const rightWing = new THREE.Mesh(wingGeo, wingMat);
  rightWing.position.set(0.05, 0.05, 0);
  rightWing.scale.x = -1; // Mirror right wing
  bfly.add(rightWing);
  bfly.rightWing = rightWing;

  bfly.scale.setScalar(1.2);
  return bfly;
}

// ----------------------------------------------------
// BOTANICAL MEADOW FLORA: CLOVER, DANDELION, POPPIES, BLUEBELLS, THISTLES, LAVENDER
// ----------------------------------------------------

export function createGiantClover(height: number = 10): THREE.Group {
  const clover = new THREE.Group();

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.6, height * 0.35, 0.3),
    new THREE.Vector3(0.3, height * 0.75, -0.4),
    new THREE.Vector3(0, height, 0),
  ]);
  const stemTex = getMacroTexture(MACRO_TEXTURES.STEM, 1, 6);
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(stemCurve, 20, 0.28, 10, false),
    new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.65 })
  );
  stem.castShadow = true;
  stem.receiveShadow = true;
  clover.add(stem);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, height, 0);

  const floretShape = new THREE.Shape();
  floretShape.moveTo(-0.12, 0);
  floretShape.quadraticCurveTo(-0.18, 0.8, -0.3, 1.6);
  floretShape.quadraticCurveTo(0, 1.8, 0.3, 1.6);
  floretShape.quadraticCurveTo(0.18, 0.8, 0.12, 0);
  floretShape.closePath();

  const floretExtrude = new THREE.ExtrudeGeometry(floretShape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
  });

  const floretTex = getMacroTexture(MACRO_TEXTURES.THISTLE, 1, 1);
  const floretMat = new THREE.MeshStandardMaterial({
    map: floretTex,
    color: 0xFB7185,
    roughness: 0.45,
  });
  const floretBaseMat = new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.8 });

  for (let i = 0; i < 54; i++) {
    const phi = Math.acos(-1 + (2 * i) / 54);
    const theta = Math.sqrt(54 * Math.PI) * phi;

    const floretMesh = new THREE.Mesh(floretExtrude, floretMat);
    floretMesh.position.set(
      Math.sin(phi) * Math.cos(theta) * 1.1,
      Math.cos(phi) * 1.15,
      Math.sin(phi) * Math.sin(theta) * 1.1
    );
    floretMesh.lookAt(floretMesh.position.clone().multiplyScalar(2.5));

    const calyx = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.4, 5), floretBaseMat);
    calyx.position.z = -0.2;
    calyx.rotation.x = Math.PI / 2;
    floretMesh.add(calyx);

    headGroup.add(floretMesh);
  }

  const nectarCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 14),
    new THREE.MeshPhysicalMaterial({
      color: 0xF59E0B,
      transmission: 0.85,
      roughness: 0.1,
      transparent: true,
      opacity: 0.9,
      emissive: 0xD97706,
      emissiveIntensity: 0.35,
    })
  );
  headGroup.add(nectarCore);
  clover.add(headGroup);

  const leafTex = getMacroTexture(MACRO_TEXTURES.BOTANICAL_LEAF, 1, 1);
  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    roughness: 0.55,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const leafGeo = new THREE.CircleGeometry(2.2, 16);

  for (let l = 0; l < 3; l++) {
    const angle = (l * Math.PI * 2) / 3;
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.set(Math.cos(angle) * 1.8, height * 0.55, Math.sin(angle) * 1.8);
    leaf.rotation.x = -Math.PI / 2.2;
    leaf.rotation.z = angle;
    leaf.receiveShadow = true;
    clover.add(leaf);
  }

  return clover;
}

export function createGiantDandelion(height: number = 12): THREE.Group {
  const dandelion = new THREE.Group();

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.4, height * 0.4, 0.5),
    new THREE.Vector3(0, height, 0),
  ]);
  const stemTex = getMacroTexture(MACRO_TEXTURES.STEM, 1, 8);
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(stemCurve, 18, 0.3, 10, false),
    new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.68 })
  );
  dandelion.add(stem);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, height, 0);

  const strapGeo = new THREE.BoxGeometry(0.18, 0.04, 2.2);
  strapGeo.translate(0, 0, 1.1);
  const dandelionTex = getMacroTexture(MACRO_TEXTURES.DANDELION, 1, 1);
  const strapMat = new THREE.MeshStandardMaterial({
    map: dandelionTex,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 68; i++) {
    const angle = (i * Math.PI * 2) / 32 + (i * 0.15);
    const radius = 0.3 + (i / 68) * 1.2;
    const floret = new THREE.Mesh(strapGeo, strapMat);
    floret.position.set(Math.cos(angle) * radius, 0.15 * Math.sin(i), Math.sin(angle) * radius);
    floret.rotation.y = angle;
    floret.rotation.x = 0.15 + (i / 68) * 0.25;
    headGroup.add(floret);
  }

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 0.9, 0.35, 18),
    new THREE.MeshStandardMaterial({
      map: dandelionTex,
      roughness: 0.75,
      emissive: 0x854D0E,
      emissiveIntensity: 0.2,
    })
  );
  headGroup.add(pad);

  dandelion.add(headGroup);
  return dandelion;
}

export function createDandelionSeedHead(height: number = 13): THREE.Group {
  const clock = new THREE.Group();

  const stemTex = getMacroTexture(MACRO_TEXTURES.STEM, 1, 8);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, height, 8),
    new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.75 })
  );
  stem.position.y = height / 2;
  clock.add(stem);

  const head = new THREE.Group();
  head.position.set(0, height, 0);

  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), new THREE.MeshStandardMaterial({ color: 0x57391F })));

  const silkMat = new THREE.MeshStandardMaterial({ color: 0xFAFAFA, roughness: 0.2, transparent: true, opacity: 0.85 });
  const stalkMat = new THREE.MeshStandardMaterial({ color: 0xD4D4D8, roughness: 0.5 });
  const seedMat = new THREE.MeshStandardMaterial({ color: 0x27272A, roughness: 0.9 });

  for (let i = 0; i < 54; i++) {
    const phi = Math.acos(-1 + (2 * i) / 54);
    const theta = Math.sqrt(54 * Math.PI) * phi;
    const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).normalize();

    const stalkGroup = new THREE.Group();
    stalkGroup.position.copy(dir.clone().multiplyScalar(0.7));

    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 4), stalkMat);
    stalk.position.set(0, 0.8, 0);
    stalkGroup.add(stalk);

    const seed = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.35, 5), seedMat);
    seed.position.set(0, 0.15, 0);
    stalkGroup.add(seed);

    const umbrella = new THREE.Mesh(new THREE.CircleGeometry(0.35, 10), silkMat);
    umbrella.position.set(0, 1.6, 0);
    umbrella.rotation.x = -Math.PI / 2;
    stalkGroup.add(umbrella);

    stalkGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    head.add(stalkGroup);
  }

  clock.add(head);
  return clock;
}

export function createGiantPoppy(height: number = 14): THREE.Group {
  const poppy = new THREE.Group();

  const stemTex = getMacroTexture(MACRO_TEXTURES.STEM, 1, 8);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.3, height, 10),
    new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.75 })
  );
  stem.position.y = height / 2;
  poppy.add(stem);

  const head = new THREE.Group();
  head.position.set(0, height, 0);

  const petalGeo = new THREE.SphereGeometry(3.0, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.3);
  const poppyTex = getMacroTexture(MACRO_TEXTURES.POPPY, 1, 1);
  const petalMat = new THREE.MeshPhysicalMaterial({
    map: poppyTex,
    roughness: 0.35,
    transmission: 0.32,
    opacity: 0.98,
    transparent: true,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const p = new THREE.Mesh(petalGeo, petalMat);
    p.rotation.y = angle;
    p.rotation.x = 0.38;
    p.scale.set(0.95, 0.65, 1.15);
    head.add(p);
  }

  const leafTex = getMacroTexture(MACRO_TEXTURES.BOTANICAL_LEAF, 2, 2);
  const capsule = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 14),
    new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.65 })
  );
  capsule.position.y = 0.3;
  head.add(capsule);

  poppy.add(head);
  return poppy;
}

export function createGiantBluebell(height: number = 11): THREE.Group {
  const bluebell = new THREE.Group();

  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.4, height * 0.4, 0),
    new THREE.Vector3(1.2, height * 0.75, 0),
    new THREE.Vector3(2.2, height * 0.95, 0),
    new THREE.Vector3(3.0, height * 0.85, 0),
  ]);
  const stemTex = getMacroTexture(MACRO_TEXTURES.STEM, 1, 8);
  const stem = new THREE.Mesh(
    new THREE.TubeGeometry(stemCurve, 20, 0.25, 8, false),
    new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.68 })
  );
  bluebell.add(stem);

  const bellGeo = new THREE.CylinderGeometry(0.9, 0.3, 1.8, 12, 1, true);
  const bluebellTex = getMacroTexture(MACRO_TEXTURES.BLUEBELL, 1, 1);
  const bellMat = new THREE.MeshPhysicalMaterial({
    map: bluebellTex,
    roughness: 0.32,
    transmission: 0.45,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
  });

  const bellPositions = [
    { x: 1.4, y: height * 0.78, z: 0.3 },
    { x: 2.0, y: height * 0.9, z: -0.3 },
    { x: 2.7, y: height * 0.88, z: 0.2 },
    { x: 3.1, y: height * 0.8, z: 0.0 },
  ];

  bellPositions.forEach((pos) => {
    const bell = new THREE.Mesh(bellGeo, bellMat);
    bell.position.set(pos.x, pos.y, pos.z);
    bell.rotation.x = Math.PI;
    bell.rotation.z = -0.3;
    bluebell.add(bell);
  });

  return bluebell;
}

export function createWildThistle(height: number = 12): THREE.Group {
  // Prickly Meadow Thistle (Cirsium vulgare)
  const thistle = new THREE.Group();

  const stemTex = getMacroTexture(MACRO_TEXTURES.STEM, 1, 8);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.35, height, 8),
    new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.75 })
  );
  stem.position.y = height / 2;
  thistle.add(stem);

  const head = new THREE.Group();
  head.position.set(0, height, 0);

  // Involucre bulb with spiny green bracts
  const thistleTex = getMacroTexture(MACRO_TEXTURES.THISTLE, 1, 1);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(1.2, 14, 12),
    new THREE.MeshStandardMaterial({ map: thistleTex, roughness: 0.75 })
  );
  bulb.scale.set(0.9, 1.2, 0.9);
  head.add(bulb);

  // Purple crown brush florets
  const brushGeo = new THREE.ConeGeometry(0.08, 1.8, 5);
  brushGeo.translate(0, 0.9, 0);
  const brushMat = new THREE.MeshStandardMaterial({
    map: thistleTex,
    color: 0xC084FC,
    roughness: 0.38,
  });

  for (let i = 0; i < 48; i++) {
    const phi = (i / 48) * Math.PI * 0.4;
    const theta = i * 2.4;
    const brush = new THREE.Mesh(brushGeo, brushMat);
    brush.position.set(Math.sin(phi) * Math.cos(theta) * 0.9, 1.1 + Math.cos(phi) * 0.4, Math.sin(phi) * Math.sin(theta) * 0.9);
    brush.rotation.x = Math.sin(phi) * Math.sin(theta) * 0.4;
    brush.rotation.z = -Math.sin(phi) * Math.cos(theta) * 0.4;
    head.add(brush);
  }

  thistle.add(head);
  return thistle;
}

export function createLavenderSpike(height: number = 10): THREE.Group {
  // Fragrant tiered Lavender (Lavandula)
  const lavender = new THREE.Group();

  const stemTex = getMacroTexture(MACRO_TEXTURES.STEM, 1, 8);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, height, 6),
    new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.7 })
  );
  stem.position.y = height / 2;
  lavender.add(stem);

  const floretGeo = new THREE.SphereGeometry(0.24, 8, 6);
  floretGeo.scale(0.8, 1.3, 0.8);
  const bluebellTex = getMacroTexture(MACRO_TEXTURES.BLUEBELL, 2, 2);
  const floretMat = new THREE.MeshStandardMaterial({
    map: bluebellTex,
    color: 0xA78BFA,
    roughness: 0.35,
  });

  // Tiered whorls along upper half
  for (let tier = 0; tier < 8; tier++) {
    const y = height * 0.6 + tier * 0.45;
    for (let f = 0; f < 6; f++) {
      const angle = (f * Math.PI * 2) / 6 + (tier * 0.5);
      const floret = new THREE.Mesh(floretGeo, floretMat);
      floret.position.set(Math.cos(angle) * 0.4, y, Math.sin(angle) * 0.4);
      lavender.add(floret);
    }
  }

  return lavender;
}

// ----------------------------------------------------
// DETAILED COMPOSITE TREES & FUNGI
// ----------------------------------------------------

export function createBracketFungus(width: number = 3.2, depth: number = 2.4): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.CylinderGeometry(width, width * 0.85, 0.45, 20, 1, false, 0, Math.PI);
  geo.scale(1.0, 1.0, depth / width);

  const fungusTex = getMacroTexture(MACRO_TEXTURES.BRACKET_FUNGUS, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    map: fungusTex,
    roughness: 0.82,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = -Math.PI / 2;
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

// ----------------------------------------------------
// BOTANICALLY ACCURATE 3D FOLIAGE, NEEDLES & PINECONES
// ----------------------------------------------------

export function createOakLeafShape(length: number = 3.4, width: number = 1.9): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = width / 2;

  shape.moveTo(0, 0); // Petiole base
  // Right margin with 4 distinct rounded lobes and sinusoidal sinuses
  shape.bezierCurveTo(hw * 0.35, length * 0.1, hw * 0.75, length * 0.16, hw * 0.8, length * 0.26); // Lobe 1
  shape.bezierCurveTo(hw * 0.5, length * 0.32, hw * 0.45, length * 0.38, hw * 0.95, length * 0.48); // Lobe 2
  shape.bezierCurveTo(hw * 1.1, length * 0.56, hw * 0.65, length * 0.64, hw * 0.9, length * 0.76); // Lobe 3
  shape.bezierCurveTo(hw * 0.98, length * 0.83, hw * 0.45, length * 0.88, 0, length); // Rounded apex

  // Left margin with organic asymmetry
  shape.bezierCurveTo(-hw * 0.45, length * 0.88, -hw * 0.98, length * 0.83, -hw * 0.9, length * 0.76); // Lobe 3
  shape.bezierCurveTo(-hw * 0.65, length * 0.64, -hw * 1.1, length * 0.56, -hw * 0.95, length * 0.48); // Lobe 2
  shape.bezierCurveTo(-hw * 0.45, length * 0.38, -hw * 0.5, length * 0.32, -hw * 0.8, length * 0.26); // Lobe 1
  shape.bezierCurveTo(-hw * 0.75, length * 0.16, -hw * 0.35, length * 0.1, 0, 0);

  return shape;
}

export function createBirchLeafShape(length: number = 2.2, width: number = 1.5): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = width / 2;

  shape.moveTo(0, 0);
  // Deltoid diamond-ovate with tapering acuminate tip
  shape.bezierCurveTo(hw * 0.6, length * 0.15, hw * 1.05, length * 0.35, hw * 0.9, length * 0.6);
  shape.bezierCurveTo(hw * 0.75, length * 0.75, hw * 0.35, length * 0.9, 0, length);
  shape.bezierCurveTo(-hw * 0.35, length * 0.9, -hw * 0.75, length * 0.75, -hw * 0.9, length * 0.6);
  shape.bezierCurveTo(-hw * 1.05, length * 0.35, -hw * 0.6, length * 0.15, 0, 0);

  return shape;
}

// Cached Shared Botanical Materials for high performance
let sharedOakLeafMat: THREE.MeshStandardMaterial | null = null;
let sharedPineNeedleMat: THREE.MeshStandardMaterial | null = null;
let sharedPineconeMat: THREE.MeshStandardMaterial | null = null;
let sharedBirchLeafMat: THREE.MeshPhysicalMaterial | null = null;
let sharedTwigMat: THREE.MeshStandardMaterial | null = null;

function getOakLeafMaterial(): THREE.MeshStandardMaterial {
  if (!sharedOakLeafMat) {
    const leafTex = getMacroTexture(MACRO_TEXTURES.BOTANICAL_LEAF, 1, 1);
    sharedOakLeafMat = new THREE.MeshStandardMaterial({
      map: leafTex,
      color: 0x15803D,
      roughness: 0.42,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
  }
  return sharedOakLeafMat;
}

function getPineNeedleMaterial(): THREE.MeshStandardMaterial {
  if (!sharedPineNeedleMat) {
    sharedPineNeedleMat = new THREE.MeshStandardMaterial({
      color: 0x166534, // Rich Scots pine evergreen needle
      roughness: 0.32, // Waxy cuticle sheen
      metalness: 0.08,
      side: THREE.DoubleSide,
    });
  }
  return sharedPineNeedleMat;
}

function getPineconeMaterial(): THREE.MeshStandardMaterial {
  if (!sharedPineconeMat) {
    const barkTex = getMacroTexture(MACRO_TEXTURES.OAK_BARK, 2, 2);
    sharedPineconeMat = new THREE.MeshStandardMaterial({
      map: barkTex,
      color: 0x663311, // Woody umber pinecone scales
      roughness: 0.88,
      metalness: 0.02,
    });
  }
  return sharedPineconeMat;
}

function getBirchLeafMaterial(): THREE.MeshPhysicalMaterial {
  if (!sharedBirchLeafMat) {
    const leafTex = getMacroTexture(MACRO_TEXTURES.BOTANICAL_LEAF, 1, 1);
    sharedBirchLeafMat = new THREE.MeshPhysicalMaterial({
      map: leafTex,
      color: 0x84CC16,
      roughness: 0.45,
      transmission: 0.2,
      side: THREE.DoubleSide,
    });
  }
  return sharedBirchLeafMat;
}

function getTwigMaterial(): THREE.MeshStandardMaterial {
  if (!sharedTwigMat) {
    sharedTwigMat = new THREE.MeshStandardMaterial({
      color: 0x3E2723,
      roughness: 0.9,
    });
  }
  return sharedTwigMat;
}

export function createDetailedPinecone(length: number = 2.6, radius: number = 1.2): THREE.Group {
  const coneGroup = new THREE.Group();
  const mat = getPineconeMaterial();

  // Central axis core
  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.25, radius * 0.5, length, 8), mat);
  core.position.y = length / 2;
  coneGroup.add(core);

  // 36 Spiraling Imbricated Woody Scales with distinct thickness and tapering tips
  const scaleGeo = new THREE.BoxGeometry(radius * 0.45, 0.1, radius * 0.65);
  const pos = scaleGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getZ(i) > 0) {
      pos.setX(i, pos.getX(i) * 0.55);
      pos.setY(i, pos.getY(i) * 0.4);
    }
  }
  scaleGeo.computeVertexNormals();

  const totalScales = 36;
  const goldenAngle = 2.39996; // 137.5 degrees

  for (let s = 0; s < totalScales; s++) {
    const t = s / totalScales;
    const y = t * length * 0.88 + 0.12;
    const profileRad = Math.sin(t * Math.PI) * radius;
    const angle = s * goldenAngle;

    const scaleMesh = new THREE.Mesh(scaleGeo, mat);
    scaleMesh.position.set(Math.cos(angle) * (profileRad * 0.75), y, Math.sin(angle) * (profileRad * 0.75));
    scaleMesh.rotation.y = -angle - Math.PI / 2;
    scaleMesh.rotation.x = 0.32 + (1.0 - t) * 0.3;
    scaleMesh.castShadow = true;
    coneGroup.add(scaleMesh);
  }

  // Woody peduncle stem
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.8, 6), mat);
  stalk.position.y = -0.35;
  coneGroup.add(stalk);

  return coneGroup;
}

export function create3DOakLeafMesh(length: number = 3.4, width: number = 1.9): THREE.Group {
  const leafGroup = new THREE.Group();
  const shape = createOakLeafShape(length, width);
  const geo = new THREE.ShapeGeometry(shape, 8);

  // Subtle natural cupped curvature
  const pos = geo.attributes.position;
  const hw = width / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const cup = -Math.sin((Math.abs(x) / (hw + 0.1)) * Math.PI * 0.5) * 0.25 + Math.sin((y / length) * Math.PI) * 0.15;
    pos.setZ(i, cup);
  }
  geo.computeVertexNormals();

  const leafMat = getOakLeafMaterial();
  const mesh = new THREE.Mesh(geo, leafMat);
  mesh.castShadow = true;
  leafGroup.add(mesh);

  // Raised 3D midrib vein and petiole stalk
  const twigMat = getTwigMaterial();
  const vein = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.08, length * 1.15, 4),
    twigMat
  );
  vein.position.set(0, length * 0.48, 0.04);
  leafGroup.add(vein);

  return leafGroup;
}

export function createDetailedOakLeafSpray(scale: number = 1.0): THREE.Group {
  const rosette = new THREE.Group();
  const twigMat = getTwigMaterial();

  // Central woody twig node
  const node = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15 * scale, 0.28 * scale, 4.0 * scale, 5),
    twigMat
  );
  node.position.y = 2.0 * scale;
  rosette.add(node);

  // 8 lobed 3D oak leaves radiating spirally
  const leafCount = 8;
  for (let l = 0; l < leafCount; l++) {
    const angle = (l * Math.PI * 2) / leafCount + (l * 0.25);
    const leaf = create3DOakLeafMesh(3.4 * scale, 1.9 * scale);
    leaf.position.set(Math.cos(angle) * 0.35 * scale, (1.2 + l * 0.3) * scale, Math.sin(angle) * 0.35 * scale);
    leaf.rotation.y = angle - Math.PI / 2;
    leaf.rotation.x = 0.55 + (l % 2) * 0.18;
    leaf.rotation.z = (l % 2 === 0 ? 0.22 : -0.22);
    rosette.add(leaf);
  }

  return rosette;
}

export function createDetailedPineNeedleSpray(scale: number = 1.0): THREE.Group {
  const group = new THREE.Group();
  const twigMat = getTwigMaterial();
  const needleMat = getPineNeedleMaterial();

  const length = 7.5 * scale;
  // Woody branchlet twig
  const twig = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.35 * scale, length, 6),
    twigMat
  );
  twig.position.y = length / 2;
  group.add(twig);

  // Slender curved 3D needle geometry
  const needleGeo = new THREE.ConeGeometry(0.045 * scale, 2.6 * scale, 4);
  needleGeo.translate(0, 1.3 * scale, 0);

  // 24 Radial Needle Fascicles (Pairs of needles) spiraling along the twig
  const fascicleCount = 24;
  for (let f = 0; f < fascicleCount; f++) {
    const t = f / fascicleCount;
    const y = (0.18 + t * 0.78) * length;
    const baseAngle = f * 1.85;

    // Needle pair spreading in a V
    for (let s of [-0.22, 0.22]) {
      const needle = new THREE.Mesh(needleGeo, needleMat);
      needle.position.set(Math.cos(baseAngle) * 0.28 * scale, y, Math.sin(baseAngle) * 0.28 * scale);
      needle.rotation.y = baseAngle + s;
      needle.rotation.x = 0.58 + Math.sin(baseAngle) * 0.1;
      needle.rotation.z = -0.58 * Math.cos(baseAngle);
      group.add(needle);
    }
  }

  // Clusters of 2 detailed 3D pinecones at branchlet node
  const cone1 = createDetailedPinecone(2.4 * scale, 1.1 * scale);
  cone1.position.set(0.45 * scale, length * 0.45, 0.25 * scale);
  cone1.rotation.z = 1.25;
  cone1.rotation.y = 0.5;
  group.add(cone1);

  const cone2 = createDetailedPinecone(2.0 * scale, 0.95 * scale);
  cone2.position.set(-0.4 * scale, length * 0.52, -0.3 * scale);
  cone2.rotation.z = -1.15;
  cone2.rotation.y = -0.8;
  group.add(cone2);

  return group;
}

export function createDetailedBirchLeafSpray(scale: number = 1.0): THREE.Group {
  const group = new THREE.Group();
  const twigMat = getTwigMaterial();
  const leafMat = getBirchLeafMaterial();

  // Graceful weeping pendulous curve
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.5 * scale, -2.5 * scale, 0.2 * scale),
    new THREE.Vector3(1.2 * scale, -5.5 * scale, -0.4 * scale),
    new THREE.Vector3(1.6 * scale, -8.5 * scale, 0.1 * scale),
  ]);

  const twigMesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 10, 0.09 * scale, 5, false),
    twigMat
  );
  group.add(twigMesh);

  // 3D Deltoid serrated birch leaf geometry
  const leafShape = createBirchLeafShape(2.2 * scale, 1.4 * scale);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 6);

  // Attach 8 fluttering leaves along the weeping branchlet
  const points = curve.getPoints(8);
  for (let i = 1; i < points.length; i++) {
    const pt = points[i];
    const leafMesh = new THREE.Mesh(leafGeo, leafMat);
    leafMesh.position.set(pt.x, pt.y, pt.z);
    leafMesh.rotation.y = (i * Math.PI) / 2.5;
    leafMesh.rotation.x = 0.4 + (i * 0.1);
    leafMesh.rotation.z = (i % 2 === 0 ? 0.3 : -0.3);
    leafMesh.castShadow = true;
    group.add(leafMesh);

    // Petiole stem
    const petiole = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * scale, 0.03 * scale, 0.6 * scale, 4), twigMat);
    petiole.position.set(pt.x, pt.y + 0.25 * scale, pt.z);
    group.add(petiole);
  }

  // Hanging pollen catkin tassel at branchlet tip
  const catkin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12 * scale, 0.08 * scale, 1.8 * scale, 6),
    new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.8 })
  );
  const tip = points[points.length - 1];
  catkin.position.set(tip.x, tip.y - 0.9 * scale, tip.z);
  group.add(catkin);

  return group;
}

export function createScotsPineTree(height: number = 46): THREE.Group {
  const pine = new THREE.Group();

  // Rugged dark brown trunk at base, warm cinnamon orange on upper tiers
  const baseBarkTex = getMacroTexture(MACRO_TEXTURES.OAK_BARK, 2, 6);
  const lowerTrunkMat = new THREE.MeshStandardMaterial({
    map: baseBarkTex,
    roughness: 0.94,
    color: 0x3E2723,
  });

  const upperTrunkMat = new THREE.MeshStandardMaterial({
    roughness: 0.88,
    color: 0xC2410C, // Scots pine characteristic cinnamon upper trunk
  });

  // 1. Tapered Trunk
  const lowerH = height * 0.42;
  const lowerTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 4.8, lowerH, 16),
    lowerTrunkMat
  );
  lowerTrunk.position.y = lowerH / 2;
  lowerTrunk.castShadow = true;
  lowerTrunk.receiveShadow = true;
  pine.add(lowerTrunk);

  // Basal flared anchor roots
  for (let r = 0; r < 5; r++) {
    const rAngle = (r * Math.PI * 2) / 5;
    const root = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6.0, 6), lowerTrunkMat);
    root.position.set(Math.cos(rAngle) * 4.2, 1.8, Math.sin(rAngle) * 4.2);
    root.rotation.y = rAngle;
    root.rotation.z = -Math.cos(rAngle) * 0.5;
    root.rotation.x = Math.sin(rAngle) * 0.5;
    pine.add(root);
  }

  const upperH = height * 0.58;
  const upperTrunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 2.4, upperH, 14),
    upperTrunkMat
  );
  upperTrunk.position.y = lowerH + upperH / 2;
  upperTrunk.castShadow = true;
  pine.add(upperTrunk);

  // 2. Horizontal Whorled Boughs with 3D Needle Fascicles & Pinecones
  const whorlTiers = [
    { y: height * 0.52, count: 5, boughLen: 16, sprayScale: 1.35 },
    { y: height * 0.65, count: 5, boughLen: 14, sprayScale: 1.3 },
    { y: height * 0.77, count: 4, boughLen: 12, sprayScale: 1.25 },
    { y: height * 0.88, count: 4, boughLen: 9, sprayScale: 1.2 },
    { y: height * 0.96, count: 3, boughLen: 6, sprayScale: 1.15 },
  ];

  whorlTiers.forEach((tier, tierIdx) => {
    const angleOffset = (tierIdx * Math.PI) / 3.5;
    for (let b = 0; b < tier.count; b++) {
      const angle = (b * Math.PI * 2) / tier.count + angleOffset + (Math.random() - 0.5) * 0.2;

      // Horizontal wood bough
      const boughWood = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.85, tier.boughLen, 6),
        upperTrunkMat
      );
      boughWood.position.set(Math.cos(angle) * (tier.boughLen / 2), tier.y + 0.4, Math.sin(angle) * (tier.boughLen / 2));
      boughWood.rotation.y = angle;
      boughWood.rotation.z = -Math.cos(angle) * 0.12;
      boughWood.rotation.x = Math.sin(angle) * 0.12;
      boughWood.castShadow = true;
      pine.add(boughWood);

      // Mid-bough and tip 3D needle sprays with pinecones
      const tipDist = tier.boughLen * 0.95;
      const midDist = tier.boughLen * 0.55;

      const tipSpray = createDetailedPineNeedleSpray(tier.sprayScale);
      tipSpray.position.set(Math.cos(angle) * tipDist, tier.y + 0.8, Math.sin(angle) * tipDist);
      tipSpray.rotation.y = angle;
      tipSpray.rotation.x = Math.sin(angle) * 0.2;
      tipSpray.rotation.z = -Math.cos(angle) * 0.2;
      pine.add(tipSpray);

      const midSpray = createDetailedPineNeedleSpray(tier.sprayScale * 0.85);
      midSpray.position.set(Math.cos(angle) * midDist, tier.y + 0.5, Math.sin(angle) * midDist);
      midSpray.rotation.y = angle + 0.4;
      pine.add(midSpray);
    }
  });

  // Pine Leader Spire at top with apical pinecones and needles
  const leaderSpray = createDetailedPineNeedleSpray(1.3);
  leaderSpray.position.set(0, height + 1.5, 0);
  pine.add(leaderSpray);

  return pine;
}

export function createAncientOakTree(trunkHeight: number = 52): THREE.Group {
  const tree = new THREE.Group();

  const textureLoader = new THREE.TextureLoader();
  const barkTex = textureLoader.load('/src/assets/images/oak_bark_macro_1793461527415.jpg');
  barkTex.colorSpace = THREE.SRGBColorSpace;
  barkTex.wrapS = THREE.RepeatWrapping;
  barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.repeat.set(5, 10);

  const barkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    roughness: 0.94,
    metalness: 0.04,
  });

  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x15803D,
    roughness: 0.98,
  });

  // 1. Organic Tapered Main Trunk with surface furrow ripples
  const trunkSegments = 5;
  const segmentH = trunkHeight / trunkSegments;
  for (let s = 0; s < trunkSegments; s++) {
    const bottomR = 26 - s * 2.8;
    const topR = 26 - (s + 1) * 2.8;
    const segGeo = new THREE.CylinderGeometry(topR, bottomR, segmentH, 24, 2);
    const pos = segGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const vz = pos.getZ(i);
      const angle = Math.atan2(vz, vx);
      const ripple = 1.0 + Math.sin(angle * 5 + s) * 0.07 + Math.sin(vy * 0.8) * 0.04;
      pos.setX(i, vx * ripple);
      pos.setZ(i, vz * ripple);
    }
    segGeo.computeVertexNormals();

    const segMesh = new THREE.Mesh(segGeo, barkMat);
    segMesh.position.y = s * segmentH + segmentH / 2;
    segMesh.castShadow = true;
    segMesh.receiveShadow = true;
    tree.add(segMesh);
  }

  // 2. Flared Buttress Roots (6 massive radial anchor roots spreading into the earth)
  const rootAngles = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3];
  rootAngles.forEach((angle) => {
    const rootGeo = new THREE.ConeGeometry(5.2, 18, 8);
    rootGeo.scale(0.85, 1.0, 1.8);
    const rootMesh = new THREE.Mesh(rootGeo, barkMat);

    const dist = 24.0;
    rootMesh.position.set(Math.cos(angle) * dist, 4.5, Math.sin(angle) * dist);
    rootMesh.rotation.z = -Math.cos(angle) * 0.65;
    rootMesh.rotation.x = Math.sin(angle) * 0.65;
    rootMesh.rotation.y = angle;
    rootMesh.castShadow = true;
    rootMesh.receiveShadow = true;
    tree.add(rootMesh);

    // Moss pad at root flare collar
    const mossPad = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 6), mossMat);
    mossPad.scale.set(1.4, 0.35, 1.2);
    mossPad.position.set(Math.cos(angle) * (dist + 5), 0.4, Math.sin(angle) * (dist + 5));
    mossPad.receiveShadow = true;
    tree.add(mossPad);
  });

  // 3. Tree Burl Knots & Shelf Bracket Fungi on the trunk
  const burlGeo = new THREE.SphereGeometry(3.2, 10, 8);
  burlGeo.scale(1.2, 0.7, 1.0);
  const burl1 = new THREE.Mesh(burlGeo, barkMat);
  burl1.position.set(18, 14, 6);
  tree.add(burl1);

  const burl2 = new THREE.Mesh(burlGeo, barkMat);
  burl2.position.set(-17, 22, -4);
  tree.add(burl2);

  // Bracket Fungi shelves (*Ganoderma*)
  const fungiSpawns = [
    { x: 19.5, y: 7.5, z: 2, ry: 0.1 },
    { x: 19.0, y: 11.0, z: -3, ry: -0.3 },
    { x: -18.5, y: 9.0, z: 5, ry: Math.PI + 0.2 },
    { x: 4, y: 16.0, z: 17.5, ry: Math.PI / 2 },
  ];
  fungiSpawns.forEach((f) => {
    const fungus = createBracketFungus(4.2, 3.2);
    fungus.position.set(f.x, f.y, f.z);
    fungus.rotation.y = f.ry;
    tree.add(fungus);
  });

  // 4. Massive Spreading Primary Boughs & Secondary Branches
  const boughConfigs = [
    { x: -14, y: trunkHeight * 0.65, z: 10, rx: 0.5, rz: -0.75, r: 5.5, len: 28 },
    { x: 16, y: trunkHeight * 0.72, z: -12, rx: -0.4, rz: 0.8, r: 5.8, len: 30 },
    { x: 8, y: trunkHeight * 0.78, z: 16, rx: 0.7, rz: 0.3, r: 5.0, len: 26 },
    { x: -12, y: trunkHeight * 0.82, z: -14, rx: -0.6, rz: -0.5, r: 5.2, len: 27 },
  ];

  boughConfigs.forEach((bc) => {
    const boughMesh = new THREE.Mesh(new THREE.CylinderGeometry(bc.r * 0.6, bc.r, bc.len, 12), barkMat);
    boughMesh.position.set(bc.x, bc.y, bc.z);
    boughMesh.rotation.x = bc.rx;
    boughMesh.rotation.z = bc.rz;
    boughMesh.castShadow = true;
    boughMesh.receiveShadow = true;
    tree.add(boughMesh);

    // Secondary twist branch splitting off
    const secBranch = new THREE.Mesh(new THREE.CylinderGeometry(bc.r * 0.3, bc.r * 0.5, 16, 8), barkMat);
    secBranch.position.set(bc.x * 1.5, bc.y + 7, bc.z * 1.5);
    secBranch.rotation.x = bc.rx * 1.4;
    secBranch.rotation.z = bc.rz * 1.3;
    secBranch.castShadow = true;
    tree.add(secBranch);
  });

  // 5. Majestic Spreading Oak Canopy composed of layered leaf sprays and sub-branchlets
  // Replacing basic geometric dodecahedron shapes with detailed lobed leaf sprays
  const canopyTiers = [
    // Outer lower skirt
    { angle: 0, rad: 28, y: trunkHeight * 0.68, scale: 1.4, tiltX: 0.3, tiltZ: 0.6 },
    { angle: Math.PI * 0.35, rad: 30, y: trunkHeight * 0.70, scale: 1.45, tiltX: -0.4, tiltZ: 0.5 },
    { angle: Math.PI * 0.7, rad: 29, y: trunkHeight * 0.72, scale: 1.4, tiltX: 0.4, tiltZ: -0.5 },
    { angle: Math.PI * 1.1, rad: 31, y: trunkHeight * 0.69, scale: 1.5, tiltX: -0.3, tiltZ: -0.6 },
    { angle: Math.PI * 1.5, rad: 28, y: trunkHeight * 0.73, scale: 1.4, tiltX: 0.5, tiltZ: 0.4 },
    { angle: Math.PI * 1.85, rad: 30, y: trunkHeight * 0.71, scale: 1.45, tiltX: -0.5, tiltZ: -0.3 },

    // Mid canopy fullness
    { angle: Math.PI * 0.2, rad: 22, y: trunkHeight * 0.82, scale: 1.5, tiltX: 0.2, tiltZ: 0.5 },
    { angle: Math.PI * 0.55, rad: 24, y: trunkHeight * 0.84, scale: 1.55, tiltX: -0.3, tiltZ: 0.4 },
    { angle: Math.PI * 0.9, rad: 21, y: trunkHeight * 0.80, scale: 1.45, tiltX: 0.3, tiltZ: -0.5 },
    { angle: Math.PI * 1.3, rad: 23, y: trunkHeight * 0.85, scale: 1.5, tiltX: -0.4, tiltZ: -0.4 },
    { angle: Math.PI * 1.7, rad: 22, y: trunkHeight * 0.83, scale: 1.55, tiltX: 0.4, tiltZ: 0.3 },

    // Upper crown dome
    { angle: 0, rad: 14, y: trunkHeight * 0.93, scale: 1.6, tiltX: 0.1, tiltZ: 0.3 },
    { angle: Math.PI * 0.5, rad: 15, y: trunkHeight * 0.95, scale: 1.55, tiltX: -0.2, tiltZ: 0.2 },
    { angle: Math.PI, rad: 13, y: trunkHeight * 0.94, scale: 1.6, tiltX: 0.2, tiltZ: -0.3 },
    { angle: Math.PI * 1.5, rad: 14, y: trunkHeight * 0.96, scale: 1.55, tiltX: -0.2, tiltZ: -0.2 },

    // Central apex summit
    { angle: 0, rad: 4, y: trunkHeight * 1.04, scale: 1.7, tiltX: 0, tiltZ: 0 },
    { angle: Math.PI * 0.75, rad: 6, y: trunkHeight * 1.02, scale: 1.6, tiltX: 0.1, tiltZ: 0.1 },
    { angle: Math.PI * 1.5, rad: 5, y: trunkHeight * 1.03, scale: 1.6, tiltX: -0.1, tiltZ: -0.1 },
  ];

  canopyTiers.forEach((ct) => {
    const spray = createDetailedOakLeafSpray(ct.scale);
    const x = Math.cos(ct.angle) * ct.rad;
    const z = Math.sin(ct.angle) * ct.rad;
    spray.position.set(x, ct.y, z);
    spray.rotation.x = ct.tiltX;
    spray.rotation.z = ct.tiltZ;
    spray.rotation.y = ct.angle + Math.PI / 2;
    tree.add(spray);

    // Connecting woody sub-branch from bough to leaf spray
    const connectBranch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.8, ct.rad * 0.7, 6),
      barkMat
    );
    connectBranch.position.set(x * 0.55, ct.y - 2.5, z * 0.55);
    connectBranch.rotation.y = ct.angle;
    connectBranch.rotation.z = -Math.cos(ct.angle) * 0.6;
    connectBranch.rotation.x = Math.sin(ct.angle) * 0.6;
    connectBranch.castShadow = true;
    tree.add(connectBranch);
  });

  return tree;
}

export function createBirchTree(height: number = 42): THREE.Group {
  const birch = new THREE.Group();

  const barkTex = createBirchBarkTexture();
  const trunkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    roughness: 0.72,
    metalness: 0.03,
  });

  // Tapered trunk with slight organic lean
  const trunkGeo = new THREE.CylinderGeometry(3.6, 6.2, height, 20);
  const pos = trunkGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const lean = Math.sin((y / height) * Math.PI) * 1.2;
    pos.setX(i, pos.getX(i) + lean);
  }
  trunkGeo.computeVertexNormals();

  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = height / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  birch.add(trunk);

  // Basal collar
  const baseMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(5.8, 8.5, 4.0, 16),
    new THREE.MeshStandardMaterial({ color: 0x1F2937, roughness: 0.95 })
  );
  baseMesh.position.y = 2.0;
  baseMesh.receiveShadow = true;
  birch.add(baseMesh);

  // Birch boughs with drooping branchlets
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x27272A, roughness: 0.8 });
  const boughPositions = [
    { x: -3.5, y: height * 0.7, z: 2.5, rx: 0.4, rz: -0.6 },
    { x: 3.2, y: height * 0.78, z: -2.0, rx: -0.3, rz: 0.5 },
    { x: 1.0, y: height * 0.85, z: 3.0, rx: 0.5, rz: 0.2 },
    { x: -2.0, y: height * 0.9, z: -2.5, rx: -0.4, rz: -0.4 },
  ];

  boughPositions.forEach((bp) => {
    const bough = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.8, 12, 8), branchMat);
    bough.position.set(bp.x, bp.y, bp.z);
    bough.rotation.x = bp.rx;
    bough.rotation.z = bp.rz;
    bough.castShadow = true;
    birch.add(bough);
  });

  // Airy fluttering weeping birch leaf sprays replacing geometric blobs
  const weepingSpawns = [
    { x: -7, y: height * 0.78, z: 5, scale: 1.35, rx: 0.2, rz: -0.4 },
    { x: 7, y: height * 0.82, z: -5, scale: 1.3, rx: -0.3, rz: 0.4 },
    { x: 5, y: height * 0.86, z: 6, scale: 1.4, rx: 0.3, rz: 0.3 },
    { x: -6, y: height * 0.90, z: -4, scale: 1.35, rx: -0.2, rz: -0.3 },
    { x: 0, y: height * 0.96, z: 5, scale: 1.45, rx: 0.1, rz: 0.1 },
    { x: 4, y: height * 1.02, z: 0, scale: 1.5, rx: -0.1, rz: 0.2 },
    { x: -3, y: height * 1.05, z: -2, scale: 1.5, rx: 0.1, rz: -0.2 },
    { x: 0, y: height * 1.12, z: 1, scale: 1.4, rx: 0, rz: 0 },
    // Lower graceful weeping branches
    { x: -9, y: height * 0.68, z: 2, scale: 1.25, rx: 0.4, rz: -0.6 },
    { x: 8, y: height * 0.72, z: 3, scale: 1.25, rx: 0.3, rz: 0.5 },
  ];

  weepingSpawns.forEach((ws) => {
    const spray = createDetailedBirchLeafSpray(ws.scale);
    spray.position.set(ws.x, ws.y, ws.z);
    spray.rotation.x = ws.rx;
    spray.rotation.z = ws.rz;
    birch.add(spray);
  });

  return birch;
}

// ----------------------------------------------------
// MOSS MOUNDS & ROCKS
// ----------------------------------------------------

export function createMossMound(radius: number = 3.5): THREE.Group {
  const mound = new THREE.Group();
  const geo = new THREE.SphereGeometry(radius, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2.2);
  geo.scale(1.3, 0.45, 1.1);

  const mossTex = getMacroTexture(MACRO_TEXTURES.MOSS, 2, 2);
  const mat = new THREE.MeshStandardMaterial({
    map: mossTex,
    roughness: 0.96,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mound.add(mesh);
  return mound;
}

export function createMossyStone(radius: number = 3.5): THREE.Group {
  const stone = new THREE.Group();

  const geo = new THREE.DodecahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    pos.setX(i, vx * (0.85 + Math.sin(vy * 1.5) * 0.15));
    pos.setY(i, vy * 0.65);
    pos.setZ(i, vz * (0.9 + Math.cos(vx * 1.2) * 0.12));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0x52525B,
    roughness: 0.88,
    metalness: 0.06,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  stone.add(mesh);

  const mossTex = getMacroTexture(MACRO_TEXTURES.MOSS, 1.5, 1.5);
  const mossMat = new THREE.MeshStandardMaterial({
    map: mossTex,
    roughness: 0.96,
    metalness: 0.02,
  });
  const mossCap = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.85, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), mossMat);
  mossCap.position.y = radius * 0.35;
  mossCap.scale.set(1.0, 0.42, 1.0);
  stone.add(mossCap);

  return stone;
}

export function createWoodlandToadstool(height: number = 7.0, capRadius: number = 3.5): THREE.Group {
  const shroom = new THREE.Group();

  // 1. Organic tapered stem with fibrous macro texture
  const stemCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.2, height * 0.4, -0.15),
    new THREE.Vector3(0, height, 0),
  ]);
  const stemTex = getMacroTexture(MACRO_TEXTURES.STEM, 1, 4);
  const stemGeo = new THREE.TubeGeometry(stemCurve, 16, 0.55, 10, false);
  const stemMat = new THREE.MeshStandardMaterial({
    map: stemTex,
    color: 0xFEF3C7, // Creamy ivory fibrous mushroom stipe
    roughness: 0.82,
  });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.castShadow = true;
  stem.receiveShadow = true;
  shroom.add(stem);

  // Partial veil skirt (annulus ring)
  const ringGeo = new THREE.TorusGeometry(0.72, 0.18, 8, 16);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0xFDF6B2, roughness: 0.7 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(0.1, height * 0.65, -0.08);
  ring.rotation.x = Math.PI / 2 + 0.1;
  shroom.add(ring);

  // 2. Umbrella Cap with rich scarlet macro petal texture and white fungal warts
  const capGroup = new THREE.Group();
  capGroup.position.set(0, height, 0);

  const capGeo = new THREE.SphereGeometry(capRadius, 24, 18, 0, Math.PI * 2, 0, Math.PI / 1.8);
  const capTex = getMacroTexture(MACRO_TEXTURES.POPPY, 1, 1);
  const capMat = new THREE.MeshStandardMaterial({
    map: capTex,
    color: 0xEF4444, // Scarlet Fly Agaric cap
    roughness: 0.35,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.scale.set(1.0, 0.7, 1.0);
  cap.castShadow = true;
  cap.receiveShadow = true;
  capGroup.add(cap);

  // Gills underneath cap
  const gillMat = new THREE.MeshStandardMaterial({ color: 0xFEFCE8, roughness: 0.9, side: THREE.DoubleSide });
  const gillGeo = new THREE.PlaneGeometry(capRadius * 0.85, 0.4);
  for (let g = 0; g < 32; g++) {
    const angle = (g * Math.PI * 2) / 32;
    const gill = new THREE.Mesh(gillGeo, gillMat);
    gill.position.set(Math.cos(angle) * capRadius * 0.45, -0.2, Math.sin(angle) * capRadius * 0.45);
    gill.rotation.y = angle;
    gill.rotation.x = 0.1;
    capGroup.add(gill);
  }

  // White universal veil flecks/spots on cap
  const fleckMat = new THREE.MeshStandardMaterial({ color: 0xFAFAFA, roughness: 0.6 });
  const fleckGeo = new THREE.SphereGeometry(0.24, 6, 6);
  fleckGeo.scale(1.2, 0.35, 1.2);

  for (let s = 0; s < 22; s++) {
    const sAngle = (s * Math.PI * 2) / 11 + (s * 0.2);
    const sRad = 0.6 + (s % 4) * 0.7;
    const fleck = new THREE.Mesh(fleckGeo, fleckMat);
    fleck.position.set(
      Math.cos(sAngle) * sRad,
      (capRadius * 0.7) * Math.cos((sRad / capRadius) * (Math.PI / 2.2)),
      Math.sin(sAngle) * sRad
    );
    fleck.rotation.y = sAngle;
    capGroup.add(fleck);
  }

  shroom.add(capGroup);
  return shroom;
}

export function createGardenTrowel(): THREE.Group {
  const trowel = new THREE.Group();

  const bladeGeo = new THREE.CylinderGeometry(2.8, 0.5, 9.5, 18, 1, true, 0, Math.PI);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x71717A,
    roughness: 0.35,
    metalness: 0.8,
    side: THREE.DoubleSide,
  });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.set(0, 4.8, 0);
  blade.castShadow = true;
  trowel.add(blade);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 10.5, 14),
    new THREE.MeshStandardMaterial({ color: 0x78350F, roughness: 0.85 })
  );
  handle.position.set(0, 14.0, 0);
  handle.castShadow = true;
  trowel.add(handle);

  trowel.rotation.z = -0.32;
  trowel.rotation.x = 0.22;
  return trowel;
}

export function createTreeHollowHive(): THREE.Group {
  const tree = new THREE.Group();

  const textureLoader = new THREE.TextureLoader();
  const barkTex = textureLoader.load('/src/assets/images/oak_bark_macro_1793461527415.jpg');
  barkTex.colorSpace = THREE.SRGBColorSpace;
  barkTex.wrapS = THREE.RepeatWrapping;
  barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.repeat.set(4, 6);

  const trunkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    roughness: 0.95,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  // Ancient hollow tree trunk with thick wooden walls
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(20, 24, 44, 32, 2, true),
    trunkMat
  );
  trunk.position.set(0, 22, 0);
  trunk.receiveShadow = true;
  trunk.castShadow = true;
  tree.add(trunk);

  // Massive flared root base
  for (let a = 0; a < 6; a++) {
    const angle = (a * Math.PI * 2) / 6;
    const root = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 14, 8),
      trunkMat
    );
    root.position.set(Math.cos(angle) * 22, 4.0, Math.sin(angle) * 22);
    root.rotation.y = angle;
    root.rotation.z = -Math.cos(angle) * 0.5;
    root.rotation.x = Math.sin(angle) * 0.5;
    root.receiveShadow = true;
    tree.add(root);
  }

  // Nest Cavity Entrance rimmed with propolis & carved wood arch
  const opening = new THREE.Mesh(
    new THREE.TorusGeometry(4.6, 1.2, 16, 32),
    new THREE.MeshStandardMaterial({ color: 0x451A03, roughness: 0.88 })
  );
  opening.position.set(0, 5.5, 19.5);
  tree.add(opening);

  // Propolis wax bead drops around entrance hole
  const propolisMat = new THREE.MeshStandardMaterial({ color: 0xB45309, roughness: 0.4, metalness: 0.2 });
  for (let p = 0; p < 12; p++) {
    const pAngle = (p * Math.PI * 2) / 12;
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), propolisMat);
    bead.position.set(Math.cos(pAngle) * 4.6, 5.5 + Math.sin(pAngle) * 4.6, 19.8);
    tree.add(bead);
  }

  // Grand Landing Board with wax ramparts for arriving and departing foragers
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.9, 7.5),
    new THREE.MeshStandardMaterial({ color: 0x582D13, roughness: 0.85 })
  );
  board.position.set(0, 2.5, 21.5);
  board.receiveShadow = true;
  board.castShadow = true;
  tree.add(board);

  // Wax Rampart on landing board
  const waxRampart = new THREE.Mesh(
    new THREE.BoxGeometry(10.2, 0.45, 1.2),
    new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.65 })
  );
  waxRampart.position.set(0, 3.1, 24.5);
  tree.add(waxRampart);

  // ------------------------------------------------------------------
  // ESTABLISHED HIVE COMB ARCHITECTURE (VISIBLE FROM ENTRANCE & OUTSIDE)
  // ------------------------------------------------------------------
  const beeswaxMat = new THREE.MeshStandardMaterial({ color: 0xFBBF24, roughness: 0.55, metalness: 0.05 });
  const amberHoneyMat = new THREE.MeshPhysicalMaterial({
    color: 0xF59E0B,
    transmission: 0.82,
    opacity: 0.96,
    transparent: true,
    roughness: 0.08,
  });
  const pollenBreadMat = new THREE.MeshStandardMaterial({ color: 0xEAB308, roughness: 0.95 });
  const cappedWaxMat = new THREE.MeshStandardMaterial({ color: 0xFEF3C7, roughness: 0.72 });

  // 1. Natural Hanging Comb Slabs inside Cavity Ceiling (Suspended wild parallel combs)
  const slabPositions = [-5.0, 0, 5.0];
  slabPositions.forEach((xOffset, sIdx) => {
    const combSlab = new THREE.Group();
    combSlab.position.set(xOffset, 11.5, 11.5);

    // Organic wavy wax comb curtain
    const slabW = 6.5 + (sIdx === 1 ? 2.5 : 0);
    const slabH = 10.0 + (sIdx === 1 ? 2.0 : 0);
    const slabGeo = new THREE.BoxGeometry(slabW, slabH, 0.9);
    const slabMesh = new THREE.Mesh(slabGeo, beeswaxMat);
    slabMesh.castShadow = true;
    combSlab.add(slabMesh);

    // Glistening honey rows on comb slab
    const honeyBarGeo = new THREE.CylinderGeometry(0.35, 0.35, slabW * 0.85, 12);
    honeyBarGeo.rotateZ(Math.PI / 2);
    for (let row = 0; row < 4; row++) {
      const honeyBar = new THREE.Mesh(honeyBarGeo, amberHoneyMat);
      honeyBar.position.set(0, slabH * 0.35 - row * 1.5, 0.48);
      combSlab.add(honeyBar);

      const honeyBarBack = new THREE.Mesh(honeyBarGeo, amberHoneyMat);
      honeyBarBack.position.set(0, slabH * 0.35 - row * 1.5, -0.48);
      combSlab.add(honeyBarBack);
    }

    tree.add(combSlab);
  });

  // 2. Entrance Portal Honeycomb Apron (Clustered cells right at the entrance portal)
  const apronComb = new THREE.Group();
  apronComb.position.set(0, 4.0, 19.4);

  // Hexagonal cells clustered along the lower lip of the entrance
  const hexShapeMini = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = Math.cos(a) * 0.75;
    const py = Math.sin(a) * 0.75;
    if (i === 0) hexShapeMini.moveTo(px, py);
    else hexShapeMini.lineTo(px, py);
  }
  hexShapeMini.closePath();
  const hexMiniGeo = new THREE.ExtrudeGeometry(hexShapeMini, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04 });

  const apronCellOffsets = [
    { x: -3.2, y: -0.2, type: 'honey' },
    { x: -1.9, y: -0.6, type: 'pollen' },
    { x: -0.6, y: -0.7, type: 'capped' },
    { x: 0.7, y: -0.7, type: 'honey' },
    { x: 2.0, y: -0.6, type: 'pollen' },
    { x: 3.3, y: -0.2, type: 'honey' },
    { x: -2.5, y: -1.8, type: 'capped' },
    { x: -1.2, y: -2.0, type: 'honey' },
    { x: 0.1, y: -2.0, type: 'pollen' },
    { x: 1.4, y: -2.0, type: 'honey' },
    { x: 2.7, y: -1.8, type: 'capped' },
  ];

  apronCellOffsets.forEach((co) => {
    const cellMesh = new THREE.Mesh(hexMiniGeo, beeswaxMat);
    cellMesh.position.set(co.x, co.y, 0);
    apronComb.add(cellMesh);

    if (co.type === 'honey') {
      const honeyPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.85, 6), amberHoneyMat);
      honeyPlug.rotateX(Math.PI / 2);
      honeyPlug.position.set(co.x, co.y, 0.45);
      apronComb.add(honeyPlug);
    } else if (co.type === 'pollen') {
      const pollenPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.75, 6), pollenBreadMat);
      pollenPlug.rotateX(Math.PI / 2);
      pollenPlug.position.set(co.x, co.y, 0.4);
      apronComb.add(pollenPlug);
    } else if (co.type === 'capped') {
      const capPlug = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.35, 6), cappedWaxMat);
      capPlug.rotateX(Math.PI / 2);
      capPlug.position.set(co.x, co.y, 0.75);
      apronComb.add(capPlug);
    }
  });
  tree.add(apronComb);

  // 3. Resident Colony Bees Stationed at Established Hive
  // Guard Bee 1 (Left landing board)
  const guard1 = createProceduralBee('guard');
  guard1.scale.setScalar(0.72);
  guard1.position.set(-3.2, 3.4, 22.0);
  guard1.rotation.y = -Math.PI / 5;
  tree.add(guard1);

  // Guard Bee 2 (Right landing board)
  const guard2 = createProceduralBee('guard');
  guard2.scale.setScalar(0.72);
  guard2.position.set(3.2, 3.4, 22.0);
  guard2.rotation.y = Math.PI / 5;
  tree.add(guard2);

  // Fanner Bee at entrance ventilating the hive
  const fanner = createProceduralBee('builder');
  fanner.scale.setScalar(0.68);
  fanner.position.set(0, 3.2, 19.8);
  fanner.rotation.y = Math.PI; // Facing into hive to fan air out
  tree.add(fanner);

  // Bracket fungi on side of hive tree
  const sideFungus1 = createBracketFungus(3.8, 2.8);
  sideFungus1.position.set(19, 12, 4);
  sideFungus1.rotation.y = 0.2;
  tree.add(sideFungus1);

  const sideFungus2 = createBracketFungus(3.2, 2.4);
  sideFungus2.position.set(-18.5, 8, -6);
  sideFungus2.rotation.y = Math.PI - 0.2;
  tree.add(sideFungus2);

  // Warm Amber Nest Glow from within the cavity
  const light = new THREE.PointLight(0xF59E0B, 4.5, 24);
  light.position.set(0, 5.5, 15);
  tree.add(light);

  // Honey Scent Volumetric Beacon: Golden glowing motes swirling up from entrance
  const motesCount = 45;
  const motesGeo = new THREE.BufferGeometry();
  const motesPos = new Float32Array(motesCount * 3);
  for (let m = 0; m < motesCount; m++) {
    motesPos[m * 3] = (Math.random() - 0.5) * 6.5;
    motesPos[m * 3 + 1] = 4.5 + Math.random() * 8.5;
    motesPos[m * 3 + 2] = 19.0 + (Math.random() - 0.5) * 4.0;
  }
  motesGeo.setAttribute('position', new THREE.BufferAttribute(motesPos, 3));
  const motesMat = new THREE.PointsMaterial({
    color: 0xFDE047,
    size: 0.35,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const hiveMotes = new THREE.Points(motesGeo, motesMat);
  tree.add(hiveMotes);

  // Spreading canopy crowning the hollow tree (detailed oak leaf sprays replacing geometric dodecahedron)
  const hiveCanopyBoughs = [
    { angle: 0, rad: 22, y: 44, scale: 1.5 },
    { angle: Math.PI * 0.4, rad: 24, y: 46, scale: 1.55 },
    { angle: Math.PI * 0.8, rad: 23, y: 45, scale: 1.5 },
    { angle: Math.PI * 1.2, rad: 25, y: 47, scale: 1.6 },
    { angle: Math.PI * 1.6, rad: 22, y: 44, scale: 1.5 },
    { angle: 0, rad: 8, y: 52, scale: 1.65 },
    { angle: Math.PI, rad: 9, y: 53, scale: 1.6 },
  ];

  hiveCanopyBoughs.forEach((cb) => {
    const spray = createDetailedOakLeafSpray(cb.scale);
    const x = Math.cos(cb.angle) * cb.rad;
    const z = Math.sin(cb.angle) * cb.rad;
    spray.position.set(x, cb.y, z);
    spray.rotation.y = cb.angle + Math.PI / 2;
    tree.add(spray);

    // Arching branch arm from hollow top rim
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 2.5, cb.rad * 0.8, 8),
      trunkMat
    );
    arm.position.set(x * 0.5, cb.y - 3.5, z * 0.5);
    arm.rotation.y = cb.angle;
    arm.rotation.z = -Math.cos(cb.angle) * 0.45;
    arm.rotation.x = Math.sin(cb.angle) * 0.45;
    arm.castShadow = true;
    tree.add(arm);
  });

  return tree;
}

export function createGiantFern(height: number = 14): THREE.Group {
  const fern = new THREE.Group();
  const frondCount = 6;

  const textureLoader = new THREE.TextureLoader();
  const leafTex = textureLoader.load('/src/assets/images/botanical_leaf_macro_1793462790946.jpg');
  leafTex.colorSpace = THREE.SRGBColorSpace;
  leafTex.wrapS = THREE.RepeatWrapping;
  leafTex.wrapT = THREE.RepeatWrapping;
  leafTex.repeat.set(1, 2);

  const leafMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    color: 0x22C55E,
    roughness: 0.55,
    side: THREE.DoubleSide,
  });
    const stemTex = getMacroTexture(MACRO_TEXTURES.STEM, 1, 8);
    const stemMat = new THREE.MeshStandardMaterial({ map: stemTex, roughness: 0.7 });

  for (let f = 0; f < frondCount; f++) {
    const frondAngle = (f * Math.PI * 2) / frondCount;
    const frond = new THREE.Group();

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1.5, height * 0.4, 0),
      new THREE.Vector3(4.5, height * 0.8, 0),
      new THREE.Vector3(7.5, height * 0.95, 0),
      new THREE.Vector3(9.5, height * 0.85, 0),
    ]);
    const stemGeo = new THREE.TubeGeometry(curve, 14, 0.22, 6, false);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.castShadow = true;
    frond.add(stem);

    const points = curve.getPoints(12);
    for (let p = 2; p < points.length; p++) {
      const pt = points[p];
      const leafW = Math.sin((p / points.length) * Math.PI) * 2.8;

      const leftLeaf = new THREE.Mesh(new THREE.PlaneGeometry(leafW, 0.85), leafMat);
      leftLeaf.position.set(pt.x, pt.y, pt.z + leafW * 0.45);
      leftLeaf.rotation.x = 0.3;
      leftLeaf.rotation.y = 0.2;
      frond.add(leftLeaf);

      const rightLeaf = new THREE.Mesh(new THREE.PlaneGeometry(leafW, 0.85), leafMat);
      rightLeaf.position.set(pt.x, pt.y, pt.z - leafW * 0.45);
      rightLeaf.rotation.x = -0.3;
      rightLeaf.rotation.y = -0.2;
      frond.add(rightLeaf);
    }

    frond.rotation.y = frondAngle;
    fern.add(frond);
  }

  return fern;
}

export function createFallenMossyLog(length: number = 32, radius: number = 4.8): THREE.Group {
  const logGroup = new THREE.Group();

  const textureLoader = new THREE.TextureLoader();
  const barkTex = textureLoader.load('/src/assets/images/oak_bark_macro_1793461527415.jpg');
  barkTex.colorSpace = THREE.SRGBColorSpace;
  barkTex.wrapS = THREE.RepeatWrapping;
  barkTex.wrapT = THREE.RepeatWrapping;
  barkTex.repeat.set(3, 8);

  const barkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    roughness: 0.92,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const hollowLogGeo = new THREE.CylinderGeometry(radius, radius * 1.1, length, 24, 2, true);
  hollowLogGeo.rotateZ(Math.PI / 2);

  const logMesh = new THREE.Mesh(hollowLogGeo, barkMat);
  logMesh.position.set(0, radius, 0);
  logMesh.castShadow = true;
  logMesh.receiveShadow = true;
  logGroup.add(logMesh);

  const mossTex = getMacroTexture(MACRO_TEXTURES.MOSS, 4, 2);
  const mossMat = new THREE.MeshStandardMaterial({
    map: mossTex,
    roughness: 0.96,
    metalness: 0.02,
  });
  const mossBlanket = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, length * 0.85, 16, 1, false, 0, Math.PI),
    mossMat
  );
  mossBlanket.rotateZ(Math.PI / 2);
  mossBlanket.position.set(0, radius * 1.05, 0);
  mossBlanket.receiveShadow = true;
  logGroup.add(mossBlanket);

  for (let s = -10; s <= 10; s += 8) {
    const f = createBracketFungus(2.8, 2.2);
    f.position.set(s, radius * 0.9, radius * 1.05);
    f.rotation.y = 0;
    logGroup.add(f);
  }

  return logGroup;
}

export function createDistantForestHorizon(): THREE.Group {
  const forest = new THREE.Group();

  // 1. 360-Degree Panoramic Woodland Landscape Backdrop Cylinder
  const panoramaTex = getMacroTexture(MACRO_TEXTURES.FOREST_PANORAMA, 4, 1);
  const panoramaGeo = new THREE.CylinderGeometry(380, 380, 160, 64, 1, true);
  const panoramaMat = new THREE.MeshBasicMaterial({
    map: panoramaTex,
    side: THREE.BackSide,
    fog: true,
  });
  const panoramaMesh = new THREE.Mesh(panoramaGeo, panoramaMat);
  panoramaMesh.position.y = 65;
  forest.add(panoramaMesh);

  // 2. Rolling Meadow Hills & Forest Ridges (Verdant Amphitheater Knolls)
  const turfTex = getMacroTexture(MACRO_TEXTURES.MEADOW_TURF, 3, 3);
  const hillMat = new THREE.MeshStandardMaterial({
    map: turfTex,
    color: 0x15803D,
    roughness: 0.92,
  });
  const hillGeo = new THREE.SphereGeometry(45, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2.2);
  hillGeo.scale(2.2, 0.42, 1.6);

  const hillCount = 24;
  for (let h = 0; h < hillCount; h++) {
    const hAngle = (h * Math.PI * 2) / hillCount + (h % 3) * 0.08;
    const hDist = 210 + (h % 5) * 18;
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.set(
      Math.cos(hAngle) * hDist,
      -3 + (h % 3) * 5,
      Math.sin(hAngle) * hDist
    );
    hill.rotation.y = hAngle + (h % 2) * 0.3;
    hill.receiveShadow = true;
    forest.add(hill);
  }

  // 3. Dense Continuous 3D Woodland Boundary Wall (120+ Volumetric Trees in 3 Staggered Depth Rings)
  const oakBarkTex = getMacroTexture(MACRO_TEXTURES.OAK_BARK, 1, 3);
  const darkTrunkMat = new THREE.MeshStandardMaterial({
    map: oakBarkTex,
    color: 0x3E2723,
    roughness: 0.94,
  });

  const birchTrunkTex = createBirchBarkTexture();
  const birchTrunkMat = new THREE.MeshStandardMaterial({
    map: birchTrunkTex,
    roughness: 0.78,
  });

  const leafMacroTex = getMacroTexture(MACRO_TEXTURES.BOTANICAL_LEAF, 1, 1);
  const pineNeedleTex = getMacroTexture(MACRO_TEXTURES.PINE_NEEDLE_SPRAY, 1, 1);

  // Volumetric Foliage Materials
  const pineCanopyMat = new THREE.MeshStandardMaterial({
    map: pineNeedleTex,
    color: 0x064E3B,
    roughness: 0.42,
    metalness: 0.06,
  });
  const oakCanopyMat = new THREE.MeshStandardMaterial({
    map: leafMacroTex,
    color: 0x15803D,
    roughness: 0.48,
    metalness: 0.04,
  });
  const birchCanopyMat = new THREE.MeshStandardMaterial({
    map: leafMacroTex,
    color: 0x84CC16,
    roughness: 0.45,
    metalness: 0.03,
  });

  // Reusable Volumetric Canopy Geometries
  // 1. Organic Scots Pine Foliage Tier Skirt
  function createPineTierGeometry(radius: number, height: number): THREE.BufferGeometry {
    const geo = new THREE.ConeGeometry(radius, height, 14, 2, false);
    const pos = geo.attributes.position;
    for (let p = 0; p < pos.count; p++) {
      const y = pos.getY(p);
      if (y < 0) {
        const x = pos.getX(p);
        const z = pos.getZ(p);
        const angle = Math.atan2(z, x);
        const scalloping = 1.0 + Math.sin(angle * 7) * 0.16 + Math.cos(angle * 3) * 0.08;
        pos.setX(p, x * scalloping);
        pos.setZ(p, z * scalloping);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }

  // 2. Billowing Cloud Foliage Clump for Oaks & Birches
  function createCloudLobeGeometry(radius: number): THREE.BufferGeometry {
    const geo = new THREE.DodecahedronGeometry(radius, 2);
    const pos = geo.attributes.position;
    for (let p = 0; p < pos.count; p++) {
      const vx = pos.getX(p);
      const vy = pos.getY(p);
      const vz = pos.getZ(p);
      const disp = 1.0 + Math.sin(vx * 1.8) * Math.cos(vy * 1.8) * 0.18 + Math.sin(vz * 2.2) * 0.1;
      pos.setXYZ(p, vx * disp, vy * disp, vz * disp);
    }
    geo.computeVertexNormals();
    return geo;
  }

  const pineTierGeos = [
    createPineTierGeometry(13.5, 9.5),
    createPineTierGeometry(11.5, 9.0),
    createPineTierGeometry(9.5, 8.5),
    createPineTierGeometry(7.2, 8.0),
    createPineTierGeometry(4.8, 7.5),
  ];

  const oakClumpGeos = [
    createCloudLobeGeometry(8.5),
    createCloudLobeGeometry(7.2),
    createCloudLobeGeometry(6.0),
  ];

  const totalTrees = 120;
  for (let i = 0; i < totalTrees; i++) {
    const angle = (i * Math.PI * 2) / totalTrees + (Math.sin(i * 1.3) * 0.04);
    const ring = i % 3; // 3 Staggered Depth Rings: Inner (115), Mid (155), Far (195)
    const r = (ring === 0 ? 118 : ring === 1 ? 158 : 198) + (Math.sin(i * 2.5) * 14);
    const treeType = i % 4; // 0, 2: Scots Pine, 1: Ancient Oak, 3: Silver Birch

    const treeGroup = new THREE.Group();
    const h = (ring === 2 ? 56 : 46) + (i % 6) * 5 + Math.random() * 6;

    const isBirch = treeType === 3;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 3.8, h * 0.85, 10),
      isBirch ? birchTrunkMat : darkTrunkMat
    );
    trunk.position.y = (h * 0.85) / 2;
    trunk.castShadow = ring < 2;
    trunk.receiveShadow = true;
    treeGroup.add(trunk);

    if (treeType === 0 || treeType === 2) {
      // Volumetric Multi-Tier Scots Pine
      const tierCount = 5;
      for (let t = 0; t < tierCount; t++) {
        const tierY = h * 0.38 + t * (h * 0.14);
        const tierMesh = new THREE.Mesh(pineTierGeos[t], pineCanopyMat);
        tierMesh.position.y = tierY;
        tierMesh.rotation.y = (t * 1.4) + i * 0.2;
        tierMesh.castShadow = ring < 2;
        tierMesh.receiveShadow = true;
        treeGroup.add(tierMesh);
      }
      // Crowning needle spire
      const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 7.5, 8), pineCanopyMat);
      spire.position.y = h * 0.38 + 4 * (h * 0.14) + 6.5;
      spire.castShadow = ring < 2;
      treeGroup.add(spire);
    } else if (treeType === 1) {
      // Volumetric Ancient Oak: 8-Lobe Billowing Canopy Dome
      const crownBaseY = h * 0.72;
      const crownRadius = 14.5;
      const lobePositions = [
        { x: 0, y: crownBaseY + 6.5, z: 0, geoIdx: 0 },
        { x: crownRadius * 0.65, y: crownBaseY + 3.2, z: crownRadius * 0.35, geoIdx: 1 },
        { x: -crownRadius * 0.6, y: crownBaseY + 3.8, z: crownRadius * 0.4, geoIdx: 1 },
        { x: crownRadius * 0.25, y: crownBaseY + 2.8, z: -crownRadius * 0.65, geoIdx: 1 },
        { x: -crownRadius * 0.45, y: crownBaseY + 3.4, z: -crownRadius * 0.55, geoIdx: 1 },
        { x: crownRadius * 0.75, y: crownBaseY + 1.2, z: -crownRadius * 0.2, geoIdx: 2 },
        { x: -crownRadius * 0.7, y: crownBaseY + 1.5, z: 0, geoIdx: 2 },
        { x: 0, y: crownBaseY + 9.5, z: 0, geoIdx: 2 },
      ];

      lobePositions.forEach((lp) => {
        const lobeMesh = new THREE.Mesh(oakClumpGeos[lp.geoIdx], oakCanopyMat);
        lobeMesh.position.set(lp.x, lp.y, lp.z);
        lobeMesh.rotation.y = i * 0.5 + lp.geoIdx;
        lobeMesh.castShadow = ring < 2;
        lobeMesh.receiveShadow = true;
        treeGroup.add(lobeMesh);
      });
    } else {
      // Volumetric Silver Birch: Graceful Weeping Canopy Clouds
      const crownBaseY = h * 0.68;
      const birchCanopyPositions = [
        { x: -4.5, y: crownBaseY + 2.5, z: 3.5, geoIdx: 1 },
        { x: 4.8, y: crownBaseY + 4.2, z: -3.0, geoIdx: 1 },
        { x: 2.5, y: crownBaseY + 7.5, z: 2.5, geoIdx: 2 },
        { x: -3.0, y: crownBaseY + 8.8, z: -2.0, geoIdx: 2 },
        { x: 0, y: crownBaseY + 11.2, z: 0, geoIdx: 2 },
      ];

      birchCanopyPositions.forEach((bp) => {
        const bMesh = new THREE.Mesh(oakClumpGeos[bp.geoIdx], birchCanopyMat);
        bMesh.position.set(bp.x, bp.y, bp.z);
        bMesh.scale.set(0.9, 1.25, 0.9);
        bMesh.rotation.y = i * 0.8;
        bMesh.castShadow = ring < 2;
        bMesh.receiveShadow = true;
        treeGroup.add(bMesh);
      });
    }

    treeGroup.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    forest.add(treeGroup);
  }

  return forest;
}

export function createSkyDome(): THREE.Mesh {
  const skyGeo = new THREE.SphereGeometry(480, 32, 24);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0284C7'); // Deep cerulean zenith
  grad.addColorStop(0.35, '#38BDF8'); // Sky blue
  grad.addColorStop(0.68, '#BAE6FD'); // Light atmosphere blue
  grad.addColorStop(0.85, '#FEF3C7'); // Warm golden sunlight haze above tree line
  grad.addColorStop(0.95, '#D1FAE5'); // Meadow green atmospheric glow
  grad.addColorStop(1.0, '#A7F3D0'); // Forest glade horizon blend
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Sun glow disk near upper quadrant
  const sunGrad = ctx.createRadialGradient(380, 120, 10, 380, 120, 140);
  sunGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  sunGrad.addColorStop(0.2, 'rgba(254, 240, 138, 0.7)');
  sunGrad.addColorStop(0.5, 'rgba(253, 224, 71, 0.3)');
  sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(380, 120, 140, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  const drawCloud = (cx: number, cy: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - w * 0.4, cy + h * 0.1, w * 0.6, h * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w * 0.4, cy + h * 0.1, w * 0.7, h * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawCloud(200, 220, 110, 35);
  drawCloud(620, 180, 160, 42);
  drawCloud(850, 240, 130, 38);
  drawCloud(420, 290, 90, 28);

  const skyTex = new THREE.CanvasTexture(canvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;

  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    fog: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.position.y = 80;
  return skyDome;
}

export function createHexCombCell(cell: {
  q: number;
  r: number;
  type: CellType;
  fillAmount: number;
  broodStage?: BroodStage;
}): THREE.Group {
  const group = new THREE.Group();

  const hexRadius = 1.0;
  const x = hexRadius * Math.sqrt(3) * (cell.q + cell.r / 2);
  const y = hexRadius * 1.5 * cell.r;
  group.position.set(x, y, 0);

  const hexShape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const px = Math.cos(angle) * hexRadius;
    const py = Math.sin(angle) * hexRadius;
    if (i === 0) hexShape.moveTo(px, py);
    else hexShape.lineTo(px, py);
  }
  hexShape.closePath();

  const holePath = new THREE.Path();
  const innerRadius = hexRadius * 0.88;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const px = Math.cos(angle) * innerRadius;
    const py = Math.sin(angle) * innerRadius;
    if (i === 0) holePath.moveTo(px, py);
    else holePath.lineTo(px, py);
  }
  holePath.closePath();
  hexShape.holes.push(holePath);

  const extrudeSettings = {
    depth: 1.6,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
  };

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xFBBF24,
    roughness: 0.58,
    metalness: 0.04,
  });
  const wall = new THREE.Mesh(
    new THREE.ExtrudeGeometry(hexShape, extrudeSettings),
    wallMat
  );
  wall.position.z = -1.6;
  group.add(wall);

  if (cell.type === 'honey') {
    const honeyHeight = 1.4 * (cell.fillAmount / 100);
    const honeyGeo = new THREE.CylinderGeometry(innerRadius * 0.95, innerRadius * 0.95, honeyHeight, 6);
    honeyGeo.rotateX(Math.PI / 2);
    const honeyMesh = new THREE.Mesh(
      honeyGeo,
      new THREE.MeshPhysicalMaterial({
        color: 0xF59E0B,
        transmission: 0.84,
        opacity: 0.95,
        transparent: true,
        roughness: 0.08,
      })
    );
    honeyMesh.position.z = -1.6 + honeyHeight / 2;
    group.add(honeyMesh);

    // Translucent silk-wax cap if full or near-full honey
    if (cell.fillAmount >= 80) {
      const capGeo = new THREE.CylinderGeometry(innerRadius * 0.96, innerRadius * 0.96, 0.22, 6);
      capGeo.rotateX(Math.PI / 2);
      const capMesh = new THREE.Mesh(
        capGeo,
        new THREE.MeshStandardMaterial({
          color: 0xFEF3C7,
          roughness: 0.68,
        })
      );
      capMesh.position.z = -0.15;
      group.add(capMesh);
    }
  } else if (cell.type === 'pollen') {
    const pollenGeo = new THREE.CylinderGeometry(innerRadius * 0.95, innerRadius * 0.95, 1.25, 6);
    pollenGeo.rotateX(Math.PI / 2);
    const pollenMesh = new THREE.Mesh(
      pollenGeo,
      new THREE.MeshStandardMaterial({
        color: 0xEAB308,
        roughness: 0.92,
      })
    );
    pollenMesh.position.z = -0.95;
    group.add(pollenMesh);
  } else if (cell.type === 'brood') {
    if (cell.broodStage === 'egg') {
      // Tiny pearly-white rice-grain royal egg standing upright in cell base
      const eggGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
      eggGeo.scale(1.0, 1.2, 1.0);
      eggGeo.rotateX(Math.PI / 2);
      const eggMat = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        roughness: 0.25,
      });
      const eggMesh = new THREE.Mesh(eggGeo, eggMat);
      eggMesh.position.z = -1.35;
      group.add(eggMesh);
    } else {
      // Pearly-white curled C-shaped grub larva
      const larvaGeo = new THREE.SphereGeometry(innerRadius * 0.52, 14, 10);
      larvaGeo.scale(0.85, 1.2, 0.75);
      const larvaMesh = new THREE.Mesh(
        larvaGeo,
        new THREE.MeshStandardMaterial({
          color: 0xFEF9C3,
          roughness: 0.35,
        })
      );
      larvaMesh.position.z = -0.92;
      larvaMesh.rotation.z = Math.PI / 3.5;
      group.add(larvaMesh);
    }
  }

  return group;
}
