import { engine } from "../audio";
import { makePort } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

export class OutputModule extends Module {
  input: GainNode;

  constructor() {
    super({ type: "output", title: "OUT" });
    this.el.classList.add("output");
    const ctx = engine.ctx!;
    this.input = ctx.createGain();
    this.input.gain.value = 0.7;
    this.input.connect(engine.master);
    this.buildUi();
  }

  buildUi() {
    const row = document.createElement("div");
    row.className = "knob-row";
    row.appendChild(makeKnob({ label: "vol", min: 0, max: 1, value: 0.7,
      onChange: v => this.input.gain.value = v }));
    this.body.append(row);
    this.addJack(makePort({ module: this, dir: "in", kind: "audio", label: "in", target: this.input }), "in");
  }
}
