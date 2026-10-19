import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { driedFruit } from '../assets/DriedFruit';
import { surfaceMaterial, type SurfaceKind } from '../assets/MaterialLibrary';
import type { ActorMotion, ActorRig, AmbientRig } from '../systems/WorldAnimationSystem';

export type Chapter = 'home' | 'calcutta' | 'debt' | 'prison' | 'wedding' | 'epilogue';

export type WorldInteraction = {
  id: string;
  label: string;
  position: THREE.Vector3;
  object: THREE.Object3D;
};

export type WorldCollider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  label: string;
};

export type World = {
  root: THREE.Group;
  interactions: WorldInteraction[];
  actors: ActorRig[];
  ambient: AmbientRig[];
  spawn: THREE.Vector3;
  yaw: number;
  bounds: THREE.Box2;
  colliders: WorldCollider[];
  story?: Record<string, THREE.Object3D>;
};

const palette = {
  plaster: '#b97743',
  plasterLight: '#d59a61',
  plasterDark: '#70452e',
  timber: '#40291f',
  cloth: '#8f2f25',
  indigo: '#26333b',
  paper: '#d9c9a4',
  gold: '#d89a3c',
  white: '#e8dfcd',
  ink: '#33261e',
};

const standard = (color: string, roughness?: number, kind: SurfaceKind = 'plaster') =>
  surfaceMaterial(color, kind, roughness);

let dustTexture: THREE.CanvasTexture | undefined;
let mirrorGrimeTexture: THREE.CanvasTexture | undefined;

function getMirrorGrimeTexture(): THREE.CanvasTexture {
  if (mirrorGrimeTexture) return mirrorGrimeTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  const vignette = context.createRadialGradient(128, 150, 30, 128, 192, 250);
  vignette.addColorStop(0, 'rgba(12,14,12,0)');
  vignette.addColorStop(0.62, 'rgba(12,14,12,0.1)');
  vignette.addColorStop(0.88, 'rgba(10,12,10,0.34)');
  vignette.addColorStop(1, 'rgba(8,10,9,0.62)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, 256, 384);
  context.strokeStyle = 'rgba(226,220,204,0.05)';
  for (let index = 0; index < 9; index += 1) {
    const x = 24 + index * 26;
    context.beginPath();
    context.moveTo(x, 12);
    context.lineTo(x + 14, 372);
    context.stroke();
  }
  mirrorGrimeTexture = new THREE.CanvasTexture(canvas);
  mirrorGrimeTexture.colorSpace = THREE.SRGBColorSpace;
  return mirrorGrimeTexture;
}

function getDustTexture(): THREE.CanvasTexture {
  if (dustTexture) return dustTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context unavailable');
  const glow = context.createRadialGradient(16, 16, 0, 16, 16, 15);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.32, 'rgba(255,255,255,0.6)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 32, 32);
  dustTexture = new THREE.CanvasTexture(canvas);
  dustTexture.colorSpace = THREE.SRGBColorSpace;
  return dustTexture;
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

type DetailBlock = { size: [number, number, number]; at: [number, number, number]; roll?: number; pitch?: number };

function detailBlocks(parent: THREE.Object3D, material: THREE.Material, blocks: DetailBlock[], name: string): void {
  if (!blocks.length) return;
  const previous = parent.children.find(child => child.name === name) as THREE.InstancedMesh | undefined;
  const offset = previous?.count ?? 0;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, offset + blocks.length);
  if (previous) {
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < offset; index += 1) {
      previous.getMatrixAt(index, matrix);
      mesh.setMatrixAt(index, matrix);
    }
    parent.remove(previous);
    previous.geometry.dispose();
    previous.dispose();
  }
  const transform = new THREE.Object3D();
  blocks.forEach((block, index) => {
    transform.position.set(...block.at);
    transform.scale.set(...block.size);
    transform.rotation.set(block.pitch ?? 0, 0, block.roll ?? 0);
    transform.updateMatrix();
    mesh.setMatrixAt(offset + index, transform.matrix);
  });
  mesh.name = name;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.computeBoundingSphere();
  parent.add(mesh);
}

function addShawl(parent: THREE.Object3D): THREE.Group {
  const shawl = new THREE.Group();
  const cloth = box(shawl, [0.78, 0.035, 0.95], [0, 0, 0], standard('#7d2930', undefined, 'cloth'));
  cloth.rotation.y = 0.08;
  for (let index = 0; index < 7; index += 1) {
    const stripe = box(shawl, [0.045, 0.012, 0.9], [-0.3 + index * 0.1, 0.026, 0], standard(index % 2 ? '#c99b56' : '#4b2529', undefined, 'cloth'));
    stripe.castShadow = false;
  }
  for (const edge of [-1, 1]) {
    for (let index = 0; index < 8; index += 1) {
      const fringe = box(shawl, [0.018, 0.018, 0.13], [-0.35 + index * 0.1, -0.015, edge * 0.52], standard('#c99b56', undefined, 'cloth'));
      fringe.rotation.x = edge * 0.16;
    }
  }
  parent.add(shawl);
  return shawl;
}

function addEvidenceKnife(parent: THREE.Object3D): THREE.Group {
  const knife = new THREE.Group();
  const blade = box(knife, [0.055, 0.32, 0.025], [0, 0.18, 0], standard('#b9bdba', 0.24, 'metal'));
  blade.rotation.z = -0.08;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.18, 12), standard('#33231c', undefined, 'wood'));
  handle.position.y = -0.08;
  knife.add(handle);
  parent.add(knife);
  return knife;
}

type PersonOptions = { child?: boolean; feminine?: boolean; facialHair?: boolean; blush?: boolean; motion?: ActorMotion; phase?: number };

