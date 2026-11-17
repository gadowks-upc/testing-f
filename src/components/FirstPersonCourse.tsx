import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Eye,
  Heart,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { FinancialLevel } from "../data/levels";
import { soundFx } from "../audio/soundFx";

interface FirstPersonCourseProps {
  level: FinancialLevel;
  paused: boolean;
  onPauseToggle: () => void;
  onCoinPickup: (amount: number) => void;
  onCheckpointReached: (checkpointIndex: number) => void;
  onCourseFinished: () => void;
  onCourseFailed: () => void;
  completedCheckpoints: number;
}

interface ObstacleItem {
  group: THREE.Group;
  laneX: number;
  z: number;
  width: number;
  height: number;
  jumpable: boolean;
  hit: boolean;
}

interface CoinItem {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

interface GateItem {
  group: THREE.Group;
  z: number;
  checkpointIndex: number;
  triggered: boolean;
}

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
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

// Pre-allocated scratch helpers outside the render loop (zero GC)
const _tmpColor = new THREE.Color();
const _dummyObj = new THREE.Object3D();

function createCobbleTrackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#D4B483";
  ctx.fillRect(0, 0, 512, 512);

  // Cobblestone / wooden plank adventure path pattern
  for (let y = 0; y < 512; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? "#C9A571" : "#DFC191";
    ctx.fillRect(16, y + 6, 480, 52);
    ctx.strokeStyle = "#9F7B4D";
    ctx.lineWidth = 4;
    ctx.strokeRect(16, y + 6, 480, 52);

    // Subtle wood grain / pebble marks
    ctx.fillStyle = "rgba(120, 86, 48, 0.14)";
    for (let x = 36; x < 480; x += 72) {
      ctx.beginPath();
      ctx.ellipse(x + ((y * 7) % 24), y + 32, 18, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Painted lane guide dashes
  ctx.fillStyle = "rgba(255, 250, 230, 0.48)";
  ctx.fillRect(172, 12, 8, 40);
  ctx.fillRect(332, 12, 8, 40);
  ctx.fillRect(172, 268, 8, 40);
  ctx.fillRect(332, 268, 8, 40);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 30);
  return tex;
}

function createHazardStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#F59E0B";
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = "#DC2626";
  for (let i = -128; i < 384; i += 48) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 24, 0);
    ctx.lineTo(i + 72, 128);
    ctx.lineTo(i + 48, 128);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGrassTexture(tintHex: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = tintHex;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 240; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
    ctx.fillRect(x, y, 6, 12);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 45);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, "rgba(15, 23, 42, 0.5)");
  grad.addColorStop(1, "rgba(15, 23, 42, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createGoldCoinGroup(
  goldMat: THREE.MeshStandardMaterial,
  trimMat: THREE.MeshStandardMaterial,
  shadowTex: THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();

  // 1. Outer beveled torus rim
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.09, 12, 24), trimMat);
  group.add(rim);

  // 2. Inner stamped disc
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24), goldMat);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);

  // 3. Center embossed star/diamond medallion
  const starGeo = new THREE.OctahedronGeometry(0.2, 0);
  starGeo.scale(1, 1, 0.45);
  const emblem = new THREE.Mesh(starGeo, trimMat);
  group.add(emblem);

  // 4. Ground contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.05;
  group.add(shadow);

  return group;
}

function createObstacleGroup(
  woodMat: THREE.MeshStandardMaterial,
  stripeMat: THREE.MeshStandardMaterial,
  candyMat: THREE.MeshStandardMaterial,
  shadowTex: THREE.CanvasTexture,
  tall: boolean
): THREE.Group {
  const group = new THREE.Group();

  // 1 & 2. Grounded timber base feet
  const footGeo = new THREE.BoxGeometry(0.35, 0.18, 0.6);
  const footL = new THREE.Mesh(footGeo, woodMat);
  footL.position.set(-0.9, 0.09, 0);
  footL.castShadow = true;
  const footR = new THREE.Mesh(footGeo, woodMat);
  footR.position.set(0.9, 0.09, 0);
  footR.castShadow = true;
  group.add(footL, footR);

  // 3 & 4. Vertical wooden pillars
  const postH = tall ? 2.1 : 1.05;
  const postGeo = new THREE.CylinderGeometry(0.11, 0.13, postH, 12);
  const postL = new THREE.Mesh(postGeo, woodMat);
  postL.position.set(-0.9, postH / 2 + 0.12, 0);
  postL.castShadow = true;
  const postR = new THREE.Mesh(postGeo, woodMat);
  postR.position.set(0.9, postH / 2 + 0.12, 0);
  postR.castShadow = true;
  group.add(postL, postR);

  // 5. Striped barrier plank (impulsive-buy trap)
  const plank = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.48, 0.22), stripeMat);
  plank.position.set(0, tall ? 1.55 : 0.72, 0);
  plank.castShadow = true;
  group.add(plank);

  if (tall) {
    const lowerPlank = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.38, 0.2), stripeMat);
    lowerPlank.position.set(0, 0.75, 0);
    lowerPlank.castShadow = true;
    group.add(lowerPlank);
  }

  // 6. Playful "Antojo / Deseo" topper orb so kids recognize the financial trap
  const topper = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 1), candyMat);
  topper.position.set(0, tall ? 2.15 : 1.25, 0);
  group.add(topper);

  // 7. Contact shadow plane
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.3),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.42,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return group;
}

