import { engine } from "../audio";
import { makePort } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

// VCA: audio in * (level + cv * cvAmount)
export class VcaModule extends Module {
  gain: GainNode;
  cvIn: GainNode;

  constructor() {
    super({ type: "vca", title: "VCA" });
    const ctx = engine.ctx!;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.cvIn = ctx.createGain();
    this.cvIn.gain.value = 1;
    this.cvIn.connect(this.gain.gain);
    this.buildUi();
  }

  buildUi() {
    const row = document.createElement("div");
    row.className = "knob-row";
    row.appendChild(makeKnob({ label: "bias", min: 0, max: 1, value: 0,
      onChange: v => this.gain.gain.value = v }));
    row.appendChild(makeKnob({ label: "cv", min: 0, max: 2, value: 1,
      onChange: v => this.cvIn.gain.value = v }));

    this.body.append(row);
    this.addJack(makePort({ module: this, dir: "in", kind: "audio", label: "in", target: this.gain }), "in");
    this.addJack(makePort({ module: this, dir: "in", kind: "cv", label: "cv", target: this.cvIn }), "cv");
    this.addJack(makePort({ module: this, dir: "out", kind: "audio", label: "out", node: this.gain }), "out");
  }
}