function addPerson(
  parent: THREE.Object3D,
  position: THREE.Vector3,
  colors: [string, string],
  scale = 1,
  options: PersonOptions = {},
  actors?: ActorRig[],
): THREE.Group {
  const person = new THREE.Group();
  const robeMaterial = standard(colors[0], undefined, 'cloth');
  const accentMaterial = standard(colors[1], undefined, 'cloth');
  const skinMaterial = standard('#79503a', undefined, 'skin');
  const garmentProfile = [
    new THREE.Vector2(0.35, 0.12),
    new THREE.Vector2(0.4, 0.2),
    new THREE.Vector2(0.34, 0.76),
    new THREE.Vector2(0.27, 1.18),
    new THREE.Vector2(0.31, 1.36),
  ];
  const garment = new THREE.Mesh(new THREE.LatheGeometry(garmentProfile, 24), robeMaterial);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.025, 8, 28), standard('#422b21', undefined, 'cloth'));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.77;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 7, 24, Math.PI * 1.55), accentMaterial);
  collar.rotation.set(Math.PI / 2, 0, 0.72);
  collar.position.set(0, 1.34, 0.08);
  person.add(garment, belt, collar);

  const shoeMaterial = standard('#2e211a', undefined, 'organic');
  const feet: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 8), shoeMaterial);
    shoe.scale.set(0.78, 0.35, 1.25);
    shoe.position.set(side * 0.17, 0.1, 0.09);
    person.add(shoe);
    feet.push(shoe);
  }

  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.34, 1.29, 0.025);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.47, 7, 12), robeMaterial);
    arm.position.set(0, -0.25, 0);
    const hand = new THREE.Group();
    hand.name = 'hand';
    if (options.child) hand.scale.setScalar(0.82);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 10), skinMaterial);
    palm.scale.set(0.85, 1, 0.4);
    hand.add(palm);
    for (let fingerIndex = 0; fingerIndex < 4; fingerIndex += 1) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.045 + (fingerIndex % 3) * 0.007, 4, 8), skinMaterial);
      finger.position.set((fingerIndex - 1.5) * 0.025, -0.075, 0);
      hand.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.017, 0.035, 4, 8), skinMaterial);
    thumb.position.set(side * 0.059, -0.015, 0.008);
    thumb.rotation.z = side * 0.6;
    hand.add(thumb);
    hand.position.set(0, -0.56, 0.07);
    shoulder.rotation.z = side * 0.13;
    shoulder.add(arm, hand);
    person.add(shoulder);
    arms.push(shoulder);
  }

  const headRig = new THREE.Group();
  headRig.position.y = 1.46;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.16, 14), skinMaterial);
  neck.position.y = -0.06;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 18), skinMaterial);
  head.scale.set(0.88, 1.13, 0.9);
  head.position.y = 0.16;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.047, 12, 9), skinMaterial);
  nose.scale.set(0.64, 1.02, 1.42);
  nose.position.set(0, 0.16, 0.177);
  const eyeMaterial = standard('#211916', 0.62, 'organic');
  const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), eyeMaterial);
  leftEye.position.set(-0.061, 0.22, 0.174);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.07;
  const mouth = box(headRig, [0.075, 0.012, 0.012], [0, 0.09, 0.18], standard('#4d2924', undefined, 'organic'));
  mouth.castShadow = false;
  const blush = options.blush ? [-1, 1].map((side) => {
    const material = new THREE.MeshBasicMaterial({ color: '#c85e68', transparent: true, opacity: 0, depthWrite: false });
    const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.038, 16), material);
    cheek.position.set(side * 0.105, 0.13, 0.181);
    cheek.scale.set(1.25, 0.62, 1);
    cheek.renderOrder = 2;
    return cheek;
  }) : [];
  headRig.add(neck, head, nose, leftEye, rightEye, ...blush);
  person.add(headRig);

  if (options.feminine) {
    const scarf = new THREE.Mesh(new THREE.SphereGeometry(0.205, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), accentMaterial);
    scarf.position.y = 0.32;
    const veil = box(headRig, [0.36, 0.52, 0.045], [0, 0.09, -0.14], accentMaterial);
    veil.rotation.x = -0.08;
    headRig.add(scarf);
  } else {
    const turban = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.055, 10, 30), accentMaterial);
    turban.rotation.x = Math.PI / 2;
    turban.position.y = 0.34;
    const turbanCap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), accentMaterial);
    turbanCap.position.y = 0.34;
    headRig.add(turban, turbanCap);
  }

  if (options.facialHair) {
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 10), standard('#30221c', undefined, 'organic'));
    beard.scale.set(0.9, 0.78, 0.28);
    beard.position.set(0, 0.07, 0.17);
    headRig.add(beard);
  }

  const scarfTail = box(person, [0.13, 0.58, 0.035], [-0.18, 1.14, 0.25], accentMaterial);
  scarfTail.rotation.z = 0.08;
  person.position.copy(position);
  person.scale.setScalar(scale);
  person.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  parent.add(person);
  const rig: ActorRig = {
    root: person,
    head: headRig,
    leftArm: arms[0],
    rightArm: arms[1],
    leftFoot: feet[0],
    rightFoot: feet[1],
    garment,
    mouth,
    blush,
    scarf: scarfTail,
    basePosition: position.clone(),
    phase: options.phase ?? position.x * 0.7 + position.z * 0.13,
    motion: options.motion ?? (options.child ? 'child' : 'reserved'),
  };
  person.userData.actorRig = rig;
  actors?.push(rig);
  return person;
}

function addArch(parent: THREE.Object3D, z: number, material: THREE.Material): void {
  box(parent, [1.5, 3.2, 0.45], [-3.5, 1.6, z], material);
  box(parent, [1.5, 3.2, 0.45], [3.5, 1.6, z], material);
  box(parent, [5.5, 1.1, 0.45], [0, 3.25, z], material);
}

function addWindow(parent: THREE.Object3D, x: number, y: number, z: number, side: -1 | 1): void {
  detailBlocks(parent, standard('#241d19', undefined, 'wood'), [
    { size: [0.08, 1.15, 0.9], at: [x, y, z] },
  ], 'window-recesses');
  const shutterMaterial = standard(side < 0 ? '#33444a' : '#71372b', undefined, 'wood');
  detailBlocks(parent, shutterMaterial, [
    { size: [0.1, 1.25, 0.38], at: [x - side * 0.12, y, z - 0.64], pitch: 0.08 },
    { size: [0.1, 1.25, 0.38], at: [x - side * 0.12, y, z + 0.64], pitch: -0.08 },
  ], `window-shutters-${side}`);
  const trim: DetailBlock[] = [
    { size: [0.19, 0.12, 1.16], at: [-side * 0.04, -0.64, 0] },
    { size: [0.14, 0.11, 1.12], at: [-side * 0.02, 0.64, 0] },
    { size: [0.12, 1.28, 0.08], at: [-side * 0.02, 0, -0.51] },
    { size: [0.12, 1.28, 0.08], at: [-side * 0.02, 0, 0.51] },
    { size: [0.12, 1.12, 0.035], at: [-side * 0.07, 0, 0] },
  ];
  const worldBlocks = (blocks: DetailBlock[]): DetailBlock[] => blocks.map(block => ({
    ...block, at: [block.at[0] + x, block.at[1] + y, block.at[2] + z],
  }));
  detailBlocks(parent, standard('#b29a7b', undefined, 'stone'), worldBlocks(trim), 'window-sill-and-reveal');
  const slats: DetailBlock[] = [];
  for (const shutterZ of [-0.64, 0.64]) {
    for (let i = 0; i < 7; i += 1) {
      slats.push({ size: [0.04, 0.035, 0.33], at: [-side * 0.185, -0.47 + i * 0.155, shutterZ] });
    }
  }
  detailBlocks(parent, standard('#45382d', undefined, 'wood'), worldBlocks(slats), 'shutter-louvres');
}

function addDoorway(parent: THREE.Object3D, x: number, z: number, side: -1 | 1): void {
  const darkWood = standard('#39251d', undefined, 'wood');
  box(parent, [0.09, 2.3, 1.18], [x, 1.15, z], standard('#211a17', undefined, 'wood'));
  box(parent, [0.13, 2.5, 0.13], [x - side * 0.04, 1.25, z - 0.7], darkWood);
  box(parent, [0.13, 2.5, 0.13], [x - side * 0.04, 1.25, z + 0.7], darkWood);
  box(parent, [0.13, 0.15, 1.52], [x - side * 0.04, 2.47, z], darkWood);
  const threshold = box(parent, [0.55, 0.13, 1.5], [x - side * 0.28, 0.07, z], standard('#695140', undefined, 'stone'));
  threshold.castShadow = false;
}

function addBalcony(parent: THREE.Object3D, x: number, z: number, side: -1 | 1): void {
  const timber = standard('#4d3022', undefined, 'wood');
  box(parent, [0.8, 0.12, 2.15], [x - side * 0.34, 2.72, z], timber);
  for (const offset of [-0.86, -0.43, 0, 0.43, 0.86]) {
    box(parent, [0.08, 0.8, 0.08], [x - side * 0.7, 3.08, z + offset], timber);
  }
  box(parent, [0.09, 0.1, 2.1], [x - side * 0.7, 3.45, z], timber);
}

function addPot(parent: THREE.Object3D, x: number, z: number, color = '#845038', scale = 1): void {
  const pot = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), standard(color, undefined, 'ceramic'));
  body.scale.set(1, 0.82, 1);
  body.position.y = 0.29;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.22, 16), standard(color, undefined, 'ceramic'));
  neck.position.y = 0.62;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 20), standard('#3e291f', undefined, 'ceramic'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.74;
  pot.add(body, neck, rim);
  pot.position.set(x, 0, z);
  pot.scale.setScalar(scale);
  pot.traverse((child) => { if (child instanceof THREE.Mesh) child.castShadow = true; });
  parent.add(pot);
}

function addSack(parent: THREE.Object3D, x: number, z: number, color: string, scale = 1): void {
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), standard(color, undefined, 'cloth'));
  sack.scale.set(0.8 * scale, 1.15 * scale, 0.68 * scale);
  sack.position.set(x, 0.42 * scale, z);
  sack.castShadow = true;
  parent.add(sack);
}

