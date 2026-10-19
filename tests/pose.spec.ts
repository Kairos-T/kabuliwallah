import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import { animateWorld, type ActorRig } from '../src/systems/WorldAnimationSystem';

test('gestures blend and recover without leaving a tilted neutral pose', () => {
  const actor: ActorRig = {
    root: new THREE.Group(), head: new THREE.Group(), leftArm: new THREE.Group(), rightArm: new THREE.Group(),
    leftFoot: new THREE.Object3D(), rightFoot: new THREE.Object3D(), garment: new THREE.Object3D(), mouth: new THREE.Object3D(),
    basePosition: new THREE.Vector3(), phase: 0, motion: 'reserved', emote: 'sad',
  };
  const step = (time: number) => animateWorld([actor], [], time, 1 / 60, new THREE.Vector3(0, 0, 8));
  step(0);
  expect(actor.head.rotation.x).toBeGreaterThan(0);
  expect(actor.head.rotation.x).toBeLessThan(0.22);
  for (let frame = 1; frame < 60; frame += 1) step(frame / 60);
  expect(actor.head.rotation.x).toBeCloseTo(0.22, 3);
  actor.emote = 'struggle';
  step(1);
  expect(Math.abs(actor.root.rotation.z)).toBeGreaterThan(0);
  actor.emote = undefined;
  for (let frame = 61; frame < 181; frame += 1) step(frame / 60);
  expect(actor.head.rotation.x).toBeCloseTo(0, 4);
  expect(actor.root.rotation.z).toBeCloseTo(0, 4);
  actor.emote = 'recoil';
  step(4);
  expect(Math.abs(actor.root.position.z)).toBeGreaterThan(0);
  expect(Math.abs(actor.root.position.z)).toBeLessThan(0.46);
  actor.emote = undefined;
  for (let frame = 241; frame < 361; frame += 1) step(frame / 60);
  expect(actor.root.position.z).toBeCloseTo(0, 4);
  actor.emote = 'fallen';
  for (let frame = 362; frame < 602; frame += 1) step(frame / 60);
  expect(actor.root.rotation.z).toBeCloseTo(Math.PI / 2, 3);
  expect(actor.root.position.y).toBeCloseTo(0.23, 3);
});
