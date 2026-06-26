import { engine } from "../audio";
import { makePort, patchBay, type Port } from "../patch";
import { Module } from "./base";

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
function midiToHz(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }
function midiName(m: number) {
  const n = NOTE_NAMES[((m % 12) + 12) % 12];
  const oct = Math.floor(m / 12) - 1;
  return `${n}${oct}`;
}

// 8-step sequencer with semitone pitches. Outputs CV (Hz) + gate.
export class SequencerModule extends Module {
  steps: { midi: number; on: boolean }[] = [];
  numSteps = 8;
  current = -1;
  running = false;
  bpm = 110;
  gateRatio = 0.5;
  cvOut: ConstantSourceNode;
  gatePort!: Port;
  stepEls: { cell: HTMLElement; label: HTMLElement; btn: HTMLElement }[] = [];
  private _nextTime = 0;
  private _stepIdx = 0;
  private _timer: number | null = null;

  constructor() {
    super({ type: "seq", title: "SEQ" });
    const ctx = engine.ctx!;
    this.cvOut = ctx.createConstantSource();
    this.cvOut.offset.value = midiToHz(57);
    this.cvOut.start();

    // pleasant default: A minor pentatonic-ish ostinato
    const defaults = [57, 60, 64, 67, 64, 60, 69, 67];
    for (let i = 0; i < this.numSteps; i++) {
      this.steps.push({ midi: defaults[i], on: true });
    }
    this.buildUi();
  }

  buildUi() {
    const grid = document.createElement("div");
    grid.className = "seq-grid";
    this.steps.forEach((step, i) => {
      const cell = document.createElement("div");
      cell.className = "seq-step";
      const label = document.createElement("div");
      label.className = "knob-value";
      label.textContent = midiName(step.midi);
      label.style.cursor = "ns-resize";
      label.style.userSelect = "none";

      let dragY = 0, dragV = 0;
      const move = (e: MouseEvent) => {
        const semis = Math.round((dragY - e.clientY) / 8);
        step.midi = Math.max(12, Math.min(108, dragV + semis));
        label.textContent = midiName(step.midi);
      };
      const up = () => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      label.addEventListener("mousedown", e => {
        e.preventDefault();
        dragY = e.clientY; dragV = step.midi;
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      });

      const btn = document.createElement("button");
      btn.className = step.on ? "on" : "";
      btn.onclick = () => { step.on = !step.on; btn.className = step.on ? "on" : ""; };
      cell.append(label, btn);
      grid.appendChild(cell);
      this.stepEls.push({ cell, label, btn });
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
    const stepDur = 60 / this.bpm / 2;
    while (this._nextTime < ctx.currentTime + 0.15) {
      const step = this.steps[this._stepIdx];
      if (step.on) {
        const hz = midiToHz(step.midi);
        this.cvOut.offset.setValueAtTime(hz, this._nextTime);
        patchBay.fireGate(this.gatePort, this._nextTime, 1, hz, stepDur * this.gateRatio);
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
    this.stepEls.forEach((el, i) => el.cell.classList.toggle("current", i === this.current));
  }

  protected onDestroy() {
    this.stop();
    try { this.cvOut.stop(); } catch {}
  }
}