function createCheckpointArch(
  stoneMat: THREE.MeshStandardMaterial,
  woodMat: THREE.MeshStandardMaterial,
  emeraldMat: THREE.MeshStandardMaterial,
  goldMat: THREE.MeshStandardMaterial,
  shadowTex: THREE.CanvasTexture,
  isFinishVault: boolean
): THREE.Group {
  const group = new THREE.Group();

  // 1 & 2. Stone pedestals
  const pedGeo = new THREE.BoxGeometry(1.1, 0.7, 1.1);
  const pedL = new THREE.Mesh(pedGeo, stoneMat);
  pedL.position.set(-4.3, 0.35, 0);
  const pedR = new THREE.Mesh(pedGeo, stoneMat);
  pedR.position.set(4.3, 0.35, 0);
  group.add(pedL, pedR);

  // 3 & 4. Tall columns
  const colGeo = new THREE.CylinderGeometry(0.32, 0.38, 4.4, 16);
  const colL = new THREE.Mesh(colGeo, isFinishVault ? goldMat : woodMat);
  colL.position.set(-4.3, 2.7, 0);
  const colR = new THREE.Mesh(colGeo, isFinishVault ? goldMat : woodMat);
  colR.position.set(4.3, 2.7, 0);
  group.add(colL, colR);

  // 5. Arch crossbeam
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(9.6, 0.85, 0.9),
    isFinishVault ? goldMat : woodMat
  );
  beam.position.set(0, 5.1, 0);
  group.add(beam);

  // 6. Glowing jewel emblem center
  const jewel = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.65, 0),
    isFinishVault ? goldMat : emeraldMat
  );
  jewel.position.set(0, 5.95, 0);
  group.add(jewel);

  // 7 & 8. Hanging lanterns
  const lanternGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.55, 8);
  const lanL = new THREE.Mesh(lanternGeo, isFinishVault ? goldMat : emeraldMat);
  lanL.position.set(-3.1, 4.35, 0);
  const lanR = new THREE.Mesh(lanternGeo, isFinishVault ? goldMat : emeraldMat);
  lanR.position.set(3.1, 4.35, 0);
  group.add(lanL, lanR);

  // 9. Ground threshold strip (offset >= 0.03 to prevent z-fighting)
  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.06, 0.7),
    isFinishVault ? goldMat : emeraldMat
  );
  threshold.position.set(0, 0.03, 0);
  group.add(threshold);

  // 10. Contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.4),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.35,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);

  return group;
}

function createRunnerCharacter(
  goldMat: THREE.MeshStandardMaterial,
  woodMat: THREE.MeshStandardMaterial,
  shadowTex: THREE.CanvasTexture
): RunnerRig {
  const root = new THREE.Group();

  // Distinct PBR materials with >= 0.25 roughness variation
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf9a8d4, // cheerful explorer piglet-pink
    roughness: 0.72,
    metalness: 0.02,
  });
  const vestMat = new THREE.MeshStandardMaterial({
    color: 0x0d9488, // bright teal explorer vest
    roughness: 0.85,
    metalness: 0.04,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: 0x78350f, // warm explorer brown shorts
    roughness: 0.88,
    metalness: 0.02,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b, // sturdy amber sneakers
    roughness: 0.45,
    metalness: 0.12,
  });
  const scarfMat = new THREE.MeshStandardMaterial({
    color: 0xef4444, // adventure red neckerchief
    roughness: 0.8,
    metalness: 0.02,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.1,
  });
  const hatMat = new THREE.MeshStandardMaterial({
    color: 0x15803d, // forest explorer cap
    roughness: 0.82,
    metalness: 0.04,
  });

  // Ground contact shadow (bottom-center grounded)
  const shadowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 1.35),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.045;
  root.add(shadowMesh);

  // Body pivot centered at hips (y = 0.62 above ground)
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 0.62;
  root.add(bodyGroup);

  // 1. Torso (capsule-like rounded explorer vest)
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.31, 0.58, 16),
    vestMat
  );
  torso.position.y = 0.28;
  torso.castShadow = true;
  bodyGroup.add(torso);

  // 2. Explorer backpack + golden coin emblem on back (facing camera!)
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

  // 3. Neckerchief collar
  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.065, 10, 20),
    scarfMat
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 0.58;
  bodyGroup.add(scarf);

  // 4. Head group
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.82;
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Snout & eyes (facing forward -Z)
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

  // Cute ears
  const earGeo = new THREE.ConeGeometry(0.09, 0.18, 10);
  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(-0.22, 0.22, 0.02);
  earL.rotation.z = 0.45;
  const earR = new THREE.Mesh(earGeo, skinMat);
  earR.position.set(0.22, 0.22, 0.02);
  earR.rotation.z = -0.45;
  headGroup.add(earL, earR);

  // 5. Explorer Cap + Brim + Feather accent
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    hatMat
  );
  cap.position.y = 0.08;
  cap.castShadow = true;
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.34, 0.04, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
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

  // 6 & 7. Articulated Arms (pivoting at shoulders)
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

  // 8 & 9. Articulated Legs + Sneakers (pivoting at hips)
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

