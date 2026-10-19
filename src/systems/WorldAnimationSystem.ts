import * as THREE from 'three';

export type ActorMotion = 'child' | 'friendly' | 'reserved' | 'tense' | 'walker';
export type ActorEmote = 'talk' | 'laugh' | 'sad' | 'reach' | 'argue' | 'shove' | 'struggle' | 'restrain' | 'bound' | 'shy' | 'soften' | 'receive' | 'press' | 'recoil' | 'fallen';

export type ActorRig = {
  root: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftFoot: THREE.Object3D;
  rightFoot: THREE.Object3D;
  garment: THREE.Object3D;
  mouth: THREE.Object3D;
  blush?: THREE.Mesh[];
  blushing?: boolean;
  scarf?: THREE.Object3D;
  basePosition: THREE.Vector3;
  phase: number;
  motion: ActorMotion;
  emote?: ActorEmote;
  destination?: THREE.Vector3;
  path?: { from: THREE.Vector3; to: THREE.Vector3; duration: number };
};

export type AmbientRig = {
  object: THREE.Object3D;
  baseRotation: THREE.Euler;
  phase: number;
  amount: number;
  speed: number;
  axis: 'x' | 'y' | 'z';
};

const lookTarget = new THREE.Vector3();
const reactionVector = new THREE.Vector3();
const targetRotation = new THREE.Quaternion();
const targetMouth = new THREE.Vector3();
const locomotionPosition = new THREE.Vector3();
const poseHistory = new WeakMap<ActorRig, { joints: THREE.Object3D[]; rotations: THREE.Quaternion[]; mouth: THREE.Vector3; offset: THREE.Vector3; roll: number; previousPosition: THREE.Vector3; distance: number; leftFoot: THREE.Vector3; rightFoot: THREE.Vector3 }>();

function rigFor(object?: THREE.Object3D): ActorRig | undefined {
  return object?.userData.actorRig as ActorRig | undefined;
}

export function setActorEmote(object: THREE.Object3D | undefined, emote?: ActorEmote): void {
  const rig = rigFor(object);
  if (rig) rig.emote = emote;
}

export function moveActorTo(object: THREE.Object3D | undefined, destination: THREE.Vector3): void {
  const rig = rigFor(object);
  if (rig) rig.destination = destination.clone();
}

function dampAngle(current: number, target: number, smoothing: number, delta: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * (1 - Math.exp(-smoothing * delta));
}

