import { engine } from "./audio";
import { patchBay, type Port, type Cable } from "./patch";
import type { Module } from "./modules/base";
import { OscillatorModule } from "./modules/oscillator";
import { FilterModule } from "./modules/filter";
import { EnvelopeModule } from "./modules/envelope";
import { VcaModule } from "./modules/vca";
import { LfoModule } from "./modules/lfo";
import { NoiseModule } from "./modules/noise";
import { DelayModule } from "./modules/delay";
import { OutputModule } from "./modules/output";
import { SequencerModule } from "./modules/sequencer";
import { MixerModule } from "./modules/mixer";
import { KeyboardModule } from "./modules/keyboard";
import { ScopeModule } from "./modules/scope";
import { ReverbModule } from "./modules/reverb";

const rack = document.getElementById("rack") as HTMLDivElement;
const cablesSvg = document.getElementById("cables") as unknown as SVGSVGElement;
const powerBtn = document.getElementById("power") as HTMLButtonElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const stopBtn = document.getElementById("stop") as HTMLButtonElement;
const bpmInput = document.getElementById("bpm") as HTMLInputElement;
const addBtn = document.getElementById("add-module") as HTMLButtonElement;
const panicBtn = document.getElementById("panic") as HTMLButtonElement;
const menu = document.getElementById("module-menu") as HTMLDivElement;

const modules: Module[] = [];
const sequencers: SequencerModule[] = [];

function addModule(m: Module) {
  modules.push(m);
  if (m instanceof SequencerModule) sequencers.push(m);
  rack.appendChild(m.el);
  bindJacks(m);
  redrawCables();
  observe(m);
  const origDestroy = m.destroy.bind(m);
  m.destroy = () => {
    origDestroy();
    const i = modules.indexOf(m);
    if (i >= 0) modules.splice(i, 1);
    const j = sequencers.indexOf(m as SequencerModule);
    if (j >= 0) sequencers.splice(j, 1);
    redrawCables();
  };
}

const ro = new ResizeObserver(() => redrawCables());
function observe(m: Module) {
  ro.observe(m.el);
}
rack.addEventListener("scroll", redrawCables);
window.addEventListener("resize", redrawCables);

// ---- patching ----
let dragFrom: Port | null = null;
let dragPath: SVGPathElement | null = null;

function jackCenter(port: Port): { x: number; y: number } {
  const r = port.el!.getBoundingClientRect();
  const top = cablesSvg.getBoundingClientRect();
  return { x: r.left + r.width / 2 - top.left, y: r.top + r.height / 2 - top.top };
}

function cablePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = Math.abs(b.x - a.x);
  const sag = Math.min(120, 40 + dx * 0.4);
  const c1 = { x: a.x, y: a.y + sag };
  const c2 = { x: b.x, y: b.y + sag };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

function redrawCables() {
  // clear all except drag
  Array.from(cablesSvg.querySelectorAll("path:not(.dragging)")).forEach(p => p.remove());
  for (const c of patchBay.cables) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", cablePath(jackCenter(c.from), jackCenter(c.to)));
    p.dataset.cableId = c.id;
    p.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      patchBay.disconnect(c);
    });
    p.addEventListener("click", (e) => {
      if (e.shiftKey) patchBay.disconnect(c);
    });
    cablesSvg.appendChild(p);
  }
  // update connected dots
  const connectedPorts = new Set<string>();
  patchBay.cables.forEach(c => { connectedPorts.add(c.from.id); connectedPorts.add(c.to.id); });
  modules.forEach(m => m.ports.forEach(p => {
    if (p.el) p.el.classList.toggle("connected", connectedPorts.has(p.id));
  }));
}

patchBay.onChange(redrawCables);

function bindJacks(m: Module) {
  for (const port of m.ports) {
    const jackEl = port.el!.parentElement!;
    jackEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (port.dir === "out") {
        dragFrom = port;
      } else {
        // grabbing from input: detach any cable, treat its source as drag origin
        const existing = patchBay.cables.find(c => c.to === port);
        if (existing) {
          dragFrom = existing.from;
          patchBay.disconnect(existing);
        } else {
          dragFrom = null;
          return;
        }
      }
      dragPath = document.createElementNS("http://www.w3.org/2000/svg", "path") as SVGPathElement;
      dragPath.classList.add("dragging");
      cablesSvg.appendChild(dragPath);
      window.addEventListener("mousemove", onDragMove);
      window.addEventListener("mouseup", onDragUp, { once: true });
    });
  }
}

function onDragMove(e: MouseEvent) {
  if (!dragFrom || !dragPath) return;
  const a = jackCenter(dragFrom);
  const top = cablesSvg.getBoundingClientRect();
  const b = { x: e.clientX - top.left, y: e.clientY - top.top };
  dragPath.setAttribute("d", cablePath(a, b));
}

