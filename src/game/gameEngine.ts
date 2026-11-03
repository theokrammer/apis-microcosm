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
  BeeMeshGroup,
  WaspMeshGroup,
  MantisMeshGroup,
  ButterflyMeshGroup,
} from './proceduralModels';

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
  private lastStateUpdateTime: number = 0;

  // Biological Insect Fauna (Wasps, Mantis, Spider, Ladybugs, Butterflies)
  private insects: InsectEntity[] = [];
  private insectMeshes: Array<THREE.Group | WaspMeshGroup | MantisMeshGroup | ButterflyMeshGroup> = [];

  // Hive tree position
  private readonly hivePosition = new THREE.Vector3(0, 0, -25);
  private foundingSiteFound: boolean = false;

  // Camera damping helpers
  private cameraTarget = new THREE.Vector3();
  private cameraLookTarget = new THREE.Vector3();

  constructor(container: HTMLDivElement, callbacks: GameEngineCallbacks, initialMode: GameMode = 'colony_active') {
    this.container = container;
    this.callbacks = callbacks;
    this.gameMode = initialMode;
    if (initialMode === 'spring_founding') {
      this.currentRole = 'queen';
      this.colony.honey = 15;
      this.colony.pollen = 10;
      this.colony.wax = 12;
      this.colony.population = { foragers: 0, guards: 0, builders: 0, larvae: 0, eggs: 0 };
    }
  }

  public async init() {
    this.clock = new THREE.Clock();

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

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
      this.container.clientWidth / this.container.clientHeight,
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

    // Register all solid immovable obstacles for WASM & Rapier physics
    this.registerWorldColliders();

    // Create Player Bee
    this.spawnPlayerBee();

    // Input Listeners & Resize
    this.setupInputs();
    window.addEventListener('resize', this.onResize);

    this.tick();

    if (this.gameMode === 'spring_founding') {
      this.callbacks.onLogMessage('Spring thaw: Queen awakened. Beware of early predators while scouting a cavity!');
    } else {
      this.callbacks.onLogMessage('Colony active: Forage floral nectar. Evade ambush mantises and fight hornets!');
    }
  }

  private buildTerrain() {
    // Expansive 720x720 rolling meadow terrain basin
    const groundGeo = new THREE.PlaneGeometry(720, 720, 128, 128);
    groundGeo.rotateX(-Math.PI / 2);

    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const r = Math.sqrt(x * x + z * z);

      // Micro rolling earth mounds in inner meadow
      let y = Math.sin(x * 0.04) * Math.cos(z * 0.04) * 0.75 + Math.sin(x * 0.14 + z * 0.09) * 0.25;

      // Outer perimeter rises into verdant woodland hills and glade basin walls
      if (r > 100) {
        const hillBlend = Math.min(1.0, (r - 100) / 180);
        const hillWave = Math.sin(Math.atan2(z, x) * 5) * 6.0 + Math.cos(r * 0.03) * 4.0;
        y += hillBlend * hillBlend * (22.0 + hillWave);
      }
      posAttr.setY(i, y);
    }
    groundGeo.computeVertexNormals();

    const textureLoader = new THREE.TextureLoader();

    // Vibrant summer meadow turf with clover, grass, and buttercups
    const turfTex = textureLoader.load('/src/assets/images/meadow_turf_macro_1793560187403.jpg');
    turfTex.colorSpace = THREE.SRGBColorSpace;
    turfTex.wrapS = THREE.RepeatWrapping;
    turfTex.wrapT = THREE.RepeatWrapping;
    turfTex.repeat.set(48, 48);

    const groundMat = new THREE.MeshStandardMaterial({
      map: turfTex,
      roughness: 0.82,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Loamy soil patch around the ancient hollow hive tree roots
    const soilTex = textureLoader.load('/src/assets/images/forest_soil_macro_1793461527125.jpg');
    soilTex.colorSpace = THREE.SRGBColorSpace;
    soilTex.wrapS = THREE.RepeatWrapping;
    soilTex.wrapT = THREE.RepeatWrapping;
    soilTex.repeat.set(6, 6);

    const hiveSoilGeo = new THREE.CircleGeometry(32, 24);
    hiveSoilGeo.rotateX(-Math.PI / 2);
    const hiveSoilMat = new THREE.MeshStandardMaterial({
      map: soilTex,
      roughness: 0.94,
    });
    const hiveSoilPatch = new THREE.Mesh(hiveSoilGeo, hiveSoilMat);
    hiveSoilPatch.position.set(this.hivePosition.x, 0.06, this.hivePosition.z);
    hiveSoilPatch.receiveShadow = true;
    this.scene.add(hiveSoilPatch);

    // Giant Garden Trowel
    const trowel = createGardenTrowel();
    trowel.position.set(26, 0, -6);
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
      stone.position.set(sp.x, 0, sp.z);
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
      mound.position.set(mp.x, 0, mp.z);
      this.scene.add(mound);
    });

    // Giant Hollow Hive Tree
    const tree = createTreeHollowHive();
    tree.position.copy(this.hivePosition);
    this.scene.add(tree);

    // Hive Comb Group inside cavity, facing forward towards the entrance
    this.combMeshGroup.position.set(0, 5.5, -12.5);
    this.combMeshGroup.rotation.y = 0;
    this.scene.add(this.combMeshGroup);

    // Towering Woodland Ferns (Pikmin micro perspective)
    const fern1 = createGiantFern(15);
    fern1.position.set(-42, 0, 18);
    this.scene.add(fern1);

    const fern2 = createGiantFern(14);
    fern2.position.set(40, 0, -22);
    this.scene.add(fern2);

    const fern3 = createGiantFern(16);
    fern3.position.set(-18, 0, -52);
    this.scene.add(fern3);

    // Giant Fallen Mossy Log (Archway bee tunnel)
    const fallenLog = createFallenMossyLog(36, 4.8);
    fallenLog.position.set(6, 0, 42);
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
      shroom.position.set(ts.x, 0, ts.z);
      shroom.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(shroom);
    });
  }

  private buildForestBorderTrees() {
    // Ancient Oak Trees forming perimeter
    const oak1 = createAncientOakTree(52);
    oak1.position.set(-60, 0, -45);
    this.scene.add(oak1);

    const oak2 = createAncientOakTree(50);
    oak2.position.set(55, 0, 50);
    this.scene.add(oak2);

    // White Birch Trees with papery bark & weeping flutter leaves
    const birch1 = createBirchTree(42);
    birch1.position.set(45, 0, -40);
    this.scene.add(birch1);

    const birch2 = createBirchTree(38);
    birch2.position.set(-50, 0, 35);
    this.scene.add(birch2);

    // Scots Pine Conifers with tiered needle whorls and pine cones
    const pine1 = createScotsPineTree(48);
    pine1.position.set(-25, 0, -65);
    this.scene.add(pine1);

    const pine2 = createScotsPineTree(44);
    pine2.position.set(35, 0, 60);
    this.scene.add(pine2);
  }

  private registerWorldColliders() {
    // Register all solid immovable obstacles in Rapier3D and native WebAssembly
    const obstacles: WorldObstacle[] = [
      // Hive Hollow Tree Trunk
      { id: 'hive_tree', type: 'cylinder', x: this.hivePosition.x, z: this.hivePosition.z, yMin: 0, yMax: 44, radius: 21 },
      // Ancient Oak Trees
      { id: 'oak_1', type: 'cylinder', x: -60, z: -45, yMin: 0, yMax: 52, radius: 26 },
      { id: 'oak_2', type: 'cylinder', x: 55, z: 50, yMin: 0, yMax: 50, radius: 26 },
      // White Birch Trees
      { id: 'birch_1', type: 'cylinder', x: 45, z: -40, yMin: 0, yMax: 42, radius: 6.5 },
      { id: 'birch_2', type: 'cylinder', x: -50, z: 35, yMin: 0, yMax: 38, radius: 6.5 },
      // Scots Pine Conifers
      { id: 'pine_1', type: 'cylinder', x: -25, z: -65, yMin: 0, yMax: 48, radius: 5.0 },
      { id: 'pine_2', type: 'cylinder', x: 35, z: 60, yMin: 0, yMax: 44, radius: 4.8 },
      // Garden Trowel
      { id: 'trowel', type: 'cylinder', x: 26, z: -6, yMin: 0, yMax: 16, radius: 3.0 },
      // Fallen Mossy Nurse Log
      { id: 'fallen_log', type: 'cylinder', x: 6, z: 42, yMin: 0, yMax: 9, radius: 4.8 },
      // Mossy River Boulders (Spheres)
      { id: 'stone_1', type: 'sphere', x: -14, z: 8, yMin: 0, yMax: 8, radius: 4.2 },
      { id: 'stone_2', type: 'sphere', x: 18, z: -16, yMin: 0, yMax: 9.5, radius: 5.0 },
      { id: 'stone_3', type: 'sphere', x: -28, z: -18, yMin: 0, yMax: 7.5, radius: 3.8 },
      { id: 'stone_4', type: 'sphere', x: 8, z: 24, yMin: 0, yMax: 8.8, radius: 4.5 },
      { id: 'stone_5', type: 'sphere', x: -32, z: 20, yMin: 0, yMax: 10, radius: 5.2 },
      { id: 'stone_6', type: 'sphere', x: 34, z: -25, yMin: 0, yMax: 9.2, radius: 4.8 },
      // Woodland Toadstools
      { id: 'toadstool_1', type: 'cylinder', x: -14, z: -10, yMin: 0, yMax: 6.8, radius: 1.2 },
      { id: 'toadstool_2', type: 'cylinder', x: -16, z: -7.5, yMin: 0, yMax: 4.8, radius: 1.0 },
      { id: 'toadstool_3', type: 'cylinder', x: 14, z: 46, yMin: 0, yMax: 7.2, radius: 1.2 },
      { id: 'toadstool_4', type: 'cylinder', x: 2, z: 38, yMin: 0, yMax: 5.5, radius: 1.0 },
      { id: 'toadstool_5', type: 'cylinder', x: 24, z: -20, yMin: 0, yMax: 6.2, radius: 1.1 },
      // Botanical Flower Stalks (Thick fibrous stems)
      ...this.flowers.map((f) => ({
        id: `flower_${f.id}`,
        type: 'cylinder' as const,
        x: f.position[0],
        z: f.position[2],
        yMin: 0,
        yMax: Math.max(f.position[1], 6.0),
        radius: 0.5,
      })),
    ];

    this.physics.setObstacles(obstacles);
    simWasm.setObstacles(obstacles);
  }

  private buildDenseMeadowVegetation() {
    // Curved Grass Blades with photorealistic macro blade texture and dynamic parting shader
    const grassCount = 10000;
    const bladeGeo = createCurvedGrassGeometry();

    const textureLoader = new THREE.TextureLoader();
    const grassTex = textureLoader.load('/src/assets/images/grass_blade_macro_1793462745561.jpg');
    grassTex.colorSpace = THREE.SRGBColorSpace;
    grassTex.wrapS = THREE.RepeatWrapping;
    grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(1, 3);

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
          if (dist < 3.2 && uPlayerPos.y < 5.5) {
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

      if (x * x + (z + 25) * (z + 25) < 130) {
        dummy.position.set(0, -100, 0);
      } else {
        dummy.position.set(x, 0, z);
        const scaleY = 0.8 + Math.random() * 0.7;
        const scaleXZ = 0.85 + Math.random() * 0.4;
        dummy.scale.set(scaleXZ, scaleY, scaleXZ);
        dummy.rotation.y = Math.random() * Math.PI * 2;
        dummy.rotation.z = (Math.random() - 0.5) * 0.2;
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

    // 1,500 Clover Groundcover Leaflets with photorealistic botanical leaf macro
    const cloverCount = 1500;
    const cloverLeafGeo = new THREE.CircleGeometry(0.85, 8);
    const cloverTex = textureLoader.load('/src/assets/images/botanical_leaf_macro_1793462790946.jpg');
    cloverTex.colorSpace = THREE.SRGBColorSpace;
    const cloverMat = new THREE.MeshStandardMaterial({
      map: cloverTex,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const groundCloverMesh = new THREE.InstancedMesh(cloverLeafGeo, cloverMat, cloverCount);

    for (let i = 0; i < cloverCount; i++) {
      const r = 5 + Math.random() * 80;
      const a = Math.random() * Math.PI * 2;
      dummy.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
      dummy.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
      dummy.rotation.z = Math.random() * Math.PI * 2;
      dummy.scale.setScalar(0.7 + Math.random() * 0.6);
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
      { type: 'dandelion', x: 10, z: -4, height: 12.0, hasSpider: true }, // Crab spider hidden in dandelion!
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

      flowerMesh.position.set(cfg.x, 0, cfg.z);
      flowerMesh.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(flowerMesh);
      this.flowerMeshes.push(flowerMesh);

      // Add Crab Spider on flower if configured
      if (cfg.hasSpider) {
        const spider = createProceduralSpider();
        spider.position.set(cfg.x, cfg.height + 0.3, cfg.z);
        this.scene.add(spider);
        this.insects.push({
          id: `spider_${idx}`,
          type: 'spider',
          position: [cfg.x, cfg.height + 0.3, cfg.z],
          velocity: [0, 0, 0],
          health: 60,
          state: 'stalking',
        });
        this.insectMeshes.push(spider);
      }

      this.flowers.push({
        id: `flower_${idx}`,
        type: cfg.type,
        position: [cfg.x, cfg.height, cfg.z],
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
      new THREE.Vector3(-24, 7, 12),
      new THREE.Vector3(18, 9, -4),
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
      });
    });

    // 2. Praying Mantis (Ambush predator perched on tall thistle/clover)
    const mantisPos = new THREE.Vector3(-36, 10.5, 14);
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
    });

    // 3. Ladybugs (Neutral crawling beetles)
    const ladybugPositions = [
      new THREE.Vector3(-12, 1.2, 8),
      new THREE.Vector3(16, 2.5, -14),
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
      new THREE.Vector3(8, 12, 18),
      new THREE.Vector3(-20, 14, -10),
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
    for (let i = 0; i < 4; i++) {
      const bee = createProceduralBee('forager');
      bee.scale.setScalar(0.75);
      bee.position.set(
        (Math.random() - 0.5) * 6,
        3.5 + Math.random() * 3,
        -18 + (Math.random() - 0.5) * 5
      );
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
      const child = this.combMeshGroup.children[0];
      this.combMeshGroup.remove(child);
    }

    this.combCells.forEach((cell) => {
      const cellMesh = createHexCombCell(cell);
      this.combMeshGroup.add(cellMesh);
    });
  }

  private spawnPlayerBee() {
    if (this.playerBeeMesh) {
      this.scene.remove(this.playerBeeMesh);
    }

    this.playerBeeMesh = createProceduralBee(this.currentRole);
    this.scene.add(this.playerBeeMesh);

    if (this.gameMode === 'spring_founding') {
      this.physics.setPosition(10, 2.5, 18);
    } else {
      // Spawn right on the established hive landing board facing outward toward the meadow
      this.physics.setPosition(0, 3.8, -2.5);
    }
  }

  private setupInputs() {
    const onKeyDown = (e: KeyboardEvent) => {
      audioEngine.ensureRunning();

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
          this.executeContextAction();
          break;
        case 'Digit1':
          this.switchRole('forager');
          break;
        case 'Digit2':
          this.switchRole('guard');
          break;
        case 'Digit3':
          this.switchRole('builder');
          break;
        case 'Digit4':
          this.switchRole('queen');
          break;
        case 'KeyB':
          this.buildNewCombCell();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
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

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
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
    if (mode === 'colony_active') {
      this.currentRole = 'forager';
      this.playerState.role = 'forager';
      this.colony.honey = 85;
      this.colony.pollen = 60;
      this.colony.wax = 45;
      this.colony.nectar = 40;
      this.colony.population = {
        foragers: 20,
        guards: 8,
        builders: 10,
        larvae: 8,
        eggs: 6,
      };
      this.buildInitialComb();
      this.combMeshGroup.position.set(0, 5.5, -12.5);
      this.combMeshGroup.rotation.y = 0;
      this.spawnPlayerBee();
      this.callbacks.onLogMessage('Colony simulation: Established hive thriving! Forage floral nectar, tend brood, or defend against hornets.');
    } else {
      this.currentRole = 'queen';
      this.playerState.role = 'queen';
      this.colony.honey = 15;
      this.colony.pollen = 10;
      this.colony.wax = 12;
      this.colony.nectar = 0;
      this.colony.population = { foragers: 0, guards: 0, builders: 0, larvae: 0, eggs: 0 };
      this.combCells = [];
      this.renderCombMeshes();
      this.foundingSiteFound = false;
      this.spawnPlayerBee();
      this.callbacks.onLogMessage('Spring thaw: Queen awakened. Beware of early predators while scouting a cavity!');
    }
  }

  public executeContextAction() {
    audioEngine.ensureRunning();

    // 1. Guard Combat Attack
    if (this.currentRole === 'guard') {
      this.executeStingAttack();
      return;
    }

    // 2. Forager Nectar & Pollen Gathering
    if (this.playerState.nearFlowerId) {
      const flower = this.flowers.find((f) => f.id === this.playerState.nearFlowerId);
      if (flower && (flower.nectar > 0 || flower.pollen > 0)) {
        // Crab spider check!
        if (flower.hasSpider) {
          this.playerState.health = Math.max(10, this.playerState.health - 20);
          audioEngine.playStingAttack();
          this.callbacks.onLogMessage('CRAB SPIDER AMBUSH! Escaped petal trap with sprint [SHIFT]!');
          flower.hasSpider = false;
          return;
        }

        const sipNectar = Math.min(flower.nectar, 10);
        const gatherPollen = Math.min(flower.pollen, 6);

        flower.nectar -= sipNectar;
        flower.pollen -= gatherPollen;
        this.playerState.nectarCarried = Math.min(30, this.playerState.nectarCarried + sipNectar);
        this.playerState.pollenCarried = Math.min(20, this.playerState.pollenCarried + gatherPollen);

        if (this.playerBeeMesh.pollenBaskets) {
          const pScale = 0.5 + (this.playerState.pollenCarried / 20) * 0.85;
          this.playerBeeMesh.pollenBaskets.forEach((b) => b.scale.set(pScale, pScale, pScale));
        }

        audioEngine.playNectarSip();
        this.callbacks.onLogMessage(`Gathered ${sipNectar} nectar & ${gatherPollen} pollen from ${flower.type}!`);
        return;
      }
    }

    // 3. Deposit at Hive
    if (this.playerState.nearHive) {
      if (this.playerState.nectarCarried > 0 || this.playerState.pollenCarried > 0) {
        const honeyGain = Math.round(this.playerState.nectarCarried * 0.8);
        this.colony.honey += honeyGain;
        this.colony.pollen += this.playerState.pollenCarried;
        this.colony.wax += Math.round(honeyGain * 0.25);

        this.callbacks.onLogMessage(
          `Deposited resources: +${honeyGain} Honey, +${this.playerState.pollenCarried} Pollen, +${Math.round(honeyGain * 0.25)} Wax!`
        );

        this.playerState.nectarCarried = 0;
        this.playerState.pollenCarried = 0;
        if (this.playerBeeMesh.pollenBaskets) {
          this.playerBeeMesh.pollenBaskets.forEach((b) => b.scale.set(0.01, 0.01, 0.01));
        }
        audioEngine.playCombBuild();
        return;
      }
    }

    // 4. Queen Founding / Egg Laying
    if (this.currentRole === 'queen') {
      if (this.gameMode === 'spring_founding' && !this.foundingSiteFound) {
        if (this.playerState.nearFoundingSite) {
          this.foundingSiteFound = true;
          this.buildInitialFoundingComb();
          this.callbacks.onLogMessage('Founding cavity claimed! Built initial honeypot and wax cell.');
          return;
        }
      }

      const emptyCell = this.combCells.find((c) => c.type === 'empty');
      if (emptyCell && this.playerState.nearHive) {
        emptyCell.type = 'brood';
        emptyCell.broodStage = 'egg';
        emptyCell.broodTimer = 10;
        this.colony.population.eggs++;
        this.renderCombMeshes();
        audioEngine.playEggLay();
        this.callbacks.onLogMessage('Queen laid a royal egg into an empty honeycomb cell.');
        return;
      }
    }

    // 5. Builder: Honeycomb construction
    if (this.currentRole === 'builder') {
      this.buildNewCombCell();
    }
  }

  public buildNewCombCell() {
    if (this.colony.wax < 8) {
      this.callbacks.onLogMessage('Not enough wax (needs 8 wax scales to build cell).');
      return;
    }

    const nextQ = (this.combCells.length % 4) - 1;
    const nextR = Math.floor(this.combCells.length / 4);

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
    ];
    this.renderCombMeshes();
    this.gameMode = 'colony_active';
    this.callbacks.onLogMessage('Colony established! First brood nurtured.');
  }

  private executeStingAttack() {
    audioEngine.playStingAttack();

    const playerPos = this.playerBeeMesh.position;
    for (const insect of this.insects) {
      if (insect.type === 'wasp') {
        const iPos = new THREE.Vector3(insect.position[0], insect.position[1], insect.position[2]);
        if (playerPos.distanceTo(iPos) < 5.5) {
          insect.health -= 45;
          this.callbacks.onLogMessage(`Stinger strike hit predator wasp! (HP: ${Math.max(0, insect.health)})`);

          const knock = iPos.clone().sub(playerPos).normalize().multiplyScalar(12);
          insect.position[0] += knock.x * 0.4;
          insect.position[1] += knock.y * 0.4;
          insect.position[2] += knock.z * 0.4;

          if (insect.health <= 0) {
            this.callbacks.onLogMessage('Predator wasp repelled from the colony!');
            insect.position[0] = (Math.random() - 0.5) * 120;
            insect.position[1] = 15;
            insect.position[2] = (Math.random() - 0.5) * 120;
            insect.health = 100;
          }
          break;
        }
      }
    }
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
    if (paused) {
      audioEngine.updateFlight(0, false, this.currentRole);
    }
  }

  private tick = () => {
    if (this.isDestroyed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

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

    const pState = this.physics.update(dt, this.inputState);

    // Audio & tactile feedback for immovable obstacle collisions
    if (pState.hasCollidedObstacle) {
      audioEngine.playChitinThud(pState.lastImpactSpeed);
    }

    // Audio feedback for brushing through meadow grass stalks
    audioEngine.updateGrassRustle(pState.speed, pState.isInGrass);

    // Update grass parting vertex shader uniforms so grass parts dynamically around the bee
    if (this.grassMaterial?.userData?.uPlayerPos?.value) {
      this.grassMaterial.userData.uPlayerPos.value.copy(pState.position);
      this.grassMaterial.userData.uTime.value = this.clock.getElapsedTime();
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

    // High-performance particle simulation in WebAssembly (0 GC, native SIMD speed)
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

    this.ambientBees.forEach((aBee, idx) => {
      aBee.wingPhase = (aBee.wingPhase || 0) + dt * 50;
      if (aBee.leftWing && aBee.rightWing) {
        aBee.leftWing.rotation.z = -0.5 + Math.sin(aBee.wingPhase) * 0.4;
        aBee.rightWing.rotation.z = 0.5 - Math.sin(aBee.wingPhase) * 0.4;
      }
      const time = this.clock.getElapsedTime() + idx * 2;
      aBee.position.x = Math.sin(time * 0.8) * 3;
      aBee.position.y = 3.5 + Math.cos(time * 1.2) * 1.2;
    });

    // Check Flower Proximity
    let nearFlowerId: string | null = null;
    for (const f of this.flowers) {
      const fPos = new THREE.Vector3(f.position[0], f.position[1], f.position[2]);
      if (pState.position.distanceTo(fPos) < 4.5) {
        nearFlowerId = f.id;
        break;
      }
    }

    this.playerState.nearFlowerId = nearFlowerId;
    this.playerState.nearHive = distToHive < 12.0;
    this.playerState.nearFoundingSite = pState.position.distanceTo(this.hivePosition) < 14.0;
    this.playerState.speed = Math.round(pState.speed * 10) / 10;
    this.playerState.altitude = Math.round(pState.altitude * 10) / 10;
    this.playerState.position = [pState.position.x, pState.position.y, pState.position.z];
    const euler = new THREE.Euler().setFromQuaternion(pState.rotation, 'YXZ');
    this.playerState.yaw = euler.y;

    // Biological Insects AI update (Wasps, Mantis, Butterflies)
    this.updateBiologicalInsects(dt, pState.position);

    this.updateColonyBrood(dt);

    // Camera
    const cameraOffset = new THREE.Vector3(0, 2.4, 6.0).applyQuaternion(pState.rotation);
    this.cameraTarget.copy(pState.position).add(cameraOffset);
    this.camera.position.lerp(this.cameraTarget, dt * 5.5);

    const lookAhead = new THREE.Vector3(0, 0.4, -4.0).applyQuaternion(pState.rotation);
    this.cameraLookTarget.copy(pState.position).add(lookAhead);
    this.camera.lookAt(this.cameraLookTarget);

    const targetFOV = this.inputState.sprint ? 74 : 65;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFOV, 4.0, dt);
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);

    // Throttle React HUD state updates to 15 Hz to eliminate main thread UI contention
    const now = performance.now();
    if (now - this.lastStateUpdateTime > 66) {
      this.lastStateUpdateTime = now;
      this.callbacks.onStateUpdate(
        { ...this.playerState },
        { ...this.colony },
        this.gameMode,
        this.weatherCtrl.currentWeather,
        this.flowers,
        this.insects,
        [this.hivePosition.x, this.hivePosition.y, this.hivePosition.z]
      );
    }

    this.frameId = requestAnimationFrame(this.tick);
  };

  private updateBiologicalInsects(dt: number, playerPos: THREE.Vector3) {
    let warning: string | null = null;

    this.insects.forEach((insect, idx) => {
      const mesh = this.insectMeshes[idx];
      if (!mesh) return;

      const iPos = new THREE.Vector3(insect.position[0], insect.position[1], insect.position[2]);
      const distToPlayer = playerPos.distanceTo(iPos);

      // 1. WASP / HORNET (Aerial combat or raid)
      if (insect.type === 'wasp') {
        const wMesh = mesh as WaspMeshGroup;
        const time = this.clock.getElapsedTime() + idx * 4.0;

        if (distToPlayer < 6.0) {
          // Maintain standoff combat distance (>= 4.2m) - never overlap or flicker behind player!
          const pushAway = iPos.clone().sub(playerPos);
          pushAway.y = 0;
          if (pushAway.length() > 0.01) pushAway.normalize();

          if (distToPlayer < 4.2) {
            iPos.addScaledVector(pushAway, dt * 5.5);
          } else {
            const tangent = new THREE.Vector3(-pushAway.z, 0.1, pushAway.x);
            iPos.addScaledVector(tangent, dt * 3.5);
          }
          wMesh.lookAt(playerPos);

          if (this.currentRole !== 'guard') {
            warning = 'HORNET DETECTED! SWITCH TO GUARD [2] TO STING!';
          }
        } else {
          // Smooth wide circular territory patrol
          const patrolAngle = time * 0.35;
          const targetX = (idx === 0 ? 0 : 20) + Math.cos(patrolAngle) * 18;
          const targetZ = (idx === 0 ? -22 : 6) + Math.sin(patrolAngle) * 18;
          const targetY = 7.5 + Math.sin(time * 0.7) * 1.5;

          const targetVec = new THREE.Vector3(targetX, targetY, targetZ);
          const dir = targetVec.clone().sub(iPos);
          if (dir.length() > 0.5) {
            dir.normalize();
            iPos.addScaledVector(dir, dt * 4.0);
            wMesh.lookAt(targetVec);
          }
        }

        insect.position = [iPos.x, iPos.y, iPos.z];
        mesh.position.copy(iPos);

        wMesh.wingPhase = (wMesh.wingPhase || 0) + dt * 60;
        if (wMesh.leftWing && wMesh.rightWing) {
          wMesh.leftWing.rotation.z = -0.5 + Math.sin(wMesh.wingPhase) * 0.4;
          wMesh.rightWing.rotation.z = 0.5 - Math.sin(wMesh.wingPhase) * 0.4;
        }
      }

      // 2. PRAYING MANTIS (Ambush Predator)
      else if (insect.type === 'mantis') {
        const mantisMesh = mesh as MantisMeshGroup;
        // Head tracks player when nearby
        if (distToPlayer < 9.0) {
          if (mantisMesh.head) {
            mantisMesh.head.lookAt(playerPos);
          }

          if (distToPlayer < 5.0) {
            warning = 'MANTIS AMBUSH! EVADE WITH SPRINT [SHIFT]!';

            // Raptorial strike animation
            mantisMesh.strikeProgress = Math.min(1.0, (mantisMesh.strikeProgress || 0) + dt * 4.0);
            if (mantisMesh.leftArm && mantisMesh.rightArm) {
              const strikeAngle = Math.sin(mantisMesh.strikeProgress * Math.PI) * 1.2;
              mantisMesh.leftArm.rotation.x = strikeAngle;
              mantisMesh.rightArm.rotation.x = strikeAngle;
            }

            // If player doesn't evade with sprint, take damage!
            if (distToPlayer < 3.2 && !this.inputState.sprint) {
              this.playerState.health = Math.max(15, this.playerState.health - dt * 25);
              audioEngine.playStingAttack();
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
          bfly.leftWing.rotation.z = flap;
          bfly.rightWing.rotation.z = -flap;
        }

        // Sinusoidal flower hovering loop
        const time = this.clock.getElapsedTime() + idx * 3;
        iPos.x += Math.sin(time * 0.6) * dt * 3.0;
        iPos.y += Math.cos(time * 1.5) * dt * 1.5;
        iPos.z += Math.cos(time * 0.8) * dt * 2.5;
        insect.position = [iPos.x, iPos.y, iPos.z];
        mesh.position.copy(iPos);
      }

      // 4. LADYBUG (Slow crawl on grass/stone)
      else if (insect.type === 'ladybug') {
        const time = this.clock.getElapsedTime() + idx;
        iPos.y = Math.max(0.2, insect.position[1] + Math.sin(time * 0.4) * 0.05);
        mesh.position.copy(iPos);
      }
    });

    this.playerState.threatWarning = warning;
  }

  private updateColonyBrood(dt: number) {
    let combChanged = false;

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
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
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
    this.weatherCtrl?.dispose();
    this.renderer?.dispose();
  }
}
