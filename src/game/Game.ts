import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { disposeMaterialLibrary } from '../assets/MaterialLibrary';
import { InputController } from '../core/InputController';
import { Loop } from '../core/Loop';
import { createRenderer, resizeRenderer } from '../core/Renderer';
import { NarrativeUI } from '../systems/NarrativeUI';
import { FirstPersonPerformanceRig, type PerformanceKind } from '../systems/FirstPersonPerformanceRig';
import { animateWorld, moveActorTo, setActorEmote, type ActorRig } from '../systems/WorldAnimationSystem';
import { createWorld, disposeWorldAssets, type Chapter, type World, type WorldInteraction } from './World';

const chapters: Record<Chapter, { kicker: string; title: string; objective: string }> = {
  home: { kicker: 'PRELUDE', title: 'The Promise', objective: 'Go to your daughter before you leave.' },
  calcutta: { kicker: 'SEPARATION', title: 'Made Small', objective: 'Walk through the streets of Calcutta.' },
  debt: { kicker: 'CHAPTER II', title: 'The Debt', objective: 'Ask for the money owed to you.' },
  prison: { kicker: 'SEPARATION', title: 'The Lost Years', objective: 'Wait for your release.' },
  wedding: { kicker: 'CHAPTER IV', title: 'A Stranger Again', objective: 'Find Mini.' },
  epilogue: { kicker: 'EPILOGUE', title: 'Home?', objective: 'Return home.' },
};

const journeyChapters: Chapter[] = ['home', 'calcutta', 'prison', 'epilogue'];

const streetMurmurs = [
  { at: 5.6, line: 'Keep the children indoors. The Kabuliwallah is coming.' },
  { at: 4.1, line: 'They say those men carry children away in their bags.' },
  { at: 1.5, line: 'Have you seen the size of his bag? What does he keep in there?' },
  { at: -1.8, line: 'Don’t accept anything from him, even if it’s free.' },
] as const;

type ActiveMurmur = {
  element: HTMLParagraphElement;
  actor: THREE.Object3D;
  line: string;
};

type PlanarMirror = THREE.Mesh & {
  _reflectionCameras?: WeakMap<THREE.Camera, THREE.PerspectiveCamera>;
};

type ActivePerformance = {
  kind: PerformanceKind;
  time: number;
  duration: number;
  actor?: THREE.Object3D;
  impactFired: boolean;
  events: Set<string>;
  basePosition: THREE.Vector3;
  baseRotation: THREE.Euler;
  baseFov: number;
  baseDaylight: number;
  actorYaw: number;
  onComplete: () => void;
};

export class Game {
  private readonly debugEnabled = import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(62, 1, 0.08, 90);
  private readonly ui = new NarrativeUI();
  private readonly input: InputController;
  private readonly performanceRig: FirstPersonPerformanceRig;
  private readonly loop = new Loop((delta, elapsed) => this.update(delta, elapsed), () => this.render());
  private readonly player = new THREE.Vector3();
  private readonly movement = new THREE.Vector2();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly interactionPosition = new THREE.Vector3();
  private readonly bubblePosition = new THREE.Vector3();
  private focusedInteraction?: WorldInteraction;
  private conversationAnchor?: THREE.Object3D;
  private walkBlend = 0;
  private stepPhase = 0;
  private readonly clockLight = new THREE.DirectionalLight('#ffd59a', 2.8);
  private readonly environmentTexture: THREE.Texture;
  private backgroundTexture?: THREE.CanvasTexture;
  private world?: World;
  private chapter: Chapter = 'home';
  private yaw = 0;
  private pitch = 0;
  private frame = 0;
  private elapsed = 0;
  private chapterStep = 0;
  private visited = new Set<string>();
  private handprintMade = false;
  private readonly unlockedChapters = new Set<Chapter>(['home']);
  private allChaptersUnlocked = false;
  private stageOneUnlockClicks = 0;
  private active = false;
  private modal = true;
  private readonly murmurs: ActiveMurmur[] = [];
  private readonly murmurShown = new Set<number>();
  private readonly murmurTarget = new THREE.Vector3();
  private pausedForScreenshot = false;
  private reducedMotion = false;
  private collisionBlocks = 0;
  private sound?: { context: AudioContext; gain: GainNode; oscillators: OscillatorNode[] };
  private performance?: ActivePerformance;
  private prisonDaylight = 0;
  private prisonReleased = false;
  private readonly prisonYearInteractions = new Set<string>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environmentTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.environmentTexture;
    this.scene.environmentIntensity = 0.55;
    this.scene.add(this.camera);
    this.performanceRig = new FirstPersonPerformanceRig(this.camera);
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#ffe8ca', '#29211c', 1.28));
    this.clockLight.position.set(-6, 10, 4);
    this.clockLight.castShadow = true;
    this.clockLight.shadow.mapSize.set(1024, 1024);
    this.clockLight.shadow.camera.left = -12;
    this.clockLight.shadow.camera.right = 12;
    this.clockLight.shadow.camera.top = 12;
    this.clockLight.shadow.camera.bottom = -12;
    this.scene.add(this.clockLight);

