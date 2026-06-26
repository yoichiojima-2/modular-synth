import { engine } from "../audio";
import { makePort } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

export class LfoModule extends Module {
  osc: OscillatorNode;
  out: GainNode;

  constructor() {
    super({ type: "lfo", title: "LFO" });
    const ctx = engine.ctx!;
    this.osc = ctx.createOscillator();
    this.osc.type = "sine";
    this.osc.frequency.value = 2;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.osc.connect(this.out);
    this.osc.start();
    this.buildUi();
  }

  buildUi() {
    const select = document.createElement("select");
    select.className = "select";
    ["sine", "triangle", "square", "sawtooth"].forEach(w => {
      const o = document.createElement("option"); o.value = w; o.textContent = w;
      select.appendChild(o);
    });
    select.onchange = () => this.osc.type = select.value as OscillatorType;

    const row = document.createElement("div");
    row.className = "knob-row";
    row.appendChild(makeKnob({ label: "rate", min: 0.05, max: 40, value: 2, curve: "log", unit: "hz",
      onChange: v => this.osc.frequency.value = v }));
    row.appendChild(makeKnob({ label: "amt", min: 0, max: 1, value: 1,
      onChange: v => this.out.gain.value = v }));
    this.body.append(select, row);
    this.addJack(makePort({ module: this, dir: "out", kind: "cv", label: "out", node: this.out }), "out");
  }

  protected onDestroy() {
    try { this.osc.stop(); } catch {}
  }
}