function addReflectionBody(root: THREE.Group): THREE.Group {
  const body = addPerson(
    root,
    new THREE.Vector3(0, 0, 0),
    ['#5b4130', '#87684c'],
    0.62,
    { facialHair: true, motion: 'reserved' },
  );

  const patchMaterial = standard('#7d5e45', undefined, 'cloth');
  const stitchMaterial = new THREE.LineBasicMaterial({ color: '#c19d7b' });
  const patch = (width: number, height: number, at: [number, number, number], roll: number): void => {
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(width, height), patchMaterial);
    cloth.position.set(...at);
    cloth.rotation.z = roll;
    const stitches = new THREE.LineSegments(new THREE.EdgesGeometry(cloth.geometry), stitchMaterial);
    stitches.position.z = 0.004;
    cloth.add(stitches);
    body.add(cloth);
  };
  patch(0.15, 0.12, [0.1, 0.42, 0.395], 0.12);
  patch(0.12, 0.1, [-0.09, 0.72, 0.36], -0.18);
  patch(0.1, 0.09, [0.07, 1.02, 0.322], 0.08);

  const sack = new THREE.Group();
  sack.position.set(-0.35, 0.48, 0.05);
  sack.rotation.z = 0.22;
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 14), standard('#87663f', undefined, 'cloth'));
  bag.scale.set(0.78, 1.16, 0.66);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.12, 10), standard('#6b5033', undefined, 'cloth'));
  neck.position.y = 0.31;
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.016, 6, 16), standard('#4a3624', undefined, 'cloth'));
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.37;
  sack.add(bag, neck, tie);
  body.add(sack);

  const strapCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, 1.16, 0.24),
    new THREE.Vector3(0.05, 0.9, 0.37),
    new THREE.Vector3(-0.18, 0.62, 0.33),
    new THREE.Vector3(-0.33, 0.52, 0.2),
  ]);
  const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 12, 0.02, 6, false), standard('#4a3624', undefined, 'cloth'));
  body.add(strap);

  body.name = 'mirror-self';
  body.traverse((child) => {
    child.layers.set(1);
    if (child instanceof THREE.Mesh) child.castShadow = false;
  });
  return body;
}

function addGround(root: THREE.Group, color: string, width = 14, depth = 18): void {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth, 6, 10),
    surfaceMaterial(color, 'stone', 0.97),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
}

function addValleySurroundings(root: THREE.Group, night = false): void {
  const terrain = new THREE.PlaneGeometry(180, 180, 120, 120);
  terrain.rotateX(-Math.PI / 2);
  const positions = terrain.attributes.position;
  const elevation = (x: number, z: number) => {
    const distance = Math.sqrt(x * x + z * z * 0.65);
    const foothills = THREE.MathUtils.smoothstep(distance, 9, 22);
    const angle = Math.atan2(z, x);
    const ridge = 5.5 + Math.sin(angle * 5 + 0.8) * 2.5 + Math.cos(angle * 9) * 1.4;
    const strata = Math.sin(x * 0.21 + z * 0.13) * Math.cos(z * 0.19) * 1.3;
    return -0.09 + foothills * (ridge + strata) * Math.min(distance / 20, 1.7);
  };
  for (let i = 0; i < positions.count; i += 1) {
    positions.setY(i, elevation(positions.getX(i), positions.getZ(i)));
  }
  terrain.computeVertexNormals();
  const valley = new THREE.Mesh(terrain, standard(night ? '#463a30' : '#806047', 1, 'earth'));
  valley.name = 'continuous-mountain-valley';
  valley.receiveShadow = true;
  root.add(valley);
  const stones: DetailBlock[] = [];
  for (let i = 0; i < 24; i += 1) {
    const side = i % 2 ? -1 : 1;
    stones.push({
      size: [0.7 + (i % 3) * 0.23, 0.35 + (i % 4) * 0.12, 0.7],
      at: [side * (6.4 + (i % 3) * 0.7), 0.08, -6 + Math.floor(i / 2) * 1.25],
      roll: Math.sin(i * 2.7) * 0.15,
    });
  }
  detailBlocks(root, standard(night ? '#4b4036' : '#8b7359', 1, 'stone'), stones, 'valley-field-stones');
  if (!night) {
    const houses: DetailBlock[] = [];
    const timber: DetailBlock[] = [];
    const openings: DetailBlock[] = [];
    for (const [x, z, height] of [[9.5, -7, 3.6], [-9.5, 4, 3], [10.2, 6, 2.8], [-8, -12, 3.9]] as const) {
      const base = elevation(x, z);
      houses.push({ size: [4.5, height + 1, 4.2], at: [x, base + (height - 1) / 2, z] });
      timber.push({ size: [4.8, 0.22, 4.5], at: [x, base + height, z] });
      openings.push({ size: [0.7, 0.9, 0.06], at: [x + 1.1, base + height - 1.1, z + 2.13] });
      openings.push({ size: [0.95, 1.8, 0.06], at: [x - 0.6, base + 0.9, z + 2.13] });
    }
    detailBlocks(root, standard('#937050', 1, 'plaster'), houses, 'neighbouring-valley-homes');
    detailBlocks(root, standard('#5f4735', 1, 'wood'), timber, 'valley-house-roofs');
    detailBlocks(root, standard('#332f28', 1, 'wood'), openings, 'valley-house-openings');
  }
}

function addCitySurroundings(root: THREE.Group): void {
  const buildings: DetailBlock[] = [];
  const roofs: DetailBlock[] = [];
  const windows: DetailBlock[] = [];
  const plaster = standard('#9f795a', 1, 'plaster');
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i += 1) {
      const z = -23 + i * 6.3;
      const height = 5.8 + (i % 3) * 1.2;
      const x = side * (9 + (i % 2) * 0.8);
      buildings.push({ size: [7, height, 6.1], at: [x, height / 2, z] });
      roofs.push({ size: [7.3, 0.22, 6.35], at: [x, height, z] });
      for (let floor = 0; floor < 2; floor += 1) {
        for (let column = 0; column < 3; column += 1) {
          windows.push({ size: [0.04, 1.25, 0.65], at: [x - side * 3.52, 2.5 + floor * 2.1, z - 1.8 + column * 1.8] });
        }
      }
    }
  }
  for (const end of [-1, 1]) {
    buildings.push({ size: [12, 7.2, 4], at: [end * 2.5, 3.6, end * 20] });
    roofs.push({ size: [12.3, 0.22, 4.3], at: [end * 2.5, 7.2, end * 20] });
    for (let i = 0; i < 7; i += 1) {
      windows.push({ size: [0.72, 1.35, 0.05], at: [end * 2.5 - 4.6 + i * 1.5, 4.65, end * 17.97] });
    }
  }
  detailBlocks(root, plaster, buildings, 'continuing-city-blocks');
  detailBlocks(root, standard('#b79875', 1, 'stone'), roofs, 'distant-city-parapets');
  detailBlocks(root, standard('#3f4540', 1, 'wood'), windows, 'distant-city-shutters');
}

function addCollider(colliders: WorldCollider[], label: string, x: number, z: number, width: number, depth: number): void {
  colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2, label });
}

function addMudCourtyard(root: THREE.Group): void {
  const geometry = new THREE.PlaneGeometry(12, 13, 48, 52);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    positions.setZ(i, -0.018 + Math.sin(positions.getX(i) * 1.7) * Math.cos(positions.getY(i) * 1.3) * 0.012);
  }
  geometry.computeVertexNormals();
  const earth = new THREE.Mesh(geometry, standard('#806047', undefined, 'earth'));
  earth.name = 'continuous-courtyard-earth';
  earth.rotation.x = -Math.PI / 2;
  earth.receiveShadow = true;
  root.add(earth);
  for (let index = 0; index < 14; index += 1) {
    const straw = box(root, [0.025, 0.014, 0.48], [-4.6 + (index * 1.37) % 9.1, 0.025, -3.8 + (index * 1.91) % 7.4], standard('#a57a43', 1, 'organic'));
    straw.rotation.y = index * 0.83;
    straw.castShadow = false;
  }
}

