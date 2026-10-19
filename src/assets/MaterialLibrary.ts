import * as THREE from 'three';

export type SurfaceKind = 'earth' | 'plaster' | 'stone' | 'wood' | 'cloth' | 'paper' | 'skin' | 'ceramic' | 'metal' | 'organic';

const textures = new Map<SurfaceKind, THREE.CanvasTexture>();
const materials = new Map<string, THREE.Material>();

function noise(x: number, y: number, seed: number): number {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function smoothNoise(x: number, y: number, period: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const sample = (a: number, b: number) => noise(a % period, b % period, 2);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(ix, iy), sample(ix + 1, iy), sx),
    THREE.MathUtils.lerp(sample(ix, iy + 1), sample(ix + 1, iy + 1), sx), sy);
}

function createSurfaceTexture(kind: SurfaceKind): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create procedural surface texture.');

  const image = context.createImageData(256, 256);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const index = (y * 256 + x) * 4;
      const fine = noise(x, y, 1);
      const broad = smoothNoise(x / 32, y / 32, 8);
      let value = 220 + (fine - 0.5) * 15 + (broad - 0.5) * 18;
      if (kind === 'wood') value = 207 + Math.sin(y * 0.32 + broad * 4) * 8 + (fine - 0.5) * 9;
      if (kind === 'earth') value = 185 + (broad - 0.5) * 65 + (smoothNoise(x / 64, y / 64, 4) - 0.5) * 35 + (fine - 0.5) * 13;
      if (kind === 'cloth') value = 205 + ((x % 5 === 0 || y % 5 === 0) ? -18 : 5) + fine * 8;
      if (kind === 'stone') value = 202 + (fine - 0.5) * 20 + (broad - 0.5) * 24;
      if (kind === 'paper') value = 225 + (fine - 0.5) * 9 + (broad - 0.5) * 8;
      if (kind === 'skin' || kind === 'organic') value = 222 + (fine - 0.5) * 7;
      if (kind === 'ceramic') value = 218 + (broad - 0.5) * 12;
      if (kind === 'metal') value = 200 + (fine - 0.5) * 9 + (x % 11 === 0 ? 12 : 0);
      image.data[index] = value;
      image.data[index + 1] = value;
      image.data[index + 2] = value;
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  if (kind === 'stone') {
    context.strokeStyle = 'rgba(47, 38, 31, 0.28)';
    context.lineWidth = 2;
    for (let y = 0; y <= 256; y += 64) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(256, y);
      context.stroke();
      const offset = (y / 64) % 2 ? 32 : 0;
      for (let x = offset; x < 256; x += 64) {
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x, Math.min(256, y + 64));
        context.stroke();
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'stone' ? 3 : 2, kind === 'stone' ? 5 : 2);
  texture.anisotropy = 4;
  texture.name = `procedural-${kind}`;
  return texture;
}

function textureFor(kind: SurfaceKind): THREE.CanvasTexture {
  let texture = textures.get(kind);
  if (!texture) {
    texture = createSurfaceTexture(kind);
    textures.set(kind, texture);
  }
  return texture;
}

export function surfaceMaterial(color: string, kind: SurfaceKind = 'plaster', roughness?: number): THREE.Material {
  const resolvedRoughness = roughness ?? {
    plaster: 0.92,
    earth: 0.94,
    stone: 0.96,
    wood: 0.76,
    cloth: 0.9,
    paper: 0.88,
    skin: 0.72,
    ceramic: 0.38,
    metal: 0.42,
    organic: 0.64,
  }[kind];
  const key = `${kind}:${color}:${resolvedRoughness}`;
  const existing = materials.get(key);
  if (existing) return existing;

  const map = textureFor(kind);
  let material: THREE.Material;
  if (kind === 'cloth') {
    material = new THREE.MeshPhysicalMaterial({
      color,
      map,
      roughness: resolvedRoughness,
      sheen: 0.45,
      sheenRoughness: 0.78,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.18),
      envMapIntensity: 0.35,
    });
  } else if (kind === 'ceramic') {
    material = new THREE.MeshPhysicalMaterial({
      color,
      map,
      roughness: resolvedRoughness,
      clearcoat: 0.24,
      clearcoatRoughness: 0.52,
      envMapIntensity: 0.48,
    });
  } else {
    material = new THREE.MeshStandardMaterial({
      color,
      map,
      roughness: resolvedRoughness,
      metalness: kind === 'metal' ? 0.55 : 0,
      bumpMap: kind === 'earth' || kind === 'plaster' ? map : null,
      bumpScale: kind === 'earth' ? 0.035 : 0.008,
      envMapIntensity: kind === 'metal' ? 0.8 : 0.36,
    });
  }
  material.name = key;
  materials.set(key, material);
  return material;
}

export function disposeMaterialLibrary(): void {
  for (const material of materials.values()) material.dispose();
  for (const texture of textures.values()) texture.dispose();
  materials.clear();
  textures.clear();
}
