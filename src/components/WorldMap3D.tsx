import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { Building2, Check, Crown, Lock, Store } from "lucide-react";

export type MilestoneFocusId = "r1" | "oxxo" | "r2" | "roles" | "r3" | "bank";

export interface WorldMap3DProps {
  focusedMilestone: MilestoneFocusId;
  unlockedLevel: number;
  completedLevels: number[];
  vouchersCount: number;
  bankVaultCoins: number;
  bankName: string;
  activeRoleShortTitle: string;
  upgradeReadyTitle: string | null;
  levelRewards: Record<1 | 2 | 3, number>;
  onSelectMilestone: (id: MilestoneFocusId) => void;
  onOpenStore: () => void;
  onOpenRoleBank: (tab: "roles" | "bank") => void;
  onStartLevel: (levelId: 1 | 2 | 3) => void;
}

interface RunnerRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  shadowMesh: THREE.Mesh;
}

interface MilestoneConfig {
  id: MilestoneFocusId;
  pathT: number;
  roadPos: [number, number, number];
  landmarkPos: [number, number, number];
  labelOffsetY: number;
  bubble: string;
}

const MILESTONE_LIST: MilestoneConfig[] = [
  {
    id: "r1",
    pathT: 0.04,
    roadPos: [-14.8, 0, 4.4],
    landmarkPos: [-14.8, 0, 4.4],
    labelOffsetY: 2.8,
    bubble: "¡Vamos!",
  },
  {
    id: "oxxo",
    pathT: 0.23,
    roadPos: [-9.2, 0, -2.9],
    landmarkPos: [-9.4, 0, -6.1],
    labelOffsetY: 3.7,
    bubble: "¡OXXO!",
  },
  {
    id: "r2",
    pathT: 0.43,
    roadPos: [-2.6, 0, 3.8],
    landmarkPos: [-2.6, 0, 3.8],
    labelOffsetY: 2.8,
    bubble: "¡Sigue!",
  },
  {
    id: "roles",
    pathT: 0.62,
    roadPos: [3.7, 0, -3.1],
    landmarkPos: [3.9, 0, -6.0],
    labelOffsetY: 3.4,
    bubble: "¡Rango!",
  },
  {
    id: "r3",
    pathT: 0.81,
    roadPos: [9.8, 0, 3.4],
    landmarkPos: [9.8, 0, 3.4],
    labelOffsetY: 2.8,
    bubble: "¡Casi!",
  },
  {
    id: "bank",
    pathT: 0.96,
    roadPos: [14.8, 0, -2.0],
    landmarkPos: [15.6, 0, -5.4],
    labelOffsetY: 4.1,
    bubble: "¡Mi Banco!",
  },
];

// Pre-allocated scratch helpers outside the render loop (zero GC)
const _projVec = new THREE.Vector3();
const _pathPos = new THREE.Vector3();
const _pathTan = new THREE.Vector3();
const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _tmpColor = new THREE.Color();

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, "rgba(15, 23, 42, 0.45)");
  grad.addColorStop(1, "rgba(15, 23, 42, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCobblePathTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#D9B277";
  ctx.fillRect(0, 0, 256, 256);

  // Warm rounded flagstones
  const stones = [
    [22, 24, 92, 46, "#E7C996"],
    [132, 20, 102, 50, "#CFA365"],
    [28, 86, 108, 44, "#CFA365"],
    [152, 88, 84, 48, "#E7C996"],
    [18, 148, 88, 48, "#E5C48E"],
    [122, 150, 114, 44, "#D4AB6E"],
    [32, 208, 102, 38, "#CFA365"],
    [148, 206, 90, 40, "#E7C996"],
  ] as const;

  for (const [x, y, w, h, color] of stones) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = "#A47B43";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 22);
  tex.anisotropy = maxAniso;
  return tex;
}

function createGrassTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#68B953";
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 220; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    ctx.fillStyle =
      i % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(20, 83, 45, 0.08)";
    ctx.fillRect(x, y, 7, 11);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 18);
  tex.anisotropy = maxAniso;
  return tex;
}

function createOxxoSignTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#D92323";
  ctx.fillRect(0, 0, 512, 192);

  // Iconic top/bottom yellow bands
  ctx.fillStyle = "#FACC15";
  ctx.fillRect(0, 0, 512, 22);
  ctx.fillRect(0, 170, 512, 22);

  // Bold white OXXO badge
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 108px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OXXO", 256, 102);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createGoldCoinGroup(
  goldMat: THREE.MeshStandardMaterial,
  trimMat: THREE.MeshStandardMaterial,
  shadowTex: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.085, 10, 22), trimMat);
  group.add(rim);

  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.39, 0.09, 22),
    goldMat
  );
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  const starGeo = new THREE.OctahedronGeometry(0.18, 0);
  starGeo.scale(1, 1, 0.45);
  const emblem = new THREE.Mesh(starGeo, trimMat);
  group.add(emblem);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.0),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.38,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.82;
  group.add(shadow);

  return group;
}