function addDust(parent: THREE.Object3D, ambient: AmbientRig[], color: string, count: number, width: number, depth: number): void {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const seed = Math.sin((i + 1) * 91.733) * 43758.5453;
    const seed2 = Math.sin((i + 7) * 47.231) * 12731.883;
    const seed3 = Math.sin((i + 13) * 23.117) * 31821.119;
    positions[i * 3] = (seed - Math.floor(seed) - 0.5) * width;
    positions[i * 3 + 1] = 0.25 + (seed2 - Math.floor(seed2)) * 3.5;
    positions[i * 3 + 2] = (seed3 - Math.floor(seed3) - 0.5) * depth;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(geometry, new THREE.PointsMaterial({
    color,
    map: getDustTexture(),
    alphaMap: getDustTexture(),
    size: 0.02,
    transparent: true,
    opacity: 0.28,
    alphaTest: 0.04,
    depthWrite: false,
    sizeAttenuation: true,
  }));
  parent.add(dust);
  ambient.push({ object: dust, baseRotation: dust.rotation.clone(), phase: 0.8, amount: 0.025, speed: 0.18, axis: 'y' });
}

function homeWorld(): World {
  const root = new THREE.Group();
  const interactions: WorldInteraction[] = [];
  const actors: ActorRig[] = [];
  const ambient: AmbientRig[] = [];
  const colliders: WorldCollider[] = [];
  addDust(root, ambient, '#e0b57d', 36, 10, 10);
  addValleySurroundings(root);
  addMudCourtyard(root);

  const wall = standard('#8b6245', 1, 'plaster');
  box(root, [11.2, 4.25, 0.48], [0, 2.12, -5.72], wall);
  box(root, [0.45, 3.1, 4.8], [-5.38, 1.55, -3.52], standard('#694834', 1, 'plaster'));
  addCollider(colliders, 'house wall', 0, -5.72, 11.2, 0.55);
  addCollider(colliders, 'side wall', -5.38, -3.52, 0.55, 4.8);
  const door = box(root, [1.72, 2.75, 0.16], [0.45, 1.38, -5.42], standard('#26353b', undefined, 'wood'));
  door.rotation.z = -0.025;
  interactions.push({ id: 'leave-home', label: 'Leave for Calcutta', position: door.position.clone(), object: door });
  box(root, [2.15, 0.18, 0.28], [0.45, 2.84, -5.28], standard('#3c2920', undefined, 'wood')).rotation.z = -0.035;
  for (let index = 0; index < 10; index += 1) {
    const brick = box(root, [0.52, 0.24, 0.06], [-4.55 + (index % 3) * 0.55, 0.72 + Math.floor(index / 3) * 0.28, -5.43], standard(index % 2 ? '#8c4931' : '#70402e', 1, 'stone'));
    brick.rotation.z = (index % 3 - 1) * 0.025;
  }
  for (const [x, y] of [[3.8, 2.8], [-2.2, 3.2], [2.45, 1.35]] as const) {
    for (let segment = 0; segment < 5; segment += 1) {
      const crack = box(root, [0.009, 0.14, 0.004], [x + Math.sin(segment * 1.5) * 0.035, y - segment * 0.12, -5.477], standard('#5d4232', 1, 'plaster'));
      crack.rotation.z = Math.cos(segment * 1.5) * 0.45;
      crack.castShadow = false;
    }
  }
  const roofMaterial = standard('#493126', 1, 'wood');
  box(root, [11.5, 0.22, 2.3], [0, 4.48, -5.25], standard('#75533d', 1, 'earth'));
  for (let index = 0; index < 12; index += 1) {
    const beam = box(root, [0.34, 0.12, 2.05], [-5.05 + index * 0.92, 4.35 + (index % 3) * 0.045, -5.2], roofMaterial);
    beam.rotation.x = -0.13;
    beam.rotation.z = (index % 4 - 1.5) * 0.012;
  }
  box(root, [4.8, 0.12, 1.72], [-1.8, 2.55, -4.78], standard('#765036', 1, 'wood')).rotation.x = -0.08;
  for (const x of [-3.9, 0.3]) box(root, [0.16, 2.6, 0.16], [x, 1.3, -4.05], roofMaterial);

  box(root, [2.55, 0.14, 1.55], [0, 0.45, -1.15], standard(palette.timber, undefined, 'wood'));
  for (const x of [-1.05, 1.05]) for (const z of [-1.65, -0.65]) box(root, [0.14, 0.44, 0.14], [x, 0.22, z], roofMaterial);
  addCollider(colliders, 'low work table', 0, -1.15, 2.65, 1.65);
  const paper = box(root, [0.56, 0.025, 0.68], [-0.88, 0.54, -0.98], standard(palette.paper, undefined, 'paper'));
  interactions.push({ id: 'make-print', label: 'Make Parvati’s soot handprint on the paper', position: paper.position.clone(), object: paper });
  const sootBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.12, 22), standard('#3b2a20', 1, 'ceramic'));
  sootBowl.position.set(-0.94, 0.55, -1.6);
  root.add(sootBowl);
  const soot = new THREE.Mesh(new THREE.CircleGeometry(0.19, 20), standard('#25262a', 1, 'organic'));
  soot.rotation.x = -Math.PI / 2;
  soot.position.set(-0.94, 0.615, -1.6);
  root.add(soot);
  const child = addPerson(root, new THREE.Vector3(-1.55, 0, -1.15), ['#a85337', '#d3bd86'], 0.72, { child: true, feminine: true, motion: 'child' }, actors);
  const imprint = new THREE.Group();
  const sootPrintMaterial = standard('#25262a', 1, 'organic');
  const palm = new THREE.Mesh(new THREE.CircleGeometry(0.065, 24), sootPrintMaterial);
  palm.scale.y = 1.2;
  imprint.add(palm);
  for (let i = 0; i < 5; i += 1) {
    const finger = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), sootPrintMaterial);
    finger.scale.y = i === 4 ? 1.7 : 2.5;
    finger.position.set(i === 4 ? -0.075 : (i - 1.5) * 0.032, i === 4 ? 0.015 : 0.085, 0);
    imprint.add(finger);
  }
  imprint.rotation.x = -Math.PI / 2;
  imprint.position.set(-0.98, 0.554, -1.08);
  imprint.scale.setScalar(0.68);
  imprint.visible = false;
  root.add(imprint);
  interactions.push({ id: 'daughter', label: 'Kneel beside your daughter', position: child.position.clone(), object: child });
  box(root, [2.1, 0.7, 1.2], [3.65, 0.35, -3.8], standard('#775038', undefined, 'wood'));
  addCollider(colliders, 'storage chest', 3.65, -3.8, 2.2, 1.3);
  box(root, [1.3, 0.38, 0.9], [3.65, 0.9, -3.8], standard(palette.cloth, undefined, 'cloth'));
  box(root, [2, 0.018, 2.8], [-1.8, 0.014, 1.2], standard('#60382c', undefined, 'cloth'));
  for (let i = 0; i < 7; i += 1) {
    box(root, [0.14, 0.008, 2.7], [-2.7 + i * 0.3, 0.028, 1.2], standard(i % 2 ? '#92382c' : '#c7893f', undefined, 'cloth'));
  }
  addPot(root, -4.5, -4.3, '#80513b', 1.1);
  addPot(root, 4.65, -4.45, '#9b6240', 0.8);
  addCollider(colliders, 'large water pot', -4.5, -4.3, 0.8, 0.8);
  box(root, [3.4, 0.12, 0.5], [-3.6, 1.35, -5.65], standard('#523527', undefined, 'wood'));
  for (let i = 0; i < 4; i += 1) addSack(root, 2.7 + i * 0.55, -4.7 + (i % 2) * 0.35, i % 2 ? '#8b6947' : '#a17a50', 0.7);
  const bindings: DetailBlock[] = [];
  for (const x of [2.9, 4.4]) {
    bindings.push({ size: [0.055, 0.65, 0.035], at: [x, 0.35, -3.183] });
    bindings.push({ size: [0.055, 0.035, 1.22], at: [x, 0.717, -3.8] });
  }
  bindings.push({ size: [0.12, 0.18, 0.05], at: [3.65, 0.51, -3.17] });
  detailBlocks(root, standard('#342c26', 0.65, 'metal'), bindings, 'chest-straps-and-latch');
  const doorJoinery: DetailBlock[] = [];
  for (let i = 0; i < 6; i += 1) doorJoinery.push({ size: [0.013, 2.6, 0.018], at: [-0.24 + i * 0.27, 1.38, -5.321] });
  for (const y of [0.45, 2.25]) doorJoinery.push({ size: [1.55, 0.09, 0.06], at: [0.45, y, -5.3] });
  detailBlocks(root, standard('#26302d', undefined, 'wood'), doorJoinery, 'repaired-door-joinery');
  const shelfGoods: DetailBlock[] = [];
  for (let i = 0; i < 4; i += 1) shelfGoods.push({ size: [0.45, 0.085, 0.34], at: [-3.5, 1.47 + i * 0.085, -5.43], roll: (i % 2) * 0.025 });
  detailBlocks(root, standard('#b19970', undefined, 'cloth'), shelfGoods, 'folded-household-linen');
  const broom = new THREE.Group();
  const broomSticks: DetailBlock[] = [];
  for (let i = 0; i < 13; i += 1) broomSticks.push({ size: [0.018, 0.6, 0.018], at: [(i - 6) * 0.018, 0.3, Math.sin(i * 2) * 0.035], roll: (i - 6) * 0.023 });
  broomSticks.push({ size: [0.035, 0.95, 0.035], at: [0, 0.97, 0] });
  detailBlocks(broom, standard('#947449', undefined, 'wood'), broomSticks, 'bound-reed-broom');
  broom.position.set(-4.85, 0.04, -5.05);
  broom.rotation.z = -0.18;
  root.add(broom);
  return { root, interactions, actors, ambient, colliders, story: { imprint, paper }, spawn: new THREE.Vector3(0, 0, 4.5), yaw: Math.PI, bounds: new THREE.Box2(new THREE.Vector2(-5.1, -5.15), new THREE.Vector2(5.1, 5.65)) };
}

