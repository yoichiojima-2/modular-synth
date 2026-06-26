import { engine } from "../audio";
import { makePort } from "../patch";
import { makeKnob } from "../ui/knob";
import { Module } from "./base";

export class FilterModule extends Module {
  filter: BiquadFilterNode;
  cvIn: GainNode;

  constructor() {
    super({ type: "filter", title: "FILTER" });
    const ctx = engine.ctx!;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 800;
    this.filter.Q.value = 1.5;

    this.cvIn = ctx.createGain();
    this.cvIn.gain.value = 2000;
    this.cvIn.connect(this.filter.frequency);

    this.buildUi();
  }

  buildUi() {
    const select = document.createElement("select");
    select.className = "select";
    ["lowpass", "highpass", "bandpass", "notch"].forEach(t => {
      const o = document.createElement("option");
      o.value = t; o.textContent = t;
      select.appendChild(o);
    });
    select.onchange = () => { this.filter.type = select.value as BiquadFilterType; };

    const row = document.createElement("div");
    row.className = "knob-row";
    row.appendChild(makeKnob({
      label: "cutoff", min: 20, max: 18000, value: 800, curve: "log", unit: "hz",
      onChange: v => this.filter.frequency.value = v
    }));
    row.appendChild(makeKnob({
      label: "res", min: 0.1, max: 24, value: 1.5,
      onChange: v => this.filter.Q.value = v
    }));
    row.appendChild(makeKnob({
      label: "cv amt", min: 0, max: 8000, value: 2000, curve: "log",
      onChange: v => this.cvIn.gain.value = v
    }));

    this.body.append(select, row);
    this.addJack(makePort({ module: this, dir: "in", kind: "audio", label: "in", target: this.filter }), "in");
    this.addJack(makePort({ module: this, dir: "in", kind: "cv", label: "cv", target: this.cvIn }), "cv");
    this.addJack(makePort({ module: this, dir: "out", kind: "audio", label: "out", node: this.filter }), "out");
  }
}
