import * as THREE from 'three';

export class InputController {
  private readonly keys = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private interactQueued = false;
  private handprintQueued = false;
  private touchPointer: number | null = null;
  private lookPointer: number | null = null;
  private lastLook = new THREE.Vector2();
  private touchCenter = new THREE.Vector2();
  private touchRadius = 1;
  private touchMovement = new THREE.Vector2();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly stick: HTMLElement,
    private readonly knob: HTMLElement,
    private readonly interactButton: HTMLElement,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.addEventListener('pointerdown', this.onCanvasDown);
    this.canvas.addEventListener('pointermove', this.onCanvasMove);
    this.canvas.addEventListener('pointerup', this.onCanvasUp);
    this.canvas.addEventListener('pointercancel', this.onCanvasUp);
    this.canvas.addEventListener('lostpointercapture', this.onCanvasUp);
    this.stick.addEventListener('pointerdown', this.onStickDown);
    this.stick.addEventListener('pointermove', this.onStickMove);
    this.stick.addEventListener('pointerup', this.onStickUp);
    this.stick.addEventListener('pointercancel', this.onStickUp);
    this.stick.addEventListener('lostpointercapture', this.onStickUp);
    this.interactButton.addEventListener('pointerdown', this.onTouchInteract);
  }

  readMovement(target: THREE.Vector2): THREE.Vector2 {
    target.set(0, 0);
    if (this.keys.has('KeyA')) target.x -= 1;
    if (this.keys.has('KeyD')) target.x += 1;
    if (this.keys.has('KeyW')) target.y += 1;
    if (this.keys.has('KeyS')) target.y -= 1;
    target.add(this.touchMovement);
    if (target.lengthSq() > 1) target.normalize();
    return target;
  }

  consumeLook(delta = 0): [number, number] {
    const horizontal = Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft'));
    const vertical = Number(this.keys.has('ArrowDown')) - Number(this.keys.has('ArrowUp'));
    const result: [number, number] = [this.lookX + horizontal * 600 * delta, this.lookY + vertical * 600 * delta];
    this.lookX = 0;
    this.lookY = 0;
    return result;
  }

  consumeInteract(): boolean {
    const queued = this.interactQueued;
    this.interactQueued = false;
    return queued;
  }

  consumeHandprint(): boolean {
    const queued = this.handprintQueued;
    this.handprintQueued = false;
    return queued;
  }

  reset(): void {
    this.clear();
    this.lookX = 0;
    this.lookY = 0;
    this.interactQueued = false;
    this.handprintQueued = false;
    this.touchPointer = null;
    this.lookPointer = null;
  }

  requestPointerLock(): void {
    if (document.pointerLockElement === this.canvas) return;
    const request = (this.canvas as HTMLCanvasElement & { requestPointerLock?: () => unknown }).requestPointerLock?.bind(this.canvas);
    if (!request) return;
    try {
      const result = request() as Promise<void> | undefined;
      result?.catch?.(() => undefined);
    } catch { }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.removeEventListener('pointerdown', this.onCanvasDown);
    this.canvas.removeEventListener('pointermove', this.onCanvasMove);
    this.canvas.removeEventListener('pointerup', this.onCanvasUp);
    this.canvas.removeEventListener('pointercancel', this.onCanvasUp);
    this.canvas.removeEventListener('lostpointercapture', this.onCanvasUp);
    this.stick.removeEventListener('pointerdown', this.onStickDown);
    this.stick.removeEventListener('pointermove', this.onStickMove);
    this.stick.removeEventListener('pointerup', this.onStickUp);
    this.stick.removeEventListener('pointercancel', this.onStickUp);
    this.stick.removeEventListener('lostpointercapture', this.onStickUp);
    this.interactButton.removeEventListener('pointerdown', this.onTouchInteract);
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return;
    if (event.code.startsWith('Arrow')) event.preventDefault();
    this.keys.add(event.code);
    if (!event.repeat && (event.code === 'KeyE' || event.code === 'Enter')) this.interactQueued = true;
    if (!event.repeat && event.code === 'KeyH') this.handprintQueued = true;
  };
  private readonly onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private readonly onMouseMove = (event: MouseEvent) => {
    if (document.pointerLockElement !== this.canvas) return;
    this.lookX += event.movementX;
    this.lookY += event.movementY;
  };
  private readonly onCanvasDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') {
      this.requestPointerLock();
      return;
    }
    event.preventDefault();
    this.lookPointer = event.pointerId;
    this.lastLook.set(event.clientX, event.clientY);
    try { this.canvas.setPointerCapture(event.pointerId); } catch { }
  };
  private readonly onCanvasMove = (event: PointerEvent) => {
    if (event.pointerId !== this.lookPointer) return;
    this.lookX += (event.clientX - this.lastLook.x) * 1.25;
    this.lookY += (event.clientY - this.lastLook.y) * 1.25;
    this.lastLook.set(event.clientX, event.clientY);
  };
  private readonly onCanvasUp = (event: PointerEvent) => {
    if (event.pointerId === this.lookPointer) this.lookPointer = null;
  };
  private readonly clear = () => {
    this.keys.clear();
    this.touchMovement.set(0, 0);
    this.updateKnob();
  };
  private readonly onVisibilityChange = () => {
    if (document.hidden) this.clear();
  };
  private readonly onTouchInteract = (event: PointerEvent) => {
    event.preventDefault();
    this.interactQueued = true;
  };
  private readonly onStickDown = (event: PointerEvent) => {
    event.preventDefault();
    const rect = this.stick.getBoundingClientRect();
    this.touchPointer = event.pointerId;
    this.touchCenter.set(rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.touchRadius = rect.width * 0.42;
    try { this.stick.setPointerCapture(event.pointerId); } catch { }
    this.updateTouch(event);
  };
  private readonly onStickMove = (event: PointerEvent) => {
    if (event.pointerId === this.touchPointer) this.updateTouch(event);
  };
  private readonly onStickUp = (event: PointerEvent) => {
    if (event.pointerId !== this.touchPointer) return;
    this.touchPointer = null;
    this.touchMovement.set(0, 0);
    this.updateKnob();
  };
  private updateTouch(event: PointerEvent): void {
    this.touchMovement.set(
      (event.clientX - this.touchCenter.x) / this.touchRadius,
      -(event.clientY - this.touchCenter.y) / this.touchRadius,
    );
    if (this.touchMovement.lengthSq() > 1) this.touchMovement.normalize();
    this.updateKnob();
  }
  private updateKnob(): void {
    this.knob.style.transform = `translate(calc(-50% + ${this.touchMovement.x * 34}px), calc(-50% - ${this.touchMovement.y * 34}px))`;
  }
}
