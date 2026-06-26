import { engine } from "../audio";
import { makePort } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

// Simple Schroeder-style reverb: 4 comb filters in parallel → 2 allpass in series.
export class ReverbModule extends Module {
  input: GainNode;
  out: GainNode;
  wet: GainNode;
  dry: GainNode;
  combs: { delay: DelayNode; fb: GainNode; sum: GainNode }[] = [];
  apFb: GainNode[] = [];

  constructor() {
    super({ type: "reverb", title: "REVERB" });
    const ctx = engine.ctx!;
    this.input = ctx.createGain();
    this.out = ctx.createGain();
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.35;
    this.dry = ctx.createGain();
    this.dry.gain.value = 0.65;
    this.input.connect(this.dry).connect(this.out);

    const combTimes = [0.0297, 0.0371, 0.0411, 0.0437];
    const decayMix = ctx.createGain();
    decayMix.gain.value = 1 / combTimes.length;
    for (const t of combTimes) {
      const d = ctx.createDelay(0.2);
      d.delayTime.value = t;
      const fb = ctx.createGain();
      fb.gain.value = 0.78;
      const sum = ctx.createGain();
      this.input.connect(sum);
      sum.connect(d);
      d.connect(fb).connect(sum);
      d.connect(decayMix);
      this.combs.push({ delay: d, fb, sum });
    }

    // two allpass filters via feedback delay
    let last: AudioNode = decayMix;
    for (const t of [0.005, 0.0017]) {
      const d = ctx.createDelay(0.05);
      d.delayTime.value = t;
      const fb = ctx.createGain();
      fb.gain.value = 0.7;
      const ff = ctx.createGain();
      ff.gain.value = -0.7;
      const sum = ctx.createGain();
      last.connect(sum);
      last.connect(ff).connect(sum); // approximate allpass
      sum.connect(d);
      d.connect(fb).connect(sum);
      last = d;
      this.apFb.push(fb);
    }
    last.connect(this.wet).connect(this.out);

    this.buildUi();
  }

  buildUi() {
    const row = document.createElement("div");
    row.className = "knob-row";
    row.appendChild(makeKnob({
      label: "decay", min: 0.2, max: 0.95, value: 0.78,
      onChange: v => this.combs.forEach(c => c.fb.gain.value = v)
    }));
    row.appendChild(makeKnob({
      label: "mix", min: 0, max: 1, value: 0.35,
      onChange: v => { this.wet.gain.value = v; this.dry.gain.value = 1 - v; }
    }));
    this.body.append(row);
    this.addJack(makePort({ module: this, dir: "in", kind: "audio", label: "in", target: this.input }), "in");
    this.addJack(makePort({ module: this, dir: "out", kind: "audio", label: "out", node: this.out }), "out");
  }
}
