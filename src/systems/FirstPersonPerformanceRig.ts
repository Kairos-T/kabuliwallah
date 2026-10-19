import * as THREE from 'three';
import { driedFruit } from '../assets/DriedFruit';

export type PerformanceKind = 'handprint' | 'trade' | 'gift' | 'debt' | 'point-shawl' | 'recognition' | 'wedding-silence' | 'mini-departs' | 'reckoning' | 'bound-greeting' | 'look-to-father' | 'receive-money' | 'refuse-payment' | 'hesitation' | 'kneel' | 'stand' | 'look-back' | 'visits' | 'sit' | 'rise' | 'approach-mini' | 'recognise-face' | 'door-rattle' | 'door-exit';

const smooth = (value: number): number => value * value * (3 - 2 * value);
const segment = (time: number, from: number, to: number): number => smooth(THREE.MathUtils.clamp((time - from) / (to - from), 0, 1));

export class FirstPersonPerformanceRig {
  readonly root = new THREE.Group();
  private readonly leftArm = this.arm(-1);
  private readonly rightArm = this.arm(1);
  private paperSurface?: THREE.MeshStandardMaterial;
  private sootPrint?: THREE.MeshBasicMaterial;
  private readonly paperWear: THREE.Mesh[] = [];
  private readonly paper = this.createPaper();
  private readonly parcel = this.createParcel();
  private readonly shawl = this.createShawl();
  private readonly coin = this.createCoin();
  private readonly blade = this.createBlade();
  private readonly bindings = this.createBindings();

  constructor(camera: THREE.Camera) {
    this.root.name = 'first-person-performance-rig';
    this.root.renderOrder = 100;
    this.root.add(this.leftArm, this.rightArm, this.paper, this.parcel, this.shawl, this.coin, this.blade, this.bindings);
    camera.add(this.root);
    this.hide();
  }

  begin(kind: PerformanceKind): void {
    const makingHandprint = kind === 'handprint';
    this.root.visible = !makingHandprint;
    this.leftArm.visible = !makingHandprint && !['wedding-silence', 'mini-departs', 'reckoning', 'look-to-father', 'refuse-payment', 'hesitation', 'kneel', 'stand', 'look-back', 'visits', 'sit', 'rise', 'approach-mini', 'recognise-face', 'door-rattle', 'door-exit'].includes(kind);
    this.rightArm.visible = this.leftArm.visible;
    this.paper.visible = kind === 'recognition';
    this.parcel.visible = kind === 'trade' || kind === 'gift';
    this.shawl.visible = false;
    this.coin.visible = false;
    this.blade.visible = kind === 'debt';
    this.bindings.visible = false;
  }

