import { engine } from "../audio";
import { makePort } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

export class NoiseModule extends Module {
  src: AudioBufferSourceNode;
  out: GainNode;

  constructor() {
    super({ type: "noise", title: "NOISE" });
    const ctx = engine.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.src = ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    this.out = ctx.createGain();
    this.out.gain.value = 0.3;
    this.src.connect(this.out);
    this.src.start();
    this.buildUi();
  }

  buildUi() {
    const row = document.createElement("div");
    row.className = "knob-row";
    row.appendChild(makeKnob({ label: "level", min: 0, max: 1, value: 0.3,
      onChange: v => this.out.gain.value = v }));
    this.body.append(row);
    this.addJack(makePort({ module: this, dir: "out", kind: "audio", label: "out", node: this.out }), "out");
  }

  protected onDestroy() { try { this.src.stop(); } catch {} }
}
