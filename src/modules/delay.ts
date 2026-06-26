import { engine } from "../audio";
import { makePort } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

export class DelayModule extends Module {
  input: GainNode;
  delay: DelayNode;
  fb: GainNode;
  wet: GainNode;
  dry: GainNode;
  out: GainNode;

  constructor() {
    super({ type: "delay", title: "DELAY" });
    const ctx = engine.ctx!;
    this.input = ctx.createGain();
    this.delay = ctx.createDelay(2.0);
    this.delay.delayTime.value = 0.35;
    this.fb = ctx.createGain();
    this.fb.gain.value = 0.35;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.4;
    this.dry = ctx.createGain();
    this.dry.gain.value = 1;
    this.out = ctx.createGain();

    this.input.connect(this.dry).connect(this.out);
    this.input.connect(this.delay);
    this.delay.connect(this.fb).connect(this.delay);
    this.delay.connect(this.wet).connect(this.out);

    this.buildUi();
  }

  buildUi() {
    const row = document.createElement("div");
    row.className = "knob-row";
    row.appendChild(makeKnob({ label: "time", min: 0.01, max: 2, value: 0.35, curve: "log", unit: "s",
      onChange: v => this.delay.delayTime.value = v }));
    row.appendChild(makeKnob({ label: "fb", min: 0, max: 0.95, value: 0.35,
      onChange: v => this.fb.gain.value = v }));
    row.appendChild(makeKnob({ label: "mix", min: 0, max: 1, value: 0.4,
      onChange: v => { this.wet.gain.value = v; this.dry.gain.value = 1 - v; } }));

    this.body.append(row);
    this.addJack(makePort({ module: this, dir: "in", kind: "audio", label: "in", target: this.input }), "in");
    this.addJack(makePort({ module: this, dir: "out", kind: "audio", label: "out", node: this.out }), "out");
  }
}