function createRunnerCharacter(
  goldMat: THREE.MeshStandardMaterial,
  woodMat: THREE.MeshStandardMaterial,
  shadowTex: THREE.CanvasTexture
): RunnerRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf9a8d4,
    roughness: 0.72,
    metalness: 0.02,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: 0x0d9488,
    roughness: 0.85,
    metalness: 0.04,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.88,
    metalness: 0.02,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.45,
    metalness: 0.12,
  });
  const scarfMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.8,
    metalness: 0.02,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.1,
  });
  const hatMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.82,
    metalness: 0.04,
  });

  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.45),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.06;
  root.add(shadowMesh);

  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.62;
  root.add(bodyGroup);

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.31, 0.58, 16),
    vestMat
  );
  torso.position.y = 0.28;
  torso.castShadow = true;
  bodyGroup.add(torso);

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.42, 0.22),
    woodMat
  );
  backpack.position.set(0, 0.3, 0.28);
  backpack.castShadow = true;
  bodyGroup.add(backpack);

  const packCoin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.06, 16),
    goldMat
  );
  packCoin.rotation.x = Math.PI / 2;
  packCoin.position.set(0, 0.32, 0.4);
  bodyGroup.add(packCoin);

  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.065, 10, 20),
    scarfMat
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.58;
  bodyGroup.add(scarf);

  const headGroup = new THREE.Group();
  headGroup.position.y = 0.82;
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const snout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.12, 14),
    skinMat
  );
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, -0.04, -0.28);
  headGroup.add(snout);

  const eyeGeo = new THREE.SphereGeometry(0.045, 10, 10);
  const eyeL = new THREE.Mesh(eyeGeo, darkMat);
  eyeL.position.set(-0.11, 0.06, -0.26);
  const eyeR = new THREE.Mesh(eyeGeo, darkMat);
  eyeR.position.set(0.11, 0.06, -0.26);
  headGroup.add(eyeL, eyeR);

  const earGeo = new THREE.ConeGeometry(0.09, 0.18, 10);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(-0.22, 0.22, 0.02);
  earL.rotation.z = 0.45;
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.position.set(0.22, 0.22, 0.02);
  earR.rotation.z = -0.45;
  headGroup.add(earL, earR);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hatMat
  );
  cap.position.y = 0.08;
  cap.castShadow = true;
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.32,
      0.34,
      0.04,
      16,
      1,
      false,
      -Math.PI * 0.45,
      Math.PI * 0.9
    ),
    hatMat
  );
  brim.position.set(0, 0.12, -0.05);
  brim.rotation.y = Math.PI;
  const feather = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.24, 0.08),
    goldMat
  );
  feather.position.set(0.18, 0.32, 0.05);
  feather.rotation.z = -0.35;
  headGroup.add(cap, brim, feather);

  const buildArm = (xSide: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xSide * 0.35, 0.5, 0);
    const upper = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.24, 6, 10),
      skinMat
    );
    upper.position.y = -0.18;
    upper.castShadow = true;
    const glove = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 10, 10),
      bootMat
    );
    glove.position.y = -0.34;
    pivot.add(upper, glove);
    bodyGroup.add(pivot);
    return pivot;
  };
  const leftArmPivot = buildArm(-1);
  const rightArmPivot = buildArm(1);

  const buildLeg = (xSide: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xSide * 0.15, 0.04, 0);
    const thigh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.09, 0.32, 10),
      shortsMat
    );
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.075, 0.24, 10),
      skinMat
    );
    shin.position.y = -0.4;
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.14, 0.32),
      bootMat
    );
    shoe.position.set(0, -0.56, -0.05);
    shoe.castShadow = true;
    pivot.add(thigh, shin, shoe);
    bodyGroup.add(pivot);
    return pivot;
  };
  const leftLegPivot = buildLeg(-1);
  const rightLegPivot = buildLeg(1);

  root.scale.setScalar(1.35);

  return {
    root,
    bodyGroup,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    shadowMesh,
  };
}

function createRoadRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  segments: number,
  halfWidth: number,
  yOffset: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    side.crossVectors(up, tan).normalize();

    const lx = pt.x - side.x * halfWidth;
    const lz = pt.z - side.z * halfWidth;
    const rx = pt.x + side.x * halfWidth;
    const rz = pt.z + side.z * halfWidth;

    positions.push(lx, yOffset, lz);
    positions.push(rx, yOffset, rz);

    uvs.push(0, t);
    uvs.push(1, t);

    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export const WorldMap3D: React.FC<WorldMap3DProps> = ({
  focusedMilestone,
  unlockedLevel,
  completedLevels,
  vouchersCount,
  bankVaultCoins,
  bankName,
  activeRoleShortTitle,
  upgradeReadyTitle,
  levelRewards,
  onSelectMilestone,
  onOpenStore,
  onOpenRoleBank,
  onStartLevel,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const pinRefs = useRef<Record<MilestoneFocusId, HTMLButtonElement | null>>({
    r1: null,
    oxxo: null,
    r2: null,
    roles: null,
    r3: null,
    bank: null,
  });
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const latestPropsRef = useRef({
    focusedMilestone,
    unlockedLevel,
    completedLevels,
    onSelectMilestone,
    onOpenStore,
    onOpenRoleBank,
    onStartLevel,
  });
  latestPropsRef.current = {
    focusedMilestone,
    unlockedLevel,
    completedLevels,
    onSelectMilestone,
    onOpenStore,
    onOpenRoleBank,
    onStartLevel,
  };

  // Trigger camera re-frame whenever user clicks a milestone from UI
  const cameraAutoFollowRef = useRef(true);
  useEffect(() => {
    cameraAutoFollowRef.current = true;
  }, [focusedMilestone]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      if (!gl) return true;
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 300);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9be0fa);
    scene.fog = new THREE.FogExp2(0x9be0fa, 0.014);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 160);
    camera.position.set(-2, 13.5, 20.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // Procedural Studio Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Warm/cool 3-point outdoor lighting rig
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x3f7d32, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5d6, 2.1);
    sunLight.position.set(16, 28, 18);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 4;
    sunLight.shadow.camera.far = 75;
    sunLight.shadow.camera.left = -24;
    sunLight.shadow.camera.right = 24;
    sunLight.shadow.camera.top = 18;
    sunLight.shadow.camera.bottom = -18;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0xa5f3fc, 0.65);
    rimLight.position.set(-18, 12, -16);
    scene.add(rimLight);

    // Map Pan Controls: no 360 rotation, smooth left/right & up/down drag across the map
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.panSpeed = 1.15;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.PAN,
    };
    controls.target.set(0, 0.8, 0);

    const handleControlStart = () => {
      cameraAutoFollowRef.current = false;
    };
    controls.addEventListener("start", handleControlStart);

    // Shared procedural textures & PBR materials
    const shadowTex = createContactShadowTexture();
    const cobbleTex = createCobblePathTexture(maxAniso);
    const grassTex = createGrassTexture(maxAniso);
    const oxxoSignTex = createOxxoSignTexture(maxAniso);

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.22,
      metalness: 0.88,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.28,
      metalness: 0.82,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x854d0e,
      roughness: 0.86,
      metalness: 0.05,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.78,
      metalness: 0.06,
    });
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.32,
      metalness: 0.18,
    });
    const amberMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.4,
      metalness: 0.12,
    });
    const slateMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.65,
      metalness: 0.12,
    });

    // 1. Undulating Valley Terrain
    const terrainGeo = new THREE.PlaneGeometry(140, 100, 64, 48);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      // Keep the central play corridor flat (|x| < 18, |z| < 9), rise gently into hills around perimeter
      const corridorMask =
        THREE.MathUtils.smoothstep(Math.abs(z), 7.5, 19) +
        THREE.MathUtils.smoothstep(Math.abs(x), 18, 30);
      const hillHeight =
        Math.min(1, corridorMask) *
        (Math.sin(x * 0.14) * 1.6 + Math.cos(z * 0.18) * 1.4 + 2.1);
      posAttr.setY(i, Math.max(0, hillHeight) - 0.02);
    }
    terrainGeo.computeVertexNormals();
    const terrainMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.92,
      metalness: 0.02,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    scene.add(terrain);

    // 2. Winding River & Wooden Arch Bridge
    const riverCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.5, 0.015, -35),
      new THREE.Vector3(-0.5, 0.015, -14),
      new THREE.Vector3(1.1, 0.015, 0.5),
      new THREE.Vector3(-1.2, 0.015, 14),
      new THREE.Vector3(3.0, 0.015, 36),
    ]);
    const riverGeo = createRoadRibbonGeometry(riverCurve, 48, 1.35, 0.015);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.18,
    });
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.receiveShadow = true;
    scene.add(riverMesh);

    // 3. Winding Cobblestone Adventure Path connecting all 6 stops
    const roadCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-16.2, 0, 5.2),
      new THREE.Vector3(-14.8, 0, 4.4),
      new THREE.Vector3(-9.2, 0, -2.9),
      new THREE.Vector3(-2.6, 0, 3.8),
      new THREE.Vector3(0.9, 0, 0.4), // Bridge crossing
      new THREE.Vector3(3.7, 0, -3.1),
      new THREE.Vector3(9.8, 0, 3.4),
      new THREE.Vector3(14.8, 0, -2.0),
    ]);

    const roadGeo = createRoadRibbonGeometry(roadCurve, 120, 1.15, 0.05);
    const roadMat = new THREE.MeshStandardMaterial({
      map: cobbleTex,
      roughness: 0.85,
      metalness: 0.04,
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Wooden Bridge right over the river crossing at (0.9, 0, 0.4)
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(0.9, 0.05, 0.4);
    bridgeGroup.rotation.y = Math.PI * 0.25;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 2.7), woodMat);
    deck.position.y = 0.22;
    deck.castShadow = true;
    deck.receiveShadow = true;
    bridgeGroup.add(deck);
    for (const zSide of [-1.25, 1.25]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.12), woodMat);
      rail.position.set(0, 0.85, zSide);
      bridgeGroup.add(rail);
      for (const xPost of [-1.45, 0, 1.45]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.09, 0.85, 8),
          woodMat
        );
        post.position.set(xPost, 0.46, zSide);
        post.castShadow = true;
        bridgeGroup.add(post);
      }
    }
    scene.add(bridgeGroup);

    // 4. Stylized Composite Trees (InstancedMesh trunks + layered canopies)
    const treeCoords: [number, number, number][] = [
      [-18, -7, 1.1],
      [-15, -10, 0.95],
      [-17, 10, 1.05],
      [-6, -11, 1.2],
      [-6, 10, 0.95],
      [2, -12, 1.15],
      [6, 10, 1.1],
      [12, -11, 1.05],
      [18, 8, 1.15],
      [20, -9, 1.2],
      [-21, 1, 1.15],
      [21, 1, 1.1],
      [-12, 11, 1.0],
      [14, 11, 0.95],
    ];
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.26, 1.5, 8);
    trunkGeo.translate(0, 0.75, 0);
    const canopyGeo = new THREE.DodecahedronGeometry(1.05, 1);
    canopyGeo.translate(0, 2.05, 0);

    const trunksInst = new THREE.InstancedMesh(trunkGeo, woodMat, treeCoords.length);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.02,
    });
    const canopiesInst = new THREE.InstancedMesh(
      canopyGeo,
      canopyMat,
      treeCoords.length
    );
    trunksInst.castShadow = true;
    canopiesInst.castShadow = true;
    treeCoords.forEach(([tx, tz, sc], idx) => {
      _dummyObj.position.set(tx, 0, tz);
      _dummyObj.scale.setScalar(sc);
      _dummyObj.rotation.y = idx * 0.9;
      _dummyObj.updateMatrix();
      trunksInst.setMatrixAt(idx, _dummyObj.matrix);
      canopiesInst.setMatrixAt(idx, _dummyObj.matrix);
      _tmpColor.setHex(idx % 3 === 0 ? 0x2e7d32 : idx % 3 === 1 ? 0x388e3c : 0x43a047);
      canopiesInst.setColorAt(idx, _tmpColor);
    });
    trunksInst.computeBoundingSphere();
    canopiesInst.computeBoundingSphere();
    scene.add(trunksInst, canopiesInst);

    // 5. Drifting 3D Fluffy Clouds
    const cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0,
    });
    const cloudSeeds = [
      [-14, 10.5, -14, 1.1],
      [-2, 11.5, -16, 1.3],
      [11, 10.8, -14, 1.0],
      [20, 11.2, -11, 0.9],
    ] as const;
    const cloudClusters: THREE.Group[] = [];
    for (const [cx, cy, cz, sc] of cloudSeeds) {
      const cg = new THREE.Group();
      cg.position.set(cx, cy, cz);
      cg.scale.setScalar(sc);
      const puffs: [number, number, number, number][] = [
        [0, 0, 0, 1.2],
        [-1.0, -0.15, 0.1, 0.9],
        [1.05, -0.1, -0.1, 0.95],
        [0.3, 0.4, 0, 0.85],
      ];
      for (const [px, py, pz, pr] of puffs) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(pr, 12, 10), cloudMat);
        puff.position.set(px, py, pz);
        cg.add(puff);
      }
      cloudsGroup.add(cg);
      cloudClusters.push(cg);
    }
    scene.add(cloudsGroup);

    // 6. Spinning 3D Gold Coins Guiding Along the Path (NEVER squashed!)
    const coinSpotsT = [0.11, 0.16, 0.31, 0.36, 0.5, 0.56, 0.7, 0.75, 0.88, 0.92];
    const pathCoins: THREE.Group[] = [];
    coinSpotsT.forEach((t, idx) => {
      const pt = roadCurve.getPointAt(t);
      const coin = createGoldCoinGroup(goldMat, goldTrimMat, shadowTex);
      coin.position.set(pt.x, 0.95, pt.z);
      coin.scale.setScalar(0.78);
      coin.userData.phase = idx * 0.7;
      scene.add(coin);
      pathCoins.push(coin);
    });

    // 7. Interactive 3D Landmarks
    const clickableRoots: THREE.Object3D[] = [];
    const registerClickable = (obj: THREE.Object3D, id: MilestoneFocusId) => {
      obj.traverse((child) => {
        child.userData.milestoneId = id;
      });
      clickableRoots.push(obj);
    };

    // Route Pedestals (Ruta 1, Ruta 2, Ruta 3)
    const animatedFlags: THREE.Mesh[] = [];
    const routeConfigs: { id: "r1" | "r2" | "r3"; lvlId: 1 | 2 | 3 }[] = [
      { id: "r1", lvlId: 1 },
      { id: "r2", lvlId: 2 },
      { id: "r3", lvlId: 3 },
    ];
    for (const rc of routeConfigs) {
      const cfg = MILESTONE_LIST.find((m) => m.id === rc.id)!;
      const unlocked = rc.lvlId <= unlockedLevel;
      const completed = completedLevels.includes(rc.lvlId);

      const group = new THREE.Group();
      group.position.set(...cfg.landmarkPos);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.32, 0.3, 24),
        stoneMat
      );
      base.position.y = 0.15;
      base.receiveShadow = true;
      base.castShadow = true;
      group.add(base);

      const ringMat = completed ? emeraldMat : unlocked ? goldMat : slateMat;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.08, 0.1, 12, 28),
        ringMat
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.31;
      group.add(ring);

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 2.2, 10),
        stoneMat
      );
      pole.position.set(0.65, 1.25, -0.35);
      pole.castShadow = true;
      group.add(pole);

      const flagMat = completed ? emeraldMat : unlocked ? amberMat : slateMat;
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.5, 0.06), flagMat);
      flag.position.set(1.08, 2.05, -0.35);
      flag.castShadow = true;
      group.add(flag);
      animatedFlags.push(flag);

      if (!unlocked) {
        const lockBody = new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.45, 0.25),
          slateMat
        );
        lockBody.position.set(0, 0.65, 0);
        group.add(lockBody);
      }

      registerClickable(group, rc.id);
      scene.add(group);
    }

    // OXXO Mini 3D Convenience Storefront
    const oxxoCfg = MILESTONE_LIST.find((m) => m.id === "oxxo")!;
    const oxxoGroup = new THREE.Group();
    oxxoGroup.position.set(...oxxoCfg.landmarkPos);
    const oxxoPad = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.16, 3.6),
      stoneMat
    );
    oxxoPad.position.y = 0.08;
    oxxoPad.receiveShadow = true;
    oxxoGroup.add(oxxoPad);

    const oxxoWalls = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 2.2, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.78 })
    );
    oxxoWalls.position.set(0, 1.25, -0.2);
    oxxoWalls.castShadow = true;
    oxxoWalls.receiveShadow = true;
    oxxoGroup.add(oxxoWalls);

    const oxxoRoofFascia = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.78, 2.65),
      new THREE.MeshStandardMaterial({ color: 0xd92323, roughness: 0.45 })
    );
    oxxoRoofFascia.position.set(0, 2.65, -0.15);
    oxxoRoofFascia.castShadow = true;
    oxxoGroup.add(oxxoRoofFascia);

    // Crisp OXXO front signboard
    const oxxoSignPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.72),
      new THREE.MeshStandardMaterial({ map: oxxoSignTex, roughness: 0.4 })
    );
    oxxoSignPlane.position.set(0, 2.65, 1.19);
    oxxoGroup.add(oxxoSignPlane);

    // Yellow awning overhang
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.14, 0.85),
      goldMat
    );
    awning.position.set(0, 2.1, 1.28);
    awning.rotation.x = 0.18;
    oxxoGroup.add(awning);

    // Glass doors
    const doors = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.45, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        roughness: 0.12,
        metalness: 0.25,
      })
    );
    doors.position.set(-0.35, 0.88, 1.0);
    oxxoGroup.add(doors);

    registerClickable(oxxoGroup, "oxxo");
    scene.add(oxxoGroup);

    // Subir de Rol Monument (Rotating Golden Crown Pedestal)
    const rolesCfg = MILESTONE_LIST.find((m) => m.id === "roles")!;
    const rolesGroup = new THREE.Group();
    rolesGroup.position.set(...rolesCfg.landmarkPos);

    const ped1 = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.75, 0.35, 8),
      stoneMat
    );
    ped1.position.y = 0.175;
    ped1.castShadow = true;
    ped1.receiveShadow = true;
    const ped2 = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.25, 0.55, 8),
      amberMat
    );
    ped2.position.y = 0.62;
    ped2.castShadow = true;
    rolesGroup.add(ped1, ped2);

    const crownGroup = new THREE.Group();
    crownGroup.position.y = 1.65;
    const crownBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.58, 0.42, 12),
      goldMat
    );
    crownBand.castShadow = true;
    crownGroup.add(crownBand);
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8), goldMat);
      spike.position.set(Math.cos(ang) * 0.56, 0.42, Math.sin(ang) * 0.56);
      crownGroup.add(spike);
      const gem = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 10, 10),
        i % 2 === 0 ? emeraldMat : new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.2 })
      );
      gem.position.set(Math.cos(ang) * 0.56, 0.68, Math.sin(ang) * 0.56);
      crownGroup.add(gem);
    }
    rolesGroup.add(crownGroup);
    registerClickable(rolesGroup, "roles");
    scene.add(rolesGroup);

    // Mi Propio Banco (Classical Emerald & Gold Bank Building)
    const bankCfg = MILESTONE_LIST.find((m) => m.id === "bank")!;
    const bankGroup = new THREE.Group();
    bankGroup.position.set(...bankCfg.landmarkPos);

    const bankSteps = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.28, 3.8),
      stoneMat
    );
    bankSteps.position.y = 0.14;
    bankSteps.receiveShadow = true;
    bankSteps.castShadow = true;
    bankGroup.add(bankSteps);

    const bankBody = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 2.25, 2.7),
      new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.72 })
    );
    bankBody.position.set(0, 1.4, -0.2);
    bankBody.castShadow = true;
    bankBody.receiveShadow = true;
    bankGroup.add(bankBody);

    // 4 White Columns
    for (const cx of [-1.45, -0.55, 0.55, 1.45]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.2, 2.15, 12),
        stoneMat
      );
      col.position.set(cx, 1.35, 1.32);
      col.castShadow = true;
      bankGroup.add(col);
    }

    // Triangular Pediment
    const pedShape = new THREE.Shape();
    pedShape.moveTo(-2.25, 0);
    pedShape.lineTo(0, 1.15);
    pedShape.lineTo(2.25, 0);
    pedShape.closePath();
    const pedimentGeo = new THREE.ExtrudeGeometry(pedShape, {
      depth: 3.15,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 2,
    });
    pedimentGeo.translate(0, 0, -1.55);
    const pediment = new THREE.Mesh(pedimentGeo, goldMat);
    pediment.position.set(0, 2.52, 0.05);
    pediment.castShadow = true;
    bankGroup.add(pediment);

    // Arched Golden Door
    const vaultDoor = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 1.45, 0.15),
      goldTrimMat
    );
    vaultDoor.position.set(0, 1.0, 1.15);
    bankGroup.add(vaultDoor);

    registerClickable(bankGroup, "bank");
    scene.add(bankGroup);

    // 8. Hero 3D Tito Explorer Character on the Road!
    const tito = createRunnerCharacter(goldMat, woodMat, shadowTex);
    const initialCfg =
      MILESTONE_LIST.find((m) => m.id === latestPropsRef.current.focusedMilestone) ??
      MILESTONE_LIST[0];
    let currentT = initialCfg.pathT;
    const initPt = roadCurve.getPointAt(currentT);
    tito.root.position.set(initPt.x, 0.05, initPt.z);
    scene.add(tito.root);

    // Pointer Raycaster for tapping 3D buildings directly
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownX = ev.clientX;
      pointerDownY = ev.clientY;
    };

    const onPointerUp = (ev: PointerEvent) => {
      const dist = Math.hypot(ev.clientX - pointerDownX, ev.clientY - pointerDownY);
      if (dist > 9) return; // Ignore drags/orbits

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(clickableRoots, true);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.milestoneId as
          | MilestoneFocusId
          | undefined;
        if (hitId) {
          if (hitId === "oxxo") {
            cameraAutoFollowRef.current = true;
            latestPropsRef.current.onSelectMilestone("oxxo");
            latestPropsRef.current.onOpenStore();
            return;
          }
          const currentFocus = latestPropsRef.current.focusedMilestone;
          if (currentFocus === hitId) {
            if (hitId === "roles") latestPropsRef.current.onOpenRoleBank("roles");
            else if (hitId === "bank") latestPropsRef.current.onOpenRoleBank("bank");
            else if (hitId === "r1") latestPropsRef.current.onStartLevel(1);
            else if (hitId === "r2") latestPropsRef.current.onStartLevel(2);
            else if (hitId === "r3") latestPropsRef.current.onStartLevel(3);
          } else {
            cameraAutoFollowRef.current = true;
            latestPropsRef.current.onSelectMilestone(hitId);
          }
        }
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // ResizeObserver for crisp non-squashed aspect ratio on any screen
    let canvasW = width;
    let canvasH = height;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      canvasW = Math.max(entry.contentRect.width, 280);
      canvasH = Math.max(entry.contentRect.height, 260);
      camera.aspect = canvasW / canvasH;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasW, canvasH);
    });
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Animation loop (strictly zero GC, software-GL safe)
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let runPhase = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function updateProjectedLabels() {
      for (const m of MILESTONE_LIST) {
        const el = pinRefs.current[m.id];
        if (!el) continue;
        _projVec.set(
          m.landmarkPos[0],
          m.labelOffsetY,
          m.landmarkPos[2]
        );
        _projVec.project(camera);
        if (_projVec.z > 1) {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          continue;
        }
        const sx = ((_projVec.x + 1) / 2) * canvasW;
        const sy = ((-_projVec.y + 1) / 2) * canvasH;
        const clampedX = Math.max(54, Math.min(canvasW - 54, sx));
        const clampedY = Math.max(28, Math.min(canvasH - 28, sy));
        el.style.opacity = "1";
        el.style.pointerEvents = "auto";
        el.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0) translate(-50%, -100%)`;
      }

      if (bubbleRef.current) {
        _projVec.set(tito.root.position.x, 3.05, tito.root.position.z);
        _projVec.project(camera);
        if (_projVec.z > 1) {
          bubbleRef.current.style.opacity = "0";
        } else {
          const bx = ((_projVec.x + 1) / 2) * canvasW;
          const by = ((-_projVec.y + 1) / 2) * canvasH;
          bubbleRef.current.style.opacity = "1";
          bubbleRef.current.style.transform = `translate3d(${bx}px, ${by}px, 0) translate(-50%, -100%)`;
        }
      }
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.08);
      const elapsed = clock.getElapsedTime();

      // 1. Move Tito smoothly along the winding 3D road toward the selected milestone!
      const targetCfg =
        MILESTONE_LIST.find(
          (m) => m.id === latestPropsRef.current.focusedMilestone
        ) ?? MILESTONE_LIST[0];
      const deltaT = targetCfg.pathT - currentT;
      const isRunning = Math.abs(deltaT) > 0.004;

      if (isRunning) {
        const step = Math.sign(deltaT) * Math.min(Math.abs(deltaT), dt * 0.36);
        currentT += step;
        roadCurve.getPointAt(THREE.MathUtils.clamp(currentT, 0, 1), _pathPos);
        roadCurve.getTangentAt(THREE.MathUtils.clamp(currentT, 0, 1), _pathTan);

        tito.root.position.set(_pathPos.x, 0.05, _pathPos.z);
        // Face direction of travel (runner nose faces -Z)
        const dirSign = Math.sign(deltaT);
        const targetYaw = Math.atan2(
          -_pathTan.x * dirSign,
          -_pathTan.z * dirSign
        );
        // Smooth angular interpolation
        let diff = targetYaw - tito.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        tito.root.rotation.y += diff * Math.min(1, dt * 12);

        runPhase += dt * 15;
        const swing = Math.sin(runPhase) * 0.85;
        tito.leftLegPivot.rotation.x = swing;
        tito.rightLegPivot.rotation.x = -swing;
        tito.leftArmPivot.rotation.x = -swing * 0.8;
        tito.rightArmPivot.rotation.x = swing * 0.8;
        tito.bodyGroup.position.y = 0.62 + Math.abs(Math.sin(runPhase)) * 0.14;
      } else {
        currentT = targetCfg.pathT;
        roadCurve.getPointAt(currentT, _pathPos);
        tito.root.position.set(_pathPos.x, 0.05, _pathPos.z);

        // Gently face viewer (+Z -> rotation.y = Math.PI because nose is -Z)
        const idleYaw = Math.PI * 0.92;
        let diff = idleYaw - tito.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        tito.root.rotation.y += diff * Math.min(1, dt * 7);

        tito.leftLegPivot.rotation.x = THREE.MathUtils.damp(
          tito.leftLegPivot.rotation.x,
          0,
          10,
          dt
        );
        tito.rightLegPivot.rotation.x = THREE.MathUtils.damp(
          tito.rightLegPivot.rotation.x,
          0,
          10,
          dt
        );
        tito.leftArmPivot.rotation.x = THREE.MathUtils.damp(
          tito.leftArmPivot.rotation.x,
          Math.sin(elapsed * 3) * 0.12,
          8,
          dt
        );
        tito.rightArmPivot.rotation.x = THREE.MathUtils.damp(
          tito.rightArmPivot.rotation.x,
          -Math.sin(elapsed * 3) * 0.12,
          8,
          dt
        );
        tito.bodyGroup.position.y = 0.62 + Math.abs(Math.sin(elapsed * 3.4)) * 0.07;
      }

      // 2. Spin 3D coins cleanly in world space (zero squash!)
      for (const coin of pathCoins) {
        coin.rotation.y = elapsed * 2.2 + coin.userData.phase;
        coin.position.y = 0.88 + Math.sin(elapsed * 2.6 + coin.userData.phase) * 0.12;
      }

      // 3. Spin golden crown & flutter flags & drift clouds
      crownGroup.rotation.y = elapsed * 1.1;
      crownGroup.position.y = 1.65 + Math.sin(elapsed * 2.2) * 0.1;

      animatedFlags.forEach((f, idx) => {
        f.rotation.y = Math.sin(elapsed * 3.5 + idx) * 0.22;
      });

      cloudClusters.forEach((c, idx) => {
        c.position.x += dt * (0.28 + idx * 0.05);
        if (c.position.x > 26) c.position.x = -26;
      });

      // 4. Responsive Camera Auto-Framing (adapts smoothly to portrait mobile vs widescreen desktop)
      if (cameraAutoFollowRef.current) {
        const aspect = canvasW / canvasH;
        const isPortrait = aspect < 1.05;
        const focusX = THREE.MathUtils.clamp(tito.root.position.x * 0.72, -10.5, 10.5);
        const focusZ = THREE.MathUtils.clamp(tito.root.position.z * 0.35 - 0.6, -3.5, 2.5);

        const camDistZ = isPortrait ? 18.5 : aspect < 1.4 ? 17.5 : 16.5;
        const camHeightY = isPortrait ? 11.8 : 11.2;

        _camGoalTarget.set(focusX, 0.8, focusZ);
        _camGoalPos.set(focusX + (isPortrait ? 0 : 0.8), camHeightY, focusZ + camDistZ);

        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, 4.5, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, 4.5, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, 4.5, dt);

        camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 4.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 4.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 4.5, dt);
      }

      controls.update();

      // Keep map panning cleanly inside the valley bounds (no drifting into void)
      const clampedX = THREE.MathUtils.clamp(controls.target.x, -12.5, 12.5);
      const clampedZ = THREE.MathUtils.clamp(controls.target.z, -4.5, 4.5);
      if (clampedX !== controls.target.x || clampedZ !== controls.target.z) {
        camera.position.x += clampedX - controls.target.x;
        camera.position.z += clampedZ - controls.target.z;
        controls.target.x = clampedX;
        controls.target.z = clampedZ;
      }

      updateProjectedLabels();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener("start", handleControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
      shadowTex.dispose();
      cobbleTex.dispose();
      grassTex.dispose();
      oxxoSignTex.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [unlockedLevel, completedLevels]);

  const activeBubble =
    MILESTONE_LIST.find((m) => m.id === focusedMilestone)?.bubble ?? "¡Vamos!";

  const handlePinTap = (id: MilestoneFocusId) => {
    if (id === "oxxo") {
      onSelectMilestone("oxxo");
      onOpenStore();
      return;
    }
    if (focusedMilestone === id) {
      if (id === "roles") onOpenRoleBank("roles");
      else if (id === "bank") onOpenRoleBank("bank");
      else if (id === "r1") onStartLevel(1);
      else if (id === "r2") onStartLevel(2);
      else if (id === "r3") onStartLevel(3);
    } else {
      onSelectMilestone(id);
    }
  };

  return (
    <div className="relative flex-1 min-h-[380px] sm:min-h-[430px] rounded-3xl border-2 border-emerald-400 shadow-lg overflow-hidden bg-[#9be0fa] select-none">
      {/* Isolated WebGL Canvas Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full touch-none cursor-grab active:cursor-grabbing"
        aria-label="Mapa 3D interactivo de Misión Ahorro"
      />

      {/* Projected Floating HTML Landmark Tags (Solid surfaces, zero backdrop-blur!) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Floating speech tag above Tito */}
        <div
          ref={bubbleRef}
          className="absolute top-0 left-0 z-20 px-2.5 py-0.5 rounded-xl bg-white border-2 border-slate-900 text-[11px] font-display font-black text-slate-900 shadow-md whitespace-nowrap transition-opacity duration-150"
        >
          {activeBubble}
        </div>

        {/* Route 1, 2, 3 Floating Pins */}
        {([1, 2, 3] as const).map((lvlId) => {
          const id: MilestoneFocusId = `r${lvlId}` as MilestoneFocusId;
          const unlocked = lvlId <= unlockedLevel;
          const completed = completedLevels.includes(lvlId);
          const selected = focusedMilestone === id;

          return (
            <button
              key={id}
              ref={(el) => {
                pinRefs.current[id] = el;
              }}
              type="button"
              onClick={() => handlePinTap(id)}
              className={`absolute top-0 left-0 z-10 min-h-[38px] px-2.5 py-1 rounded-xl border-2 shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                selected
                  ? "bg-slate-900 border-amber-400 text-white"
                  : completed
                    ? "bg-emerald-600 border-white text-white"
                    : unlocked
                      ? "bg-white border-amber-500 text-slate-900 hover:bg-amber-50"
                      : "bg-slate-200 border-slate-400 text-slate-600"
              }`}
            >
              {completed ? (
                <Check className="w-3.5 h-3.5 shrink-0" />
              ) : !unlocked ? (
                <Lock className="w-3.5 h-3.5 shrink-0" />
              ) : null}
              <span className="font-display font-extrabold text-xs">
                Ruta {lvlId}
              </span>
              <span
                className={`font-mono-num text-[10px] font-bold ${
                  selected
                    ? "text-amber-300"
                    : completed
                      ? "text-emerald-100"
                      : "text-amber-700"
                }`}
              >
                +{levelRewards[lvlId]}
              </span>
            </button>
          );
        })}

        {/* OXXO Store Pin */}
        <button
          ref={(el) => {
            pinRefs.current.oxxo = el;
          }}
          type="button"
          onClick={() => handlePinTap("oxxo")}
          className={`absolute top-0 left-0 z-10 min-h-[38px] px-2.5 py-1 rounded-xl border-2 shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            focusedMilestone === "oxxo"
              ? "bg-[#D92323] border-white text-[#FACC15] ring-2 ring-slate-900"
              : "bg-[#D92323] border-[#FACC15] text-[#FACC15] hover:bg-[#b91c1c]"
          }`}
        >
          <Store className="w-3.5 h-3.5 shrink-0" />
          <span className="font-display font-black text-xs">OXXO</span>
          {vouchersCount > 0 && (
            <span className="font-mono-num text-[10px] font-bold text-white">
              ({vouchersCount})
            </span>
          )}
        </button>

        {/* Subir Rol Pin */}
        <button
          ref={(el) => {
            pinRefs.current.roles = el;
          }}
          type="button"
          onClick={() => handlePinTap("roles")}
          className={`absolute top-0 left-0 z-10 min-h-[38px] px-2.5 py-1 rounded-xl border-2 shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            upgradeReadyTitle
              ? "bg-amber-400 border-slate-900 text-slate-950"
              : focusedMilestone === "roles"
                ? "bg-slate-900 border-amber-400 text-white"
                : "bg-white border-amber-500 text-amber-950 hover:bg-amber-50"
          }`}
        >
          <Crown className="w-3.5 h-3.5 shrink-0" />
          <span className="font-display font-extrabold text-xs">
            {upgradeReadyTitle ? "¡Subir Rol!" : activeRoleShortTitle}
          </span>
        </button>

        {/* Mi Propio Banco Pin */}
        <button
          ref={(el) => {
            pinRefs.current.bank = el;
          }}
          type="button"
          onClick={() => handlePinTap("bank")}
          className={`absolute top-0 left-0 z-10 min-h-[38px] px-2.5 py-1 rounded-xl border-2 shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
            focusedMilestone === "bank"
              ? "bg-emerald-900 border-amber-400 text-white"
              : "bg-emerald-700 border-white text-white hover:bg-emerald-800"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="font-display font-extrabold text-xs max-w-[92px] truncate">
            {bankName}
          </span>
          <span className="font-mono-num text-[10px] font-bold text-amber-300">
            {bankVaultCoins}
          </span>
        </button>
      </div>
    </div>
  );
};