function streetWorld(wedding: boolean): World {
  const root = new THREE.Group();
  const interactions: WorldInteraction[] = [];
  const actors: ActorRig[] = [];
  const ambient: AmbientRig[] = [];
  const colliders: WorldCollider[] = [];
  addDust(root, ambient, wedding ? '#f2d19a' : '#d6ad79', 62, 7, 24);
  addGround(root, wedding ? '#8a715d' : '#796047', 120, 120);
  addCitySurroundings(root);
  const left = standard(wedding ? '#b88f6c' : palette.plaster);
  const right = standard(wedding ? '#c5a27c' : palette.plasterLight);
  for (const side of [-1, 1]) {
    const material = side < 0 ? left : right;
    box(root, [3.1, 5.3, 4.2], [side * 5.5, 2.65, -8], material);
    box(root, [3.1, 4.2, 4.2], [side * 5.5, 2.1, -2.4], material);
    box(root, [3.1, 5.7, 4.2], [side * 5.5, 2.85, 3.2], material);
  }
  addCollider(colliders, 'west buildings', -4.9, -2, 2.7, 21);
  addCollider(colliders, 'east buildings', 4.9, -2, 2.7, 21);
  for (const side of [-1, 1] as const) {
    for (const z of [-8.7, -3.1, 2.5]) {
      addWindow(root, side * 3.93, 3.45 + ((z + 9) % 2) * 0.24, z, side);
    }
    addDoorway(root, side * 3.93, -7.6, side);
    addDoorway(root, side * 3.93, 3.7, side);
    addBalcony(root, side * 3.93, -2.2, side);
  }
  const cornices: DetailBlock[] = [];
  const masonry: DetailBlock[] = [];
  for (const side of [-1, 1]) {
    for (const [z, height] of [[-8, 5.3], [-2.4, 4.2], [3.2, 5.7]]) {
      cornices.push({ size: [0.26, 0.16, 4.38], at: [side * 3.92, height - 0.12, z] });
      cornices.push({ size: [0.17, 0.11, 4.3], at: [side * 3.94, 2.86, z] });
      cornices.push({ size: [0.19, 0.28, 4.22], at: [side * 3.92, 0.18, z] });
      for (let row = 0; row < 5; row += 1) {
        masonry.push({ size: [0.055, 0.15, 0.34], at: [side * 3.91, 0.46 + row * 0.19, z - 1.52 + (row % 2) * 0.18] });
      }
    }
  }
  detailBlocks(root, standard('#aa8a65', undefined, 'stone'), cornices, 'street-cornices-and-plinths');
  detailBlocks(root, standard('#815039', undefined, 'stone'), masonry, 'exposed-brick-repairs');
  const clothesline = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-3.9, 4.15, 1.3), new THREE.Vector3(0, 3.78, 1.3), new THREE.Vector3(3.9, 4.15, 1.3),
  ]);
  root.add(new THREE.Mesh(new THREE.TubeGeometry(clothesline, 20, 0.012, 4, false), standard('#473a2b', undefined, 'organic')));
  for (let i = 0; i < 3; i += 1) {
    const linen = box(root, [0.65, 0.7 + i * 0.12, 0.016], [-1.7 + i * 1.25, 3.5, 1.3], standard(i === 1 ? '#6b7373' : '#b4a891', undefined, 'cloth'));
    linen.rotation.z = 0.04 * (i - 1);
    ambient.push({ object: linen, baseRotation: linen.rotation.clone(), phase: i, amount: 0.035, speed: 0.7, axis: 'x' });
  }
  addArch(root, -11.5, standard(palette.plasterDark));
  for (const z of [-8, -2.4, 3.2]) {
    for (const side of [-1, 1]) {
      const awning = box(root, [2.9, 0.12, 1.5], [side * 3.9, 2.55, z], standard(side < 0 ? palette.cloth : palette.indigo, undefined, 'cloth'));
      awning.rotation.x = side * 0.12;
      ambient.push({ object: awning, baseRotation: awning.rotation.clone(), phase: z * 0.34 + side, amount: 0.018, speed: 1.1, axis: 'z' });
    }
  }
  const mini = addPerson(root, new THREE.Vector3(2.35, 0, -6.1), wedding ? ['#9f2827', '#e3bd55'] : ['#d4813f', '#efe0b7'], wedding ? 1 : 0.7, { child: !wedding, feminine: true, blush: wedding, motion: wedding ? 'reserved' : 'friendly' }, actors);
  mini.visible = !wedding;
  if (wedding) {
    const sandal = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16), standard('#e5cba0', 1, 'organic'));
    sandal.position.set(0, 0.285, 0.151);
    (mini.userData.actorRig as ActorRig).head.add(sandal);
  }
  interactions.push({ id: wedding ? 'grown-mini' : 'mini', label: wedding ? 'Try the old joke' : 'Listen to Mini', position: mini.position.clone(), object: mini });
  const father = addPerson(root, wedding ? new THREE.Vector3(-2.2, 0, -7) : new THREE.Vector3(3.1, 0, -7.25), ['#ded3bd', '#6d4531'], 1.02, { facialHair: true, motion: 'reserved' }, actors);
  if (wedding) interactions.push({ id: 'father', label: 'Speak to Mini’s father', position: father.position.clone(), object: father });
  if (!wedding) {
    box(root, [3.1, 1, 1.4], [-2.8, 0.5, -0.3], standard('#62412c', undefined, 'wood'));
    box(root, [2.6, 0.15, 1], [-2.8, 1.1, -0.3], standard('#b48346', undefined, 'wood'));
    addCollider(colliders, 'market stall', -2.8, -0.3, 2.8, 1.55);
    const customer = addPerson(root, new THREE.Vector3(-1.45, 0, -1.35), ['#6f5543', '#be945f'], 0.96, { facialHair: true, motion: 'reserved', phase: 0.6 }, actors);
    interactions.push({ id: 'sale', label: 'Speak with the customer', position: customer.position.clone(), object: customer });
    for (let i = 0; i < 3; i += 1) {
      const x = -3.65 + i * 0.75;
      box(root, [0.67, 0.05, 0.72], [x, 1.21, -0.3], standard('#805b36', undefined, 'wood'));
      const fruit = driedFruit(65, 0.29);
      fruit.position.set(x, 1.25, -0.3);
      root.add(fruit);
    }
    addSack(root, -2.1, 0.65, '#ad8758', 1.1);
    addSack(root, -1.5, 0.85, '#8d6b49', 0.78);
    addPot(root, 3.2, 3.6, '#8d4e32', 0.9);
    addPot(root, -3.1, -4.2, '#77442f', 0.75);
    const onlooker = addPerson(root, new THREE.Vector3(3.2, 0, 0.8), ['#5c4d42', '#302b27'], 0.96, { facialHair: true, motion: 'tense' }, actors);
    interactions.push({ id: 'suspicion', label: 'Meet the onlooker’s gaze', position: onlooker.position.clone(), object: onlooker });

    const porter = addPerson(root, new THREE.Vector3(-1.25, 0, 1.5), ['#75604b', '#b69261'], 0.92, { facialHair: true, motion: 'walker', phase: 1.7 }, actors);
    actors[actors.length - 1].path = {
      from: new THREE.Vector3(-1.25, 0, 1.5),
      to: new THREE.Vector3(-1.25, 0, -9.4),
      duration: 10.5,
    };
    porter.userData.ambientActor = true;
  } else {
    for (let i = 0; i < 9; i += 1) {
      const thread = box(root, [0.035, 0.035, 8], [-3.2 + i * 0.8, 3.7 + (i % 2) * 0.18, -5], standard(i % 2 ? palette.gold : palette.cloth, undefined, 'cloth'));
      thread.rotation.z = (i - 4) * 0.015;
    }
    const canopyMaterial = standard(palette.white, undefined, 'cloth');
    canopyMaterial.transparent = true;
    canopyMaterial.opacity = 0.88;
    box(root, [6.4, 0.08, 5], [0, 3.85, -7], canopyMaterial);
    for (let i = 0; i < 7; i += 1) {
      const lantern = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.12, 10), standard('#6d2d24', undefined, 'metal'));
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 10, 8),
        new THREE.MeshStandardMaterial({ color: i % 2 ? '#d69c3e' : '#a93d2f', emissive: i % 2 ? '#7a4315' : '#54140f', emissiveIntensity: 0.35, roughness: 0.7 }),
      );
      body.scale.y = 1.35;
      body.position.y = -0.22;
      lantern.add(cap, body);
      lantern.position.set(-2.7 + i * 0.9, 3.45, -8.2 + (i % 2) * 1.6);
      root.add(lantern);
      ambient.push({ object: lantern, baseRotation: lantern.rotation.clone(), phase: i * 0.73, amount: 0.065, speed: 1.25, axis: 'z' });
    }

    const marigold = standard('#e29b28', undefined, 'organic');
    const flowerGeometry = new THREE.SphereGeometry(0.055, 8, 6);
    const flowers = new THREE.InstancedMesh(flowerGeometry, marigold, 68);
    const flowerMatrix = new THREE.Matrix4();
    for (let index = 0; index < 68; index += 1) {
      const row = index < 34 ? 0 : 1;
      const local = index % 34;
      flowerMatrix.makeScale(1, 0.72, 1);
      flowerMatrix.setPosition(-3.1 + local * 0.188, 2.72 + row * 0.34 + Math.sin(local * 1.8) * 0.04, -5.05 - row * 0.06);
      flowers.setMatrixAt(index, flowerMatrix);
    }
    flowers.castShadow = true;
    root.add(flowers);

    for (const x of [-2.45, 2.45]) {
      box(root, [0.16, 2.7, 0.16], [x, 1.35, -7.7], standard('#7c392c', undefined, 'wood'));
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 18), standard('#b68137', 0.35, 'metal'));
      lamp.position.set(x, 0.22, -5.2);
      root.add(lamp);
    }
    box(root, [4.6, 0.28, 2.8], [0, 0.14, -8.05], standard('#8b2f2d', undefined, 'cloth'));
    addCollider(colliders, 'wedding dais', 0, -8.05, 4.7, 2.9);
    box(root, [2.2, 0.78, 0.72], [0, 0.56, -8.8], standard('#b98943', undefined, 'wood'));
    box(root, [1.85, 0.14, 0.72], [0, 0.99, -8.8], standard('#d5b06a', undefined, 'cloth'));
    const guest = addPerson(root, new THREE.Vector3(-2.85, 0, 1.4), ['#36586a', '#d2a64c'], 0.96, { feminine: true, motion: 'friendly', phase: 0.4 }, actors);
    interactions.push({ id: 'wedding-guest', label: 'Speak with a wedding guest', position: guest.position.clone(), object: guest });
    const musician = addPerson(root, new THREE.Vector3(-2.75, 0, -3.45), ['#71402f', '#e0c480'], 0.96, { facialHair: true, motion: 'friendly', phase: 1.2 }, actors);
    interactions.push({ id: 'musician', label: 'Listen to the wedding musician', position: musician.position.clone(), object: musician });
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.31, 0.6, 18), standard('#8b4e2f', undefined, 'wood'));
    drum.rotation.z = Math.PI / 2;
    drum.position.set(-2.4, 0.92, -3.28);
    root.add(drum);
    const petalGeometry = new THREE.CircleGeometry(0.045, 7);
    petalGeometry.rotateX(-Math.PI / 2);
    const petals = new THREE.InstancedMesh(petalGeometry, standard('#cf6530', undefined, 'organic'), 22);
    const petalMatrix = new THREE.Matrix4();
    for (let index = 0; index < 22; index += 1) {
      petalMatrix.compose(
        new THREE.Vector3(-2.6 + (index * 1.27) % 5.2, 0.025, -4.1 - (index * 0.79) % 4.5),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, index * 0.71, 0)),
        new THREE.Vector3(0.78 + (index % 3) * 0.24, 1, 0.72 + (index % 2) * 0.3),
      );
      petals.setMatrixAt(index, petalMatrix);
    }
    root.add(petals);
  }
  for (let i = 0; i < 9; i += 1) {
    const seam = box(root, [6.8, 0.012, 0.035], [0, 0.014, 7.4 - i * 2.05], standard('#5a4636'));
    seam.rotation.y = (i % 3 - 1) * 0.025;
  }
  return { root, interactions, actors, ambient, colliders, spawn: new THREE.Vector3(0, 0, 6.5), yaw: Math.PI, bounds: new THREE.Box2(new THREE.Vector2(-3.5, -10.5), new THREE.Vector2(3.5, 8.5)), story: { mini, father } };
}

