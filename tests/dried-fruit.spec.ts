import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import { driedFruit } from '../src/assets/DriedFruit';

test('raisin batches have finite wrinkled geometry and deterministic placements', () => {
  const first = driedFruit(42, 0.155, true);
  const second = driedFruit(42, 0.155, true);
  expect(first.count).toBe(42);
  expect(Array.from(first.instanceMatrix.array)).toEqual(Array.from(second.instanceMatrix.array));
  const positions = first.geometry.attributes.position;
  const radii = new Set<number>();
  for (let i = 0; i < positions.count; i += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, i);
    expect(Number.isFinite(point.length())).toBe(true);
    radii.add(Math.round(point.length() * 100));
  }
  expect(radii.size).toBeGreaterThan(8);
  expect((first.material as THREE.MeshStandardMaterial).depthTest).toBe(false);
  for (const mesh of [first, second]) {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    mesh.dispose();
  }
});