function createBossOwlMonument(
  goldMat: THREE.MeshStandardMaterial,
  woodMat: THREE.MeshStandardMaterial,
  emeraldMat: THREE.MeshStandardMaterial,
  shadowTex: THREE.CanvasTexture
): { group: THREE.Group; wingL: THREE.Group; wingR: THREE.Group } {
  const group = new THREE.Group();

  const featherMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.78,
    metalness: 0.05,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.85,
    metalness: 0.02,
  });
  const waistcoatMat = new THREE.MeshStandardMaterial({
    color: 0x047857,
    roughness: 0.65,
    metalness: 0.1,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.2,
    metalness: 0.1,
  });

  // 1. Golden vault pedestal
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.85, 0.55, 24),
    goldMat
  );
  pedestal.position.y = 0.275;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  // 2. Owl body in emerald waistcoat
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.78, 1.35, 18),
    waistcoatMat
  );
  torso.position.y = 1.25;
  torso.castShadow = true;
  group.add(torso);

  // 3. Chest medallion
  const badge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16),
    goldMat
  );
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0.28, 1.45, 0.65);
  group.add(badge);

  // 4. Owl head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.68, 20, 16), featherMat);
  head.position.y = 2.25;
  head.castShadow = true;
  group.add(head);

  // 5. Cream facial disc
  const face = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.16, 18),
    bellyMat
  );
  face.rotation.x = Math.PI / 2;
  face.position.set(0, 2.25, 0.54);
  group.add(face);

  // 6 & 7. Brass spectacles & eyes (facing +Z toward approaching runner!)
  const specGeo = new THREE.TorusGeometry(0.16, 0.03, 10, 20);
  const specL = new THREE.Mesh(specGeo, goldMat);
  specL.position.set(-0.22, 2.32, 0.64);
  const specR = new THREE.Mesh(specGeo, goldMat);
  specR.position.set(0.22, 2.32, 0.64);
  const eyeGeo = new THREE.SphereGeometry(0.08, 10, 10);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.22, 2.32, 0.61);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(0.22, 2.32, 0.61);
  group.add(specL, specR, eyeL, eyeR);

  // 8. Golden beak & ear tufts
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 8), goldMat);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 2.18, 0.72);
  const tuftGeo = new THREE.ConeGeometry(0.14, 0.36, 8);
  const tuftL = new THREE.Mesh(tuftGeo, featherMat);
  tuftL.position.set(-0.42, 2.86, 0.05);
  tuftL.rotation.z = 0.4;
  const tuftR = new THREE.Mesh(tuftGeo, featherMat);
  tuftR.position.set(0.42, 2.86, 0.05);
  tuftR.rotation.z = -0.4;
  group.add(beak, tuftL, tuftR);

  // 9 & 10. Waving wings
  const buildWing = (xSide: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xSide * 0.72, 1.72, 0);
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.85, 0.45),
      featherMat
    );
    wing.position.set(xSide * 0.14, -0.35, 0);
    wing.castShadow = true;
    pivot.add(wing);
    group.add(pivot);
    return pivot;
  };
  const wingL = buildWing(-1);
  const wingR = buildWing(1);

  // Floating emerald crown gem above Don Búho
  const crownGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.28, 0),
    emeraldMat
  );
  crownGem.position.y = 3.35;
  group.add(crownGem);

  // Contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 4.2),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.4,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  // Use woodMat subtly on base trim ring
  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(1.65, 0.08, 8, 24),
    woodMat
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 0.08;
  group.add(trim);

  return { group, wingL, wingR };
}

