import { engine } from "../audio";
import { makePort, patchBay, type Port } from "../patch";
import { Module } from "./base";

// Computer-keyboard input. Rows of keys → semitones from a base. Outputs CV + gate.
// Layout (lower row z..m + upper q..u = white/black like piano):
// a w s e d f t g y h u j  →  C C# D D# E F F# G G# A A# B
// Also responds to clicking on-screen keys.
const ROW_KEYS = ["a","w","s","e","d","f","t","g","y","h","u","j","k"];
const SEMIS = [0,1,2,3,4,5,6,7,8,9,10,11,12];
const BLACK = new Set([1,3,6,8,10]);

function midiToHz(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }

export class KeyboardModule extends Module {
  cvOut: ConstantSourceNode;
  gatePort!: Port;
  octave = 4; // C4 base = midi 60
  active = new Set<string>();
  keyEls: HTMLElement[] = [];

  constructor() {
    super({ type: "keys", title: "KEYS" });
    const ctx = engine.ctx!;
    this.cvOut = ctx.createConstantSource();
    this.cvOut.offset.value = midiToHz(60);
    this.cvOut.start();

    this.buildUi();

    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("keyup", this.onKeyUp);
  }

  buildUi() {
    const info = document.createElement("div");
    info.className = "knob-value";
    info.style.color = "var(--muted)";
    info.style.padding = "2px 0";
    info.textContent = `keys row: a w s e d f t g y h u j  ·  z/x: oct`;
    this.body.appendChild(info);

    const piano = document.createElement("div");
    piano.style.display = "flex";
    piano.style.position = "relative";
    piano.style.height = "60px";
    piano.style.gap = "2px";

    SEMIS.forEach((s, i) => {
      const key = document.createElement("div");
      const isBlack = BLACK.has(s);
      key.style.flex = isBlack ? "0 0 14px" : "1";
      key.style.background = isBlack ? "#0a0b0e" : "#d8dce3";
      key.style.height = isBlack ? "38px" : "100%";
      key.style.borderRadius = "0 0 2px 2px";
      key.style.cursor = "pointer";
      key.style.border = "1px solid #262a32";
      key.style.transition = "background .08s";
      key.title = ROW_KEYS[i];
      key.addEventListener("mousedown", () => this.press(s, ROW_KEYS[i]));
      key.addEventListener("mouseup", () => this.release(ROW_KEYS[i]));
      key.addEventListener("mouseleave", () => this.release(ROW_KEYS[i]));
      piano.appendChild(key);
      this.keyEls.push(key);
    });

    this.body.appendChild(piano);

    this.addJack(makePort({ module: this, dir: "out", kind: "cv", label: "cv", node: this.cvOut }), "cv");
    this.gatePort = makePort({ module: this, dir: "out", kind: "gate", label: "gate" });
    this.addJack(this.gatePort, "gate");
  }

  press(semi: number, code: string) {
    if (this.active.has(code)) return;
    this.active.add(code);
    const midi = 12 * (this.octave + 1) + semi;
    const hz = midiToHz(midi);
    const t = engine.now();
    this.cvOut.offset.setValueAtTime(hz, t);
    patchBay.fireGate(this.gatePort, t, 1, hz, 4); // long sustain; we'll release on keyup
    const el = this.keyEls[SEMIS.indexOf(semi)];
    if (el) el.style.background = "var(--accent)";
  }

  release(code: string) {
    if (!this.active.has(code)) return;
    this.active.delete(code);
    if (this.active.size === 0) {
      patchBay.fireGateOff(this.gatePort, engine.now());
    }
    const idx = ROW_KEYS.indexOf(code);
    if (idx >= 0) {
      const el = this.keyEls[idx];
      const isBlack = BLACK.has(SEMIS[idx]);
      if (el) el.style.background = isBlack ? "#0a0b0e" : "#d8dce3";
    }
  }

  onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "z") { this.octave = Math.max(0, this.octave - 1); return; }
    if (e.key === "x") { this.octave = Math.min(8, this.octave + 1); return; }
    const idx = ROW_KEYS.indexOf(e.key);
    if (idx < 0) return;
    e.preventDefault();
    this.press(SEMIS[idx], e.key);
  };

  onKeyUp = (e: KeyboardEvent) => {
    this.release(e.key);
  };

  protected onDestroy() {
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("keyup", this.onKeyUp);
    try { this.cvOut.stop(); } catch {}
  }
}