function onDragUp(e: MouseEvent) {
  window.removeEventListener("mousemove", onDragMove);
  if (dragPath) { dragPath.remove(); dragPath = null; }
  if (!dragFrom) return;
  // find target port
  const target = (e.target as HTMLElement).closest(".jack") as HTMLElement | null;
  if (target) {
    const portId = target.dataset.portId;
    for (const m of modules) {
      for (const p of m.ports) {
        if (p.id === portId && p.dir === "in") {
          patchBay.connect(dragFrom, p);
        }
      }
    }
  }
  dragFrom = null;
}

// ---- module menu ----
addBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const r = addBtn.getBoundingClientRect();
  menu.style.top = `${r.bottom + 6}px`;
  menu.style.left = `${r.left}px`;
  menu.classList.toggle("hidden");
});
document.addEventListener("click", () => menu.classList.add("hidden"));
menu.addEventListener("click", (e) => e.stopPropagation());
menu.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {
    const t = (btn as HTMLButtonElement).dataset.type!;
    addByType(t);
    menu.classList.add("hidden");
  });
});

function addByType(t: string) {
  if (!engine.ctx) { alert("press power first"); return; }
  let m: Module;
  switch (t) {
    case "osc": m = new OscillatorModule(); break;
    case "filter": m = new FilterModule(); break;
    case "env": m = new EnvelopeModule(); break;
    case "vca": m = new VcaModule(); break;
    case "lfo": m = new LfoModule(); break;
    case "noise": m = new NoiseModule(); break;
    case "delay": m = new DelayModule(); break;
    case "seq": m = new SequencerModule(); break;
    case "mixer": m = new MixerModule(); break;
    case "keys": m = new KeyboardModule(); break;
    case "scope": m = new ScopeModule(); break;
    case "reverb": m = new ReverbModule(); break;
    case "output": m = new OutputModule(); break;
    default: return;
  }
  addModule(m);
}

// ---- transport ----
powerBtn.addEventListener("click", async () => {
  await engine.start();
  powerBtn.disabled = true;
  powerBtn.textContent = "on";
  powerBtn.classList.add("active");
  playBtn.disabled = false;
  stopBtn.disabled = false;
  bootPatch();
});

playBtn.addEventListener("click", () => {
  const bpm = +bpmInput.value || 110;
  sequencers.forEach(s => s.start(bpm));
  playBtn.classList.add("active");
});

stopBtn.addEventListener("click", () => {
  sequencers.forEach(s => s.stop());
  playBtn.classList.remove("active");
});

panicBtn.addEventListener("click", () => {
  if (!engine.ctx) return;
  sequencers.forEach(s => s.stop());
  playBtn.classList.remove("active");
  const t = engine.now();
  engine.master.gain.cancelScheduledValues(t);
  engine.master.gain.setValueAtTime(0, t);
  engine.master.gain.linearRampToValueAtTime(0.6, t + 0.2);
});

bpmInput.addEventListener("input", () => {
  const bpm = +bpmInput.value || 110;
  sequencers.forEach(s => s.setBpm(bpm));
});

// ---- default patch ----
function bootPatch() {
  if (modules.length > 0) return;
  const seq = new SequencerModule();
  const osc = new OscillatorModule();
  const env = new EnvelopeModule();
  const vca = new VcaModule();
  const filt = new FilterModule();
  const delay = new DelayModule();
  const out = new OutputModule();

  [seq, osc, env, vca, filt, delay, out].forEach(m => addModule(m));

  // give the DOM a tick so jack rects exist
  requestAnimationFrame(() => {
    const pOf = (m: Module, label: string, dir: "in" | "out") =>
      m.ports.find(p => p.label === label && p.dir === dir)!;

    // when seq drives pitch, zero the osc's base offset so seq cv defines pitch
    (osc as OscillatorModule).freqOffset.offset.value = 0;
    (osc as OscillatorModule).baseFreq = 0;
    patchBay.connect(pOf(seq, "cv", "out"), pOf(osc, "v/oct", "in"));
    patchBay.connect(pOf(seq, "gate", "out"), pOf(env, "gate", "in"));
    patchBay.connect(pOf(osc, "out", "out"), pOf(vca, "in", "in"));
    patchBay.connect(pOf(env, "env", "out"), pOf(vca, "cv", "in"));
    patchBay.connect(pOf(vca, "out", "out"), pOf(filt, "in", "in"));
    patchBay.connect(pOf(filt, "out", "out"), pOf(delay, "in", "in"));
    patchBay.connect(pOf(delay, "out", "out"), pOf(out, "in", "in"));
    redrawCables();
  });
}
