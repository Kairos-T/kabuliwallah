export class Loop {
  private frameId = 0;
  private lastTime = 0;
  private running = false;
  private readonly maxDelta = new URLSearchParams(window.location.search).has('recording') ? 0.35 : 0.1;

  constructor(
    private readonly update: (deltaSeconds: number, elapsedSeconds: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  private readonly tick = (time: number) => {
    if (!this.running) return;
    const deltaSeconds = Math.min((time - this.lastTime) / 1000, this.maxDelta);
    this.lastTime = time;
    try {
      this.update(deltaSeconds, time / 1000);
      this.render();
    } catch (error) {
      console.error('Game frame error:', error);
    }
    this.frameId = requestAnimationFrame(this.tick);
  };
}