export const FirstPersonCourse: React.FC<FirstPersonCourseProps> = ({
  level,
  paused,
  onPauseToggle,
  onCoinPickup,
  onCheckpointReached,
  onCourseFinished,
  onCourseFailed,
  completedCheckpoints,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // React UI mirrors updated at low frequency (never tearing down Three.js)
  const [hearts, setHearts] = useState(3);
  const [progressPct, setProgressPct] = useState(0);
  const [routeCoins, setRouteCoins] = useState(0);
  const [muted, setMuted] = useState(soundFx.muted);
  const [hitBanner, setHitBanner] = useState<string | null>(null);
  const [thirdPersonCam, setThirdPersonCam] = useState(true);

  // Mutable refs accessed inside animation loop
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const thirdPersonRef = useRef(thirdPersonCam);
  thirdPersonRef.current = thirdPersonCam;

  const callbacksRef = useRef({
    onCoinPickup,
    onCheckpointReached,
    onCourseFinished,
    onCourseFailed,
  });
  callbacksRef.current = {
    onCoinPickup,
    onCheckpointReached,
    onCourseFinished,
    onCourseFailed,
  };

  // Input state separated into continuous held + edge-triggered jump buffer
  const heldInputRef = useRef({
    left: false,
    right: false,
    boost: false,
  });
  const jumpBufferTimerRef = useRef(0);
  const swipeStartXRef = useRef<number | null>(null);
  const touchSteerOffsetRef = useRef(0);

  const triggerJump = () => {
    jumpBufferTimerRef.current = 0.16; // 160ms input buffering
  };

  const toggleMute = () => {
    soundFx.muted = !soundFx.muted;
    setMuted(soundFx.muted);
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    setHearts(3);
    setProgressPct(0);
    setRouteCoins(0);
    setHitBanner(null);

    // Software WebGL detection (only for render cost: AA, shadow, pixelRatio, frame pacing)
    const isSoftwareGl = (() => {
      const probe = document.createElement("canvas").getContext("webgl2");
      if (!probe) return true;
      const ext = probe.getExtension("WEBGL_debug_renderer_info");
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension("WEBGL_lose_context")?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(level.skyColor);
    scene.fog = new THREE.FogExp2(level.fogColor, 0.015);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(72, width / height, 0.1, 220);
    camera.position.set(0, 1.75, 4);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Mandatory studio environment reflections for shiny gold coins & trim
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Three-point warm/cool outdoor lighting rig
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x4d7c0f, 0.85);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4d6, 1.6);
    sun.position.set(16, 28, 12);
    sun.castShadow = !isSoftwareGl;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 90;
    sun.shadow.camera.left = -22;
    sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 22;
    sun.shadow.camera.bottom = -22;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    const rimLight = new THREE.DirectionalLight(0xbae6fd, 0.45);
    rimLight.position.set(-12, 10, -24);
    scene.add(rimLight);

    // Procedural Textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const trackTex = createCobbleTrackTexture();
    trackTex.anisotropy = maxAniso;
    const stripeTex = createHazardStripeTexture();
    stripeTex.anisotropy = maxAniso;
    const grassTex = createGrassTexture(level.groundTint);
    grassTex.anisotropy = maxAniso;
    const shadowTex = createContactShadowTexture();

    // Shared PBR Materials with varied roughness & metalness
    const groundMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.92,
      metalness: 0.0,
    });
    const trackMat = new THREE.MeshStandardMaterial({
      map: trackTex,
      roughness: 0.72,
      metalness: 0.05,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.2,
      metalness: 0.92,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.35,
      metalness: 0.75,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x7c4a26,
      roughness: 0.85,
      metalness: 0.02,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.9,
      metalness: 0.05,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      map: stripeTex,
      roughness: 0.5,
      metalness: 0.1,
    });
    const candyMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      roughness: 0.3,
      metalness: 0.25,
      emissive: 0xbe185d,
      emissiveIntensity: 0.22,
    });
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.25,
      metalness: 0.4,
      emissive: 0x059669,
      emissiveIntensity: 0.3,
    });

    // Natural rolling meadow ground extending far past the route (no indoor box walls)
    const courseEndZ = -level.routeLength;
    const groundGeo = new THREE.PlaneGeometry(180, level.routeLength + 140, 32, 48);
    groundGeo.rotateX(-Math.PI / 2);
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const gx = posAttr.getX(i);
      const gz = posAttr.getZ(i);
      // Keep the center path corridor flat; sculpt rolling hills on the outer flanks
      const absX = Math.abs(gx);
      if (absX > 6.5) {
        const hill =
          Math.sin(gx * 0.14 + gz * 0.05) * 1.4 +
          Math.cos(gz * 0.08) * 0.9 +
          (absX - 6.5) * 0.16;
        posAttr.setY(i, Math.max(0, hill));
      }
    }
    groundGeo.computeVertexNormals();
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set(0, 0, courseEndZ / 2 - 20);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Elevated cobblestone adventure trail (offset +0.03 in Y so never z-fights)
    const trackMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, 0.08, level.routeLength + 30),
      trackMat
    );
    trackMesh.position.set(0, 0.03, courseEndZ / 2 - 5);
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Side border rails using InstancedMesh (>20 repeated wooden posts)
    const postCount = Math.floor((level.routeLength + 20) / 5) * 2;
    const postGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.9, 8);
    const instancedPosts = new THREE.InstancedMesh(postGeo, woodMat, postCount);
    let postIdx = 0;
    for (let z = 6; z >= courseEndZ - 10; z -= 5) {
      for (const side of [-4.5, 4.5]) {
        if (postIdx < postCount) {
          _dummyObj.position.set(side, 0.45, z);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.setScalar(1);
          _dummyObj.updateMatrix();
          instancedPosts.setMatrixAt(postIdx++, _dummyObj.matrix);
        }
      }
    }
    instancedPosts.instanceMatrix.needsUpdate = true;
    instancedPosts.computeBoundingSphere();
    scene.add(instancedPosts);

    // Natural outdoor trees perimeter using two InstancedMeshes (trunks + leafy crowns)
    const treeCount = 70;
    const trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.28, 0.4, 2.6, 8),
      woodMat,
      treeCount
    );
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.0,
    });
    const crownMesh = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(1.7, 1),
      crownMat,
      treeCount
    );
    const treePalette = [0x2e7d32, 0x388e3c, 0x43a047, 0x558b2f];

    for (let i = 0; i < treeCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = 8 - (i / treeCount) * (level.routeLength + 30);
      const x = side * (8.5 + ((i * 37) % 18));
      const scale = 0.85 + ((i * 19) % 30) / 100;

      _dummyObj.position.set(x, 1.3 * scale, z);
      _dummyObj.rotation.set(0, i * 0.7, 0);
      _dummyObj.scale.setScalar(scale);
      _dummyObj.updateMatrix();
      trunkMesh.setMatrixAt(i, _dummyObj.matrix);

      _dummyObj.position.set(x, 3.1 * scale, z);
      _dummyObj.scale.set(scale * 1.1, scale * 1.25, scale * 1.1);
      _dummyObj.updateMatrix();
      crownMesh.setMatrixAt(i, _dummyObj.matrix);

      _tmpColor.setHex(treePalette[i % treePalette.length]);
      crownMesh.setColorAt(i, _tmpColor);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    crownMesh.instanceMatrix.needsUpdate = true;
    if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true;
    trunkMesh.computeBoundingSphere();
    crownMesh.computeBoundingSphere();
    scene.add(trunkMesh, crownMesh);

    // Spawn 3 Checkpoint Arches + Final Vault Gate
    const gates: GateItem[] = [];
    const checkpointFractions = [0.3, 0.62, 0.92];
    checkpointFractions.forEach((frac, idx) => {
      const z = -level.routeLength * frac;
      const arch = createCheckpointArch(
        stoneMat,
        woodMat,
        emeraldMat,
        goldMat,
        shadowTex,
        false
      );
      arch.position.set(0, 0, z);
      scene.add(arch);
      gates.push({ group: arch, z, checkpointIndex: idx, triggered: false });
    });

    const finishZ = -level.routeLength;
    const finishArch = createCheckpointArch(
      stoneMat,
      woodMat,
      emeraldMat,
      goldMat,
      shadowTex,
      true
    );
    finishArch.position.set(0, 0, finishZ);
    scene.add(finishArch);

    // Chief Boss Don Búho waiting right at the final vault gate!
    const bossOwl = createBossOwlMonument(goldMat, woodMat, emeraldMat, shadowTex);
    bossOwl.group.position.set(0, 0, finishZ - 2.2);
    scene.add(bossOwl.group);

    // Spawn Obstacles ("Trampas de Compra Impulsiva") avoiding checkpoint zones
    const lanes = [-2.5, 0, 2.5];
    const obstacles: ObstacleItem[] = [];
    for (let i = 0; i < level.obstacleCount; i++) {
      const z = -16 - (i / level.obstacleCount) * (level.routeLength - 26);
      const nearGate = gates.some((g) => Math.abs(g.z - z) < 8);
      if (nearGate) continue;

      const laneX = lanes[(i * 7 + level.id) % lanes.length];
      const tall = i % 3 === 1;
      const obsGroup = createObstacleGroup(
        woodMat,
        stripeMat,
        candyMat,
        shadowTex,
        tall
      );
      obsGroup.position.set(laneX, 0, z);
      scene.add(obsGroup);

      obstacles.push({
        group: obsGroup,
        laneX,
        z,
        width: 1.9,
        height: tall ? 2.1 : 1.05,
        jumpable: !tall,
        hit: false,
      });
    }

    // Spawn Gold Coins along inviting arcs
    const coins: CoinItem[] = [];
    for (let i = 0; i < level.coinCount; i++) {
      const z = -10 - (i / level.coinCount) * (level.routeLength - 18);
      const laneX = lanes[(i * 5 + 1) % lanes.length];
      const blockedByTall = obstacles.some(
        (o) => !o.jumpable && Math.abs(o.z - z) < 2.2 && o.laneX === laneX
      );
      const finalX = blockedByTall ? 0 : laneX;
      const y = i % 4 === 2 ? 2.0 : 1.15; // Some elevated coins encourage jumping!

      const coinGroup = createGoldCoinGroup(goldMat, trimMat, shadowTex);
      coinGroup.position.set(finalX, y, z);
      scene.add(coinGroup);
      coins.push({ group: coinGroup, x: finalX, y, z, collected: false });
    }

    // Pooled sparkle particles for coin pickups
    const particlePool: Particle[] = [];
    const sparkGeo = new THREE.OctahedronGeometry(0.12, 0);
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(sparkGeo, goldMat);
      m.visible = false;
      scene.add(m);
      particlePool.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0 });
    }

    const spawnBurst = (bx: number, by: number, bz: number) => {
      let spawned = 0;
      for (const p of particlePool) {
        if (p.life <= 0 && spawned < 6) {
          p.life = 0.45;
          p.mesh.visible = true;
          p.mesh.position.set(bx, by, bz);
          const angle = (spawned / 6) * Math.PI * 2;
          p.vx = Math.cos(angle) * 3.2;
          p.vy = 2.5 + (spawned % 2) * 1.4;
          p.vz = Math.sin(angle) * 3.2;
          spawned++;
        }
      }
    };

    // Create animated 3D Explorer Runner character
    const runner = createRunnerCharacter(goldMat, woodMat, shadowTex);
    runner.root.position.set(0, 0, 2);
    scene.add(runner.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Player physics state
    let playerX = 0;
    let playerY = 0;
    let playerVelY = 0;
    let playerZ = 2;
    let grounded = true;
    let coyoteTimer = 0;
    let localHearts = 3;
    let localCoins = 0;
    let hitstopTimer = 0;
    let shakeIntensity = 0;
    let invulnTimer = 0;
    let headBobPhase = 0;
    let courseEnded = false;
    let lastReportedPct = -1;

    // Keyboard listeners
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") heldInputRef.current.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") heldInputRef.current.right = true;
      if (e.code === "KeyW" || e.code === "ArrowUp") heldInputRef.current.boost = true;
      if (e.code === "Space") {
        e.preventDefault();
        triggerJump();
      }
      if (e.code === "Escape") {
        onPauseToggle();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") heldInputRef.current.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") heldInputRef.current.right = false;
      if (e.code === "KeyW" || e.code === "ArrowUp") heldInputRef.current.boost = false;
    };
    const onWindowBlur = () => {
      heldInputRef.current.left = false;
      heldInputRef.current.right = false;
      heldInputRef.current.boost = false;
      touchSteerOffsetRef.current = 0;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth || window.innerWidth;
      const nh = container.clientHeight || window.innerHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    // WebGL context loss safety
    const onContextLost = (ev: Event) => {
      ev.preventDefault();
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

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

    function tick() {
      if (disposed) return;

      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);

      if (!pausedRef.current && !courseEnded) {
        if (hitstopTimer > 0) {
          hitstopTimer -= dt;
        } else {
          // 1. Forward speed + boost
          const speedMult = heldInputRef.current.boost ? 1.24 : 1.0;
          const forwardSpeed = level.baseSpeed * speedMult;
          playerZ -= forwardSpeed * dt;

          // 2. Smooth lateral steering (keyboard + mobile buttons + swipe)
          const steerDir =
            (heldInputRef.current.right ? 1 : 0) -
            (heldInputRef.current.left ? 1 : 0) +
            touchSteerOffsetRef.current;
          touchSteerOffsetRef.current = THREE.MathUtils.damp(
            touchSteerOffsetRef.current,
            0,
            10,
            dt
          );
          const targetX = THREE.MathUtils.clamp(
            playerX + steerDir * 8.5 * dt,
            -3.3,
            3.3
          );
          playerX = THREE.MathUtils.damp(playerX, targetX, 18, dt);

          // 3. Coyote time & buffered Jump
          if (grounded) {
            coyoteTimer = 0.12;
          } else {
            coyoteTimer = Math.max(0, coyoteTimer - dt);
          }
          if (jumpBufferTimerRef.current > 0) {
            jumpBufferTimerRef.current -= dt;
            if (coyoteTimer > 0) {
              playerVelY = 9.2;
              grounded = false;
              coyoteTimer = 0;
              jumpBufferTimerRef.current = 0;
              soundFx.playJump();
            }
          }

          // Gravity
          if (!grounded) {
            playerVelY -= 24 * dt;
            playerY += playerVelY * dt;
            if (playerY <= 0) {
              playerY = 0;
              playerVelY = 0;
              grounded = true;
            }
          }

          // Head-bob & dynamic FOV
          if (grounded) {
            headBobPhase += dt * (heldInputRef.current.boost ? 13 : 10);
          }
          const targetFov = heldInputRef.current.boost ? 78 : 72;
          if (Math.abs(camera.fov - targetFov) > 0.05) {
            camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 7, dt);
            camera.updateProjectionMatrix();
          }

          if (invulnTimer > 0) invulnTimer -= dt;

          // 4. Collect coins
          for (const coin of coins) {
            if (coin.collected) continue;
            coin.group.rotation.y += dt * 3.0;
            const dx = Math.abs(playerX - coin.x);
            const dz = Math.abs(playerZ - coin.z);
            const dy = Math.abs(playerY + 1.15 - coin.y);
            if (dx < 1.05 && dz < 1.1 && dy < 1.35) {
              coin.collected = true;
              coin.group.visible = false;
              localCoins += 10;
              setRouteCoins(localCoins);
              soundFx.playCoin();
              spawnBurst(coin.x, coin.y, coin.z);
              callbacksRef.current.onCoinPickup(10);
            }
          }

          // 5. Obstacle collisions
          for (const obs of obstacles) {
            if (obs.hit) continue;
            const dx = Math.abs(playerX - obs.laneX);
            const dz = Math.abs(playerZ - obs.z);
            if (dx < 1.05 && dz < 0.75) {
              const clearedByJump = obs.jumpable && playerY > 0.85;
              if (!clearedByJump && invulnTimer <= 0) {
                obs.hit = true;
                obs.group.rotation.x = -0.35;
                hitstopTimer = 0.055; // 55ms simulation hitstop
                shakeIntensity = 0.35;
                invulnTimer = 1.1;
                localHearts = Math.max(0, localHearts - 1);
                setHearts(localHearts);
                soundFx.playBump();
                setHitBanner("¡Cuidado con la trampa impulsiva! -1 corazón");
                window.setTimeout(() => setHitBanner(null), 1600);

                if (localHearts <= 0) {
                  courseEnded = true;
                  callbacksRef.current.onCourseFailed();
                }
              }
            }
          }

          // 6. Checkpoint Knowledge Gates
          for (const gate of gates) {
            if (!gate.triggered && playerZ <= gate.z + 1.0) {
              gate.triggered = true;
              callbacksRef.current.onCheckpointReached(gate.checkpointIndex);
              break;
            }
          }

          // 7. Finish Vault Arch -> Arrive directly in front of Chief Boss Don Búho!
          if (!courseEnded && playerZ <= finishZ + 2.8) {
            courseEnded = true;
            soundFx.playFanfare();
            callbacksRef.current.onCourseFinished();
          }

          // Animate Boss Owl waving at the finish gate
          const tNow = clock.elapsedTime;
          bossOwl.wingL.rotation.z = -0.35 - Math.sin(tNow * 4.5) * 0.35;
          bossOwl.wingR.rotation.z = 0.35 + Math.sin(tNow * 4.5) * 0.35;
          bossOwl.group.position.y = Math.sin(tNow * 2.2) * 0.08;

          // 8. Progress readout
          const pct = Math.min(
            100,
            Math.max(0, Math.round(((2 - playerZ) / (level.routeLength + 2)) * 100))
          );
          if (pct !== lastReportedPct) {
            lastReportedPct = pct;
            setProgressPct(pct);
          }
        }
      }

      // Update pooled particles
      for (const p of particlePool) {
        if (p.life > 0) {
          p.life -= dt;
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.vy -= 9.5 * dt;
          p.mesh.rotation.y += dt * 8;
          if (p.life <= 0) p.mesh.visible = false;
        }
      }

      // Animate 3D Runner Character (arms, legs, torso lean, jump tuck, turn bank)
      const isThirdPerson = thirdPersonRef.current;
      runner.root.visible = isThirdPerson;

      if (isThirdPerson) {
        const runSwing = grounded ? Math.sin(headBobPhase) * 0.95 : 0.45;
        const jumpTuck = grounded ? 0 : 0.45;
        runner.leftLegPivot.rotation.x = runSwing + jumpTuck;
        runner.rightLegPivot.rotation.x = -runSwing + jumpTuck;
        runner.leftArmPivot.rotation.x = -runSwing * 0.95 - (grounded ? 0 : 0.5);
        runner.rightArmPivot.rotation.x = runSwing * 0.95 - (grounded ? 0 : 0.5);

        // Forward sprint lean & playful bounce
        const runBounce = grounded && !pausedRef.current ? Math.abs(Math.sin(headBobPhase)) * 0.08 : 0;
        runner.bodyGroup.position.y = 0.62 + runBounce;
        runner.bodyGroup.rotation.x = -0.18;
        runner.headGroup.rotation.x = 0.14;

        // Bank slightly into steering direction
        const steerBank =
          (heldInputRef.current.left ? 0.18 : 0) -
          (heldInputRef.current.right ? 0.18 : 0);
        runner.root.rotation.z = THREE.MathUtils.damp(
          runner.root.rotation.z,
          steerBank,
          12,
          dt
        );
        runner.root.position.set(playerX, playerY, playerZ);
        runner.shadowMesh.position.y = -playerY + 0.045;
        const shadowScale = Math.max(0.45, 1 - playerY * 0.22);
        runner.shadowMesh.scale.setScalar(shadowScale);

        // Blink gently during brief post-bump invulnerability
        if (invulnTimer > 0) {
          runner.bodyGroup.visible = Math.floor(invulnTimer * 16) % 2 === 0;
        } else {
          runner.bodyGroup.visible = true;
        }
      }

      // Camera placement (3rd-person runner chase view vs 1st-person) with decaying shake
      const bobY = grounded && !pausedRef.current ? Math.sin(headBobPhase) * 0.045 : 0;
      const shakeX =
        shakeIntensity > 0.01 ? (Math.random() - 0.5) * shakeIntensity : 0;
      const shakeY =
        shakeIntensity > 0.01 ? (Math.random() - 0.5) * shakeIntensity : 0;
      shakeIntensity = THREE.MathUtils.damp(shakeIntensity, 0, 12, dt);

      if (isThirdPerson) {
        const camX = THREE.MathUtils.damp(camera.position.x, playerX * 0.85, 12, dt);
        camera.position.set(
          camX + shakeX,
          2.65 + playerY * 0.78 + bobY + shakeY,
          playerZ + 4.35
        );
        camera.lookAt(playerX * 0.72, 1.25 + playerY * 0.6, playerZ - 8.5);
      } else {
        camera.position.set(playerX + shakeX, 1.75 + playerY + bobY + shakeY, playerZ);
        camera.lookAt(playerX * 0.65, 1.5 + playerY * 0.6, playerZ - 14);
      }

      camera.rotation.z = THREE.MathUtils.damp(
        camera.rotation.z,
        (heldInputRef.current.left ? 0.03 : 0) -
          (heldInputRef.current.right ? 0.03 : 0),
        10,
        dt
      );

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      tick();
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });
      trackTex.dispose();
      stripeTex.dispose();
      grassTex.dispose();
      shadowTex.dispose();
      renderer.dispose();
    };
  }, [level]);

  // Touch swipe handlers on the viewport
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      swipeStartXRef.current = e.touches[0].clientX;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (swipeStartXRef.current === null || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - swipeStartXRef.current;
    swipeStartXRef.current = e.touches[0].clientX;
    touchSteerOffsetRef.current = THREE.MathUtils.clamp(dx * 0.055, -1.3, 1.3);
  };
  const handleTouchEnd = () => {
    swipeStartXRef.current = null;
  };

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden select-none bg-[#CBEBF7]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Isolated WebGL mount container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Low-occlusion HUD overlay (pointer-events-none wrapper, NO backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
        {/* Top perimeter HUD */}
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto rounded-2xl bg-white/95 border border-slate-200 px-3.5 py-2 shadow-sm flex items-center gap-3">
            <div>
              <p className="text-xs font-bold text-slate-500">
                Nivel {level.id} · {level.title}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="font-mono-num text-sm sm:text-base font-bold text-amber-700">
                  +{routeCoins} monedas
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  |
                </span>
                <span className="font-mono-num text-xs sm:text-sm font-bold text-teal-700">
                  Puertas {completedCheckpoints}/3
                </span>
              </div>
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {/* Hearts */}
            <div
              className="rounded-2xl bg-white/95 border border-slate-200 px-3 py-2 shadow-sm flex items-center gap-1"
              aria-label={`Vidas restantes: ${hearts}`}
            >
              {[0, 1, 2].map((idx) => (
                <Heart
                  key={idx}
                  className={`w-5 h-5 ${
                    idx < hearts
                      ? "text-rose-500 fill-rose-500"
                      : "text-slate-300 fill-slate-200"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setThirdPersonCam((v) => !v)}
              aria-label={thirdPersonCam ? "Cambiar a vista primera persona" : "Ver personaje corriendo"}
              className="min-h-[44px] px-3 rounded-2xl bg-white/95 border border-slate-200 flex items-center justify-center gap-1.5 text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer text-xs font-bold whitespace-nowrap"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">
                {thirdPersonCam ? "Vista Corredor" : "1ª Persona"}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Activar sonido" : "Silenciar sonido"}
              className="min-w-[44px] min-h-[44px] rounded-2xl bg-white/95 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer"
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={onPauseToggle}
              aria-label={paused ? "Reanudar" : "Pausar"}
              className="min-w-[44px] min-h-[44px] rounded-2xl bg-white/95 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer"
            >
              {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Center-top progress bar + collision / final boss approach feedback */}
        <div className="flex flex-col items-center gap-2 -mt-auto">
          {hitBanner && (
            <div className="rounded-xl bg-rose-600 text-white font-bold text-xs sm:text-sm px-4 py-2 shadow-md">
              {hitBanner}
            </div>
          )}
          {!hitBanner && progressPct >= 82 && (
            <div className="rounded-xl bg-amber-500 text-slate-950 font-display font-extrabold text-xs sm:text-sm px-4 py-2 shadow-md">
              ¡Última fase! Ahí te espera Don Búho Tesorero para tu entrevista
            </div>
          )}
        </div>

        {/* Bottom thumb-zone controls + route progress */}
        <div className="flex flex-col gap-2.5">
          {/* Compact route progress bar */}
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white/95 border border-slate-200 px-3.5 py-2 shadow-sm">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
              <span>Camino hacia Don Búho</span>
              <span className="font-mono-num text-slate-900">{progressPct}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-transform duration-150 origin-left"
                style={{ transform: `scaleX(${progressPct / 100})` }}
              />
            </div>
          </div>

          {/* Mobile & mouse thumb controls */}
          <div className="pointer-events-auto flex items-center justify-between gap-3 max-w-xl w-full mx-auto">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Mover a la izquierda"
                onPointerDown={() => {
                  heldInputRef.current.left = true;
                }}
                onPointerUp={() => {
                  heldInputRef.current.left = false;
                }}
                onPointerLeave={() => {
                  heldInputRef.current.left = false;
                }}
                onPointerCancel={() => {
                  heldInputRef.current.left = false;
                }}
                className="min-w-[60px] min-h-[56px] rounded-2xl bg-white/95 border-2 border-slate-300 active:bg-amber-100 active:border-amber-500 flex items-center justify-center text-slate-900 shadow-md cursor-pointer"
              >
                <ArrowLeft className="w-7 h-7" />
              </button>
              <button
                type="button"
                aria-label="Mover a la derecha"
                onPointerDown={() => {
                  heldInputRef.current.right = true;
                }}
                onPointerUp={() => {
                  heldInputRef.current.right = false;
                }}
                onPointerLeave={() => {
                  heldInputRef.current.right = false;
                }}
                onPointerCancel={() => {
                  heldInputRef.current.right = false;
                }}
                className="min-w-[60px] min-h-[56px] rounded-2xl bg-white/95 border-2 border-slate-300 active:bg-amber-100 active:border-amber-500 flex items-center justify-center text-slate-900 shadow-md cursor-pointer"
              >
                <ArrowRight className="w-7 h-7" />
              </button>
            </div>

            <p className="hidden md:block text-xs font-semibold text-slate-800 bg-white/90 px-3 py-1.5 rounded-xl border border-slate-200">
              A/D o Flechas Mover · Espacio Saltar · Esc Pausa
            </p>

            <button
              type="button"
              onPointerDown={() => triggerJump()}
              className="min-w-[116px] min-h-[56px] px-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.97] border-2 border-amber-700 text-slate-950 font-display font-extrabold text-base flex items-center justify-center gap-2 shadow-md cursor-pointer whitespace-nowrap"
            >
              <ArrowUp className="w-6 h-6" />
              <span>Saltar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pause modal when paused manually without quiz */}
      {paused && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#FFFDF7] border-2 border-amber-300 p-6 text-center shadow-2xl">
            <h2 className="text-2xl font-display font-extrabold text-slate-900">
              Juego en Pausa
            </h2>
            <p className="text-sm text-slate-600 mt-1 mb-5">
              Tómate un respiro. ¡Tus monedas te esperan en el camino!
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onPauseToggle}
                className="min-h-[48px] w-full rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                <span>Continuar Ruta</span>
              </button>
              <button
                type="button"
                onClick={onCourseFailed}
                className="min-h-[48px] w-full rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Volver al Mapa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
