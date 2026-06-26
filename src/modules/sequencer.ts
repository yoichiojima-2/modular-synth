import { engine } from "../audio";
import { makePort, patchBay, type Port } from "../patch";
import { Module } from "./base";

// 8-step sequencer. Outputs:
//   - cv (1v/oct style but in Hz on freq port)
//   - gate (uses patchBay.fireGate)
// Also exposes a ConstantSourceNode for the pitch CV so it can modulate OSC freq directly.
export class SequencerModule extends Module {
  steps: { note: number; on: boolean }[] = [];
  numSteps = 8;
  current = -1;
  running = false;
  bpm = 110;
  gateRatio = 0.5;
  cvOut: ConstantSourceNode;
  gatePort!: Port;
  stepEls: HTMLElement[] = [];
  private _nextTime = 0;
  private _stepIdx = 0;
  private _timer: number | null = null;

  constructor() {
    super({ type: "seq", title: "SEQ" });
    const ctx = engine.ctx!;
    this.cvOut = ctx.createConstantSource();
    this.cvOut.offset.value = 220;
    this.cvOut.start();

    for (let i = 0; i < this.numSteps; i++) {
      this.steps.push({ note: 220 + i * 30, on: i % 2 === 0 });
    }

    this.buildUi();
  }

  buildUi() {
    const grid = document.createElement("div");
    grid.className = "seq-grid";
    this.steps.forEach((step, i) => {
      const cell = document.createElement("div");
      cell.className = "seq-step";
      const input = document.createElement("input");
      input.type = "number";
      input.min = "20";
      input.max = "4000";
      input.value = step.note.toFixed(0);
      input.onchange = () => { step.note = +input.value; };
      const btn = document.createElement("button");
      btn.className = step.on ? "on" : "";
      btn.onclick = () => { step.on = !step.on; btn.className = step.on ? "on" : ""; };
      cell.append(input, btn);
      grid.appendChild(cell);
      this.stepEls.push(cell);
    });

    this.body.appendChild(grid);

    this.addJack(makePort({ module: this, dir: "out", kind: "cv", label: "cv", node: this.cvOut }), "cv");
    this.gatePort = makePort({ module: this, dir: "out", kind: "gate", label: "gate" });
    this.addJack(this.gatePort, "gate");
  }

  start(bpm: number) {
    if (this.running) return;
    this.bpm = bpm;
    this.running = true;
    this._stepIdx = 0;
    this._nextTime = engine.now() + 0.05;
    this.tick();
  }

  stop() {
    this.running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this.current = -1;
    this.updateHighlight();
  }

  setBpm(bpm: number) { this.bpm = bpm; }

  private tick = () => {
    if (!this.running) return;
    const ctx = engine.ctx!;
    const stepDur = 60 / this.bpm / 2; // 8th notes
    while (this._nextTime < ctx.currentTime + 0.15) {
      const step = this.steps[this._stepIdx];
      if (step.on) {
        this.cvOut.offset.setValueAtTime(step.note, this._nextTime);
        patchBay.fireGate(this.gatePort, this._nextTime, 1, step.note, stepDur * this.gateRatio);
      }
      const idx = this._stepIdx;
      const t = this._nextTime;
      const delay = (t - ctx.currentTime) * 1000;
      setTimeout(() => { this.current = idx; this.updateHighlight(); }, Math.max(0, delay));
      this._stepIdx = (this._stepIdx + 1) % this.numSteps;
      this._nextTime += stepDur;
    }
    this._timer = window.setTimeout(this.tick, 25);
  };

  updateHighlight() {
    this.stepEls.forEach((el, i) => el.classList.toggle("current", i === this.current));
  }

  protected onDestroy() {
    this.stop();
    try { this.cvOut.stop(); } catch {}
  }
}