  setHandprintAge(age: number): void {
    const amount = THREE.MathUtils.clamp(age, 0, 1);
    this.paperSurface?.color.set(new THREE.Color('#dfcda7').lerp(new THREE.Color('#8f7450'), amount));
    if (this.sootPrint) {
      this.sootPrint.color.set(new THREE.Color('#202126').lerp(new THREE.Color('#55504a'), amount));
      this.sootPrint.opacity = THREE.MathUtils.lerp(0.88, 0.43, amount);
    }
    for (const [index, mark] of this.paperWear.entries()) {
      const material = mark.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, amount - index * 0.11) * 0.16;
      mark.visible = amount > index * 0.11;
    }
  }

  liftPaperFrom(camera: THREE.Camera, position: THREE.Vector3, amount: number): void {
    const heldPosition = this.paper.position.clone();
    const heldRotation = this.paper.quaternion.clone();
    const start = camera.worldToLocal(position.clone().add(new THREE.Vector3(0, 0.014, 0)));
    const rotation = camera.getWorldQuaternion(new THREE.Quaternion()).invert()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    this.paper.position.lerpVectors(start, heldPosition, amount);
    this.paper.quaternion.slerpQuaternions(rotation, heldRotation, amount);
    this.paper.scale.x = THREE.MathUtils.lerp(0.56 / 0.46, 1, amount);
    this.paper.scale.y = THREE.MathUtils.lerp(0.68 / 0.62, this.paper.scale.y, amount);
    this.holdPaper();
  }

  supportChildHand(camera: THREE.Camera, hand: THREE.Object3D, progress: number): void {
    if (progress >= 0.78) return;
    const contact = segment(progress, 0.12, 0.26) * (1 - segment(progress, 0.65, 0.77));
    this.root.visible = contact > 0;
    this.paper.visible = false;
    this.leftArm.visible = false;
    this.rightArm.visible = true;
    const target = hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.115, -0.005, -0.025));
    camera.worldToLocal(target);
    const rotation = camera.getWorldQuaternion(new THREE.Quaternion()).invert()
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -0.25)));
    this.rightArm.quaternion.slerp(rotation, contact);
    const offset = new THREE.Vector3(0, 0.29, 0).applyQuaternion(this.rightArm.quaternion);
    this.rightArm.position.lerp(target.sub(offset), contact);
    for (let i = 0; i < 4; i += 1) {
      const finger = this.rightArm.getObjectByName(`finger-${i}`);
      if (finger) {
        finger.rotation.x = THREE.MathUtils.lerp(-0.28, -0.08, contact);
        finger.rotation.z = (i - 1.5) * 0.035 * contact;
      }
    }
    const thumb = this.rightArm.getObjectByName('grip-thumb');
    if (thumb) {
      thumb.position.set(
        THREE.MathUtils.lerp(-0.068, -0.052, contact),
        THREE.MathUtils.lerp(0.005, 0.018, contact),
        THREE.MathUtils.lerp(0.01, -0.008, contact),
      );
      thumb.rotation.z = THREE.MathUtils.lerp(0.5, 0.62, contact);
    }
  }

  update(kind: PerformanceKind, progress: number): void {
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    this.resetPose();

    if (kind === 'handprint') {
      this.paper.visible = t >= 0.78;
      this.leftArm.visible = t >= 0.78;
      this.rightArm.visible = true;
      this.root.visible = t >= 0.78;
      const lift = segment(t, 0.78, 0.94);
      const fold = segment(t, 0.94, 1);
      this.paper.position.y = THREE.MathUtils.lerp(-0.68, -0.14, lift) - fold * 0.18;
      this.paper.rotation.x = THREE.MathUtils.lerp(-0.5, 0.02, lift);
      this.paper.scale.setScalar(1);
      this.leftArm.position.y += lift * 0.16;
      this.rightArm.position.y += lift * 0.16;
    } else if (kind === 'receive-money') {
      const reach = segment(t, 0, 0.42);
      const withdraw = segment(t, 0.55, 1);
      this.leftArm.visible = false;
      this.rightArm.position.set(0.24, -0.78 + reach * 0.38 - withdraw * 0.4, -1.22 - reach * 0.1 + withdraw * 0.25);
    } else if (kind === 'trade' || kind === 'gift') {
      const offer = segment(t, 0.04, 0.42);
      const receive = segment(t, 0.5, 0.78);
      this.rightArm.position.set(0.46 - offer * 0.22, -0.7 + offer * 0.24, -1.2 - offer * 0.12);
      this.parcel.position.set(this.rightArm.position.x - 0.08, this.rightArm.position.y + 0.24, this.rightArm.position.z - 0.12);
      this.parcel.rotation.z = -0.2 + offer * 0.35;
      this.parcel.visible = t < 0.58;
      this.coin.visible = kind === 'trade' && t >= 0.48;
      this.coin.position.set(0.02, -0.5 + receive * 0.18, -1.18 - receive * 0.08);
      this.coin.rotation.y = t * Math.PI * 6;
    } else if (kind === 'debt') {
      const challenge = segment(t, 0.03, 0.18);
      const grapple = segment(t, 0.17, 0.34);
      const draw = segment(t, 0.31, 0.43);
      const strike = segment(t, 0.43, 0.53);
      const surrender = segment(t, 0.62, 0.78);
      const bound = segment(t, 0.73, 0.88);
      this.shawl.visible = false;
      this.shawl.position.set(0.2 - grapple * 0.28, -0.22 - grapple * 0.18, -1.46);
      this.shawl.rotation.set(0, 0, 0.12 - grapple * 0.5);
      this.leftArm.position.set(-0.44 + grapple * 0.36 + bound * 0.02, -0.78 + challenge * 0.18 + grapple * 0.14 + bound * 0.22, -1.22 - grapple * 0.18);
      this.leftArm.rotation.set(-0.12 - grapple * 0.5 + bound * 0.28, 0, 0.42 - grapple * 0.34 - bound * 0.12);
      this.rightArm.position.set(0.44 - draw * 0.12 - strike * 0.28 - bound * 0.23, -0.78 + challenge * 0.12 + draw * 0.28 - surrender * 0.2 + bound * 0.38, -1.22 - strike * 0.2 + surrender * 0.12);
      this.rightArm.rotation.set(-0.12 - strike * 0.42 + bound * 0.34, 0, -0.42 + draw * 0.64 - strike * 0.32 + bound * 0.28);
      this.blade.position.set(this.rightArm.position.x - 0.04, this.rightArm.position.y + 0.24, this.rightArm.position.z - 0.03);
      this.blade.rotation.set(-0.08, 0, -0.46 + draw * 0.82 - strike * 0.46);
      this.blade.scale.setScalar(THREE.MathUtils.lerp(0.72, 1, draw));
      this.blade.visible = t >= 0.31 && t < 0.7;
      this.bindings.visible = t >= 0.73;
      for (const [arm, x] of [[this.leftArm, -0.15], [this.rightArm, 0.15]] as const) {
        arm.position.set(
          THREE.MathUtils.lerp(arm.position.x, x, bound),
          THREE.MathUtils.lerp(arm.position.y, -0.35, bound),
          THREE.MathUtils.lerp(arm.position.z, -1.3, bound),
        );
      }
      this.leftArm.rotation.z = THREE.MathUtils.lerp(this.leftArm.rotation.z, -0.12, bound);
      this.rightArm.rotation.z = THREE.MathUtils.lerp(this.rightArm.rotation.z, 0.12, bound);
    } else if (kind === 'bound-greeting') {
      const lift = segment(t, 0, 0.6);
      this.leftArm.position.set(-0.18, -0.55 + lift * 0.28, -1.3);
      this.rightArm.position.set(0.18, -0.55 + lift * 0.28, -1.3);
      this.leftArm.rotation.z = -0.12;
      this.rightArm.rotation.z = 0.12;
      this.bindings.visible = true;
    } else if (kind === 'recognition') {
      const raise = segment(t, 0.04, 0.38);
      const lower = segment(t, 0.78, 0.98);
      this.paper.position.y = THREE.MathUtils.lerp(-0.68, -0.12, raise) - lower * 0.45;
      this.paper.position.z = -1.38 - raise * 0.08;
      this.paper.rotation.z = Math.sin(t * 7) * 0.012 * (1 - lower);
      this.leftArm.position.y += raise * 0.15 - lower * 0.2;
      this.rightArm.position.y += raise * 0.15 - lower * 0.2;
    }
    if (kind === 'handprint' || kind === 'recognition') this.holdPaper();
    if (this.bindings.visible) this.updateBindings();
  }

  private holdPaper(): void {
    this.paper.updateMatrix();
    for (const [arm, side] of [[this.leftArm, -1], [this.rightArm, 1]] as const) {
      arm.quaternion.copy(this.paper.quaternion);
      arm.rotateZ(-side * 0.12);
      const palm = new THREE.Vector3(side * 0.255, -0.19, -0.025).applyMatrix4(this.paper.matrix);
      const wristOffset = new THREE.Vector3(0, 0.29, 0).applyQuaternion(arm.quaternion);
      arm.position.copy(palm).sub(wristOffset);
      const thumb = arm.getObjectByName('grip-thumb');
      if (thumb) {
        thumb.position.set(-side * 0.055, 0.005, 0.065);
        thumb.rotation.z = side * 0.9;
        thumb.renderOrder = 103;
      }
    }
  }

  hide(): void {
    this.root.visible = false;
  }

  pointAt(camera: THREE.Camera, worldTarget: THREE.Vector3, progress: number): void {
    const reach = segment(progress, 0, 0.3) * (1 - segment(progress, 0.75, 1));
    this.leftArm.visible = false;
    this.rightArm.position.y += reach * 0.28;
    const target = camera.worldToLocal(worldTarget.clone()).sub(this.rightArm.position).normalize();
    const aim = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), target);
    this.rightArm.quaternion.slerp(aim, reach);
    for (let i = 0; i < 4; i += 1) {
      const finger = this.rightArm.getObjectByName(`finger-${i}`);
      if (finger) finger.rotation.x = THREE.MathUtils.lerp(-0.28, i === 0 ? 0 : -1.65, reach);
    }
  }

  dispose(): void {
    this.root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    });
    this.root.removeFromParent();
  }

  private resetPose(): void {
    for (const [arm, side] of [[this.leftArm, -1], [this.rightArm, 1]] as const) {
      for (let i = 0; i < 4; i += 1) {
        const finger = arm.getObjectByName(`finger-${i}`);
        if (finger) finger.rotation.set(-0.28, 0, 0);
      }
      const thumb = arm.getObjectByName('grip-thumb');
      if (thumb) {
        thumb.position.set(-side * 0.068, 0.005, 0.01);
        thumb.rotation.z = side * 0.5;
        thumb.renderOrder = 100;
      }
    }
    this.leftArm.position.set(-0.44, -0.78, -1.22);
    this.rightArm.position.set(0.44, -0.78, -1.22);
    this.leftArm.rotation.set(-0.12, 0, 0.42);
    this.rightArm.rotation.set(-0.12, 0, -0.42);
    this.paper.position.set(0, -0.68, -1.38);
    this.paper.rotation.set(0, 0, 0);
    this.paper.scale.set(1, 1, 1);
    this.parcel.position.set(0.3, -0.54, -1.24);
    this.parcel.rotation.set(0, 0, -0.2);
    this.shawl.position.set(0.2, -0.22, -1.46);
    this.shawl.rotation.set(0, 0, 0.12);
    this.coin.position.set(0, -0.5, -1.2);
    this.blade.position.set(0.42, -0.5, -1.22);
    this.blade.rotation.set(0, 0, 0);
    this.bindings.position.set(0, -0.18, -1.3);
    this.bindings.rotation.set(0, 0, 0);
  }

  private arm(side: -1 | 1): THREE.Group {
    const group = new THREE.Group();
    const cloth = new THREE.MeshStandardMaterial({ color: '#7a3d2c', roughness: 0.92, depthTest: false });
    const skin = new THREE.MeshStandardMaterial({ color: '#76503d', roughness: 0.88, depthTest: false });
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.4, 8, 14), cloth);
    const hand = new THREE.Group();
    hand.position.y = 0.29;
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), skin);
    palm.scale.set(0.9, 1.08, 0.32);
    hand.add(palm);
    for (let i = 0; i < 4; i += 1) {
      const finger = new THREE.Group();
      finger.name = `finger-${i}`;
      finger.position.set((i - 1.5) * 0.029, 0.054, 0);
      const length = 0.057 + (1 - Math.abs(i - 1.5) / 2) * 0.018;
      const proximal = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, length * 0.52, 4, 10), skin);
      proximal.position.y = length * 0.26;
      const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, length * 0.34, 4, 10), skin);
      tip.position.set(0, length * 0.73, -0.003);
      tip.rotation.x = -0.16;
      finger.add(proximal, tip);
      finger.rotation.x = -0.28;
      hand.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.045, 4, 10), skin);
    thumb.name = 'grip-thumb';
    thumb.position.set(-side * 0.068, 0.005, 0.01);
    thumb.rotation.z = side * 0.5;
    hand.add(thumb);
    group.add(sleeve, hand);
    group.traverse((child) => { if (child instanceof THREE.Mesh) child.renderOrder = 100; });
    return group;
  }

  private createPaper(): THREE.Group {
    const group = new THREE.Group();
    this.paperSurface = new THREE.MeshStandardMaterial({ color: '#dfcda7', roughness: 0.96, side: THREE.DoubleSide, depthTest: false });
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.62),
      this.paperSurface,
    );
    group.add(paper);
    this.sootPrint = new THREE.MeshBasicMaterial({ color: '#25262a', transparent: true, opacity: 0.88, depthTest: false });
    const print = new THREE.Group();
    print.scale.setScalar(0.68);
    group.add(print);
    const palm = new THREE.Mesh(new THREE.CircleGeometry(0.09, 22), this.sootPrint);
    palm.scale.set(0.82, 1.16, 1);
    palm.position.set(0, -0.075, 0.008);
    print.add(palm);
    for (let index = 0; index < 4; index += 1) {
      const finger = new THREE.Mesh(new THREE.CircleGeometry(0.024, 14), this.sootPrint);
      finger.scale.set(0.58, 1.62 + (1.5 - Math.abs(1.5 - index)) * 0.22, 1);
      finger.position.set((index - 1.5) * 0.043, 0.072 + (1.5 - Math.abs(1.5 - index)) * 0.012, 0.01);
      print.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CircleGeometry(0.025, 14), this.sootPrint);
    thumb.scale.set(0.62, 1.5, 1);
    thumb.position.set(-0.095, -0.015, 0.01);
    thumb.rotation.z = 0.72;
    print.add(thumb);
    for (let index = 0; index < 5; index += 1) {
      const mark = new THREE.Mesh(
        new THREE.CircleGeometry(0.018 + index * 0.004, 16),
        new THREE.MeshBasicMaterial({ color: index % 2 ? '#4f3424' : '#765438', transparent: true, opacity: 0, depthTest: false }),
      );
      mark.scale.set(1.8 + (index % 2), 0.5 + (index % 3) * 0.22, 1);
      mark.position.set(index % 2 ? 0.19 : -0.19, -0.25 + index * 0.12, 0.006);
      mark.rotation.z = index * 0.7;
      group.add(mark);
      this.paperWear.push(mark);
    }
    group.traverse((child) => { if (child instanceof THREE.Mesh) child.renderOrder = 102; });
    return group;
  }

  private createParcel(): THREE.Group {
    const group = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.2, 5, 1, true),
      new THREE.MeshStandardMaterial({ color: '#c9ae7e', roughness: 0.98, side: THREE.DoubleSide, depthTest: false }));
    paper.rotation.z = Math.PI;
    paper.position.y = -0.08;
    paper.renderOrder = 103;
    group.add(paper, driedFruit(42, 0.155, true));
    return group;
  }

  private createShawl(): THREE.Group {
    const group = new THREE.Group();
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.58, 0.72),
      new THREE.MeshStandardMaterial({ color: '#7d2930', roughness: 0.96, side: THREE.DoubleSide, depthTest: false }),
    );
    group.add(cloth);
    const stripeMaterial = new THREE.MeshBasicMaterial({ color: '#d0a75d', depthTest: false });
    for (const x of [-0.22, -0.11, 0, 0.11, 0.22]) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.69), stripeMaterial);
      stripe.position.set(x, 0, 0.006);
      group.add(stripe);
    }
    for (const edge of [-1, 1]) {
      for (let index = 0; index < 7; index += 1) {
        const fringe = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.09), stripeMaterial);
        fringe.position.set(-0.25 + index * 0.083, edge * 0.395, 0.006);
        group.add(fringe);
      }
    }
    group.scale.setScalar(0.68);
    group.traverse((child) => { if (child instanceof THREE.Mesh) child.renderOrder = 103; });
    return group;
  }

  private createCoin(): THREE.Mesh {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.012, 18),
      new THREE.MeshStandardMaterial({ color: '#b58235', roughness: 0.34, metalness: 0.72, depthTest: false }),
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.renderOrder = 103;
    return mesh;
  }

  private createBlade(): THREE.Group {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#c4c0b6', roughness: 0.22, metalness: 0.9, depthTest: false });
    const wood = new THREE.MeshStandardMaterial({ color: '#392319', roughness: 0.72, depthTest: false });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 0.026), metal);
    blade.position.y = 0.21;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), metal);
    tip.position.y = 0.44;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.048, 0.2, 12), wood);
    handle.position.y = -0.06;
    group.add(blade, tip, handle);
    group.traverse((child) => { if (child instanceof THREE.Mesh) child.renderOrder = 104; });
    return group;
  }

  private createBindings(): THREE.Group {
    const group = new THREE.Group();
    const iron = new THREE.MeshStandardMaterial({ color: '#4a4842', roughness: 0.62, metalness: 0.7, depthTest: false });
    for (let index = 0; index < 2; index += 1) {
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.014, 10, 24), iron);
      cuff.name = index ? 'right-wrist-cuff' : 'left-wrist-cuff';
      group.add(cuff);
    }
    for (let index = 0; index < 9; index += 1) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.005, 6, 12), iron);
      link.name = 'restraint-chain-link';
      group.add(link);
    }
    group.traverse((child) => { if (child instanceof THREE.Mesh) child.renderOrder = 107; });
    return group;
  }

  private updateBindings(): void {
    this.bindings.position.set(0, 0, 0);
    this.bindings.rotation.set(0, 0, 0);
    const left = this.bindings.children[0];
    const right = this.bindings.children[1];
    for (const [cuff, arm] of [[left, this.leftArm], [right, this.rightArm]]) {
      cuff.position.set(0, 0.225, 0).applyQuaternion(arm.quaternion).add(arm.position);
      cuff.quaternion.copy(arm.quaternion);
      cuff.rotateX(Math.PI / 2);
    }
    for (let index = 2; index < this.bindings.children.length; index += 1) {
      const link = this.bindings.children[index];
      const fraction = (index - 1) / 10;
      const inset = Math.min(0.076 / left.position.distanceTo(right.position), 0.4);
      link.position.lerpVectors(left.position, right.position, inset + fraction * (1 - 2 * inset));
      link.position.y -= Math.sin(fraction * Math.PI) * 0.035;
      link.rotation.set(index % 2 ? Math.PI / 2 : 0, 0, 0);
    }
  }
}
