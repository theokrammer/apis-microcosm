/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BeeRole,
  GameMode,
  WeatherType,
  CombCell,
  ColonyResources,
  PlayerBeeState,
  FlightInputState,
  FlowerData,
  InsectEntity,
  FlowerType,
} from '../types/game';
import { BeePhysicsEngine, WorldObstacle } from './physics';
import { simWasm } from '../wasm/beeSimWasm';
import { audioEngine } from './audio';
import { setupWeatherSystem, WeatherController } from './weather';
import {
  createProceduralBee,
  createProceduralWasp,
  createProceduralMantis,
  createProceduralSpider,
  createProceduralLadybug,
  createProceduralButterfly,
  createGiantClover,
  createGiantDandelion,
  createDandelionSeedHead,
  createGiantPoppy,
  createGiantBluebell,
  createWildThistle,
  createLavenderSpike,
  createAncientOakTree,
  createBirchTree,
  createScotsPineTree,
  createMossMound,
  createMossyStone,
  createGardenTrowel,
  createTreeHollowHive,
  createHexCombCell,
  createCurvedGrassGeometry,
  createSkyDome,
  createDistantForestHorizon,
  createGiantFern,
  createFallenMossyLog,
  createWoodlandToadstool,
  MACRO_TEXTURES,
  getMacroTexture,
  BeeMeshGroup,
  WaspMeshGroup,
  MantisMeshGroup,
  ButterflyMeshGroup,
} from './proceduralModels';
import { terrainHeightAt, detectSoftwareWebGL } from './terrain';

// Pre-allocated math helpers for zero-GC per-frame updates
const _camOffset = new THREE.Vector3();
const _camLookAhead = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();

export interface GameEngineCallbacks {
  onStateUpdate: (
    player: PlayerBeeState,
    colony: ColonyResources,
    mode: GameMode,
    weather: WeatherType,
    flowers: FlowerData[],
    insects: InsectEntity[],
    hivePos: [number, number, number]
  ) => void;
  onLogMessage: (msg: string) => void;
}

export class BeeGameEngine {
  private container: HTMLDivElement;
  private callbacks: GameEngineCallbacks;

  // Three.js Core
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock!: THREE.Clock;
  private frameId: number = 0;
  private isDestroyed: boolean = false;
  private isPaused: boolean = true;
  private panAngle: number = 0;

  // Physics & Weather
  private physics!: BeePhysicsEngine;
  private weatherCtrl!: WeatherController;

