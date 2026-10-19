import * as THREE from 'three';

export function driedFruit(count: number, radius: number, overlay = false): THREE.InstancedMesh {
  const geometry = new THREE.SphereGeometry(1, 14, 10);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i += 1) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    const crease = 1 + 0.085 * Math.sin(Math.atan2(z, x) * 9 + y * 4) + 0.035 * Math.cos(y * 21);
    vertices.setXYZ(i, x * crease, y, z * crease);
  }
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: '#79502e', roughness: 0.83, depthTest: !overlay });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const transform = new THREE.Object3D();
  for (let i = 0; i < count; i += 1) {
    const a = i * 2.39996;
    const distance = Math.sqrt((i + 0.5) / count) * radius;
    transform.position.set(Math.cos(a) * distance, 0.018 + (1 - distance / radius) * radius * 0.3, Math.sin(a) * distance);
    transform.rotation.set(Math.sin(i) * 0.35, a, Math.cos(i * 2) * 0.3);
    const size = radius * (0.11 + (i % 3) * 0.012);
    transform.scale.set(size * 0.65, size * 0.52, size);
    transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
    mesh.setColorAt(i, new THREE.Color().setHSL(0.065 + (i % 4) * 0.012, 0.36, 0.16 + (i % 5) * 0.025));
  }
  mesh.renderOrder = overlay ? 103 : 0;
  mesh.receiveShadow = !overlay;
  return mesh;
}
