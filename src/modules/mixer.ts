import { engine } from "../audio";
import { makePort } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

export class MixerModule extends Module {
  inputs: GainNode[] = [];
  out: GainNode;

  constructor() {
    super({ type: "mixer", title: "MIX" });
    const ctx = engine.ctx!;
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    for (let i = 0; i < 3; i++) {
      const g = ctx.createGain();
      g.gain.value = 0.7;
      g.connect(this.out);
      this.inputs.push(g);
    }
    this.buildUi();
  }

  buildUi() {
    const row = document.createElement("div");
    row.className = "knob-row";
    this.inputs.forEach((g, i) => {
      row.appendChild(makeKnob({
        label: `ch${i+1}`, min: 0, max: 1.5, value: 0.7,
        onChange: v => g.gain.value = v
      }));
    });
    this.body.append(row);
    this.inputs.forEach((g, i) => {
      this.addJack(makePort({ module: this, dir: "in", kind: "audio", label: `in${i+1}`, target: g }), `in${i+1}`);
    });
    this.addJack(makePort({ module: this, dir: "out", kind: "audio", label: "out", node: this.out }), "out");
  }
}
