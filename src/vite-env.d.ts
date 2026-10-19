/// <reference types="vite/client" />

interface ThreeGameDiagnostics {
  frame: number;
  elapsed: number;
  score: number;
  prisonDaylight: number;
  prisonReleased: boolean;
  targetScore: number;
  complete: boolean;
  debugModal: boolean;
  debugPaused: boolean;
  murmurs: {
    active: number;
    shown: string[];
    visible: string[];
  };
  player: {
    position: { x: number; y: number; z: number };
    speed: number;
  };
  camera: {
    eyeHeight: number;
    yaw: number;
    pitch: number;
  };
  collision: {
    engine: 'custom-aabb';
    colliders: number;
    blockedFrames: number;
  };
  story: Record<string, { x: number; y: number; z: number; screenX: number; screenY: number; visible: boolean }>;
  animation: {
    actors: number;
    ambient: number;
    movingActors: number;
    activeEmotes: string[];
    performance: string | null;
    performanceProgress: number | null;
    performanceRigVisible: boolean;
    sampleArm: number;
    movingActorZ: number | null;
    crowdFacingPlayer: number;
  };
  renderer: {
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  canvas: {
    clientWidth: number;
    clientHeight: number;
    width: number;
    height: number;
    dpr: number;
  };
}

interface ThreeGameTestHooks {
  seed(value: number): void | Promise<void>;
  setState(name: string): { state: string } | Promise<{ state: string }>;
  setPausedForScreenshot(paused: boolean): void | Promise<void>;
  setReducedMotion(enabled: boolean): void | Promise<void>;
  hideDebugUi(hidden: boolean): void | Promise<void>;
}

interface Window {
  __THREE_GAME_DIAGNOSTICS__?: ThreeGameDiagnostics;
  __THREE_GAME_TEST_HOOKS__?: ThreeGameTestHooks;
}
