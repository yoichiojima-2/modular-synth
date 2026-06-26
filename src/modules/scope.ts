import { engine } from "../audio";
import { makePort } from "../patch";
import { Module } from "./base";

export class ScopeModule extends Module {
  analyser: AnalyserNode;
  buf: Float32Array;
  canvas!: HTMLCanvasElement;
  raf = 0;

  constructor() {
    super({ type: "scope", title: "SCOPE" });
    const ctx = engine.ctx!;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buf = new Float32Array(this.analyser.fftSize);
    this.buildUi();
    this.draw();
  }

  buildUi() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 320;
    this.canvas.height = 90;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "90px";
    this.canvas.style.background = "#0a0b0e";
    this.canvas.style.border = "1px solid var(--line)";
    this.canvas.style.borderRadius = "2px";
    this.body.append(this.canvas);

    this.addJack(makePort({ module: this, dir: "in", kind: "audio", label: "in", target: this.analyser }), "in");
    this.addJack(makePort({ module: this, dir: "out", kind: "audio", label: "thru", node: this.analyser }), "thru");
  }

  draw = () => {
    const c = this.canvas;
    const g = c.getContext("2d")!;
    const w = c.width, h = c.height;
    this.analyser.getFloatTimeDomainData(this.buf as any);
    g.fillStyle = "#0a0b0e";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#262a32";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, h/2); g.lineTo(w, h/2);
    g.stroke();

    g.strokeStyle = "#c8ff3e";
    g.lineWidth = 1.5;
    g.beginPath();
    const N = this.buf.length;
    for (let i = 0; i < w; i++) {
      const s = this.buf[Math.floor(i / w * N)];
      const y = (1 - s) * h / 2;
      if (i === 0) g.moveTo(i, y); else g.lineTo(i, y);
    }
    g.stroke();
    this.raf = requestAnimationFrame(this.draw);
  };

  protected onDestroy() {
    cancelAnimationFrame(this.raf);
  }
}