  // Lights
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  // Player Bee Mesh & State
  private playerBeeMesh!: BeeMeshGroup;
  private currentRole: BeeRole = 'forager';
  private gameMode: GameMode = 'colony_active';
  private inputState: FlightInputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    sprint: false,
    actionPrimary: false,
    actionSecondary: false,
  };

  private playerState: PlayerBeeState = {
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
  };

  // Colony resources & Comb
  private colony: ColonyResources = {
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
  };

  private combCells: CombCell[] = [];
  private combMeshGroup: THREE.Group = new THREE.Group();

  // World Props & Particles
  private flowers: FlowerData[] = [];
  private flowerMeshes: THREE.Group[] = [];
  private grassMesh!: THREE.InstancedMesh;
  private grassMaterial!: THREE.MeshStandardMaterial;
  private pollenPoints!: THREE.Points;
  private ambientBees: BeeMeshGroup[] = [];
  private residentHiveBees: BeeMeshGroup[] = [];
  private lastStateUpdateTime: number = 0;

  // Biological Insect Fauna (Wasps, Mantis, Spider, Ladybugs, Butterflies)
  private insects: InsectEntity[] = [];
  private insectMeshes: Array<THREE.Group | WaspMeshGroup | MantisMeshGroup | ButterflyMeshGroup> = [];

  // Hive tree position & interior/entrance checkpoints
  private readonly hivePosition = new THREE.Vector3(0, terrainHeightAt(0, -25), -25);
  private readonly hiveEntrancePos = new THREE.Vector3(0, 4.5, -4.5);
  private readonly hiveInteriorPos = new THREE.Vector3(0, 5.5, -16.0);
  private foundingSiteFound: boolean = false;
  private healingEnergyAcc: number = 0;
  private honeyRipenAcc: number = 0;

  // Camera damping helpers
  private cameraTarget = new THREE.Vector3();
  private cameraLookTarget = new THREE.Vector3();

  // Bound event listeners for clean teardown
  private onKeyDownBound?: (e: KeyboardEvent) => void;
  private onKeyUpBound?: (e: KeyboardEvent) => void;
  private onBlurBound?: () => void;

  constructor(container: HTMLDivElement, callbacks: GameEngineCallbacks, initialMode: GameMode = 'colony_active') {
    this.container = container;
    this.callbacks = callbacks;
    this.gameMode = initialMode;
    if (initialMode === 'spring_founding') {
      this.currentRole = 'queen';
      this.playerState.role = 'queen';
      this.colony.honey = 15;
      this.colony.pollen = 10;
      this.colony.wax = 12;
      this.colony.nectar = 0;
      this.colony.population = { foragers: 0, guards: 0, builders: 0, larvae: 0, eggs: 0 };
    } else if (initialMode === 'swarm_migration') {
      this.currentRole = 'queen';
      this.playerState.role = 'queen';
      this.colony.honey = 45;
      this.colony.pollen = 30;
      this.colony.wax = 35;
      this.colony.nectar = 20;
      this.colony.population = { foragers: 14, guards: 5, builders: 7, larvae: 0, eggs: 0 };
    }
  }

  public async init() {
    this.clock = new THREE.Clock();

    const isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xD1FAE5);

    this.camera = new THREE.PerspectiveCamera(
      65,
      this.container.clientWidth / Math.max(1, this.container.clientHeight),
      0.1,
      850
    );
    this.camera.position.set(0, 6, 16);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.sunLight = new THREE.DirectionalLight(0xFFFBEB, 2.4);
    this.sunLight.position.set(35, 65, 25);
    this.sunLight.castShadow = !isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 150;
    this.sunLight.shadow.camera.left = -45;
    this.sunLight.shadow.camera.right = 45;
    this.sunLight.shadow.camera.top = 45;
    this.sunLight.shadow.camera.bottom = -45;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0xE0F2FE, 0x362312, 0.9);
    this.scene.add(this.hemiLight);

    this.physics = new BeePhysicsEngine();
    await this.physics.init();
    await simWasm.init();

    this.weatherCtrl = setupWeatherSystem(this.scene, this.sunLight, this.hemiLight);
    if (this.gameMode === 'spring_founding') {
      this.weatherCtrl.setWeather('spring_thaw');
    }

    // Sky Dome & Horizon Panorama (Expansive Distance Optics)
    this.scene.add(createSkyDome());
    this.scene.add(createDistantForestHorizon());

    // Populate Environment
    this.buildTerrain();
    this.buildForestBorderTrees();
    this.buildDenseMeadowVegetation();
    this.buildAtmosphericSunShafts();
    this.buildPollenDustParticles();
    this.buildInitialComb();
    this.spawnBiologicalFauna();
    this.spawnAmbientColonyBees();

    // Register all solid immovable obstacles for WASM physics
    this.registerWorldColliders();

    // Create Player Bee
    this.spawnPlayerBee();

    // Input Listeners & Resize
    this.setupInputs();
    window.addEventListener('resize', this.onResize);

    this.tick();

    if (this.gameMode === 'spring_founding') {
      this.callbacks.onLogMessage('Spring thaw: Queen awakened. Beware of early predators while scouting a cavity!');
    } else if (this.gameMode === 'swarm_migration') {
      this.callbacks.onLogMessage('Swarm migration: Lead your queen to the hollow oak cavity to claim a new hive!');
    } else {
      this.callbacks.onLogMessage('Colony active: Forage floral nectar. Evade ambush mantises and fight hornets!');
    }
  }

  private buildTerrain() {
    // Expansive 720x720 rolling meadow terrain basin matching terrainHeightAt(x, z)
    const groundGeo = new THREE.PlaneGeometry(720, 720, 128, 128);
    groundGeo.rotateX(-Math.PI / 2);

    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      posAttr.setY(i, terrainHeightAt(x, z));
    }
    groundGeo.computeVertexNormals();

    const turfTex = getMacroTexture(MACRO_TEXTURES.MEADOW_TURF, 48, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      map: turfTex,
      roughness: 0.82,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Loamy soil patch around the ancient hollow hive tree roots
    const soilTex = getMacroTexture(MACRO_TEXTURES.SOIL, 6, 6);
    const hiveSoilGeo = new THREE.CircleGeometry(32, 24);
    hiveSoilGeo.rotateX(-Math.PI / 2);
    const hiveSoilMat = new THREE.MeshStandardMaterial({
      map: soilTex,
      roughness: 0.94,
    });
    const hiveSoilPatch = new THREE.Mesh(hiveSoilGeo, hiveSoilMat);
    hiveSoilPatch.position.set(this.hivePosition.x, this.hivePosition.y + 0.06, this.hivePosition.z);
    hiveSoilPatch.receiveShadow = true;
    this.scene.add(hiveSoilPatch);

    // Giant Garden Trowel
    const trowel = createGardenTrowel();
    trowel.position.set(26, terrainHeightAt(26, -6), -6);
    this.scene.add(trowel);

    // Mossy River Stones & Mounds
    const stonePositions = [
      { x: -14, z: 8, r: 4.2 },
      { x: 18, z: -16, r: 5.0 },
      { x: -28, z: -18, r: 3.8 },
      { x: 8, z: 24, r: 4.5 },
      { x: -32, z: 20, r: 5.2 },
      { x: 34, z: -25, r: 4.8 },
    ];
    stonePositions.forEach((sp) => {
      const stone = createMossyStone(sp.r);
      stone.position.set(sp.x, terrainHeightAt(sp.x, sp.z), sp.z);
      stone.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(stone);
    });

    // Spongy Moss Mounds
    const mossPositions = [
      { x: -6, z: -20, r: 3.5 },
      { x: 12, z: 10, r: 4.0 },
      { x: -22, z: 5, r: 3.2 },
    ];
    mossPositions.forEach((mp) => {
      const mound = createMossMound(mp.r);
      mound.position.set(mp.x, terrainHeightAt(mp.x, mp.z), mp.z);
      this.scene.add(mound);
    });

    // Giant Hollow Hive Tree
    const tree = createTreeHollowHive();
    tree.position.copy(this.hivePosition);
    this.scene.add(tree);
    if (Array.isArray(tree.userData.residentBees)) {
      this.residentHiveBees = tree.userData.residentBees as BeeMeshGroup[];
    }

    // Hive Comb Group inside cavity, facing forward towards the entrance
    this.combMeshGroup.position.set(0, this.hivePosition.y + 5.5, -12.5);
    this.combMeshGroup.rotation.y = 0;
    this.scene.add(this.combMeshGroup);

    // Towering Woodland Ferns
    const fernSpawns = [
      { x: -42, z: 18, h: 15 },
      { x: 40, z: -22, h: 14 },
      { x: -18, z: -52, h: 16 },
    ];
    fernSpawns.forEach((fs) => {
      const fern = createGiantFern(fs.h);
      fern.position.set(fs.x, terrainHeightAt(fs.x, fs.z), fs.z);
      this.scene.add(fern);
    });

    // Giant Fallen Mossy Log (Archway bee landmark)
    const fallenLog = createFallenMossyLog(36, 4.8);
    fallenLog.position.set(6, terrainHeightAt(6, 42), 42);
    this.scene.add(fallenLog);

    // Woodland Fly Agaric Toadstool Clusters (Amanita muscaria)
    const toadstoolSpawns = [
      { x: -14, z: -10, h: 6.8, r: 3.4 },
      { x: -16, z: -7.5, h: 4.8, r: 2.5 },
      { x: 14, z: 46, h: 7.2, r: 3.6 },
      { x: 2, z: 38, h: 5.5, r: 2.8 },
      { x: 24, z: -20, h: 6.2, r: 3.1 },
    ];
    toadstoolSpawns.forEach((ts) => {
      const shroom = createWoodlandToadstool(ts.h, ts.r);
      shroom.position.set(ts.x, terrainHeightAt(ts.x, ts.z), ts.z);
      shroom.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(shroom);
    });
  }

  private buildForestBorderTrees() {
    const placeTree = (tree: THREE.Group, x: number, z: number) => {
      tree.position.set(x, terrainHeightAt(x, z), z);
      this.scene.add(tree);
    };

    placeTree(createAncientOakTree(52), -60, -45);
    placeTree(createAncientOakTree(50), 55, 50);
    placeTree(createBirchTree(42), 45, -40);
    placeTree(createBirchTree(38), -50, 35);
    placeTree(createScotsPineTree(48), -25, -65);
    placeTree(createScotsPineTree(44), 35, 60);
  }

  private registerWorldColliders() {
    // Build hollow perimeter ring of 11 trunk wall cylinders around hive (leaving +Z entrance at PI/2 wide open)
    const hiveWallObstacles: WorldObstacle[] = [];
    const ringSegments = 12;
    for (let k = 0; k < ringSegments; k++) {
      // Skip k === 3 (angle PI/2 = (0, +20.2) -> world (0, -4.8)) so the bee can fly into the cavity!
      if (k === 3) continue;
      const angle = (k * Math.PI * 2) / ringSegments;
      const wx = this.hivePosition.x + Math.cos(angle) * 20.2;
      const wz = this.hivePosition.z + Math.sin(angle) * 20.2;
      const gy = terrainHeightAt(wx, wz);
      hiveWallObstacles.push({
        id: `hive_wall_${k}`,
        type: 'cylinder',
        x: wx,
        z: wz,
        yMin: gy,
        yMax: gy + 44,
        radius: 3.4,
      });
    }

    // Horizontal fallen mossy log (span 36m along X centered at x=6, z=42)
    const logSpheres: WorldObstacle[] = [-14, -7, 0, 7, 14].map((dx, i) => {
      const lx = 6 + dx;
      const lz = 42;
      const gy = terrainHeightAt(lx, lz);
      return {
        id: `fallen_log_${i}`,
        type: 'sphere',
        x: lx,
        z: lz,
        yMin: gy,
        yMax: gy + 9.6,
        radius: 4.8,
      };
    });

    const cylObs = (id: string, x: number, z: number, height: number, radius: number): WorldObstacle => {
      const gy = terrainHeightAt(x, z);
      return { id, type: 'cylinder', x, z, yMin: gy, yMax: gy + height, radius };
    };

    const sphereObs = (id: string, x: number, z: number, height: number, radius: number): WorldObstacle => {
      const gy = terrainHeightAt(x, z);
      return { id, type: 'sphere', x, z, yMin: gy, yMax: gy + height, radius };
    };

    const obstacles: WorldObstacle[] = [
      ...hiveWallObstacles,
      cylObs('oak_1', -60, -45, 52, 26),
      cylObs('oak_2', 55, 50, 50, 26),
      cylObs('birch_1', 45, -40, 42, 6.5),
      cylObs('birch_2', -50, 35, 38, 6.5),
      cylObs('pine_1', -25, -65, 48, 5.0),
      cylObs('pine_2', 35, 60, 44, 4.8),
      cylObs('trowel', 26, -6, 16, 3.0),
      ...logSpheres,
      sphereObs('stone_1', -14, 8, 8, 4.2),
      sphereObs('stone_2', 18, -16, 9.5, 5.0),
      sphereObs('stone_3', -28, -18, 7.5, 3.8),
      sphereObs('stone_4', 8, 24, 8.8, 4.5),
      sphereObs('stone_5', -32, 20, 10, 5.2),
      sphereObs('stone_6', 34, -25, 9.2, 4.8),
      cylObs('toadstool_1', -14, -10, 6.8, 1.2),
      cylObs('toadstool_2', -16, -7.5, 4.8, 1.0),
      cylObs('toadstool_3', 14, 46, 7.2, 1.2),
      cylObs('toadstool_4', 2, 38, 5.5, 1.0),
      cylObs('toadstool_5', 24, -20, 6.2, 1.1),
      ...this.flowers.map((f) => {
        const gy = terrainHeightAt(f.position[0], f.position[2]);
        return {
          id: `flower_${f.id}`,
          type: 'cylinder' as const,
          x: f.position[0],
          z: f.position[2],
          yMin: gy,
          yMax: Math.max(f.position[1], gy + 6.0),
          radius: 0.5,
        };
      }),
    ];

    this.physics.setObstacles(obstacles);
  }

  private buildDenseMeadowVegetation() {
    // Curved Grass Blades with photorealistic macro blade texture and dynamic parting shader
    const grassCount = 10000;
    const bladeGeo = createCurvedGrassGeometry();

    const grassTex = getMacroTexture(MACRO_TEXTURES.GRASS_BLADE, 1, 3);
    this.grassMaterial = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.52,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });

    this.grassMaterial.userData.uPlayerPos = { value: new THREE.Vector3(0, 0, 0) };
    this.grassMaterial.userData.uTime = { value: 0 };

    this.grassMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uPlayerPos = this.grassMaterial.userData.uPlayerPos;
      shader.uniforms.uTime = this.grassMaterial.userData.uTime;

      shader.vertexShader = `
        uniform vec3 uPlayerPos;
        uniform float uTime;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 instPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec2 diff = instPos.xz - uPlayerPos.xz;
          float dist = length(diff);
          if (dist < 3.2 && abs(uPlayerPos.y - instPos.y) < 5.5) {
            vec2 pushDir = normalize(diff + vec2(0.001, 0.001));
            float factor = (1.0 - dist / 3.2) * (position.y / 6.5);
            transformed.x += pushDir.x * factor * 2.2;
            transformed.z += pushDir.y * factor * 2.2;
            transformed.y -= factor * 0.8;
          }
          float wave = sin(uTime * 2.5 + instPos.x * 0.3 + instPos.z * 0.3) * (position.y / 6.5) * 0.3;
          transformed.x += wave;
        #endif
        `
      );
    };

    this.grassMesh = new THREE.InstancedMesh(bladeGeo, this.grassMaterial, grassCount);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    const colorOptions = [0x15803D, 0x16A34A, 0x4ADE80, 0x65A30D, 0x22C55E, 0xD97706];

    for (let i = 0; i < grassCount; i++) {
      const radius = 6 + Math.pow(Math.random(), 0.75) * 95;
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (x * x + (z + 25) * (z + 25) < 480) {
        dummy.position.set(0, -100, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
      } else {
        dummy.position.set(x, terrainHeightAt(x, z), z);
        const scaleY = 0.8 + Math.random() * 0.7;
        const scaleXZ = 0.85 + Math.random() * 0.4;
        dummy.scale.set(scaleXZ, scaleY, scaleXZ);
        dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.2);
      }
      dummy.updateMatrix();
      this.grassMesh.setMatrixAt(i, dummy.matrix);

      const hex = colorOptions[Math.floor(Math.random() * colorOptions.length)];
      color.setHex(hex);
      this.grassMesh.setColorAt(i, color);
    }

    this.grassMesh.instanceMatrix.needsUpdate = true;
    if (this.grassMesh.instanceColor) this.grassMesh.instanceColor.needsUpdate = true;
    this.grassMesh.receiveShadow = true;
    this.scene.add(this.grassMesh);

    // 1,500 Clover Groundcover Leaflets aligned to terrainHeightAt
    const cloverCount = 1500;
    const cloverLeafGeo = new THREE.CircleGeometry(0.85, 8);
    const cloverTex = getMacroTexture(MACRO_TEXTURES.BOTANICAL_LEAF, 1, 1);
    const cloverMat = new THREE.MeshStandardMaterial({
      map: cloverTex,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const groundCloverMesh = new THREE.InstancedMesh(cloverLeafGeo, cloverMat, cloverCount);

    for (let i = 0; i < cloverCount; i++) {
      const r = 5 + Math.random() * 80;
      const a = Math.random() * Math.PI * 2;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      if (cx * cx + (cz + 25) * (cz + 25) < 420) {
        dummy.position.set(0, -100, 0);
        dummy.scale.set(0.001, 0.001, 0.001);
      } else {
        dummy.position.set(cx, terrainHeightAt(cx, cz) + 0.08, cz);
        dummy.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.3, 0, Math.random() * Math.PI * 2);
        dummy.scale.setScalar(0.7 + Math.random() * 0.6);
      }
      dummy.updateMatrix();
      groundCloverMesh.setMatrixAt(i, dummy.matrix);
    }
    groundCloverMesh.instanceMatrix.needsUpdate = true;
    groundCloverMesh.receiveShadow = true;
    this.scene.add(groundCloverMesh);

    // Diverse Flora (Clover, Dandelion, Seed head, Poppy, Bluebell, Thistle, Lavender)
    const flowerConfigs: Array<{
      type: FlowerType;
      x: number;
      z: number;
      height: number;
      hasSpider?: boolean;
    }> = [
      { type: 'clover', x: -18, z: 10, height: 9.5 },
      { type: 'clover', x: -30, z: -8, height: 11.0 },
      { type: 'clover', x: 16, z: 20, height: 10.0 },
      { type: 'dandelion', x: 10, z: -4, height: 12.0, hasSpider: true },
      { type: 'dandelion', x: -10, z: 26, height: 12.5 },
      { type: 'seedhead', x: 28, z: -16, height: 13.0 },
      { type: 'seedhead', x: -4, z: -14, height: 11.5 },
      { type: 'poppy', x: -24, z: 32, height: 14.0 },
      { type: 'poppy', x: 30, z: 6, height: 13.5 },
      { type: 'bluebell', x: 6, z: 36, height: 11.0 },
      { type: 'bluebell', x: -20, z: -22, height: 10.5 },
      { type: 'thistle', x: -36, z: 14, height: 13.0 },
      { type: 'thistle', x: 22, z: -28, height: 12.5 },
      { type: 'lavender', x: 14, z: 34, height: 10.0 },
      { type: 'lavender', x: -12, z: -32, height: 9.5 },
    ];

    flowerConfigs.forEach((cfg, idx) => {
      let flowerMesh: THREE.Group;
      if (cfg.type === 'clover') flowerMesh = createGiantClover(cfg.height);
      else if (cfg.type === 'dandelion') flowerMesh = createGiantDandelion(cfg.height);
      else if (cfg.type === 'seedhead') flowerMesh = createDandelionSeedHead(cfg.height);
      else if (cfg.type === 'poppy') flowerMesh = createGiantPoppy(cfg.height);
      else if (cfg.type === 'bluebell') flowerMesh = createGiantBluebell(cfg.height);
      else if (cfg.type === 'thistle') flowerMesh = createWildThistle(cfg.height);
      else flowerMesh = createLavenderSpike(cfg.height);

      const groundY = terrainHeightAt(cfg.x, cfg.z);
      flowerMesh.position.set(cfg.x, groundY, cfg.z);
      flowerMesh.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(flowerMesh);
      this.flowerMeshes.push(flowerMesh);

      // Add Crab Spider on flower if configured
      if (cfg.hasSpider) {
        const spider = createProceduralSpider();
        spider.position.set(cfg.x, groundY + cfg.height + 0.3, cfg.z);
        this.scene.add(spider);
        this.insects.push({
          id: `spider_${idx}`,
          type: 'spider',
          position: [cfg.x, groundY + cfg.height + 0.3, cfg.z],
          velocity: [0, 0, 0],
          health: 60,
          state: 'stalking',
        });
        this.insectMeshes.push(spider);
      }

      this.flowers.push({
        id: `flower_${idx}`,
        type: cfg.type,
        position: [cfg.x, groundY + cfg.height, cfg.z],
        nectar: 100,
        pollen: 100,
        petalColor: cfg.type === 'clover' ? 0xE11D48 : cfg.type === 'poppy' ? 0xE11D48 : 0xFACC15,
        hasSpider: cfg.hasSpider,
      });
    });
  }

  private buildAtmosphericSunShafts() {
    const shaftGeo = new THREE.CylinderGeometry(2.5, 9.0, 38, 12, 1, true);
    const shaftMat = new THREE.MeshBasicMaterial({
      color: 0xFEF3C7,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const shaft1 = new THREE.Mesh(shaftGeo, shaftMat);
    shaft1.position.set(-6, 14, 4);
    shaft1.rotation.z = 0.45;
    shaft1.rotation.x = -0.3;
    this.scene.add(shaft1);

    const shaft2 = new THREE.Mesh(shaftGeo, shaftMat);
    shaft2.position.set(16, 16, -2);
    shaft2.rotation.z = 0.35;
    shaft2.rotation.x = -0.25;
    this.scene.add(shaft2);
  }

  private buildPollenDustParticles() {
    const count = 450;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 18 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }

    // Seed WASM pollen buffer so particles start distributed across the meadow
    simWasm.seedPollen(positions);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xFDE047,
      size: 0.28,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pollenPoints = new THREE.Points(geo, mat);
    this.scene.add(this.pollenPoints);
  }

  private spawnBiologicalFauna() {
    // 1. Predatory Wasps (Hornet raiders)
    const waspPositions = [
      new THREE.Vector3(-24, terrainHeightAt(-24, 12) + 7, 12),
      new THREE.Vector3(18, terrainHeightAt(18, -4) + 9, -4),
    ];
    waspPositions.forEach((pos, idx) => {
      const waspMesh = createProceduralWasp();
      waspMesh.position.copy(pos);
      this.scene.add(waspMesh);
      this.insectMeshes.push(waspMesh);

      this.insects.push({
        id: `wasp_${idx}`,
        type: 'wasp',
        position: [pos.x, pos.y, pos.z],
        velocity: [0, 0, 0],
        health: 100,
        state: 'stalking',
        target: idx === 0 ? 'hive' : 'player',
        animTimer: 0,
      });
    });

    // 2. Praying Mantis (Ambush predator perched on tall thistle)
    const mantisY = terrainHeightAt(-36, 14) + 10.5;
    const mantisPos = new THREE.Vector3(-36, mantisY, 14);
    const mantisMesh = createProceduralMantis();
    mantisMesh.position.copy(mantisPos);
    mantisMesh.rotation.y = -Math.PI / 3;
    this.scene.add(mantisMesh);
    this.insectMeshes.push(mantisMesh);

    this.insects.push({
      id: 'mantis_1',
      type: 'mantis',
      position: [mantisPos.x, mantisPos.y, mantisPos.z],
      velocity: [0, 0, 0],
      health: 140,
      state: 'stalking',
      target: 'player',
      animTimer: 0,
    });

    // 3. Ladybugs (Neutral crawling beetles)
    const ladybugPositions = [
      new THREE.Vector3(-12, terrainHeightAt(-12, 8) + 0.35, 8),
      new THREE.Vector3(16, terrainHeightAt(16, -14) + 0.35, -14),
    ];
    ladybugPositions.forEach((lPos, idx) => {
      const lb = createProceduralLadybug();
      lb.position.copy(lPos);
      this.scene.add(lb);
      this.insectMeshes.push(lb);

      this.insects.push({
        id: `ladybug_${idx}`,
        type: 'ladybug',
        position: [lPos.x, lPos.y, lPos.z],
        velocity: [0, 0, 0],
        health: 50,
        state: 'crawling',
      });
    });

    // 4. Swallowtail Butterflies (Neutral pollinators fluttering between blossoms)
    const bflyPositions = [
      new THREE.Vector3(8, terrainHeightAt(8, 18) + 12, 18),
      new THREE.Vector3(-20, terrainHeightAt(-20, -10) + 14, -10),
    ];
    bflyPositions.forEach((bPos, idx) => {
      const bfly = createProceduralButterfly();
      bfly.position.copy(bPos);
      this.scene.add(bfly);
      this.insectMeshes.push(bfly);

      this.insects.push({
        id: `butterfly_${idx}`,
        type: 'butterfly',
        position: [bPos.x, bPos.y, bPos.z],
        velocity: [0, 0, 0],
        health: 40,
        state: 'fluttering',
      });
    });
  }

  private spawnAmbientColonyBees() {
    for (let i = 0; i < 6; i++) {
      const bee = createProceduralBee('forager');
      bee.scale.setScalar(0.75);
      bee.position.set(
        (Math.random() - 0.5) * 6,
        this.hivePosition.y + 4.0 + Math.random() * 2,
        -5.0 + (Math.random() - 0.5) * 4
      );
      bee.userData.phaseOffset = i * 1.37;
      bee.userData.flowerIdx = i % Math.max(1, this.flowers.length);
      this.scene.add(bee);
      this.ambientBees.push(bee);
    }
  }

  private buildInitialComb() {
    // Majestic Established Honeycomb Array: Brood Nursery, Pollen Belt, Honey Reserves & Wax Foundation
    this.combCells = [
      // Central Brood Nursery (Curled larvae & royal eggs)
      { q: 0, r: 0, type: 'brood', fillAmount: 100, broodStage: 'larva', broodTimer: 18 },
      { q: 1, r: -1, type: 'brood', fillAmount: 100, broodStage: 'larva', broodTimer: 14 },
      { q: 0, r: -1, type: 'brood', fillAmount: 100, broodStage: 'egg', broodTimer: 8 },
      { q: -1, r: 0, type: 'brood', fillAmount: 100, broodStage: 'egg', broodTimer: 10 },
      { q: -1, r: 1, type: 'brood', fillAmount: 100, broodStage: 'larva', broodTimer: 22 },
      { q: 0, r: 1, type: 'brood', fillAmount: 100, broodStage: 'larva', broodTimer: 16 },
      { q: 1, r: 0, type: 'brood', fillAmount: 100, broodStage: 'egg', broodTimer: 6 },
      // Pollen Storage Belt (Nutrient bee bread)
      { q: 1, r: 1, type: 'pollen', fillAmount: 95 },
      { q: -1, r: 2, type: 'pollen', fillAmount: 90 },
      { q: -2, r: 1, type: 'pollen', fillAmount: 85 },
      { q: -2, r: 2, type: 'pollen', fillAmount: 80 },
      { q: 2, r: -1, type: 'pollen', fillAmount: 90 },
      { q: 0, r: 2, type: 'pollen', fillAmount: 75 },
      { q: -2, r: 0, type: 'pollen', fillAmount: 85 },
      // Amber Honey Reserves & Capped Honey Cells
      { q: 2, r: 0, type: 'honey', fillAmount: 95 },
      { q: 2, r: -2, type: 'honey', fillAmount: 90 },
      { q: 1, r: -2, type: 'honey', fillAmount: 85 },
      { q: 0, r: -2, type: 'honey', fillAmount: 100 },
      { q: -1, r: -1, type: 'honey', fillAmount: 95 },
      { q: 3, r: -1, type: 'honey', fillAmount: 80 },
      { q: 3, r: -2, type: 'honey', fillAmount: 85 },
      { q: 2, r: 1, type: 'honey', fillAmount: 90 },
      { q: 1, r: 2, type: 'honey', fillAmount: 95 },
      // Wax Foundation & Expansion Frontier
      { q: -2, r: -1, type: 'empty', fillAmount: 0 },
      { q: -1, r: -2, type: 'empty', fillAmount: 0 },
      { q: 3, r: 0, type: 'empty', fillAmount: 0 },
      { q: -3, r: 1, type: 'empty', fillAmount: 0 },
      { q: 0, r: 3, type: 'empty', fillAmount: 0 },
    ];
    this.renderCombMeshes();
  }

  private renderCombMeshes() {
    while (this.combMeshGroup.children.length > 0) {
      this.combMeshGroup.remove(this.combMeshGroup.children[0]);
    }

    this.combCells.forEach((cell) => {
      const cellMesh = createHexCombCell(cell);
      this.combMeshGroup.add(cellMesh);
    });
  }

  private disposeObjectHierarchy(root: THREE.Object3D) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => this.disposeMaterialAndTextures(m));
      } else if (mat) {
        this.disposeMaterialAndTextures(mat);
      }
    });
  }

  private disposeMaterialAndTextures(mat: THREE.Material) {
    const std = mat as THREE.MeshStandardMaterial;
    if (std.map) std.map.dispose();
    if (std.normalMap) std.normalMap.dispose();
    if (std.roughnessMap) std.roughnessMap.dispose();
    mat.dispose();
  }

  private spawnPlayerBee() {
    if (this.playerBeeMesh) {
      this.scene.remove(this.playerBeeMesh);
      this.disposeObjectHierarchy(this.playerBeeMesh);
    }

    this.playerBeeMesh = createProceduralBee(this.currentRole);
    this.syncPollenBasketScale();
    this.scene.add(this.playerBeeMesh);
  }

  private syncPollenBasketScale() {
    if (!this.playerBeeMesh?.pollenBaskets) return;
    const ratio = this.playerState.pollenCarried / 20;
    const pScale = ratio > 0 ? 0.45 + ratio * 0.85 : 0.01;
    this.playerBeeMesh.pollenBaskets.forEach((b) => b.scale.set(pScale, pScale, pScale));
  }

  private clearInputs() {
    this.inputState.forward = false;
    this.inputState.backward = false;
    this.inputState.left = false;
    this.inputState.right = false;
    this.inputState.up = false;
    this.inputState.down = false;
    this.inputState.sprint = false;
    this.inputState.actionPrimary = false;
    this.inputState.actionSecondary = false;
  }

  private setupInputs() {
    this.onKeyDownBound = (e: KeyboardEvent) => {
      if (this.isPaused || this.isDestroyed) return;
      audioEngine.ensureRunning();

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.inputState.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.inputState.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.inputState.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.inputState.right = true;
          break;
        case 'KeyQ':
          this.inputState.down = true;
          break;
        case 'KeyE':
          this.inputState.up = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.inputState.sprint = true;
          break;
        case 'Space':
          if (!e.repeat) this.executeContextAction();
          break;
        case 'KeyF':
          if (!e.repeat) this.executeSecondaryAction();
          break;
        case 'Digit1':
          if (!e.repeat) this.switchRole('forager');
          break;
        case 'Digit2':
          if (!e.repeat) this.switchRole('guard');
          break;
        case 'Digit3':
          if (!e.repeat) this.switchRole('builder');
          break;
        case 'Digit4':
          if (!e.repeat) this.switchRole('queen');
          break;
        case 'KeyB':
          if (!e.repeat) this.buildNewCombCell();
          break;
      }
    };

    this.onKeyUpBound = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.inputState.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.inputState.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.inputState.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.inputState.right = false;
          break;
        case 'KeyQ':
          this.inputState.down = false;
          break;
        case 'KeyE':
          this.inputState.up = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.inputState.sprint = false;
          break;
      }
    };

    this.onBlurBound = () => {
      this.clearInputs();
    };

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onBlurBound);
  }

  public switchRole(role: BeeRole) {
    if (this.currentRole === role) return;
    this.currentRole = role;
    this.playerState.role = role;
    this.spawnPlayerBee();
    audioEngine.playNectarSip();
    this.callbacks.onLogMessage(`Switched role to ${role.toUpperCase()}`);
  }

  public setWeather(weather: WeatherType) {
    this.weatherCtrl.setWeather(weather);
    this.callbacks.onLogMessage(`Weather shifted to ${weather.toUpperCase()}`);
  }

  public setGameMode(mode: GameMode) {
    this.gameMode = mode;
    this.clearInputs();

    this.playerState.health = 100;
    this.playerState.stamina = 100;
    this.playerState.nectarCarried = 0;
    this.playerState.pollenCarried = 0;
    this.playerState.threatWarning = null;
    this.playerState.stingingCooldown = 0;

    // Replenish flowers & reset predator positions
    this.flowers.forEach((f) => {
      f.nectar = 100;
      f.pollen = 100;
      if (f.id === 'flower_3') f.hasSpider = true;
    });
    this.insects.forEach((ins, idx) => {
      if (ins.type === 'wasp') {
        ins.health = 100;
        ins.animTimer = 0;
        const wx = idx % 2 === 0 ? -24 : 18;
        const wz = idx % 2 === 0 ? 12 : -4;
        ins.position = [wx, terrainHeightAt(wx, wz) + 8, wz];
      } else if (ins.type === 'mantis') {
        ins.health = 140;
        ins.animTimer = 0;
      } else if (ins.type === 'spider') {
        ins.health = 60;
      }
    });

    if (mode === 'colony_active') {
      this.currentRole = 'forager';
      this.playerState.role = 'forager';
      this.colony.honey = 85;
      this.colony.pollen = 60;
      this.colony.wax = 45;
      this.colony.nectar = 40;
      this.colony.hiveWarmth = 90;
      this.colony.population = {
        foragers: 20,
        guards: 8,
        builders: 10,
        larvae: 8,
        eggs: 6,
      };
      this.foundingSiteFound = true;
      this.buildInitialComb();
      this.combMeshGroup.position.set(0, this.hivePosition.y + 5.5, -12.5);
      this.combMeshGroup.rotation.y = 0;
      this.spawnPlayerBee();
      this.physics.setPosition(0, this.hivePosition.y + 3.8, -2.5, 0);
      this.callbacks.onLogMessage('Colony simulation: Established hive thriving! Forage floral nectar, tend brood, or defend against hornets.');
    } else if (mode === 'swarm_migration') {
      this.currentRole = 'queen';
      this.playerState.role = 'queen';
      this.colony.honey = 45;
      this.colony.pollen = 30;
      this.colony.wax = 35;
      this.colony.nectar = 20;
      this.colony.hiveWarmth = 78;
      this.colony.population = { foragers: 14, guards: 5, builders: 7, larvae: 0, eggs: 0 };
      this.combCells = [];
      this.renderCombMeshes();
      this.foundingSiteFound = false;
      this.spawnPlayerBee();
      this.physics.setPosition(22, terrainHeightAt(22, 28) + 4.0, 28, Math.PI * 0.25);
      this.callbacks.onLogMessage('Swarm migration: Guide the swarm queen to the hollow oak cavity to establish a new colony!');
    } else {
      this.currentRole = 'queen';
      this.playerState.role = 'queen';
      this.colony.honey = 15;
      this.colony.pollen = 10;
      this.colony.wax = 12;
      this.colony.nectar = 0;
      this.colony.hiveWarmth = 68;
      this.colony.population = { foragers: 0, guards: 0, builders: 0, larvae: 0, eggs: 0 };
      this.combCells = [];
      this.renderCombMeshes();
      this.foundingSiteFound = false;
      this.spawnPlayerBee();
      this.physics.setPosition(10, terrainHeightAt(10, 18) + 2.5, 18, 0.2);
      this.callbacks.onLogMessage('Spring thaw: Queen awakened. Beware of early predators while scouting the oak cavity!');
    }
  }

  private getNearestPredatorDistance(maxDist: number): InsectEntity | null {
    const pPos = this.playerBeeMesh.position;
    for (const ins of this.insects) {
      if (ins.type === 'wasp' || ins.type === 'mantis' || ins.type === 'spider') {
        _vecA.set(ins.position[0], ins.position[1], ins.position[2]);
        if (pPos.distanceTo(_vecA) < maxDist) {
          return ins;
        }
      }
    }
    return null;
  }

  public executeSecondaryAction() {
    audioEngine.ensureRunning();
    if (this.playerState.nearHive && this.playerState.health < 100 && this.colony.honey >= 2) {
      this.colony.honey -= 2;
      this.playerState.health = Math.min(100, this.playerState.health + 25);
      audioEngine.playNectarSip();
      this.callbacks.onLogMessage('Sipped royal honey from hive stores (+25 HP).');
      return;
    }
    if (this.playerState.stamina < 95 && this.playerState.nectarCarried >= 5) {
      this.playerState.nectarCarried -= 5;
      this.playerState.stamina = Math.min(100, this.playerState.stamina + 45);
      audioEngine.playNectarSip();
      this.callbacks.onLogMessage('Consumed floral nectar for flight energy (+45 Stamina).');
      return;
    }
    this.callbacks.onLogMessage('Secondary [F]: Heal near hive with honey or convert carried nectar to stamina.');
  }

  public executeContextAction() {
    audioEngine.ensureRunning();

    // 1. Guard Combat Attack (when predator in range or not near hive deposit/flower)
    const predatorNear = this.getNearestPredatorDistance(6.0);
    if (this.currentRole === 'guard' && predatorNear) {
      this.executeStingAttack();
      return;
    }

    // 2. Deposit at Hive (works for any caste carrying nectar/pollen)
    if (this.playerState.nearHive && (this.playerState.nectarCarried > 0 || this.playerState.pollenCarried > 0)) {
      const rawNectar = this.playerState.nectarCarried;
      const immediateHoney = Math.round(rawNectar * 0.4);
      const ripeningNectar = rawNectar - immediateHoney;
      const waxGain = Math.max(1, Math.round(rawNectar * 0.25));

      this.colony.honey += immediateHoney;
      this.colony.nectar += ripeningNectar;
      this.colony.pollen += this.playerState.pollenCarried;
      this.colony.wax += waxGain;

      // Visually fill available empty comb cells
      let combUpdated = false;
      if (rawNectar > 0) {
        const emptyHoneyCell = this.combCells.find((c) => c.type === 'empty');
        if (emptyHoneyCell) {
          emptyHoneyCell.type = 'honey';
          emptyHoneyCell.fillAmount = Math.min(100, 65 + rawNectar);
          combUpdated = true;
        }
      }
      if (this.playerState.pollenCarried > 0) {
        const emptyPollenCell = this.combCells.find((c) => c.type === 'empty');
        if (emptyPollenCell) {
          emptyPollenCell.type = 'pollen';
          emptyPollenCell.fillAmount = 90;
          combUpdated = true;
        }
      }
      if (combUpdated) this.renderCombMeshes();

      this.callbacks.onLogMessage(
        `Deposited: +${immediateHoney} Honey, +${ripeningNectar} Raw Nectar, +${this.playerState.pollenCarried} Pollen, +${waxGain} Wax!`
      );

      this.playerState.nectarCarried = 0;
      this.playerState.pollenCarried = 0;
      this.syncPollenBasketScale();
      audioEngine.playCombBuild();
      return;
    }

    // 3. Floral Nectar & Pollen Gathering
    if (this.playerState.nearFlowerId) {
      const flower = this.flowers.find((f) => f.id === this.playerState.nearFlowerId);
      if (flower && (flower.nectar > 0 || flower.pollen > 0)) {
        if (flower.hasSpider) {
          this.applyPlayerDamage(22, 'CRAB SPIDER AMBUSH! Evaded petal trap — spider scattered!');
          flower.hasSpider = false;
          const spider = this.insects.find((ins) => ins.type === 'spider');
          if (spider) {
            spider.health = 0;
            spider.position[1] = -50;
          }
          return;
        }

        const sipNectar = Math.min(flower.nectar, 10, 30 - this.playerState.nectarCarried);
        const gatherPollen = Math.min(flower.pollen, 6, 20 - this.playerState.pollenCarried);

        if (sipNectar === 0 && gatherPollen === 0) {
          this.callbacks.onLogMessage('Pollen baskets full! Return to the hive entrance to deposit.');
          return;
        }

        flower.nectar -= sipNectar;
        flower.pollen -= gatherPollen;
        this.playerState.nectarCarried = Math.min(30, this.playerState.nectarCarried + sipNectar);
        this.playerState.pollenCarried = Math.min(20, this.playerState.pollenCarried + gatherPollen);
        this.syncPollenBasketScale();

        audioEngine.playNectarSip();
        this.callbacks.onLogMessage(`Gathered ${sipNectar} nectar & ${gatherPollen} pollen from ${flower.type}!`);
        return;
      } else if (flower) {
        this.callbacks.onLogMessage(`${flower.type} is depleted and regenerating nectar...`);
        return;
      }
    }

    // 4. Queen Founding / Egg Laying
    if (this.currentRole === 'queen') {
      if ((this.gameMode === 'spring_founding' || this.gameMode === 'swarm_migration') && !this.foundingSiteFound) {
        if (this.playerState.nearFoundingSite) {
          this.foundingSiteFound = true;
          this.buildInitialFoundingComb();
          return;
        } else {
          this.callbacks.onLogMessage('Fly inside or onto the hollow oak landing board to claim the cavity.');
          return;
        }
      }

      if (this.playerState.nearHive) {
        const emptyCell = this.combCells.find((c) => c.type === 'empty');
        if (emptyCell) {
          emptyCell.type = 'brood';
          emptyCell.broodStage = 'egg';
          emptyCell.broodTimer = 10;
          this.colony.population.eggs++;
          this.renderCombMeshes();
          audioEngine.playEggLay();
          this.callbacks.onLogMessage('Queen laid a royal egg into an empty honeycomb cell.');
          return;
        } else {
          this.callbacks.onLogMessage('No empty comb cells available — switch to Builder [3] and expand comb [B]!');
          return;
        }
      }
    }

    // 5. Builder: Honeycomb construction
    if (this.currentRole === 'builder') {
      this.buildNewCombCell();
      return;
    }

    // 6. Guard fallback sting
    if (this.currentRole === 'guard') {
      this.executeStingAttack();
    }
  }

  private findNextHexSpiralCoord(): { q: number; r: number } {
    const occupied = new Set(this.combCells.map((c) => `${c.q},${c.r}`));
    if (!occupied.has('0,0')) return { q: 0, r: 0 };

    const dirs: Array<[number, number]> = [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
      [-1, 1],
      [0, 1],
    ];

    for (let ring = 1; ring <= 8; ring++) {
      let q = -ring;
      let r = ring;
      for (let side = 0; side < 6; side++) {
        for (let step = 0; step < ring; step++) {
          if (!occupied.has(`${q},${r}`)) {
            return { q, r };
          }
          q += dirs[side][0];
          r += dirs[side][1];
        }
      }
    }
    return { q: this.combCells.length, r: 0 };
  }

  public buildNewCombCell() {
    if (this.colony.wax < 8) {
      this.callbacks.onLogMessage('Not enough wax (needs 8 wax scales to build cell).');
      return;
    }

    const { q: nextQ, r: nextR } = this.findNextHexSpiralCoord();
    this.colony.wax -= 8;
    this.combCells.push({
      q: nextQ,
      r: nextR,
      type: 'empty',
      fillAmount: 0,
    });

    this.renderCombMeshes();
    audioEngine.playCombBuild();
    this.callbacks.onLogMessage(`Builder expanded comb at [${nextQ}, ${nextR}]!`);
  }

  private buildInitialFoundingComb() {
    this.combCells = [
      { q: 0, r: 0, type: 'honey', fillAmount: 90 },
      { q: 1, r: 0, type: 'brood', fillAmount: 100, broodStage: 'egg', broodTimer: 8 },
      { q: 0, r: -1, type: 'empty', fillAmount: 0 },
      { q: -1, r: 0, type: 'empty', fillAmount: 0 },
    ];
    this.combMeshGroup.position.set(0, this.hivePosition.y + 5.5, -12.5);
    this.combMeshGroup.rotation.y = 0;
    this.renderCombMeshes();
    this.gameMode = 'colony_active';
    audioEngine.playCombBuild();
    this.callbacks.onLogMessage('Cavity claimed & colony established! First honeypot and brood comb constructed.');
  }

  private executeStingAttack() {
    if (this.playerState.stingingCooldown > 0) return;
    this.playerState.stingingCooldown = 0.45;
    audioEngine.playStingAttack();

    const playerPos = this.playerBeeMesh.position;
    let hitAny = false;

    for (const insect of this.insects) {
      if (insect.type === 'wasp' || insect.type === 'mantis' || insect.type === 'spider') {
        _vecA.set(insect.position[0], insect.position[1], insect.position[2]);
        if (playerPos.distanceTo(_vecA) < 6.0) {
          hitAny = true;
          const damage = insect.type === 'wasp' ? 45 : 35;
          insect.health -= damage;

          if (insect.type === 'wasp') {
            _vecB.copy(_vecA).sub(playerPos);
            if (_vecB.lengthSq() > 0.001) _vecB.normalize();
            insect.position[0] += _vecB.x * 4.5;
            insect.position[1] += _vecB.y * 2.0;
            insect.position[2] += _vecB.z * 4.5;
          }

          if (insect.health <= 0) {
            this.callbacks.onLogMessage(`Repelled ${insect.type} from the meadow!`);
            if (insect.type === 'wasp') {
              const angle = Math.random() * Math.PI * 2;
              const rx = Math.cos(angle) * 75;
              const rz = Math.sin(angle) * 75;
              insect.position = [rx, terrainHeightAt(rx, rz) + 14, rz];
              insect.health = 100;
            } else {
              insect.position[1] = -50;
            }
          } else {
            this.callbacks.onLogMessage(`Stinger strike hit ${insect.type}! (HP: ${insect.health})`);
          }
          break;
        }
      }
    }

    if (!hitAny) {
      this.callbacks.onLogMessage('Stinger strike missed — get closer (< 6m) to a wasp or mantis!');
    }
  }

  private applyPlayerDamage(amount: number, reasonLog?: string) {
    this.playerState.health = Math.max(0, this.playerState.health - amount);
    audioEngine.playStingAttack();

    if (this.playerState.health <= 0) {
      this.handlePlayerDefeat();
    } else if (reasonLog) {
      this.callbacks.onLogMessage(reasonLog);
    }
  }

  private handlePlayerDefeat() {
    this.playerState.health = 100;
    this.playerState.stamina = 100;
    this.playerState.nectarCarried = 0;
    this.playerState.pollenCarried = 0;
    this.playerState.threatWarning = null;
    this.syncPollenBasketScale();

    if (this.colony.honey >= 5) {
      this.colony.honey -= 5;
    }

    this.physics.setPosition(0, this.hivePosition.y + 3.8, -2.5, 0);
    this.clearInputs();
    this.callbacks.onLogMessage('Defeated by predator! Carried back to the hive landing board (-5 Honey).');
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      this.clearInputs();
      audioEngine.updateFlight(0, false, this.currentRole);
    }
  }

  private tick = () => {
    if (this.isDestroyed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    const elapsed = this.clock.getElapsedTime();

    if (this.isPaused) {
      // Atmospheric slow panoramic camera pan while on Main Menu
      this.panAngle += dt * 0.14;
      this.camera.position.set(
        Math.cos(this.panAngle) * 32,
        14 + Math.sin(this.panAngle * 0.5) * 3.5,
        Math.sin(this.panAngle) * 32
      );
      this.camera.lookAt(0, 5, 0);
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(this.tick);
      return;
    }

    // Stamina drain & recovery
    const isActivelySprinting =
      this.inputState.sprint && (this.inputState.forward || this.inputState.up) && this.playerState.stamina > 0;
    if (isActivelySprinting) {
      this.playerState.stamina = Math.max(0, this.playerState.stamina - dt * 22);
    } else {
      const regenRate = this.playerState.nearHive ? 30 : 15;
      this.playerState.stamina = Math.min(100, this.playerState.stamina + dt * regenRate);
    }

    if (this.playerState.stingingCooldown > 0) {
      this.playerState.stingingCooldown = Math.max(0, this.playerState.stingingCooldown - dt);
    }

    const canSprint = this.playerState.stamina > 1.0;
    const pState = this.physics.update(dt, this.inputState, canSprint);

    if (pState.hasCollidedObstacle) {
      audioEngine.playChitinThud(pState.lastImpactSpeed);
    }

    audioEngine.updateGrassRustle(pState.speed, pState.isInGrass);

    if (this.grassMaterial?.userData?.uPlayerPos?.value) {
      this.grassMaterial.userData.uPlayerPos.value.copy(pState.position);
      this.grassMaterial.userData.uTime.value = elapsed;
    }

    this.playerBeeMesh.position.copy(pState.position);
    this.playerBeeMesh.quaternion.copy(pState.rotation);

    const flapSpeed = 48 + pState.speed * 2.5;
    this.playerBeeMesh.wingPhase = (this.playerBeeMesh.wingPhase || 0) + dt * flapSpeed;
    const flapAngle = Math.sin(this.playerBeeMesh.wingPhase) * 0.45;

    if (this.playerBeeMesh.leftWing && this.playerBeeMesh.rightWing) {
      this.playerBeeMesh.leftWing.rotation.z = -Math.PI / 4.8 + flapAngle;
      this.playerBeeMesh.rightWing.rotation.z = Math.PI / 4.8 - flapAngle;
    }

    if (this.playerBeeMesh.antennae) {
      this.playerBeeMesh.antennae.forEach((ant, i) => {
        ant.rotation.z = Math.sin(this.playerBeeMesh.wingPhase * 0.2 + i) * 0.08;
      });
    }

    audioEngine.updateFlight(pState.speed, !pState.isGrounded, this.currentRole);

    const distToHive = pState.position.distanceTo(this.hivePosition);
    audioEngine.updateHiveAmbience(distToHive, this.colony.population.foragers + this.colony.population.guards);

    this.weatherCtrl.update(dt, pState.position);

    // High-performance particle simulation in WebAssembly
    if (this.pollenPoints) {
      const posAttr = this.pollenPoints.geometry.attributes.position as THREE.BufferAttribute;
      if (simWasm.getIsReady()) {
        simWasm.updatePollen(450, dt, this.weatherCtrl.wind.x);
        (posAttr.array as Float32Array).set(simWasm.pollenFloats);
      } else {
        for (let i = 0; i < posAttr.count; i++) {
          let py = posAttr.getY(i) - dt * 0.2;
          let px = posAttr.getX(i) + this.weatherCtrl.wind.x * dt * 0.5;
          if (py < 0.2) py = 18;
          if (px > 40) px = -40;
          posAttr.setY(i, py);
          posAttr.setX(i, px);
        }
      }
      posAttr.needsUpdate = true;
    }

    // Animate resident guard & fanner bees at the hive landing board
    this.residentHiveBees.forEach((rBee, rIdx) => {
      const rate = rIdx === 2 ? 68 : 44; // Fanner fans wings faster to ventilate comb
      rBee.wingPhase = (rBee.wingPhase || 0) + dt * rate;
      const flap = Math.sin(rBee.wingPhase) * 0.42;
      if (rBee.leftWing && rBee.rightWing) {
        rBee.leftWing.rotation.z = -0.5 + flap;
        rBee.rightWing.rotation.z = 0.5 - flap;
      }
      if (rIdx < 2) {
        rBee.position.y = 3.4 + Math.sin(elapsed * 2.4 + rIdx * Math.PI) * 0.14;
      }
    });

    // Animate foraging ambient bees flying looping paths between hive entrance and meadow flowers
    this.ambientBees.forEach((aBee, idx) => {
      aBee.wingPhase = (aBee.wingPhase || 0) + dt * 52;
      if (aBee.leftWing && aBee.rightWing) {
        const flap = Math.sin(aBee.wingPhase) * 0.4;
        aBee.leftWing.rotation.z = -0.5 + flap;
        aBee.rightWing.rotation.z = 0.5 - flap;
      }
      const phaseOffset = Number(aBee.userData.phaseOffset ?? idx * 1.3);
      const flowerIdx = Number(aBee.userData.flowerIdx ?? idx) % Math.max(1, this.flowers.length);
      const targetFlower = this.flowers[flowerIdx];
      if (targetFlower) {
        const cycle = (elapsed * 0.12 + phaseOffset * 0.18) % 1.0;
        // Triangle wave 0 -> 1 -> 0 between hive entrance and flower top
        const t = cycle < 0.5 ? cycle * 2.0 : (1.0 - cycle) * 2.0;
        const smoothT = t * t * (3.0 - 2.0 * t);

        const nextX = THREE.MathUtils.lerp(this.hiveEntrancePos.x + (idx - 2.5) * 0.9, targetFlower.position[0], smoothT);
        const nextZ = THREE.MathUtils.lerp(this.hiveEntrancePos.z, targetFlower.position[2], smoothT);
        const arcLift = Math.sin(smoothT * Math.PI) * 4.5;
        const nextY = THREE.MathUtils.lerp(this.hiveEntrancePos.y, targetFlower.position[1] + 0.8, smoothT) + arcLift;

        const dx = nextX - aBee.position.x;
        const dz = nextZ - aBee.position.z;
        if (dx * dx + dz * dz > 0.0001) {
          aBee.rotation.y = Math.atan2(-dx, -dz);
        }
        aBee.position.set(nextX, nextY, nextZ);
      }
    });

    // Check Flower Proximity & regenerate flower nectar/pollen
    let nearFlowerId: string | null = null;
    for (const f of this.flowers) {
      f.nectar = Math.min(100, f.nectar + dt * 2.0);
      f.pollen = Math.min(100, f.pollen + dt * 1.4);

      _vecA.set(f.position[0], f.position[1], f.position[2]);
      if (pState.position.distanceTo(_vecA) < 4.5) {
        nearFlowerId = f.id;
      }
    }

    const distToEntrance = pState.position.distanceTo(this.hiveEntrancePos);
    const distToInterior = pState.position.distanceTo(this.hiveInteriorPos);
    const isNearHive =
      distToEntrance < 9.5 ||
      (distToInterior < 17.5 && pState.position.y < this.hivePosition.y + 16.0);

    this.playerState.nearFlowerId = nearFlowerId;
    this.playerState.nearHive = isNearHive;
    this.playerState.nearFoundingSite = isNearHive || distToHive < 22.0;
    this.playerState.speed = Math.round(pState.speed * 10) / 10;
    this.playerState.altitude = Math.round(pState.altitude * 10) / 10;
    this.playerState.position = [pState.position.x, pState.position.y, pState.position.z];
    _euler.setFromQuaternion(pState.rotation, 'YXZ');
    this.playerState.yaw = _euler.y;

    // Gentle hive healing while resting at hive
    if (isNearHive && this.playerState.health < 100 && this.colony.honey > 0) {
      this.playerState.health = Math.min(100, this.playerState.health + dt * 6.0);
      this.healingEnergyAcc += dt * 6.0;
      if (this.healingEnergyAcc >= 10.0) {
        this.healingEnergyAcc -= 10.0;
        this.colony.honey = Math.max(0, this.colony.honey - 1);
      }
    }

    // Biological Insects AI update
    this.updateBiologicalInsects(dt, elapsed, pState.position);

    // Colony Brood, Nectar Ripening, & Warmth
    this.updateColonySimulation(dt);

    // Camera tracking (zero allocations)
    _camOffset.set(0, 2.4, 6.0).applyQuaternion(pState.rotation);
    this.cameraTarget.copy(pState.position).add(_camOffset);
    this.camera.position.lerp(this.cameraTarget, dt * 5.5);

    _camLookAhead.set(0, 0.4, -4.0).applyQuaternion(pState.rotation);
    this.cameraLookTarget.copy(pState.position).add(_camLookAhead);
    this.camera.lookAt(this.cameraLookTarget);

    const targetFOV = isActivelySprinting ? 74 : 65;
    const nextFov = THREE.MathUtils.damp(this.camera.fov, targetFOV, 4.0, dt);
    if (Math.abs(nextFov - this.camera.fov) > 0.01) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }

    this.renderer.render(this.scene, this.camera);

    // Throttle React HUD state updates to 15 Hz
    const now = performance.now();
    if (now - this.lastStateUpdateTime > 66) {
      this.lastStateUpdateTime = now;
      this.callbacks.onStateUpdate(
        { ...this.playerState },
        { ...this.colony, population: { ...this.colony.population } },
        this.gameMode,
        this.weatherCtrl.currentWeather,
        this.flowers,
        this.insects,
        [this.hivePosition.x, this.hivePosition.y, this.hivePosition.z]
      );
    }

    this.frameId = requestAnimationFrame(this.tick);
  };

  private updateBiologicalInsects(dt: number, elapsed: number, playerPos: THREE.Vector3) {
    let warning: string | null = null;

    this.insects.forEach((insect, idx) => {
      const mesh = this.insectMeshes[idx];
      if (!mesh || insect.health <= 0) {
        if (mesh && insect.health <= 0) mesh.visible = false;
        return;
      }
      mesh.visible = true;

      _vecA.set(insect.position[0], insect.position[1], insect.position[2]);
      const distToPlayer = playerPos.distanceTo(_vecA);

      // 1. WASP / HORNET (Aerial predator & hive raider)
      if (insect.type === 'wasp') {
        const wMesh = mesh as WaspMeshGroup;
        const time = elapsed + idx * 4.0;
        insect.animTimer = Math.max(0, (insect.animTimer || 0) - dt);

        if (distToPlayer < 12.0) {
          // Approach or orbit at striking range (3.2m - 5.5m)
          _vecB.copy(playerPos).sub(_vecA);
          const dist = _vecB.length();
          if (dist > 3.6) {
            _vecB.normalize();
            _vecA.addScaledVector(_vecB, dt * 6.2);
          } else {
            // Orbit around player and periodically dive-sting
            _vecC.set(-_vecB.z, 0.2, _vecB.x).normalize();
            _vecA.addScaledVector(_vecC, dt * 4.0);
          }

          // Orient head (-Z) toward player
          wMesh.rotation.y = Math.atan2(-(playerPos.x - _vecA.x), -(playerPos.z - _vecA.z));

          if (distToPlayer < 4.5 && insect.animTimer <= 0) {
            insect.animTimer = 2.0;
            const dmg = this.currentRole === 'guard' ? 8 : 14;
            this.applyPlayerDamage(dmg, 'Hornet sting hit you! Switch to Guard [2] & press [Space] to fight back!');
          }

          if (!warning) {
            warning =
              this.currentRole === 'guard'
                ? 'HORNET IN RANGE! PRESS [SPACE] TO STING!'
                : 'HORNET DETECTED! SWITCH TO GUARD [2] TO STING!';
          }
        } else {
          // Circular territory patrol; raid hive entrance if idx === 0
          const patrolAngle = time * 0.35;
          const centerX = idx === 0 ? 0 : 20;
          const centerZ = idx === 0 ? -10 : 6;
          const targetX = centerX + Math.cos(patrolAngle) * 16;
          const targetZ = centerZ + Math.sin(patrolAngle) * 16;
          const targetY = terrainHeightAt(targetX, targetZ) + 7.5 + Math.sin(time * 0.7) * 1.5;

          _vecB.set(targetX - _vecA.x, targetY - _vecA.y, targetZ - _vecA.z);
          if (_vecB.lengthSq() > 0.25) {
            _vecB.normalize();
            _vecA.addScaledVector(_vecB, dt * 4.5);
            wMesh.rotation.y = Math.atan2(-_vecB.x, -_vecB.z);
          }
        }

        insect.position[0] = _vecA.x;
        insect.position[1] = _vecA.y;
        insect.position[2] = _vecA.z;
        mesh.position.copy(_vecA);

        wMesh.wingPhase = (wMesh.wingPhase || 0) + dt * 60;
        if (wMesh.leftWing && wMesh.rightWing) {
          const flap = Math.sin(wMesh.wingPhase) * 0.4;
          wMesh.leftWing.rotation.z = -0.5 + flap;
          wMesh.rightWing.rotation.z = 0.5 - flap;
        }
      }

      // 2. PRAYING MANTIS (Ambush Predator)
      else if (insect.type === 'mantis') {
        const mantisMesh = mesh as MantisMeshGroup;
        insect.animTimer = Math.max(0, (insect.animTimer || 0) - dt);

        if (distToPlayer < 9.5) {
          if (mantisMesh.head) {
            mantisMesh.head.lookAt(playerPos);
          }

          if (distToPlayer < 5.5) {
            warning = 'MANTIS AMBUSH! EVADE WITH SPRINT [SHIFT]!';

            mantisMesh.strikeProgress = Math.min(1.0, (mantisMesh.strikeProgress || 0) + dt * 4.0);
            if (mantisMesh.leftArm && mantisMesh.rightArm) {
              const strikeAngle = Math.sin(mantisMesh.strikeProgress * Math.PI) * 1.2;
              mantisMesh.leftArm.rotation.x = strikeAngle;
              mantisMesh.rightArm.rotation.x = strikeAngle;
            }

            if (distToPlayer < 3.4 && !this.inputState.sprint && insect.animTimer <= 0) {
              insect.animTimer = 0.75;
              this.applyPlayerDamage(18, 'Mantis strike hit! Hold [Shift] to evade!');
            }
          } else {
            mantisMesh.strikeProgress = 0;
          }
        }
      }

      // 3. BUTTERFLY (Gentle Pollinator Fluttering)
      else if (insect.type === 'butterfly') {
        const bfly = mesh as ButterflyMeshGroup;
        bfly.wingPhase = (bfly.wingPhase || 0) + dt * 14;
        const flap = Math.sin(bfly.wingPhase) * 0.85;

        if (bfly.leftWing && bfly.rightWing) {
          bfly.leftWing.rotation.z = -flap;
          bfly.rightWing.rotation.z = flap;
        }

        const time = elapsed + idx * 3;
        const vx = Math.sin(time * 0.6) * 3.0;
        const vy = Math.cos(time * 1.5) * 1.5;
        const vz = Math.cos(time * 0.8) * 2.5;
        _vecA.x += vx * dt;
        _vecA.y = Math.max(terrainHeightAt(_vecA.x, _vecA.z) + 3.0, _vecA.y + vy * dt);
        _vecA.z += vz * dt;
        bfly.rotation.y = Math.atan2(-vx, -vz);

        insect.position[0] = _vecA.x;
        insect.position[1] = _vecA.y;
        insect.position[2] = _vecA.z;
        mesh.position.copy(_vecA);
      }

      // 4. LADYBUG (Slow crawl on grass/stone)
      else if (insect.type === 'ladybug') {
        const time = elapsed + idx;
        _vecA.y = terrainHeightAt(_vecA.x, _vecA.z) + 0.35 + Math.sin(time * 0.8) * 0.03;
        mesh.position.copy(_vecA);
      }
    });

    this.playerState.threatWarning = warning;
  }

  private updateColonySimulation(dt: number) {
    let combChanged = false;

    // 1. Dynamic Hive Warmth based on weather & population
    const weatherTemp =
      this.weatherCtrl.currentWeather === 'rain'
        ? 68
        : this.weatherCtrl.currentWeather === 'spring_thaw'
          ? 74
          : this.weatherCtrl.currentWeather === 'breezy'
            ? 84
            : 92;
    const popBonus = Math.min(12, (this.colony.population.foragers + this.colony.population.builders) * 0.4);
    const targetWarmth = Math.min(100, Math.max(45, weatherTemp + popBonus - 6));
    this.colony.hiveWarmth = Math.round(THREE.MathUtils.damp(this.colony.hiveWarmth, targetWarmth, 0.5, dt));

    // 2. Ripen Raw Nectar into Honey inside warm hive
    if (this.colony.nectar > 0 && this.colony.hiveWarmth >= 50) {
      this.honeyRipenAcc += dt * 1.4;
      if (this.honeyRipenAcc >= 1.0) {
        const units = Math.min(this.colony.nectar, Math.floor(this.honeyRipenAcc));
        this.honeyRipenAcc -= units;
        this.colony.nectar -= units;
        this.colony.honey += units;
      }
    }

    // 3. Brood Maturation Lifecycle
    this.combCells.forEach((cell) => {
      if (cell.type === 'brood' && cell.broodTimer !== undefined) {
        cell.broodTimer -= dt;
        if (cell.broodTimer <= 0) {
          if (cell.broodStage === 'egg') {
            cell.broodStage = 'larva';
            cell.broodTimer = 15;
            this.colony.population.eggs = Math.max(0, this.colony.population.eggs - 1);
            this.colony.population.larvae++;
            combChanged = true;
          } else if (cell.broodStage === 'larva') {
            cell.broodStage = 'mature';
            this.colony.population.larvae = Math.max(0, this.colony.population.larvae - 1);
            this.colony.population.foragers++;
            cell.type = 'empty';
            combChanged = true;
            this.callbacks.onLogMessage('A new worker bee has emerged from the honeycomb cell!');
          }
        }
      }
    });

    if (combChanged) {
      this.renderCombMeshes();
    }
  }

  private onResize = () => {
    if (!this.container) return;
    this.camera.aspect = this.container.clientWidth / Math.max(1, this.container.clientHeight);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  };

  public setFlightInput(input: Partial<FlightInputState>) {
    this.inputState = { ...this.inputState, ...input };
  }

  public dispose() {
    this.isDestroyed = true;
    cancelAnimationFrame(this.frameId);

    window.removeEventListener('resize', this.onResize);
    if (this.onKeyDownBound) window.removeEventListener('keydown', this.onKeyDownBound);
    if (this.onKeyUpBound) window.removeEventListener('keyup', this.onKeyUpBound);
    if (this.onBlurBound) window.removeEventListener('blur', this.onBlurBound);

    this.weatherCtrl?.dispose();

    if (this.scene) {
      this.disposeObjectHierarchy(this.scene);
      if (this.scene.environment) {
        this.scene.environment.dispose();
        this.scene.environment = null;
      }
    }

    this.renderer?.dispose();
  }
}