function debtWorld(): World {
  const world = streetWorld(false);
  const father = world.story?.father;
  for (const item of [...world.interactions]) world.root.remove(item.object);
  world.interactions.length = 0;
  world.actors.splice(0, world.actors.length, ...world.actors.filter((actor) => actor.root.parent === world.root));
  const debtor = addPerson(world.root, new THREE.Vector3(0, 0, -4.5), ['#4d5660', '#2d3136'], 1, { facialHair: true, motion: 'tense' }, world.actors);
  const shawl = addShawl((debtor.userData.actorRig as ActorRig).rightArm);
  shawl.position.set(0, -0.91, 0.1);
  shawl.rotation.set(Math.PI / 2, 0, 0);
  shawl.scale.setScalar(0.75);
  const bloodPool = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshStandardMaterial({ color: '#501b19', roughness: 0.46, metalness: 0 }),
  );
  bloodPool.geometry.rotateX(-Math.PI / 2);
  bloodPool.position.set(0, 0.022, -4.5);
  bloodPool.scale.set(0.62, 1, 0.42);
  bloodPool.name = 'blood-pool';
  bloodPool.visible = false;
  bloodPool.receiveShadow = true;
  world.root.add(bloodPool);

  const leftPoliceman = addPerson(world.root, new THREE.Vector3(-2.9, 0, -7.1), ['#6e633f', '#28303a'], 1.02, { facialHair: true, motion: 'tense', phase: 0.3 }, world.actors);
  const rightPoliceman = addPerson(world.root, new THREE.Vector3(2.9, 0, -7.1), ['#756842', '#28303a'], 1.02, { facialHair: true, motion: 'tense', phase: 1.2 }, world.actors);
  const mini = addPerson(world.root, new THREE.Vector3(2.35, 0, -5.55), ['#d4813f', '#efe0b7'], 0.7, { child: true, feminine: true, motion: 'child', phase: 2.1 }, world.actors);
  const crowdBoyA = addPerson(world.root, new THREE.Vector3(-3, 0, -7.5), ['#7d5a45', '#b99463'], 0.66, { child: true, motion: 'friendly', phase: 0.9 }, world.actors);
  const crowdBoyB = addPerson(world.root, new THREE.Vector3(2.75, 0, -8.1), ['#59656b', '#9d774c'], 0.7, { child: true, motion: 'friendly', phase: 1.7 }, world.actors);
  const evidenceKnife = addEvidenceKnife((leftPoliceman.userData.actorRig as ActorRig).rightArm);
  evidenceKnife.position.set(0, -0.64, 0.08);
  evidenceKnife.rotation.set(0.15, 0, -0.2);
  leftPoliceman.visible = false;
  rightPoliceman.visible = false;
  mini.visible = false;
  crowdBoyA.visible = false;
  crowdBoyB.visible = false;
  evidenceKnife.visible = false;
  world.interactions.push({ id: 'debtor', label: 'Ask for the money owed', position: debtor.position.clone(), object: debtor });
  world.spawn.set(0, 0, 2.5);
  world.story = { debtor, shawl, bloodPool, leftPoliceman, rightPoliceman, mini, crowdBoyA, crowdBoyB, evidenceKnife, ...(father ? { father } : {}) };
  return world;
}