    this.input = new InputController(
      canvas,
      this.element('#touch-stick'),
      this.element('#touch-knob'),
      this.element('#touch-interact'),
    );
    this.bindUi();
    this.enterChapter('home');
    this.ui.gameplayVisible(false);
    resizeRenderer(this.renderer, this.camera, 1.75);
    if (this.debugEnabled) this.installTestHooks();
    this.publishDiagnostics();
  }

  start(): void {
    this.loop.start();
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.stopSound();
    this.performanceRig.dispose();
    this.backgroundTexture?.dispose();
    this.environmentTexture.dispose();
    disposeWorldAssets();
    disposeMaterialLibrary();
    this.renderer.dispose();
    window.__THREE_GAME_DIAGNOSTICS__ = undefined;
    window.__THREE_GAME_TEST_HOOKS__ = undefined;
  }

  private bindUi(): void {
    this.element<HTMLButtonElement>('#begin-button').onclick = () => {
      this.ui.hideTitle(() => {
        this.ui.gameplayVisible(true);
        this.ui.handprintButton.classList.add('hidden');
        this.active = true;
        this.modal = true;
        this.ui.showCard(
          chapters.home.kicker,
          chapters.home.title,
          '',
          () => this.resumeFromCard(),
        );
      });
    };
    this.element<HTMLButtonElement>('#close-handprint').onclick = () => this.closeHandprint();
    this.ui.handprint.onclick = (event) => {
      if (event.target === this.ui.handprint) this.closeHandprint();
    };
    this.ui.handprintButton.onclick = () => this.openHandprint();
    this.element<HTMLButtonElement>('#restart-button').onclick = () => {
      this.ui.ending.classList.add('hidden');
      this.active = true;
      this.modal = false;
      this.handprintMade = false;
      this.enterChapter('home');
      this.ui.gameplayVisible(true);
      this.ui.handprintButton.classList.add('hidden');
    };
  }

  private update(delta: number, _elapsed: number): void {
    this.frame += 1;
    if (!this.pausedForScreenshot) this.elapsed += delta;
    resizeRenderer(this.renderer, this.camera, 1.75);
    if (this.world && !this.pausedForScreenshot) {
      animateWorld(
        this.world.actors,
        this.world.ambient,
        this.elapsed,
        delta,
        this.performance ? this.camera.position : this.player,
        this.conversationAnchor ?? this.focusedInteraction?.object,
        this.reducedMotion,
      );
      if (this.chapter === 'home' && this.visited.has('daughter-around-table')) {
        const daughter = this.world.interactions.find(item => item.id === 'daughter')?.object;
        const rig = daughter?.userData.actorRig as ActorRig | undefined;
        if (rig && !rig.destination) {
          this.visited.delete('daughter-around-table');
          this.visited.add('daughter-walking-to-door');
          moveActorTo(daughter, new THREE.Vector3(-1.7, 0, -5.08));
        }
      }
      if (this.chapter === 'home' && this.visited.has('daughter-walking-to-door')) {
        const daughter = this.world.interactions.find(item => item.id === 'daughter')?.object;
        const rig = daughter?.userData.actorRig as ActorRig | undefined;
        if (rig && !rig.destination) {
          this.visited.delete('daughter-walking-to-door');
          setActorEmote(daughter, undefined);
          rig.root.rotation.y = Math.PI / 2;
        }
      }
    }
    if (this.performance && !this.pausedForScreenshot) this.updatePerformance(delta);
    this.updateSpeechBubble();
    this.updateMurmurs();
    if (this.modal && !this.ui.handprint.classList.contains('hidden') && this.input.consumeHandprint()) {
      this.closeHandprint();
    }
    if (!this.active || this.modal || this.pausedForScreenshot) {
      this.publishDiagnostics();
      return;
    }

    const [lookX, lookY] = this.input.consumeLook(delta);
    this.yaw -= lookX * 0.0021;
    this.pitch = THREE.MathUtils.clamp(this.pitch - lookY * 0.0018, -1.12, 1.05);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    this.input.readMovement(this.movement);
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const speed = 3.25 * delta;
    const moveX = (this.forward.x * this.movement.y + this.right.x * this.movement.x) * speed;
    const moveZ = (this.forward.z * this.movement.y + this.right.z * this.movement.x) * speed;
    this.movePlayer(moveX, moveZ);
    const self = this.world?.story?.self;
    if (self) {
      self.position.set(this.player.x, 0, this.player.z);
      self.rotation.y = this.yaw + Math.PI;
    }
    if (this.chapter === 'calcutta') this.maybeMurmurStreet();
    if (this.chapter === 'calcutta' && !this.visited.has('suspicion') && this.movement.lengthSq() > 0
      && this.player.z < 3.2 && this.player.z > 1.5) {
      const onlooker = this.world?.interactions.find(item => item.id === 'suspicion');
      if (onlooker) {
        this.stageStreetEncounter(onlooker);
        this.publishDiagnostics();
        return;
      }
    }
    if (this.chapter === 'calcutta' && this.visited.has('suspicion') && !this.visited.has('sale')
      && this.movement.lengthSq() > 0 && this.player.z < 1.15 && this.player.z > -0.5) {
      const customer = this.world?.interactions.find(item => item.id === 'sale');
      if (customer) {
        this.stageStreetEncounter(customer);
        this.publishDiagnostics();
        return;
      }
    }
    const moving = this.movement.length();
    this.walkBlend = THREE.MathUtils.damp(this.walkBlend, moving, 8, delta);
    this.stepPhase += delta * (5.8 + this.walkBlend * 2.6);
    const bob = this.reducedMotion ? 0 : Math.sin(this.stepPhase * 2) * 0.026 * this.walkBlend;
    const sway = this.reducedMotion ? 0 : Math.cos(this.stepPhase) * 0.012 * this.walkBlend;
    this.camera.position.set(this.player.x + sway, this.player.y + this.eyeHeight() + bob, this.player.z);
    this.camera.rotation.z = this.reducedMotion ? 0 : Math.sin(this.stepPhase) * 0.006 * this.walkBlend;
    const targetFov = 62 + this.walkBlend * 1.4;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, delta);
      this.camera.updateProjectionMatrix();
    }

    const interaction = this.findInteraction();
    this.focusedInteraction = interaction;
    this.ui.setPrompt(interaction?.label);
    if (interaction && this.input.consumeInteract()) this.activate(interaction);
    if (this.handprintMade && this.input.consumeHandprint()) this.openHandprint();

    this.publishDiagnostics();
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private enterChapter(chapter: Chapter): void {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('kabuliwallah-chapters') ?? '[]');
      if (Array.isArray(saved)) for (const key of saved) {
        if (typeof key === 'string' && Object.hasOwn(chapters, key)) this.unlockedChapters.add(key as Chapter);
      }
      this.unlockedChapters.add(chapter);
      localStorage.setItem('kabuliwallah-chapters', JSON.stringify([...this.unlockedChapters]));
    } catch { this.unlockedChapters.add(chapter); }
    this.updateChapterNavigation(chapter);
    this.prisonDaylight = 0;
    this.prisonReleased = false;
    this.prisonYearInteractions.clear();
    if (this.world) {
      this.scene.remove(this.world.root);
      this.world.root.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        (child as THREE.Mesh & { dispose?: () => void }).dispose?.();
        child.geometry.dispose();
      });
    }
    this.chapter = chapter;
    this.focusedInteraction = undefined;
    this.conversationAnchor = undefined;
    this.ui.closeDialogue();
    this.performance = undefined;
    this.performanceRig.hide();
    this.ui.setCinematic(false);
    this.element('#time-wash').style.opacity = '0';
    this.element('#performance-caption').classList.add('hidden');
    this.ui.positionSpeechBubble(0, 0, false);
    this.walkBlend = 0;
    this.chapterStep = 0;
    this.visited.clear();
    this.ui.clearMurmurs();
    this.murmurs.length = 0;
    this.murmurShown.clear();
    this.world = createWorld(chapter);
    this.scene.add(this.world.root);
    this.player.copy(this.world.spawn);
    const mirror = this.world.story?.mirror as PlanarMirror | undefined;
    if (mirror?._reflectionCameras) {
      const reflectionCamera = new THREE.PerspectiveCamera();
      reflectionCamera.layers.enable(1);
      mirror._reflectionCameras.set(this.camera, reflectionCamera);
    }
    this.yaw = 0;
    this.pitch = 0;
    this.collisionBlocks = 0;
    this.performanceRig.setHandprintAge(this.handprintAge(chapter));
    this.camera.position.set(this.player.x, this.eyeHeight(), this.player.z);
    this.camera.rotation.set(0, this.yaw, 0, 'YXZ');
    const darker = chapter === 'prison';
    this.backgroundTexture?.dispose();
    this.backgroundTexture = undefined;
    if (chapter === 'home' || chapter === 'calcutta' || chapter === 'debt' || chapter === 'wedding') {
      this.backgroundTexture = this.createSkyTexture(chapter === 'wedding');
      this.scene.background = this.backgroundTexture;
      this.scene.fog = new THREE.Fog(chapter === 'wedding' ? '#d5af85' : chapter === 'home' ? '#9a7158' : '#bb8b68', 14, 38);
    } else {
      const background = new THREE.Color(darker ? '#1b2225' : chapter === 'epilogue' ? '#17120f' : '#513324');
      this.scene.background = background;
      this.scene.fog = new THREE.Fog(background, darker ? 7 : 14, darker ? 38 : 38);
    }
    this.clockLight.color.set(chapter === 'prison' ? '#b9d5e1' : '#ffd09a');
    this.clockLight.intensity = chapter === 'prison' ? 0.45 : 2.8;
    if (chapter === 'prison') {
      const light = this.world.story?.prisonWindowLight as THREE.PointLight | undefined;
      if (light) light.intensity = 0.2;
    }
    const info = chapters[chapter];
    this.ui.setChapter(info.kicker, info.title);
    this.ui.setObjective(info.objective);
    this.ui.setPrompt();
  }

  private updateChapterNavigation(current: Chapter): void {
    this.ui.chapterNav.replaceChildren();
    for (const [stage, key] of journeyChapters.entries()) {
      const chapter = chapters[key];
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = String(stage);
      button.setAttribute('aria-label', `Stage ${stage}: ${chapter.title}`);
      const locked = !this.allChaptersUnlocked && !this.unlockedChapters.has(key);
      button.setAttribute('aria-disabled', String(locked));
      button.setAttribute('aria-current', key === current ? 'step' : 'false');
      button.title = `${chapter.title} — ${locked ? 'Locked' : 'Restart chapter'}`;
      button.onclick = () => {
        if (locked) {
          if (key === 'calcutta') this.tryChapterBackdoor();
          return;
        }
        this.ui.cancelCard();
        this.ui.closeHandprint();
        this.ui.ending.classList.add('hidden');
        this.active = true;
        this.modal = false;
        this.handprintMade = key !== 'home';
        this.enterChapter(key);
        if (key === 'epilogue') {
          this.finishJourney();
          return;
        }
        this.ui.gameplayVisible(true);
        this.ui.handprintButton.classList.toggle('hidden', !this.handprintMade);
        this.input.requestPointerLock();
      };
      this.ui.chapterNav.append(button);
    }
  }

  private tryChapterBackdoor(): void {
    this.stageOneUnlockClicks += 1;
    if (this.stageOneUnlockClicks < 3) return;
    this.allChaptersUnlocked = true;
    this.stageOneUnlockClicks = 0;
    this.updateChapterNavigation(this.chapter);
  }

  private movePlayer(deltaX: number, deltaZ: number): void {
    if (!this.world) return;
    const nextX = THREE.MathUtils.clamp(this.player.x + deltaX, this.world.bounds.min.x, this.world.bounds.max.x);
    if (!this.playerBlocked(nextX, this.player.z)) this.player.x = nextX;
    else if (Math.abs(deltaX) > 0.0001) this.collisionBlocks += 1;
    const nextZ = THREE.MathUtils.clamp(this.player.z + deltaZ, this.world.bounds.min.y, this.world.bounds.max.y);
    if (!this.playerBlocked(this.player.x, nextZ)) this.player.z = nextZ;
    else if (Math.abs(deltaZ) > 0.0001) this.collisionBlocks += 1;
  }

  private eyeHeight(): number {
    return this.chapter === 'calcutta' ? 0.92 : 1.62;
  }

  private playerBlocked(x: number, z: number): boolean {
    const radius = 0.29;
    return this.world?.colliders.some((collider) => {
      const nearestX = THREE.MathUtils.clamp(x, collider.minX, collider.maxX);
      const nearestZ = THREE.MathUtils.clamp(z, collider.minZ, collider.maxZ);
      return (x - nearestX) ** 2 + (z - nearestZ) ** 2 < radius ** 2;
    }) ?? false;
  }

  private handprintAge(chapter: Chapter): number {
    return ({ home: 0, calcutta: 0.18, debt: 0.28, prison: 0.7, wedding: 0.94, epilogue: 1 } as Record<Chapter, number>)[chapter];
  }

  private createSkyTexture(wedding: boolean): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, wedding ? '#6f91aa' : '#607f98');
    gradient.addColorStop(0.58, wedding ? '#c4a17f' : '#ae8062');
    gradient.addColorStop(1, wedding ? '#e0be91' : '#c09270');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  private findInteraction(): WorldInteraction | undefined {
    if (!this.world) return undefined;
    this.camera.getWorldDirection(this.forward);
    let best: WorldInteraction | undefined;
    let bestDistance = Infinity;
    for (const item of this.world.interactions) {
      if (!item.object.visible) continue;
      if (this.chapter === 'home' && item.id === 'make-print') continue;
      if (this.chapter === 'home' && this.handprintMade && (item.id === 'daughter' || item.id === 'make-print')) continue;
      if (this.chapter === 'home' && item.id === 'leave-home'
        && (this.visited.has('daughter-around-table') || this.visited.has('daughter-walking-to-door'))) continue;
      if (this.chapter === 'prison' && this.prisonReleased && (item.id === 'window' || item.id === 'prison-bench')) continue;
      if (this.chapter === 'prison' && this.prisonYearInteractions.has(`${this.chapterStep}:${item.id}`)) continue;
      if (this.chapter === 'calcutta' && this.visited.has(item.id)) continue;
      if (this.chapter === 'wedding' && this.visited.has(item.id) && item.id !== 'father') continue;
      item.object.getWorldPosition(this.interactionPosition);
      const toward = this.interactionPosition.clone().sub(this.player);
      toward.y = 0;
      const distance = toward.length();
      const facing = toward.normalize().dot(this.forward.clone().setY(0).normalize());
      const nearbyDoor = (item.id === 'leave-home' || item.id === 'last-door') && distance <= 2.6;
      const range = this.chapter === 'home' && item.id === 'daughter' ? 1.65 : 3;
      if (distance > range || (!nearbyDoor && facing < 0.12)) continue;
      if (distance < bestDistance) {
        best = item;
        bestDistance = distance;
      }
    }
    return best;
  }

  private activate(interaction: WorldInteraction): void {
    this.playCue(420, 0.055, 0.035);
    this.conversationAnchor = interaction.object.userData.actorRig ? interaction.object : undefined;
    if (this.chapter === 'home') this.activateHome(interaction.id);
    else if (this.chapter === 'calcutta') this.activateCalcutta(interaction.id);
    else if (this.chapter === 'debt') this.activateDebt();
    else if (this.chapter === 'prison') this.activatePrison(interaction.id);
    else if (this.chapter === 'wedding') this.activateWedding(interaction.id);
    else this.finishJourney();
  }

  private stageStreetEncounter(interaction: WorldInteraction): void {
    this.camera.position.set(this.player.x, this.player.y + 1.62, this.player.z);
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    moveActorTo(interaction.object, this.player.clone().addScaledVector(this.forward, 1.25).setY(0));
    this.activate(interaction);
  }

  private activateHome(id: string): void {
    if (id === 'make-print' && !this.visited.has('home-ready')) id = 'daughter';
    if (id === 'daughter') {
      this.visited.add(id);
      this.conversationAnchor = this.world?.interactions.find(item => item.id === 'daughter')?.object;
      const daughter = this.conversationAnchor;
      setActorEmote(this.conversationAnchor, 'reach');
      const answer = (thought: string): void => {
        this.say('Thought', 'Rahamat', thought, [{
          label: '“I don’t want to leave you either, Parvati.”', action: () => {
            setActorEmote(daughter, 'sad');
            this.say('Parvati', 'Your daughter', 'Then stay. Please, Baba. Just until tomorrow. I will be good.', [{
              label: 'Kneel beside her. “You have done nothing wrong. I must work, but leaving you hurts.”', action: () => this.startPerformance('kneel', daughter, 1.8, () => {
                setActorEmote(daughter, 'reach');
                this.say('Parvati', 'Your daughter', 'Then take my hand with you. Here, on this paper. Keep it where you can feel it.', [{
                  label: '“Show me.” Help her make the handprint', action: () => this.startPerformance('stand', daughter, 1.2, () => {
                    this.visited.add('home-ready');
                    this.yaw = this.camera.rotation.y;
                    this.pitch = this.camera.rotation.x;
                    this.activateHome('make-print');
                  }),
                }], daughter);
              }),
            }], daughter);
          },
        }], null);
      };
      this.say('Farewell', 'Your daughter', 'Baba, don’t go. Please. Who will sit with me when you are gone?', [
        { label: '“I will carry home with me.”', action: () => answer('I had rehearsed this goodbye on the road. Now she holds my sleeve, and none of those words is enough.') },
        { label: '“I wish I could stay.”', action: () => answer('The road means work. This courtyard means her. I cannot make either need disappear.') },
        { label: 'Stay quiet for a moment', action: () => answer('If I answer too quickly, she will hear me trying not to cry. For a moment, I cannot find the words.') },
      ]);
    } else if (id === 'make-print') {
      const daughter = this.world?.interactions.find((item) => item.id === 'daughter')?.object;
      setActorEmote(daughter, 'press');
      this.startPerformance('handprint', daughter, 5.5, () => {
          this.handprintMade = true;
          this.visited.add(id);
          this.ui.handprintButton.classList.remove('hidden');
          const daughter = this.world?.interactions.find((item) => item.id === 'daughter')?.object;
          const rig = daughter?.userData.actorRig as ActorRig | undefined;
          if (rig) {
            rig.rightArm.getObjectByName('hand')?.quaternion.identity();
            rig.basePosition.x = -1.43;
          }
          this.visited.add('daughter-around-table');
          moveActorTo(daughter, new THREE.Vector3(-1.8, 0, -2.5));
          setActorEmote(daughter, 'sad');
          this.player.x = 1.78;
          this.camera.position.set(this.player.x, 1.62, this.player.z);
          this.yaw = this.camera.rotation.y;
          this.pitch = this.camera.rotation.x;
          this.closeDialogue('Walk to the courtyard door. She follows, hoping you will look back.');
      });
    } else if (this.handprintMade) {
      const daughter = this.world?.interactions.find((item) => item.id === 'daughter')?.object;
      this.conversationAnchor = daughter;
      setActorEmote(daughter, 'reach');
      this.say('Farewell', 'Your daughter', 'Baba… don’t forget me. Will you keep it close?', [
        { label: 'Look back. “Always, Parvati.”', action: () => this.startPerformance('look-back', daughter, 2.2, () => this.say('One last look', 'Your daughter', 'I will wait for you, Baba.', [{
          label: 'Leave reluctantly for Calcutta', action: () => this.transition('SEPARATION', 'Made Small', 'calcutta'),
        }], daughter)) },
        { label: 'Hold the handprint and step through', quiet: true, action: () => this.say('Thought', 'Rahamat', 'I want to turn back. I carry this small hand against my heart because I cannot carry her with me.', [{ label: '“Not for a moment.” Leave with her handprint', action: () => this.transition('SEPARATION', 'Made Small', 'calcutta') }], null) },
      ]);
    } else {
      this.say('Prelude', 'The door', 'Parvati is waiting beside the paper.', [
        { label: 'Return to the table', action: () => this.closeDialogue('Help your daughter make the handprint.') },
      ], null);
    }
  }

  private activateCalcutta(id: string): void {
    if (this.visited.has(id)) return;
    if (id === 'class-door') {
      this.visited.add(id);
      this.transition('SEPARATION', 'The Lost Years', 'prison');
      return;
    }
    if (id === 'mini' && !this.visited.has('mini-first')) {
      this.visited.add('mini-first');
      const mini = this.conversationAnchor;
      setActorEmote(mini, 'shy');
      moveActorTo(mini, new THREE.Vector3(2.8, 0, -6.8));
      this.say('First meeting', 'Mini’s father', 'Come here, Mini. There is nothing to fear.', [{
        label: 'Offer nuts and raisins, without moving closer', action: () => {
          setActorEmote(mini, 'shy');
          this.say('Thought', 'Rahamat', 'She holds closer to her father. I will not press her.', [{
            label: 'Give her time · several visits pass', action: () => {
              moveActorTo(mini, new THREE.Vector3(2.35, 0, -6.1));
              this.startPerformance('visits', mini, 3.8, () => {
                this.clockLight.intensity = 2.8;
                this.yaw = 0;
                this.pitch = 0;
                this.closeDialogue('Mini is by the doorway. Walk over to her.');
              });
            },
          }], null);
        },
      }], this.world?.story?.father);
      return;
    }
    this.visited.add(id);
    if (id === 'sale') {
      setActorEmote(this.conversationAnchor, 'talk');
      this.say('Street transaction', 'Customer', '“How much for these raisins? Your price seems high, Kabuliwallah.”', [
        { label: '“Taste a few. These are good raisins.”', action: () => {
          const customer = this.conversationAnchor;
          this.startPerformance('trade', customer, 1.9, () => this.say('The work of migration', 'Customer', '“Sweet. All right, I’ll take a small bag. Have you come all the way from Kabul?”', [
            { label: '“Yes. My daughter is waiting there.”', action: () => this.say('', 'Customer', '“Then I hope you can go home to her soon.”', [{ label: 'Close the ledger', action: () => this.afterStreetMoment() }], customer) },
          ], customer));
        } },
        { label: 'Lower the price to finish the sale', quiet: true, action: () => {
          const customer = this.conversationAnchor;
          this.startPerformance('trade', customer, 1.9, () => this.say('The work of migration', 'Customer', '“That’s better. A small bag, then. Here is your money.”', [
            { label: 'Say nothing. Close the ledger', action: () => this.afterStreetMoment() },
          ], customer));
        } },
      ]);
    } else if (id === 'suspicion') {
      setActorEmote(this.conversationAnchor, 'argue');
      const onlooker = this.conversationAnchor;
      const reflect = (thought: string): void => {
        setActorEmote(onlooker, 'shy');
        this.say('Thought', 'Rahamat', thought, [{
          label: 'Take a breath and continue down the street', action: () => this.afterStreetMoment(),
        }], null);
      };
      this.say('Street encounter', 'Onlooker', '“Keep that great bag away from the children. What do you carry in it?”', [
        { label: 'Show him the fruit', action: () => this.startPerformance('gift', onlooker, 1.8, () => this.say('Suspicion names the stranger first', 'Onlooker', '“Goods, then. Still—people have heard stories about men from the mountains.”', [{ label: '“Stories are not a man.” Keep walking', action: () => reflect('He sees a stranger. Parvati would see her father.') }], onlooker)) },
        { label: '“I am a father too. Do not speak of me as a danger.”', action: () => this.say('Reply', 'Onlooker', '“A father? Well… I only asked about the bag.”', [{ label: 'Let the silence answer him', action: () => reflect('For a moment, he has no answer. I am proud that I spoke. I am tired of needing to.') }], onlooker) },
        { label: 'Keep walking', action: () => reflect('I swallow the reply. There is work to do, and a journey home to earn. Silence does not mean that his words did not hurt.'), quiet: true },
      ], onlooker);
    } else {
      setActorEmote(this.conversationAnchor, 'talk');
      this.say('Old friends', 'Mini', '“Kabuliwallah! Kabuliwallah! What is inside your bag?”', [
        { label: 'Offer raisins without asking payment', action: () => {
          setActorEmote(this.conversationAnchor, 'talk');
          this.say('A patient listener · later visits', 'Mini', '“What have you got in your bag?”', [
            { label: '“An elephant!”', action: () => {
              setActorEmote(this.conversationAnchor, 'laugh');
              this.playLaughCue();
              this.say('The shared joke', 'Rahamat', 'And when are you going to your father-in-law’s house?', [{
                label: 'Listen to her quick reply', action: () => this.say('She does not yet understand marriage', 'Mini', 'Are you going there?', [{
                  label: 'Shake your fist playfully: “I will thrash my father-in-law!”', action: () => this.finishMiniFriendship(),
                }], this.world?.story?.mini),
              }], null);
            } },
          ]);
        } },
        { label: 'Ask if she is going to her father-in-law’s house', action: () => {
          setActorEmote(this.conversationAnchor, 'laugh');
          this.playLaughCue();
          this.say('The joke before time changes it', 'Mini', '“Are you going there?”', [
            { label: '“I will thrash my father-in-law!”', action: () => this.finishMiniFriendship() },
          ]);
        }, quiet: true },
      ]);
    }
  }

  private afterStreetMoment(): void {
    const complete = ['sale', 'suspicion', 'mini'].every(id => this.visited.has(id));
    this.closeDialogue(complete ? 'January: collect the accounts before your yearly return home.' : 'Attend to another part of the street.');
    if (complete) {
      setTimeout(() => this.transition('CHAPTER II', 'The Debt', 'debt'), 450);
    }
  }

  private finishMiniFriendship(): void {
    const mini = this.world?.story?.mini;
    setActorEmote(mini, 'laugh');
    this.playLaughCue();
    this.say('The eight-anna coin', 'Mini’s father', 'Why did you give her those? Here—take these eight annas.', [{
      label: 'Accept the coin, then give it to Mini', action: () => {
        this.say('A gift returned', 'Mini', 'For me?', [{
          label: 'Leave her with the fruit and coin', action: () => this.afterStreetMoment(),
        }], mini);
      },
    }], this.world?.story?.father);
  }

  private activateDebt(): void {
    setActorEmote(this.conversationAnchor, 'argue');
    const debtor = this.conversationAnchor;
    this.say('A Rampuri shawl', 'The debtor', '“I bought no Rampuri shawl from you. I owe you nothing.”', [
      {
        label: 'Point to the shawl in his hand',
        action: () => this.startPerformance('point-shawl', debtor, 1.8, () => {
          setActorEmote(debtor, 'argue');
          this.say('The disputed debt', 'The debtor', '“There is no account between us.”', [
            { label: 'Demand payment again', action: () => this.debtChoice() },
            {
              label: 'Imagine walking away',
              quiet: true,
              action: () => this.say(
                'A counterfactual—not Tagore’s plot',
                'A path the story did not take',
                'You leave with less money, but with your freedom. Interactivity can imagine this choice; it cannot pretend it is what Rahamat chose.',
                [{ label: 'Return to the remembered story', action: () => this.debtChoice() }],
                null,
              ),
            },
          ], debtor);
        }),
      },
      {
        label: 'Imagine walking away',
        quiet: true,
        action: () => this.say(
          'A counterfactual—not Tagore’s plot',
          'A path the story did not take',
          'You leave with less money, but with your freedom. Interactivity can imagine this choice; it cannot pretend it is what Rahamat chose.',
          [{ label: 'Return to the remembered story', action: () => this.debtChoice() }],
          null,
        ),
      },
    ]);
  }

  private debtChoice(): void {
    const debtor = this.world?.interactions.find((item) => item.id === 'debtor')?.object;
    this.startPerformance('debt', debtor, 7.2, () => this.startPerformance('look-back', this.world?.story?.mini, 1.5, () => this.afterArrest()));
  }

  private afterArrest(): void {
    const mini = this.world?.story?.mini;
    const father = this.world?.story?.father;
    setActorEmote(mini, 'talk');
    setActorEmote(father, 'reach');
    this.playCue(523.25, 0.18, 0.018);
    this.say('Mini calls out', 'Mini', '“O Kabuliwallah! Kabuliwallah!”', [{
      label: 'Listen to Mini',
      action: () => {
        setActorEmote(mini, 'talk');
        this.say('The old joke under restraint', 'Mini', '“Are you going to the father-in-law’s house?”', [{
          label: 'Lift your bound hands',
          action: () => {
            setActorEmote(mini, 'sad');
            this.startPerformance('bound-greeting', mini, 1.8, () => {
            this.say('Rahamat answers as he is led away', 'Rahamat', '“Just where I am going, little one. I would have thrashed him—but my hands are bound.”', [{
              label: 'Be taken to prison',
              action: () => this.transition('CHAPTER III', 'The Lost Years', 'prison'),
            }], null);
            });
          },
        }], mini);
      },
    }], mini);
  }

  private activatePrison(id: string): void {
    if (id === 'prison-bench') {
      this.prisonYearInteractions.add(`${this.chapterStep}:${id}`);
      this.startPerformance('sit', undefined, 1.8, () => this.say('The cell', 'Rahamat', 'The bench creaks from the weight of my waiting.', [
        { label: 'Sit with the silence', action: () => this.startPerformance('visits', undefined, 4, () => this.say('Still alone', 'Rahamat', 'The light moves. The door does not.', [{ label: 'Stand up', action: () => this.standFromBench() }], null)) },
        { label: 'Stand up', action: () => this.standFromBench() },
      ], null));
      return;
    }
    if (id === 'prison-door') {
      if (this.prisonReleased) {
        this.startPerformance('door-exit', undefined, 3.6, () => {
          this.enterChapter('epilogue');
          this.finishJourney();
        });
        return;
      }
      this.prisonYearInteractions.add(`${this.chapterStep}:${id}`);
      this.startPerformance('door-rattle', undefined, 1.15, () => this.say('The cell', 'Rahamat', 'I try the handle. The door shudders, but the bolt holds.', [{
        label: 'Return to the silence', action: () => this.closeDialogue('The window is the only thing that changes.'),
      }], null));
      return;
    }
    if (id !== 'window') return;
    const years = [
      ['YEAR 1', 'The light returns to the same wall.'],
      ['YEAR 4', 'Outside, another morning begins. Inside, nothing has moved.'],
      ['YEAR 8', 'The window grows pale. Parvati has lived eight years beyond the child you remember.'],
    ] as const;
    const [title, copy] = years[Math.min(this.chapterStep, years.length - 1)];
    this.chapterStep += 1;
    const final = this.chapterStep >= years.length;
    this.performanceRig.setHandprintAge(Math.min(1, 0.28 + this.chapterStep * 0.24));
    this.startPerformance('visits', undefined, 2.4, () => {
      this.modal = true;
      this.ui.showCard('Behind the same bars', title, copy, () => {
        this.ui.hideCard(() => {
          if (final) {
            this.prisonReleased = true;
            const door = this.world?.interactions.find((interaction) => interaction.id === 'prison-door');
            if (door) door.label = 'Try the locked door again';
            this.playCue(146.83, 0.9, 0.025);
            this.say('A voice beyond the door', 'Prison guard', '“Rahamat. Your time is up. Your sentence is complete. You are free to go.”', [{
              label: 'Rise and return to the door',
              action: () => this.closeDialogue('Return to the door that would not open.'),
            }], null);
          } else {
            this.modal = false;
            this.ui.setObjective('The cell remains. Sit, wait, or watch the window again.');
            this.input.requestPointerLock();
          }
        });
      });
    });
  }

  private standFromBench(): void {
    this.startPerformance('rise', undefined, 1.3, () => {
      this.yaw = this.camera.rotation.y;
      this.pitch = this.camera.rotation.x;
      this.closeDialogue('Nothing has changed. Walk, sit, or watch the window.');
    });
  }

  private activateWedding(id: string): void {
    if (id === 'wedding-guest') {
      this.visited.add(id);
      setActorEmote(this.conversationAnchor, 'talk');
      const guest = this.conversationAnchor;
      this.say('Wedding morning', 'Wedding guest', '“The wedding pipes began at dawn. Mini’s father has counted every lamp twice, but he has barely looked at them.”', [
        { label: 'Ask where Mini is', action: () => this.say('Wedding morning', 'Wedding guest', '“Inside, dressed for departure. Do not delay her family unless your need is grave.”', [{ label: 'Thank her', action: () => this.closeDialogue('Speak with Mini’s father at the threshold.') }], guest) },
      ], guest);
    } else if (id === 'musician') {
      this.visited.add(id);
      setActorEmote(this.conversationAnchor, 'talk');
      const musician = this.conversationAnchor;
      this.playCue(392, 0.22, 0.015);
      this.say('Morning music at the wedding gate', 'Musician', '“We play Bhairavi while one home prepares to let a daughter go. You look as though another farewell brought you here.”', [
        { label: 'Touch the folded handprint', action: () => this.say('Two departures echo across the threshold', 'Musician', '“Then speak before the procession begins. Time does not wait for a song to finish.”', [{ label: 'Step toward the family', action: () => this.closeDialogue('Find Mini and her father before the procession begins.') }], musician) },
      ], musician);
    } else if (id === 'grown-mini' && !this.visited.has(id)) {
      this.visited.add(id);
      const mini = this.conversationAnchor;
      setActorEmote(mini, 'shy');
      this.say('The same words, years later', 'Rahamat', '“Are you going to your father-in-law’s house?”', [
        { label: 'Wait for her answer', action: () => this.startPerformance('wedding-silence', mini, 4.2, () => {
          moveActorTo(mini, new THREE.Vector3(4.4, 0, -8.5));
          this.startPerformance('mini-departs', mini, 3.2, () => {
            if (mini) mini.visible = false;
            this.startPerformance('reckoning', undefined, 4.5, () => {
              this.ui.setObjective('The remembered child is not waiting unchanged at home.');
              this.say('Thought', 'Rahamat', 'Parvati, too. All these years, I have kept her small. I shall have to make friends with her again. What may have happened at home?', [{
                label: 'Look up at Mini’s father', action: () => this.fatherOffersMoney(),
              }], null);
            });
          });
        }) },
      ], null);
    } else if (id === 'father') {
      setActorEmote(this.conversationAnchor, 'talk');
      const father = this.conversationAnchor;
      if (this.visited.has('recognised')) {
        this.closeDialogue('Mini has been called. Try the old greeting.');
        return;
      }
      if (!this.visited.has('face-recognised')) {
        this.visited.add('face-recognised');
        setActorEmote(father, 'shy');
        this.say('Eight years have altered you', 'Mini’s father', 'Yes? Who is it? There are ceremonies today…', [{
          label: 'Offer the old smile. “It is Rahamat, sir.”', action: () => this.startPerformance('recognise-face', father, 2.4, () => {
            this.conversationAnchor = father;
            this.activateWedding('father');
          }),
        }], father);
        return;
      }
      this.say('At the wedding threshold', 'Mini’s father', 'When did you come, Rahamat?', [{
        label: '“Last evening. I was released from jail.”', action: () => {
          setActorEmote(father, 'shy');
          this.say('The welcome closes', 'Mini’s father', 'There are ceremonies going on. I am busy. Could you come another day?', [{
            label: 'Leave', action: () => this.startPerformance('hesitation', father, 3.8, () => this.say('A second refusal', 'Mini’s father', 'Mini? No, you cannot see her today. The ceremonies have already begun.', [{
              label: 'Return with the fruit: “Will you give these to her?”', action: () => {
                setActorEmote(father, 'receive');
                this.startPerformance('gift', father, 1.7, () => {
                this.say('A gift mistaken for a sale', 'Mini’s father', 'Let me pay you for these.', [{
                  label: 'Refuse payment. “I too have a little girl at home.”', action: () => this.startPerformance('refuse-payment', father, 1.35, () => this.say('A father’s gift', 'Rahamat', 'I think of my daughter and bring fruit to your child—not to make a profit.', [{
        label: 'Unfold the worn handprint', action: () => {
          this.startPerformance('recognition', father, 2.8, () => {
          this.visited.add('recognised');
          this.say('He calls into the house', 'Mini’s father', 'Bring Mini here.', [
            { label: 'Wait for Mini', action: () => {
              const mini = this.world?.story?.mini;
              if (mini) {
                mini.visible = true;
                const rig = mini.userData.actorRig as ActorRig;
                rig.basePosition.set(2.35, 0, -9.2);
                mini.position.copy(rig.basePosition);
                moveActorTo(mini, new THREE.Vector3(2.35, 0, -6.1));
              }
              setActorEmote(mini, 'shy');
              this.startPerformance('approach-mini', mini, 4, () => {
                this.player.copy(this.camera.position).setY(0);
                this.yaw = this.camera.rotation.y;
                this.pitch = this.camera.rotation.x;
                this.conversationAnchor = mini;
                this.activateWedding('grown-mini');
              });
            } },
          ], father);
          });
        } },
                  ], null)),
                }], father);
                });
              },
            }], father)),
          }], father);
        },
      }], father);
    }
  }

  private finishJourney(): void {
    if (document.pointerLockElement) void document.exitPointerLock();
    this.input.reset();
    this.movement.set(0, 0);
    this.active = false;
    this.modal = true;
    this.ui.gameplayVisible(false);
    this.ui.setPrompt();
    this.ui.ending.classList.remove('hidden');
  }

  private fatherOffersMoney(): void {
    const father = this.world?.story?.father;
    if (!father) return;
    const rig = father.userData.actorRig as ActorRig;
    moveActorTo(father, new THREE.Vector3(this.camera.position.x - 0.65, 0, this.camera.position.z - 1.35));
    this.startPerformance('look-to-father', father, 3.4, () => {
      const note = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.13, 0.006), new THREE.MeshStandardMaterial({ color: '#b8aa7b', roughness: 0.95 }));
      note.name = 'journey-banknote';
      const border = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.09, 0.007), new THREE.MeshStandardMaterial({ color: '#69715a', roughness: 0.95 }));
      note.add(border);
      note.position.set(0, -0.64, 0.07);
      rig.rightArm.add(note);
      setActorEmote(father, 'receive');
      this.say('Two fathers', 'Mini’s father', 'Go back to your own daughter, Rahamat, in your own country. May your meeting bring happiness to my child.', [{
        label: 'Accept the money for the journey home', action: () => {
          this.startPerformance('receive-money', father, 2.4, () => {
            note.visible = false;
            this.transition('EPILOGUE', 'Home?', 'epilogue');
          });
        },
      }], father);
    });
  }

  private transition(kicker: string, title: string, next: Chapter): void {
    this.modal = true;
    this.input.reset();
    this.movement.set(0, 0);
    this.ui.closeDialogue();
    this.playCue(174, 0.7, 0.025);
    this.ui.showCard(kicker, title, '', () => {
      this.enterChapter(next);
      this.ui.hideCard(() => {
        if (next === 'epilogue') {
          this.finishJourney();
          return;
        }
        this.modal = false;
        this.input.requestPointerLock();
      });
    });
  }

  private resumeFromCard(): void {
    this.ui.hideCard(() => {
      this.modal = false;
      this.input.requestPointerLock();
    });
  }

  private say(context: string, speaker: string, line: string, choices: Parameters<NarrativeUI['showDialogue']>[3], anchor: THREE.Object3D | null | undefined = this.conversationAnchor): void {
    this.modal = true;
    this.input.reset();
    this.movement.set(0, 0);
    this.conversationAnchor = anchor ?? undefined;
    this.ui.showDialogue(context, speaker, line, choices, Boolean(this.conversationAnchor));
  }

  private closeDialogue(objective?: string): void {
    setActorEmote(this.conversationAnchor, undefined);
    this.conversationAnchor = undefined;
    this.ui.closeDialogue();
    this.modal = false;
    if (objective) this.ui.setObjective(objective);
    this.input.requestPointerLock();
  }

  private startPerformance(kind: PerformanceKind, actor: THREE.Object3D | undefined, duration: number, onComplete: () => void): void {
    this.modal = true;
    this.input.reset();
    this.movement.set(0, 0);
    this.ui.closeDialogue();
    this.ui.setPrompt();
    this.ui.setCinematic(true);
    this.conversationAnchor = undefined;
    this.performanceRig.begin(kind);
    this.performance = {
      kind,
      time: 0,
      duration,
      actor,
      impactFired: false,
      events: new Set<string>(),
      basePosition: this.camera.position.clone(),
      baseRotation: this.camera.rotation.clone(),
      baseFov: this.camera.fov,
      baseDaylight: this.prisonDaylight,
      actorYaw: actor?.rotation.y ?? 0,
      onComplete,
    };
    if (kind === 'trade' || kind === 'gift') setActorEmote(actor, 'receive');
    else if (kind === 'handprint') setActorEmote(actor, 'press');
    else if (kind === 'debt') setActorEmote(actor, 'argue');
    else if (kind === 'receive-money') setActorEmote(actor, 'receive');
    else if (kind === 'refuse-payment') setActorEmote(actor, 'soften');
    else if (kind === 'approach-mini') setActorEmote(actor, 'shy');
    else if (kind === 'wedding-silence' || kind === 'mini-departs' || kind === 'hesitation') setActorEmote(actor, 'shy');
    else setActorEmote(actor, 'talk');
  }

  private updatePerformance(delta: number): void {
    const performance = this.performance;
    if (!performance) return;
    performance.time += delta;
    const progress = Math.min(performance.time / performance.duration, 1);
    this.performanceRig.update(performance.kind, progress);
    this.camera.position.copy(performance.basePosition);
    this.camera.rotation.copy(performance.baseRotation);
    this.camera.fov = performance.baseFov;

    const eased = THREE.MathUtils.smoothstep(progress, 0, 1);
    if (['look-back', 'recognise-face', 'approach-mini'].includes(performance.kind) && performance.actor) {
      if (performance.kind === 'approach-mini') {
        const aisle = new THREE.Vector3(1.65, 1.62, -4.6);
        const end = new THREE.Vector3(1.65, 1.62, -5.15);
        const clear = new THREE.Vector3(performance.basePosition.x, 1.62, -4.6);
        if (progress < 0.25) this.camera.position.lerpVectors(performance.basePosition, clear, THREE.MathUtils.smoothstep(progress, 0, 0.25));
        else if (progress < 0.72) this.camera.position.lerpVectors(clear, aisle, THREE.MathUtils.smoothstep(progress, 0.25, 0.72));
        else this.camera.position.lerpVectors(aisle, end, THREE.MathUtils.smoothstep(progress, 0.72, 1));
      }
      const from = this.camera.quaternion.clone();
      const eye = performance.kind === 'look-back' ? 1.24 : 1.62;
      this.camera.lookAt(performance.actor.position.clone().add(new THREE.Vector3(0, eye, 0)));
      this.camera.quaternion.slerpQuaternions(from, this.camera.quaternion.clone(), THREE.MathUtils.smoothstep(progress, 0, 0.7));
      if (performance.kind === 'recognise-face' && progress > 0.65) setActorEmote(performance.actor, 'soften');
    }
    if (performance.kind === 'sit' || performance.kind === 'rise') {
      const target = performance.kind === 'sit' ? new THREE.Vector3(-1.4, 0.96, 1.7) : this.player.clone().add(new THREE.Vector3(0, 1.62, 0));
      this.camera.position.lerpVectors(performance.basePosition, target, eased);
      const from = this.camera.quaternion.clone();
      this.camera.lookAt(0, 2.2, -3.7);
      this.camera.quaternion.slerpQuaternions(from, this.camera.quaternion.clone(), eased);
    }
    if (performance.kind === 'door-rattle') {
      const door = this.world?.story?.prisonDoor;
      const handle = this.world?.story?.prisonHandle;
      const envelope = Math.sin(progress * Math.PI) ** 2;
      if (door) door.rotation.y = Math.sin(progress * Math.PI * 10) * envelope * 0.018;
      if (handle) handle.rotation.z = Math.sin(progress * Math.PI * 12) * envelope * 0.12;
      if (handle) {
        const from = this.camera.quaternion.clone();
        this.camera.lookAt(handle.getWorldPosition(new THREE.Vector3()));
        this.camera.quaternion.slerpQuaternions(from, this.camera.quaternion.clone(), THREE.MathUtils.smoothstep(progress, 0, 0.3));
      }
      this.camera.position.x += Math.sin(progress * Math.PI * 14) * envelope * 0.008;
    }
    if (performance.kind === 'door-exit') {
      const door = this.world?.story?.prisonDoor;
      const rahamat = this.world?.story?.exitingRahamat;
      const open = THREE.MathUtils.smoothstep(progress, 0.04, 0.38);
      if (door) door.rotation.y = THREE.MathUtils.lerp(0, -1.42, open);
      if (rahamat) {
        rahamat.visible = progress > 0.16;
        rahamat.position.set(1.28, 0, THREE.MathUtils.lerp(2.55, 5.15, THREE.MathUtils.smoothstep(progress, 0.18, 0.9)));
        rahamat.rotation.y = 0;
      }
      const sideView = new THREE.Vector3(-0.72, 1.48, 1.9);
      this.camera.position.lerpVectors(performance.basePosition, sideView, THREE.MathUtils.smoothstep(progress, 0.02, 0.3));
      if (rahamat) {
        const from = this.camera.quaternion.clone();
        this.camera.lookAt(rahamat.position.clone().add(new THREE.Vector3(0, 1.28, 0)));
        this.camera.quaternion.slerpQuaternions(from, this.camera.quaternion.clone(), THREE.MathUtils.smoothstep(progress, 0.02, 0.28));
      }
      this.element('#time-wash').style.opacity = String(THREE.MathUtils.smoothstep(progress, 0.86, 1));
    }
    if (performance.kind === 'visits') {
      const wash = THREE.MathUtils.smoothstep(progress, 0, 0.3) * (1 - THREE.MathUtils.smoothstep(progress, 0.7, 1));
      this.element('#time-wash').style.opacity = String(wash);
      if (this.chapter === 'prison') {
        this.prisonDaylight = THREE.MathUtils.lerp(performance.baseDaylight, Math.min(1, Math.max(this.chapterStep / 3, performance.baseDaylight + 0.12)), eased);
        const sky = this.world?.story?.prisonSky as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined;
        sky?.material.color.copy(new THREE.Color('#101827').lerp(new THREE.Color('#8fa5ae'), this.prisonDaylight));
        const light = this.world?.story?.prisonWindowLight as THREE.PointLight | undefined;
        if (light) light.intensity = 0.2 + this.prisonDaylight * 2;
        this.clockLight.intensity = 0.45 + this.prisonDaylight * 0.8;
      } else {
        this.clockLight.intensity = 0.65 + (1 - wash) * 2.15;
        const caption = this.element('#performance-caption');
        caption.textContent = 'A few mornings later';
        caption.classList.toggle('hidden', progress < 0.3 || progress > 0.7);
        if (progress >= 0.5) {
          this.player.set(1.65, 0, -1.6);
          this.camera.position.set(1.65, 1.62, -1.6);
          this.camera.rotation.set(0, 0, 0, 'YXZ');
        }
      }
    }
    if (performance.kind === 'kneel' || performance.kind === 'stand') {
      const blend = THREE.MathUtils.smoothstep(progress, 0, 1);
      this.camera.position.y = THREE.MathUtils.lerp(performance.basePosition.y, performance.kind === 'kneel' ? 1.04 : this.player.y + 1.62, blend);
      const from = this.camera.quaternion.clone();
      const target = performance.kind === 'kneel' && performance.actor
        ? performance.actor.position.clone().add(new THREE.Vector3(0, 1.24, 0))
        : new THREE.Vector3(-0.88, 0.54, -0.98);
      this.camera.lookAt(target);
      this.camera.quaternion.slerpQuaternions(from, this.camera.quaternion.clone(), blend);
    }
    if (performance.kind === 'handprint') {
      const ease = (a: number, b: number) => THREE.MathUtils.smoothstep(progress, a, b);
      const framing = ease(0, 0.16) * (1 - ease(0.78, 1));
      this.camera.position.lerp(new THREE.Vector3(-1.12, 1.18, -0.12), framing);
      const original = this.camera.quaternion.clone();
      this.camera.lookAt(-0.95, 0.65, -1.1);
      this.camera.quaternion.slerpQuaternions(original, this.camera.quaternion.clone(), framing);
      const rig = performance.actor?.userData.actorRig as ActorRig | undefined;
      if (rig) {
        rig.root.position.x = THREE.MathUtils.lerp(-1.55, -1.43, ease(0, 0.18));
        rig.root.position.y = -0.007 * ease(0.12, 0.28) * (1 - ease(0.61, 0.74));
        rig.root.rotation.y = THREE.MathUtils.lerp(performance.actorYaw, 0, ease(0, 0.18));
        rig.head.rotation.y = 1.1 * ease(0, 0.18);
        rig.head.rotation.x = 0.42 * ease(0, 0.18);
        rig.root.updateMatrixWorld(true);
        const target = new THREE.Vector3(-0.98, 0.575, -1.08);
        target.y += (1 - ease(0.22, 0.43)) * 0.12;
        target.y += ease(0.61, 0.74) * 0.22;
        rig.root.worldToLocal(target);
        target.sub(rig.rightArm.position);
        const pose = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -0.56, 0.07).normalize(), target.clone().normalize());
        rig.rightArm.quaternion.slerp(pose, ease(0.08, 0.22) * (1 - ease(0.74, 0.9)));
        rig.rightArm.scale.setScalar(1);
        const hand = rig.rightArm.getObjectByName('hand');
        if (hand) {
          rig.rightArm.updateWorldMatrix(true, false);
          const palmDown = rig.rightArm.getWorldQuaternion(new THREE.Quaternion()).invert()
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
          hand.quaternion.identity().slerp(palmDown, ease(0.08, 0.22) * (1 - ease(0.74, 0.9)));
        }
      }
      if (this.world?.story) {
        this.world.story.imprint.visible = progress >= 0.5 && progress < 0.78;
        this.world.story.paper.visible = progress < 0.78;
      }
      const rise = ease(0.8, 1);
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, 1.78, rise);
      const towardPaper = this.camera.quaternion.clone();
      this.camera.lookAt(0.45, 1.5, -5.3);
      this.camera.quaternion.slerpQuaternions(towardPaper, this.camera.quaternion.clone(), rise);
      if (progress < 0.78 && rig) {
        const hand = rig.rightArm.getObjectByName('hand');
        if (hand) {
          this.camera.updateMatrixWorld(true);
          rig.root.updateMatrixWorld(true);
          this.performanceRig.supportChildHand(this.camera, hand, progress);
        }
      }
      if (progress >= 0.78 && this.world?.story?.paper) {
        this.camera.updateMatrixWorld(true);
        this.performanceRig.liftPaperFrom(this.camera, this.world.story.paper.position, ease(0.78, 0.95));
      }
    }

    if (performance.kind === 'debt') {
      const story = this.world?.story;
      const event = (name: string, threshold: number, action: () => void): void => {
        if (progress < threshold || performance.events.has(name)) return;
        performance.events.add(name);
        action();
      };
      event('shove', 0.14, () => {
        setActorEmote(performance.actor, 'argue');
        this.playCue(116, 0.12, 0.022);
      });
      event('grapple', 0.25, () => {
        setActorEmote(performance.actor, 'struggle');
        const shawl = story?.shawl;
        if (shawl && this.world) {
          shawl.visible = true;
          this.world.root.attach(shawl);
          shawl.position.set(0.52, 0.1, -3.72);
          shawl.rotation.set(0.04, 0.4, 0.08);
          shawl.scale.setScalar(0.72);
        }
        this.playCue(92, 0.2, 0.025);
      });
      const impact = Math.max(0, 1 - Math.abs(progress - 0.5) / 0.075);
      this.camera.position.x += Math.sin(this.elapsed * 73) * impact * 0.052;
      this.camera.position.y += Math.cos(this.elapsed * 61) * impact * 0.038;
      this.camera.rotation.z += Math.sin(this.elapsed * 91) * impact * 0.022;
      this.camera.fov += impact * 5.2;
      if (progress >= 0.48 && !performance.impactFired) {
        performance.impactFired = true;
        setActorEmote(performance.actor, 'recoil');
        this.ui.pulseImpact();
        this.playCue(82, 0.42, 0.055);
      }
      event('police-enter', 0.58, () => {
        setActorEmote(performance.actor, 'fallen');
        const left = story?.leftPoliceman;
        const right = story?.rightPoliceman;
        if (left) left.visible = true;
        if (right) right.visible = true;
        moveActorTo(left, new THREE.Vector3(-0.68, 0, -4.25));
        moveActorTo(right, new THREE.Vector3(0.28, 0, -4.25));
        setActorEmote(left, 'restrain');
        setActorEmote(right, 'restrain');
        this.playCue(155, 0.25, 0.026);
      });
      event('arrest', 0.72, () => {
        if (story?.evidenceKnife) story.evidenceKnife.visible = true;
        setActorEmote(story?.leftPoliceman, 'restrain');
        setActorEmote(story?.rightPoliceman, 'restrain');
        setActorEmote(performance.actor, 'fallen');
        this.playCue(130.81, 0.36, 0.025);
      });
      if (progress >= 0.58 && story?.bloodPool) {
        story.bloodPool.visible = true;
        const spread = THREE.MathUtils.lerp(0.12, 1, THREE.MathUtils.smoothstep(progress, 0.58, 0.95));
        story.bloodPool.scale.set(0.62 * spread, 1, 0.42 * spread);
      }
      event('crowd', 0.79, () => {
        for (const [name, destination] of [
          ['crowdBoyA', new THREE.Vector3(-2.25, 0, -3.9)],
          ['crowdBoyB', new THREE.Vector3(2.3, 0, -4.15)],
        ] as const) {
          const actor = story?.[name];
          if (actor) actor.visible = true;
          moveActorTo(actor, destination);
        }
      });
      event('mini-enters', 0.84, () => {
        const mini = story?.mini;
        if (mini) {
          mini.visible = true;
          const rig = mini.userData.actorRig as { basePosition: THREE.Vector3 } | undefined;
          rig?.basePosition.set(1.75, 0, -3.75);
          mini.position.set(1.75, 0, -3.75);
        }
        moveActorTo(mini, new THREE.Vector3(0.72, 0, -3.45));
        setActorEmote(mini, 'reach');
        setActorEmote(story?.father, 'reach');
        this.playCue(392, 0.22, 0.014);
      });
      if (progress > 0.86) {
        this.camera.rotation.y -= ((progress - 0.86) / 0.14) * 0.18;
        this.camera.position.y -= (progress - 0.86) * 0.08;
      }
    } else if (performance.kind === 'point-shawl') {
      const shawl = this.world?.story?.shawl;
      if (shawl) {
        this.camera.updateMatrixWorld(true);
        this.performanceRig.pointAt(this.camera, shawl.getWorldPosition(new THREE.Vector3()), progress);
      }
    } else if (performance.kind === 'refuse-payment') {
      const envelope = Math.sin(Math.PI * progress) ** 2;
      this.camera.rotation.y += Math.sin(progress * Math.PI * 4) * envelope * (this.reducedMotion ? 0.025 : 0.14);
    } else if (performance.kind === 'hesitation') {
      const turn = THREE.MathUtils.smoothstep(progress, 0.06, 0.38);
      const returnToFather = THREE.MathUtils.smoothstep(progress, 0.62, 1);
      const hesitation = turn * (1 - returnToFather);
      this.camera.rotation.y += hesitation * 1.15;
      this.camera.rotation.x -= hesitation * 0.09;
      this.camera.position.y -= hesitation * 0.035;
      const caption = this.element('#performance-caption');
      caption.textContent = '“May I see the little one, sir? Just for a moment?”';
      caption.classList.toggle('hidden', progress < 0.66);
    } else if (performance.kind === 'recognition') {
      this.camera.position.y -= Math.sin(progress * Math.PI) * 0.035;
      if (progress > 0.46) setActorEmote(performance.actor, 'soften');
    } else if (performance.kind === 'wedding-silence') {
      const rig = performance.actor?.userData.actorRig as ActorRig | undefined;
      if (rig) rig.blushing = true;
      setActorEmote(performance.actor, 'shy');
    } else if (performance.kind === 'receive-money') {
      const note = this.world?.root.getObjectByName('journey-banknote');
      if (note && progress >= 0.42) {
        if (!performance.events.has('money-transferred')) {
          performance.events.add('money-transferred');
          this.world!.root.attach(note);
          note.userData.transferStart = note.position.clone();
          setActorEmote(performance.actor, 'soften');
        }
        const target = this.camera.localToWorld(new THREE.Vector3(0.2, -0.45 - THREE.MathUtils.smoothstep(progress, 0.65, 1) * 0.4, -1.05));
        this.world!.root.worldToLocal(target);
        note.position.lerpVectors(note.userData.transferStart, target, THREE.MathUtils.smoothstep(progress, 0.42, 0.85));
      }
    } else if (performance.kind === 'mini-departs' && performance.actor) {
      setActorEmote(performance.actor, 'shy');
      const from = this.camera.quaternion.clone();
      this.camera.lookAt(performance.actor.position.clone().add(new THREE.Vector3(0, 1.45, 0)));
      this.camera.quaternion.slerpQuaternions(from, this.camera.quaternion.clone(), THREE.MathUtils.smoothstep(progress, 0, 0.82));
    } else if (performance.kind === 'reckoning') {
      this.camera.position.y -= THREE.MathUtils.smoothstep(progress, 0.08, 0.48) * 0.72;
      this.camera.rotation.x -= THREE.MathUtils.smoothstep(progress, 0.2, 0.6) * 0.15;
    } else if (performance.kind === 'look-to-father' && performance.actor) {
      const from = this.camera.quaternion.clone();
      this.camera.lookAt(performance.actor.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
      this.camera.quaternion.slerpQuaternions(from, this.camera.quaternion.clone(), THREE.MathUtils.smoothstep(progress, 0, 1));
    }
    this.camera.updateProjectionMatrix();

    if (progress < 1) return;
    const finish = performance.onComplete;
    const holdPosture = ['kneel', 'stand', 'look-back', 'approach-mini', 'sit', 'rise', 'handprint'].includes(performance.kind)
      || (performance.kind === 'visits' && this.chapter === 'calcutta');
    if (!holdPosture) this.camera.position.copy(performance.basePosition);
    if (performance.kind === 'reckoning') this.camera.position.y -= 0.72;
    if (performance.kind !== 'look-to-father' && !holdPosture) this.camera.rotation.copy(performance.baseRotation);
    if (performance.kind === 'reckoning') this.camera.rotation.x -= 0.15;
    this.camera.fov = performance.baseFov;
    this.camera.updateProjectionMatrix();
    if (performance.kind === 'debt' || performance.kind === 'bound-greeting') this.performanceRig.update(performance.kind, 1);
    else this.performanceRig.hide();
    this.ui.setCinematic(false);
    this.element('#performance-caption').classList.add('hidden');
    if (performance.kind !== 'recognition' && performance.kind !== 'debt') setActorEmote(performance.actor, undefined);
    if (performance.kind === 'visits' || performance.kind === 'door-exit') this.element('#time-wash').style.opacity = '0';
    this.performance = undefined;
    finish();
  }

  private playLaughCue(): void {
    this.playCue(659.25, 0.11, 0.018);
    window.setTimeout(() => this.playCue(783.99, 0.13, 0.014), 115);
  }

  private maybeMurmurStreet(): void {
    if (this.murmurs.length) return;
    const actors = this.world?.actors ?? [];
    const speakerIndices = [0, 3, 5, 8];
    streetMurmurs.forEach((murmur, index) => {
      const actor = actors[speakerIndices[index]]?.root;
      if (!actor) return;
      const element = document.createElement('p');
      element.className = 'murmur';
      element.textContent = `“${murmur.line}”`;
      element.style.opacity = '0';
      element.hidden = true;
      this.ui.murmurs.append(element);
      this.murmurs.push({ element, actor, line: murmur.line });
      this.murmurShown.add(index);
    });
  }

  private updateMurmurs(): void {
    if (!this.murmurs.length) return;
    const hidden = this.modal || this.pausedForScreenshot;
    for (const murmur of this.murmurs) {
      if (hidden) {
        murmur.element.style.opacity = '0';
        murmur.element.hidden = true;
        continue;
      }
      murmur.actor.getWorldPosition(this.murmurTarget);
      const dx = this.murmurTarget.x - this.player.x;
      const dz = this.murmurTarget.z - this.player.z;
      const nearby = dx * dx + dz * dz <= 10.9;
      this.murmurTarget.y += 1.72 * murmur.actor.scale.y;
      this.murmurTarget.project(this.camera);
      const onScreen = this.murmurTarget.z > -1 && this.murmurTarget.z < 1;
      if (!nearby || !onScreen) {
        murmur.element.style.opacity = '0';
        murmur.element.hidden = true;
        continue;
      }
      murmur.element.hidden = false;
      murmur.element.style.opacity = '1';
      const halfWidth = Math.min(150, window.innerWidth / 2 - 12);
      const x = THREE.MathUtils.clamp((this.murmurTarget.x * 0.5 + 0.5) * window.innerWidth, halfWidth, window.innerWidth - halfWidth);
      const y = THREE.MathUtils.clamp((-this.murmurTarget.y * 0.5 + 0.5) * window.innerHeight, 140, window.innerHeight - 190);
      murmur.element.style.left = `${x}px`;
      murmur.element.style.top = `${y}px`;
    }
  }

  private updateSpeechBubble(): void {
    if (!this.conversationAnchor || this.ui.dialogue.classList.contains('hidden')) return;
    this.conversationAnchor.getWorldPosition(this.bubblePosition);
    this.bubblePosition.y += 2.05 * this.conversationAnchor.scale.y;
    this.bubblePosition.project(this.camera);
    const visible = this.bubblePosition.z > -1 && this.bubblePosition.z < 1;
    const halfWidth = Math.min(170, window.innerWidth / 2 - 12);
    const x = THREE.MathUtils.clamp((this.bubblePosition.x * 0.5 + 0.5) * window.innerWidth, halfWidth, window.innerWidth - halfWidth);
    const y = THREE.MathUtils.clamp((-this.bubblePosition.y * 0.5 + 0.5) * window.innerHeight, 130, window.innerHeight - 210);
    this.ui.positionSpeechBubble(x, y, visible);
  }

  private openHandprint(): void {
    if (!this.handprintMade || this.modal) return;
    this.modal = true;
    this.input.reset();
    this.movement.set(0, 0);
    this.playCue(293.66, 0.42, 0.022);
    const age = this.chapter === 'home' ? 'fresh'
      : this.chapter === 'calcutta' || this.chapter === 'debt' || (this.chapter === 'prison' && this.chapterStep === 0) ? 'travelled'
      : this.chapter === 'prison' && this.chapterStep === 1 ? 'weathered' : 'worn';
    this.ui.showHandprint(age);
  }

  private closeHandprint(): void {
    this.ui.closeHandprint();
    this.modal = false;
    this.input.requestPointerLock();
  }

  private stopSound(): void {
    if (!this.sound) return;
    for (const oscillator of this.sound.oscillators) oscillator.stop();
    void this.sound.context.close();
    this.sound = undefined;
  }

  private playCue(frequency: number, duration: number, volume: number): void {
    if (!this.sound) return;
    const oscillator = this.sound.context.createOscillator();
    const envelope = this.sound.context.createGain();
    const now = this.sound.context.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(70, frequency * 0.78), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.025, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope).connect(this.sound.gain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private installTestHooks(): void {
    window.__THREE_GAME_TEST_HOOKS__ = {
      seed: () => undefined,
      setState: (name: string) => {
        const supported: Chapter[] = ['home', 'calcutta', 'debt', 'prison', 'wedding', 'epilogue'];
        if (!supported.includes(name as Chapter)) throw new Error(`Unknown test state: ${name}`);
        this.ui.title.classList.add('hidden');
        this.ui.ending.classList.add('hidden');
        this.ui.chapterCard.classList.add('hidden');
        this.ui.dialogue.classList.add('hidden');
        this.ui.handprint.classList.add('hidden');
        this.ui.gameplayVisible(true);
        this.active = true;
        this.modal = false;
        this.handprintMade = name !== 'home';
        this.enterChapter(name as Chapter);
        if (name === 'epilogue') {
          this.finishJourney();
          this.render();
          this.publishDiagnostics();
          return { state: name };
        }
        this.ui.handprintButton.classList.toggle('hidden', !this.handprintMade);
        this.render();
        this.publishDiagnostics();
        return { state: name };
      },
      setPausedForScreenshot: (paused: boolean) => { this.pausedForScreenshot = paused; },
      setReducedMotion: (enabled: boolean) => { this.reducedMotion = enabled; },
      hideDebugUi: () => undefined,
    };
  }

  private publishDiagnostics(): void {
    if (!this.debugEnabled) return;
    const info = this.renderer.info;
    const story = Object.fromEntries(Object.entries(this.world?.story ?? {}).map(([name, object]) => {
      const world = object.getWorldPosition(new THREE.Vector3());
      const projected = world.clone().project(this.camera);
      return [name, { x: world.x, y: world.y, z: world.z, screenX: projected.x, screenY: projected.y, visible: object.visible }];
    }));
    window.__THREE_GAME_DIAGNOSTICS__ = {
      frame: this.frame,
      elapsed: this.elapsed,
      score: this.chapterStep,
      prisonDaylight: this.prisonDaylight,
      prisonReleased: this.prisonReleased,
      targetScore: this.world?.interactions.length ?? 0,
      murmurs: {
        active: this.murmurs.length,
        shown: [...this.murmurShown].map((index) => streetMurmurs[index]?.line ?? ''),
        visible: this.murmurs.map((murmur) => murmur.line),
      },
      complete: !this.active,
      debugModal: this.modal,
      debugPaused: this.pausedForScreenshot,
      player: { position: { x: this.player.x, y: this.player.y, z: this.player.z }, speed: this.movement.length() * 3.25 },
      camera: { yaw: this.yaw, pitch: this.pitch, eyeHeight: this.camera.position.y },
      collision: { engine: 'custom-aabb', colliders: this.world?.colliders.length ?? 0, blockedFrames: this.collisionBlocks },
      story,
      animation: {
        actors: this.world?.actors.length ?? 0,
        ambient: this.world?.ambient.length ?? 0,
        movingActors: this.world?.actors.filter((actor) => Boolean(actor.path)).length ?? 0,
        activeEmotes: this.world?.actors.flatMap((actor) => actor.emote ? [actor.emote] : []) ?? [],
        performance: this.performance?.kind ?? null,
        performanceProgress: this.performance ? Math.min(this.performance.time / this.performance.duration, 1) : null,
        performanceRigVisible: this.performanceRig.root.visible,
        sampleArm: this.world?.actors[0]?.rightArm.rotation.x ?? 0,
        movingActorZ: this.world?.actors.find((actor) => actor.path)?.root.position.z ?? null,
        crowdFacingPlayer: this.world?.actors.filter((actor) => {
          if (actor.root.userData.trackPlayer !== true) return false;
          const toward = Math.atan2(this.player.x - actor.root.position.x, this.player.z - actor.root.position.z);
          const difference = Math.atan2(Math.sin(toward - actor.root.rotation.y), Math.cos(toward - actor.root.rotation.y));
          return Math.abs(difference) < 0.42;
        }).length ?? 0,
      },
      renderer: {
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      },
      canvas: {
        clientWidth: this.canvas.clientWidth,
        clientHeight: this.canvas.clientHeight,
        width: this.canvas.width,
        height: this.canvas.height,
        dpr: Math.min(window.devicePixelRatio || 1, 1.75),
      },
    };
  }

  private element<T extends HTMLElement = HTMLElement>(selector: string): T {
    const result = document.querySelector<T>(selector);
    if (!result) throw new Error(`Missing element: ${selector}`);
    return result;
  }
}
