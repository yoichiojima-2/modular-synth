import { engine } from "../audio";
import { makePort, patchBay } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

// ADSR envelope: outputs CV 0..1 on a ConstantSourceNode controlled offset
export class EnvelopeModule extends Module {
  src: ConstantSourceNode;
  a = 0.01; d = 0.2; s = 0.5; r = 0.4;

  constructor() {
    super({ type: "env", title: "ENV" });
    const ctx = engine.ctx!;
    this.src = ctx.createConstantSource();
    this.src.offset.value = 0;
    this.src.start();

    this.buildUi();
  }

  buildUi() {
    const row = document.createElement("div");
    row.className = "knob-row";
    row.appendChild(makeKnob({ label: "a", min: 0.001, max: 4, value: 0.01, curve: "log", unit: "s",
      onChange: v => this.a = v }));
    row.appendChild(makeKnob({ label: "d", min: 0.001, max: 4, value: 0.2, curve: "log", unit: "s",
      onChange: v => this.d = v }));
    row.appendChild(makeKnob({ label: "s", min: 0, max: 1, value: 0.5,
      onChange: v => this.s = v }));
    row.appendChild(makeKnob({ label: "r", min: 0.001, max: 6, value: 0.4, curve: "log", unit: "s",
      onChange: v => this.r = v }));

    const trigBtn = document.createElement("button");
    trigBtn.className = "btn";
    trigBtn.textContent = "trig";
    trigBtn.onmousedown = () => this.trigger(engine.now(), 1, 440, 0.2);
    this.body.append(row, trigBtn);

    const gateIn = makePort({
      module: this, dir: "in", kind: "gate", label: "gate",
      onGate: (t, vel, freq, dur) => this.trigger(t, vel, freq, dur)
    });
    this.addJack(gateIn, "gate");
    this.addJack(makePort({ module: this, dir: "out", kind: "cv", label: "env", node: this.src }), "env");
  }

  trigger(t: number, vel: number, _freq: number, duration: number) {
    const o = this.src.offset;
    const peak = vel;
    o.cancelScheduledValues(t);
    o.setValueAtTime(Math.max(o.value, 0.0001), t);
    o.linearRampToValueAtTime(peak, t + this.a);
    o.linearRampToValueAtTime(peak * this.s, t + this.a + this.d);
    // sustain phase ends at t + duration, then release
    const offT = t + Math.max(duration, this.a + this.d);
    o.setValueAtTime(peak * this.s, offT);
    o.linearRampToValueAtTime(0, offT + this.r);
  }

  protected onDestroy() {
    try { this.src.stop(); } catch {}
  }
}