function classDistanceWorld(): World {
  const root = new THREE.Group();
  const interactions: WorldInteraction[] = [];
  const actors: ActorRig[] = [];
  const ambient: AmbientRig[] = [];
  const colliders: WorldCollider[] = [];
  addGround(root, '#79604b', 15, 26);
  addDust(root, ambient, '#d2ae7a', 52, 11, 22);
  addCitySurroundings(root);

  const residentPalettes: [string, string][] = [
    ['#d5c5a4', '#783d2c'], ['#445e69', '#c29655'],
    ['#7b674f', '#d2aa64'], ['#8a4438', '#d7bd87'],
    ['#486051', '#c6a56c'], ['#66506f', '#d1b77d'],
    ['#bf9d75', '#32434c'], ['#765244', '#b78c55'],
  ];
  const residentPositions = [
    [-2.2, 5.2], [2.15, 4.35], [-2.35, 3.25], [2.45, 2.5],
    [2.2, 0.25], [-2.35, -1.45], [2.5, -2.4], [-2.15, -4.1],
    [2.3, -5.6], [-2.45, -6.75],
  ] as const;
  for (let index = 0; index < residentPositions.length; index += 1) {
    const [x, z] = residentPositions[index];
    const person = addPerson(
      root,
      new THREE.Vector3(x, 0, z),
      residentPalettes[index % residentPalettes.length],
      1.08 + (index % 4) * 0.065,
      {
        facialHair: index % 3 === 0,
        feminine: index % 4 === 1,
        motion: 'reserved',
        phase: index * 0.43,
      },
      actors,
    );
    person.userData.lookDown = true;
    person.userData.trackPlayer = true;
  }

  const marketSpread = new THREE.Group();
  marketSpread.position.set(-2.12, 0, 0.9);
  marketSpread.rotation.y = -0.07;
  root.add(marketSpread);
  const mat = box(marketSpread, [2.25, 0.035, 1.72], [0, 0.025, 0], standard('#8f6841', undefined, 'cloth'));
  mat.castShadow = false;
  const weave: DetailBlock[] = [];
  for (let index = 0; index < 13; index += 1) {
    weave.push({ size: [2.13, 0.009, 0.022], at: [0, 0.05, -0.78 + index * 0.13] });
  }
  detailBlocks(marketSpread, standard('#c99f67', undefined, 'cloth'), weave, 'market-mat-weave');
  for (let index = 0; index < 12; index += 1) {
    const x = -1.02 + index * 0.185;
    box(marketSpread, [0.028, 0.018, 0.18], [x, 0.035, -0.94], standard('#b98b57', undefined, 'cloth')).rotation.x = -0.08;
    box(marketSpread, [0.028, 0.018, 0.18], [x, 0.035, 0.94], standard('#b98b57', undefined, 'cloth')).rotation.x = 0.08;
  }
  for (let index = 0; index < 5; index += 1) {
    const fruit = driedFruit(42, 0.25);
    fruit.position.set(-0.68 + (index % 3) * 0.66, 0.07, -0.34 + Math.floor(index / 3) * 0.72);
    marketSpread.add(fruit);
  }
  addSack(root, -2.82, 1.82, '#72523b', 0.72);
  addPot(root, -2.93, -0.05, '#7b432d', 0.72);
  addCollider(colliders, 'fruit mat', -2.12, 0.9, 2.38, 1.9);
  const awning = box(root, [2.55, 0.08, 1.9], [-2.25, 2.2, 0.9], standard('#6f3c32', undefined, 'cloth'));
  awning.rotation.z = -0.1;
  ambient.push({ object: awning, baseRotation: awning.rotation.clone(), phase: 1.3, amount: 0.018, speed: 0.9, axis: 'x' });
  for (const z of [0.05, 1.75]) {
    box(root, [0.09, 2.2, 0.09], [-1.08, 1.1, z], standard('#4b3426', undefined, 'wood'));
  }

  const facadeColors = ['#8d5739', '#b77d50', '#9c6849', '#c08b5c', '#76513d', '#a96f48'];
  for (const side of [-1, 1] as const) {
    for (let segment = 0; segment < 3; segment += 1) {
      const z = 4.2 - segment * 7;
      const height = 4.5 + ((segment + (side > 0 ? 1 : 0)) % 3) * 0.55;
      box(root, [2.4, height, 6.4], [side * 4.55, height / 2, z], standard(facadeColors[segment + (side > 0 ? 3 : 0)]));
      addWindow(root, side * 3.34, 3.15, z - 1.25, side);
      if (segment !== 1) addDoorway(root, side * 3.34, z + 1.35, side);
      const repairs: DetailBlock[] = [];
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 3; column += 1) {
          repairs.push({
            size: [0.055, 0.16, 0.48],
            at: [side * 3.315, 0.62 + row * 0.18, z - 2.25 + column * 0.5 + (row % 2) * 0.16],
          });
        }
      }
      detailBlocks(root, standard(segment % 2 ? '#77412f' : '#864832', undefined, 'stone'), repairs, `exposed-brick-${side}-${segment}`);
    }
    addCollider(colliders, side < 0 ? 'west facades' : 'east facades', side * 4.55, -2.8, 2.4, 21.8);
  }

  const mirrorFrame = new THREE.Group();
  mirrorFrame.name = 'lane-mirror';
  mirrorFrame.position.set(0, 0, -9.6);
  const frameMaterial = standard('#33261d', 0.78, 'wood');
  box(mirrorFrame, [2.56, 0.26, 0.38], [0, 3.84, 0], frameMaterial);
  box(mirrorFrame, [0.2, 3.9, 0.38], [-1.18, 1.95, 0], frameMaterial);
  box(mirrorFrame, [0.2, 3.9, 0.38], [1.18, 1.95, 0], frameMaterial);
  box(mirrorFrame, [2.56, 0.14, 0.42], [0, 0.07, 0], frameMaterial);
  const mirror = new Reflector(new THREE.PlaneGeometry(2.16, 3.5), {
    clipBias: 0.004,
    textureWidth: 512,
    textureHeight: 832,
    color: 0x939d99,
    multisample: 0,
  });
  mirror.name = 'lane-mirror-glass';
  mirror.position.set(0, 1.92, 0.03);
  mirrorFrame.add(mirror);
  const grime = new THREE.Mesh(
    new THREE.PlaneGeometry(2.16, 3.5),
    new THREE.MeshBasicMaterial({ map: getMirrorGrimeTexture(), transparent: true, depthWrite: false }),
  );
  grime.position.set(0, 1.92, 0.09);
  grime.renderOrder = 2;
  mirrorFrame.add(grime);
  root.add(mirrorFrame);
  const self = addReflectionBody(root);
  const spill = new THREE.PointLight('#ffd7ae', 2.6, 5, 1.4);
  spill.position.set(0.55, 2.1, -8.35);
  spill.layers.set(1);
  root.add(spill);
  addCollider(colliders, 'lane mirror', 0, -9.88, 2.6, 0.8);
  interactions.push({ id: 'class-door', label: 'Cross the threshold', position: new THREE.Vector3(0, 0, -9.5), object: mirrorFrame });
  return {
    root, interactions, actors, ambient, colliders,
    spawn: new THREE.Vector3(0, 0, 6.2), yaw: Math.PI,
    bounds: new THREE.Box2(new THREE.Vector2(-3.05, -10), new THREE.Vector2(3.05, 7)),
    story: { mirror, self },
  };
}