export function animateWorld(
  actors: ActorRig[],
  ambient: AmbientRig[],
  elapsed: number,
  delta: number,
  player: THREE.Vector3,
  focused?: THREE.Object3D,
  reducedMotion = false,
): void {
  const motionScale = reducedMotion ? 0.16 : 1;

  for (const actor of actors) {
    let pose = poseHistory.get(actor);
    if (!pose) {
      const joints = [actor.head, actor.leftArm, actor.rightArm];
      pose = { joints, rotations: joints.map((joint) => joint.quaternion.clone()), mouth: actor.mouth.scale.clone(), offset: new THREE.Vector3(), roll: 0, previousPosition: actor.basePosition.clone(), distance: 0, leftFoot: actor.leftFoot.position.clone(), rightFoot: actor.rightFoot.position.clone() };
      poseHistory.set(actor, pose);
    }
    pose.joints.forEach((joint, index) => pose!.rotations[index].copy(joint.quaternion));
    pose.mouth.copy(actor.mouth.scale);
    actor.head.rotation.x = 0;
    actor.root.rotation.z = 0;
    const time = elapsed + actor.phase;
    let stride = 0;
    let walking = false;
    let attentionYaw = 0;

    if (actor.destination) {
      lookTarget.copy(actor.destination).sub(actor.basePosition);
      const remaining = lookTarget.length();
      if (remaining > 0.04) {
        walking = true;
        const step = Math.min(remaining, delta * 2.45);
        actor.basePosition.addScaledVector(lookTarget.normalize(), step);
        actor.root.position.copy(actor.basePosition);
        actor.root.rotation.y = dampAngle(actor.root.rotation.y, Math.atan2(lookTarget.x, lookTarget.z), 9, delta);
        stride = Math.sin(time * 8) * 0.58 * motionScale;
      } else {
        actor.basePosition.copy(actor.destination);
        actor.destination = undefined;
        actor.root.position.copy(actor.basePosition);
      }
    } else if (actor.path) {
      walking = true;
      const cycle = (time / actor.path.duration) % 2;
      const progress = cycle <= 1 ? cycle : 2 - cycle;
      actor.root.position.lerpVectors(actor.path.from, actor.path.to, progress);
      const forward = cycle <= 1 ? actor.path.to : actor.path.from;
      lookTarget.copy(forward).sub(actor.root.position);
      actor.root.rotation.y = dampAngle(actor.root.rotation.y, Math.atan2(lookTarget.x, lookTarget.z), 7, delta);
      stride = Math.sin(time * 6.2) * 0.62 * motionScale;
    } else {
      actor.root.position.copy(actor.basePosition);
      const distance = actor.root.position.distanceTo(player);
      const tracksPlayer = actor.root.userData.trackPlayer === true;
      const engaged = focused === actor.root || actor.emote !== undefined || tracksPlayer;
      if (distance < (tracksPlayer ? 10 : 5.4) && engaged && actor.emote !== 'fallen' && actor.emote !== 'press') {
        lookTarget.copy(player).sub(actor.root.position);
        const desired = Math.atan2(lookTarget.x, lookTarget.z);
        const withdrawn = actor.emote === 'sad' || actor.emote === 'shy';
        const difference = Math.atan2(Math.sin(desired - actor.root.rotation.y), Math.cos(desired - actor.root.rotation.y));
        if ((!withdrawn || focused === actor.root) && Math.abs(difference) > 0.08) {
          actor.root.rotation.y = dampAngle(actor.root.rotation.y, desired, tracksPlayer ? 3.2 : 2.1, delta);
        }
        attentionYaw = THREE.MathUtils.clamp(difference, -0.34, 0.34);
      }
    }

    locomotionPosition.copy(actor.root.position);
    pose.distance += Math.min(0.3, locomotionPosition.distanceTo(pose.previousPosition)) / actor.root.scale.y;
    pose.previousPosition.copy(locomotionPosition);
    if (walking) stride = Math.sin(pose.distance / 0.85 * Math.PI * 2) * 0.48;
    const breathing = Math.sin(time * 1.65) * 0.012 * motionScale;
    actor.garment.scale.y = 1 + breathing;
    actor.head.rotation.y = attentionYaw + Math.sin(time * 0.72) * 0.025 * motionScale;
    if (actor.root.userData.lookDown) actor.head.rotation.x = 0.3;
    actor.head.rotation.z = Math.sin(time * 0.48 + 1.2) * 0.018 * motionScale;
    actor.leftFoot.position.z = 0.09 + stride * 0.16;
    actor.rightFoot.position.z = 0.09 - stride * 0.16;
    actor.leftFoot.position.y = 0.1 + Math.max(0, stride) * 0.055;
    actor.rightFoot.position.y = 0.1 + Math.max(0, -stride) * 0.055;
    for (const [foot, previous, phaseOffset] of [[actor.leftFoot, pose.leftFoot, 0], [actor.rightFoot, pose.rightFoot, 0.5]] as const) {
      if (walking) {
        const phase = (pose.distance / 0.85 + phaseOffset) % 1;
        const swing = Math.max(0, (phase - 0.5) * 2);
        foot.position.z = 0.09 + (phase < 0.5 ? 0.2125 - phase * 0.85 : -0.2125 + swing * swing * (3 - 2 * swing) * 0.425);
        foot.position.y = 0.1 + Math.sin(swing * Math.PI) * 0.1;
      } else {
        foot.position.z = THREE.MathUtils.damp(previous.z, 0.09, 12, delta);
        foot.position.y = THREE.MathUtils.damp(previous.y, 0.1, 12, delta);
      }
      previous.copy(foot.position);
    }
    actor.leftArm.rotation.x = stride;
    actor.rightArm.rotation.x = -stride;
    actor.leftArm.rotation.z = -0.13;
    actor.rightArm.rotation.z = 0.13;
    actor.mouth.scale.set(1, 1, 1);

    if (!walking) {
      const attention = focused === actor.root ? 1 : 0;
      if (actor.motion === 'child' || actor.motion === 'friendly') {
        actor.rightArm.rotation.x = -0.08 - attention * 0.09 + Math.sin(time * 1.4) * 0.035 * motionScale;
        actor.rightArm.rotation.z = 0.12 + attention * 0.04;
        actor.leftArm.rotation.x = Math.sin(time * 1.1 + 0.8) * 0.025 * motionScale;
        actor.root.rotation.z = Math.sin(time * 0.8) * (actor.motion === 'child' ? 0.012 : 0.005) * motionScale;
      } else if (actor.motion === 'tense') {
        actor.leftArm.rotation.z = -0.28;
        actor.rightArm.rotation.z = 0.28;
        actor.head.rotation.x = -0.05 + attention * 0.08;
      } else {
        actor.leftArm.rotation.x = Math.sin(time * 1.15) * 0.035 * motionScale;
        actor.rightArm.rotation.x = -actor.leftArm.rotation.x;
      }
    }

    const emote = actor.emote;
    const blushOpacity = actor.blushing ? 0.7 : 0;
    actor.blush?.forEach((cheek) => {
      const material = cheek.material as THREE.MeshBasicMaterial;
      material.opacity = THREE.MathUtils.damp(material.opacity, blushOpacity, blushOpacity > 0 ? 9 : 5, delta);
    });
    if (emote === 'talk') {
      const phrase = Math.pow(Math.max(0, Math.sin(time * 1.7)), 2);
      const lively = actor.motion === 'child' ? 1 : 0.65;
      actor.rightArm.rotation.x = -0.16 - phrase * 0.42 * lively * motionScale;
      actor.rightArm.rotation.z = 0.16 + phrase * 0.19 * lively * motionScale;
      actor.head.rotation.x = Math.sin(time * 2.1) * 0.026 * motionScale;
      actor.mouth.scale.y = 1 + (0.4 + phrase * 0.6) * Math.abs(Math.sin(time * 8)) * 1.6 * motionScale;
    } else if (emote === 'laugh') {
      actor.head.rotation.x = -0.12 + Math.sin(time * 5.5) * 0.045 * motionScale;
      actor.head.rotation.z = Math.sin(time * 4.2) * 0.08 * motionScale;
      actor.leftArm.rotation.z = -0.58;
      actor.rightArm.rotation.z = 0.58;
      actor.root.position.y += Math.abs(Math.sin(time * 5.5)) * 0.05 * motionScale;
      actor.mouth.scale.set(1.38, 4.4, 1);
    } else if (emote === 'sad') {
      actor.head.rotation.x = 0.22;
      actor.head.rotation.y *= 0.3;
      actor.leftArm.rotation.x = 0.05;
      actor.rightArm.rotation.x = 0.035;
      actor.leftArm.rotation.z = -0.06;
      actor.rightArm.rotation.z = 0.06;
      actor.root.position.y -= 0.018;
    } else if (emote === 'reach') {
      actor.head.rotation.x = 0.1;
      actor.rightArm.rotation.x = -1.2;
      actor.rightArm.rotation.z = 0.18;
    } else if (emote === 'argue') {
      actor.head.rotation.x = -0.08;
      actor.leftArm.rotation.x = -0.55 + Math.sin(time * 6.5) * 0.3 * motionScale;
      actor.rightArm.rotation.x = -0.8 - Math.sin(time * 6.5) * 0.25 * motionScale;
      actor.leftArm.rotation.z = -0.54;
      actor.rightArm.rotation.z = 0.54;
      actor.mouth.scale.y = 1.8 + Math.abs(Math.sin(time * 9)) * motionScale;
    } else if (emote === 'shove') {
      actor.root.position.z += Math.sin(time * 14) * 0.035 * motionScale;
      actor.head.rotation.x = -0.16;
      actor.leftArm.rotation.x = -1.35;
      actor.rightArm.rotation.x = -1.28;
      actor.leftArm.rotation.z = -0.14;
      actor.rightArm.rotation.z = 0.14;
      actor.mouth.scale.y = 2.8;
    } else if (emote === 'struggle') {
      actor.root.rotation.z = Math.sin(time * 17) * 0.055 * motionScale;
      actor.head.rotation.z = -0.12;
      actor.leftArm.rotation.x = -1.04 + Math.sin(time * 12) * 0.24 * motionScale;
      actor.rightArm.rotation.x = -0.94 - Math.sin(time * 12) * 0.24 * motionScale;
      actor.leftArm.rotation.z = -0.48;
      actor.rightArm.rotation.z = 0.48;
      actor.mouth.scale.y = 2.6;
    } else if (emote === 'restrain') {
      actor.head.rotation.x = -0.08;
      actor.leftArm.rotation.x = -1.35;
      actor.rightArm.rotation.x = -1.35;
      actor.leftArm.rotation.z = -0.28;
      actor.rightArm.rotation.z = 0.28;
    } else if (emote === 'bound') {
      actor.head.rotation.x = 0.1;
      actor.leftArm.rotation.x = -1.05;
      actor.rightArm.rotation.x = -1.05;
      actor.leftArm.rotation.z = 0.04;
      actor.rightArm.rotation.z = -0.04;
    } else if (emote === 'shy') {
      actor.head.rotation.x = 0.18;
      actor.head.rotation.y = 0.38;
      actor.leftArm.rotation.x = -0.14;
      actor.rightArm.rotation.x = -0.21;
      actor.leftArm.rotation.z = 0.04;
      actor.rightArm.rotation.z = -0.04;
      actor.mouth.scale.x = 0.72;
    } else if (emote === 'soften') {
      actor.head.rotation.x = 0.11;
      actor.head.rotation.z = 0.035;
      actor.leftArm.rotation.x = -0.12;
      actor.rightArm.rotation.x = -0.24;
      actor.leftArm.rotation.z = -0.1;
      actor.rightArm.rotation.z = 0.16;
      actor.root.position.y -= 0.012;
    } else if (emote === 'receive') {
      actor.head.rotation.x = 0.08;
      actor.leftArm.rotation.x = -1.05;
      actor.rightArm.rotation.x = -0.9;
      actor.leftArm.rotation.z = -0.22;
      actor.rightArm.rotation.z = 0.22;
    } else if (emote === 'press') {
      actor.head.rotation.x = 0.24;
      actor.rightArm.rotation.x = -1.36;
      actor.rightArm.rotation.z = 0.12;
      actor.root.position.y -= 0.08;
    } else if (emote === 'fallen') {
      actor.root.rotation.z = Math.PI / 2;
      actor.root.position.y = actor.basePosition.y + 0.23 * actor.root.scale.y;
      actor.head.rotation.x = 0.16;
      actor.head.rotation.y = 0;
      actor.leftArm.rotation.x = -0.3;
      actor.rightArm.rotation.x = -0.7;
      actor.leftArm.rotation.z = -0.18;
      actor.rightArm.rotation.z = 0.35;
      actor.mouth.scale.y = 1.3;
    } else if (emote === 'recoil') {
      reactionVector.copy(actor.root.position).sub(player).setY(0).normalize();
      actor.root.position.addScaledVector(reactionVector, 0.46);
      actor.root.rotation.z = Math.sin(time * 18) * 0.035 * motionScale;
      actor.head.rotation.x = -0.24;
      actor.leftArm.rotation.x = 0.82;
      actor.rightArm.rotation.x = 0.68;
      actor.leftArm.rotation.z = -0.86;
      actor.rightArm.rotation.z = 0.86;
      actor.mouth.scale.y = 4.1;
    }

    if (actor.scarf) actor.scarf.rotation.z = 0.08 + Math.sin(time * 1.9) * 0.035 * motionScale;
    const blend = 1 - Math.exp(-delta * (emote === 'fallen' ? 3.8 : emote === 'recoil' || emote === 'shove' ? 18 : 10));
    reactionVector.copy(actor.root.position).sub(locomotionPosition);
    pose.offset.lerp(reactionVector, blend);
    actor.root.position.copy(locomotionPosition).add(pose.offset);
    pose.roll = THREE.MathUtils.lerp(pose.roll, actor.root.rotation.z, blend);
    actor.root.rotation.z = pose.roll;
    pose.joints.forEach((joint, index) => {
      targetRotation.copy(joint.quaternion);
      joint.quaternion.slerpQuaternions(pose!.rotations[index], targetRotation, blend);
    });
    targetMouth.copy(actor.mouth.scale);
    actor.mouth.scale.lerpVectors(pose.mouth, targetMouth, 1 - Math.exp(-delta * 22));
  }

  for (const item of ambient) {
    const value = Math.sin(elapsed * item.speed + item.phase) * item.amount * motionScale;
    item.object.rotation[item.axis] = item.baseRotation[item.axis] + value;
  }
}
