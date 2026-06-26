export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  destination!: AudioNode;

  async start() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.destination = this.master;
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  now() { return this.ctx?.currentTime ?? 0; }
}

export const engine = new AudioEngine();