function prisonWorld(): World {
  const root = new THREE.Group();
  const interactions: WorldInteraction[] = [];
  const actors: ActorRig[] = [];
  const ambient: AmbientRig[] = [];
  const colliders: WorldCollider[] = [];
  addDust(root, ambient, '#a9bec6', 42, 6, 7);
  addGround(root, '#303537', 7, 8);
  box(root, [7, 4.8, 0.5], [0, 2.4, -4], standard('#3a4041'));
  box(root, [0.5, 4.8, 8], [-3.5, 2.4, 0], standard('#34393b'));
  box(root, [0.5, 4.8, 8], [3.5, 2.4, 0], standard('#34393b'));
  box(root, [7, 4.8, 0.5], [0, 2.4, 4], standard('#34393b'));
  box(root, [7, 0.25, 8], [0, 4.8, 0], standard('#292e30'));
  const cellDoor = new THREE.Group();
  cellDoor.name = 'prison-door';
  cellDoor.position.set(0.55, 0, 3.68);
  root.add(cellDoor);
  box(cellDoor, [1.5, 2.65, 0.12], [0.75, 1.325, 0], standard('#202728', 0.7, 'metal'));
  const prisonHandle = new THREE.Group();
  prisonHandle.name = 'prison-door-handle';
  prisonHandle.position.set(1.13, 1.2, -0.12);
  cellDoor.add(prisonHandle);
  box(prisonHandle, [0.45, 0.08, 0.1], [0, 0, 0], standard('#756e5d', 0.7, 'metal'));
  detailBlocks(root, standard('#111719', undefined, 'metal'), [
    { size: [1.65, 0.12, 0.18], at: [1.3, 2.7, 3.6] },
    { size: [0.1, 2.7, 0.18], at: [0.5, 1.35, 3.6] },
    { size: [0.1, 2.7, 0.18], at: [2.1, 1.35, 3.6] },
  ], 'prison-door-frame-and-bolt');
  interactions.push({ id: 'prison-door', label: 'Try the locked door', position: new THREE.Vector3(1.3, 0, 3.68), object: cellDoor });
  const windowFrame = new THREE.Group();
  windowFrame.position.set(0, 2.75, -3.68);
  root.add(windowFrame);
  detailBlocks(windowFrame, standard('#202629', undefined, 'stone'), [
    { size: [1.95, 0.18, 0.24], at: [0, -0.88, 0] },
    { size: [1.95, 0.18, 0.24], at: [0, 0.88, 0] },
    { size: [0.18, 1.62, 0.24], at: [-0.88, 0, 0] },
    { size: [0.18, 1.62, 0.24], at: [0.88, 0, 0] },
  ], 'deep-prison-window-reveal');
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 1.55),
    new THREE.MeshBasicMaterial({ color: '#101827' }),
  );
  sky.position.set(0, 2.75, -3.69);
  root.add(sky);
  for (const x of [-0.58, 0, 0.58]) box(root, [0.09, 1.65, 0.16], [x, 2.75, -3.55], standard('#111719', undefined, 'metal'));
  interactions.push({ id: 'window', label: 'Look through the barred window', position: windowFrame.position.clone(), object: windowFrame });
  const bench = box(root, [2.4, 0.3, 0.9], [-1.4, 0.3, 1.7], standard('#4b4035', undefined, 'wood'));
  interactions.push({ id: 'prison-bench', label: 'Sit on the narrow bench', position: bench.position.clone(), object: bench });
  addCollider(colliders, 'prison bench', -1.4, 1.7, 2.5, 1);
  const prisonStone: DetailBlock[] = [];
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const x = -3 + column * 0.95 + (row % 2) * 0.24;
      if (Math.abs(x) < 1.25 && row > 1 && row < 5) continue;
      prisonStone.push({ size: [0.87, 0.035, 0.025], at: [x, 0.22 + row * 0.7, -3.737] });
    }
  }
  detailBlocks(root, standard('#282e30', undefined, 'stone'), prisonStone, 'prison-mortar-joints');
  const blanket = box(root, [1.7, 0.045, 0.72], [-1.45, 0.475, 1.7], standard('#63605a', undefined, 'cloth'));
  blanket.rotation.y = 0.025;
  const moon = new THREE.PointLight('#8092bc', 2, 8, 2);
  moon.position.set(0, 2.7, -3);
  root.add(moon);
  for (let i = 0; i < 8; i += 1) {
    const mark = box(root, [0.018, 0.48, 0.035], [3.22, 1.15 + (i % 4) * 0.12, -0.8 + Math.floor(i / 4) * 0.4], standard('#798083'));
    mark.rotation.z = -0.18 + (i % 4) * 0.1;
  }
  for (let i = 0; i < 5; i += 1) {
    const seam = box(root, [0.025, 0.01, 1.5 + i * 0.55], [-2.4 + i * 1.05, 0.012, 0.2 - i * 0.45], standard('#202628'));
    seam.rotation.y = 0.4 - i * 0.12;
  }
  const exitingRahamat = addPerson(root, new THREE.Vector3(1.28, 0, 2.55), ['#49372c', '#70543e'], 0.96, { facialHair: true, motion: 'reserved' }, actors);
  exitingRahamat.name = 'exiting-rahamat';
  exitingRahamat.visible = false;
  return { root, interactions, actors, ambient, colliders, story: { prisonSky: sky, prisonWindowLight: moon, prisonBench: bench, prisonDoor: cellDoor, prisonHandle, exitingRahamat }, spawn: new THREE.Vector3(1.05, 0, 1.8), yaw: Math.PI, bounds: new THREE.Box2(new THREE.Vector2(-2.9, -3.2), new THREE.Vector2(2.9, 3.2)) };
}

function epilogueWorld(): World {
  const root = new THREE.Group();
  return {
    root, interactions: [], actors: [], ambient: [], colliders: [],
    spawn: new THREE.Vector3(), yaw: 0,
    bounds: new THREE.Box2(new THREE.Vector2(-0.1, -0.1), new THREE.Vector2(0.1, 0.1)),
  };
}

export function createWorld(chapter: Chapter): World {
  if (chapter === 'home') return homeWorld();
  if (chapter === 'calcutta') return classDistanceWorld();
  if (chapter === 'debt') return debtWorld();
  if (chapter === 'prison') return prisonWorld();
  if (chapter === 'wedding') return streetWorld(true);
  return epilogueWorld();
}

export function disposeWorldAssets(): void {
  dustTexture?.dispose();
  dustTexture = undefined;
  mirrorGrimeTexture?.dispose();
  mirrorGrimeTexture = undefined;
}
