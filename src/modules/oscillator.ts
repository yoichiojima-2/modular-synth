import { engine } from "../audio";
import { makePort } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

export class OscillatorModule extends Module {
  osc: OscillatorNode;
  out: GainNode;
  fmIn: GainNode;
  freqOffset: ConstantSourceNode;
  baseFreq = 220;
  detuneCents = 0;

  constructor() {
    super({ type: "osc", title: "OSC" });
    const ctx = engine.ctx!;
    this.osc = ctx.createOscillator();
    this.osc.type = "sawtooth";
    this.osc.frequency.value = 0;

    // base freq via ConstantSourceNode → osc.frequency
    this.freqOffset = ctx.createConstantSource();
    this.freqOffset.offset.value = this.baseFreq;
    this.freqOffset.connect(this.osc.frequency);
    this.freqOffset.start();

    // FM input: scaled by 1 Hz/V style, but we'll just pass linear modulation in Hz
    this.fmIn = ctx.createGain();
    this.fmIn.gain.value = 100;
    this.fmIn.connect(this.osc.frequency);

    this.out = ctx.createGain();
    this.out.gain.value = 0.5;
    this.osc.connect(this.out);
    this.osc.start();

    this.buildUi();
  }

  buildUi() {
    const select = document.createElement("select");
    select.className = "select";
    ["sine", "triangle", "square", "sawtooth"].forEach(w => {
      const o = document.createElement("option");
      o.value = w; o.textContent = w;
      if (w === "sawtooth") o.selected = true;
      select.appendChild(o);
    });
    select.onchange = () => { this.osc.type = select.value as OscillatorType; };

    const row = document.createElement("div");
    row.className = "knob-row";
    row.appendChild(makeKnob({
      label: "freq", min: 20, max: 8000, value: this.baseFreq, curve: "log", unit: "hz",
      onChange: v => { this.baseFreq = v; this.freqOffset.offset.value = v * Math.pow(2, this.detuneCents/1200); }
    }));
    row.appendChild(makeKnob({
      label: "detune", min: -1200, max: 1200, value: 0, unit: "ct",
      onChange: v => { this.detuneCents = v; this.freqOffset.offset.value = this.baseFreq * Math.pow(2, v/1200); }
    }));
    row.appendChild(makeKnob({
      label: "fm", min: 0, max: 2000, value: 100, curve: "log", unit: "hz",
      onChange: v => { this.fmIn.gain.value = v; }
    }));
    row.appendChild(makeKnob({
      label: "level", min: 0, max: 1, value: 0.5,
      onChange: v => { this.out.gain.value = v; }
    }));

    this.body.append(select, row);

    this.addJack(makePort({ module: this, dir: "in", kind: "cv", label: "fm", target: this.fmIn }), "fm");
    this.addJack(makePort({ module: this, dir: "in", kind: "cv", label: "v/oct", target: this.freqOffset.offset }), "1v/oct");
    this.addJack(makePort({ module: this, dir: "out", kind: "audio", label: "out", node: this.out }), "out");
  }

  // For v/oct style: set frequency by note (Hz)
  setFreq(hz: number, time: number) {
    this.freqOffset.offset.setValueAtTime(hz * Math.pow(2, this.detuneCents/1200), time);
  }

  protected onDestroy() {
    try { this.osc.stop(); } catch {}
    try { this.freqOffset.stop(); } catch {}
  }
}
