// Patch / port system. Each port is either an audio source (out) or a sink (in).
// Audio sinks are AudioNodes or AudioParams. Triggers/gates are handled as
// CV: a constant offset modulator that pulses 0→1.

import type { Module } from "./modules/base";

export type PortDir = "in" | "out";
export type PortKind = "audio" | "cv" | "gate";

export interface Port {
  id: string;
  module: Module;
  dir: PortDir;
  kind: PortKind;
  label: string;
  // For outs: the source node we connect FROM
  node?: AudioNode;
  // For ins: either an AudioParam target (for modulation) or an AudioNode
  target?: AudioNode | AudioParam;
  // For gate ins: a callback fired when a gate arrives
  onGate?: (time: number, velocity: number, freq: number, duration: number) => void;
  el?: HTMLElement; // jack DOM element
}

export interface Cable {
  id: string;
  from: Port;
  to: Port;
}

let portIdSeq = 0;
let cableIdSeq = 0;

export function makePort(opts: Omit<Port, "id">): Port {
  return { id: `p${++portIdSeq}`, ...opts };
}

export class PatchBay {
  cables: Cable[] = [];
  listeners: (() => void)[] = [];

  connect(from: Port, to: Port): Cable | null {
    if (from.dir !== "out" || to.dir !== "in") return null;
    if (from.module === to.module) return null;
    // disconnect any existing cable into the same input
    this.cables.filter(c => c.to === to).forEach(c => this.disconnect(c));
    // for audio: connect node→target
    if (from.node && to.target) {
      try {
        // @ts-ignore - connect can accept AudioParam
        from.node.connect(to.target as any);
      } catch (e) { console.warn("connect failed", e); return null; }
    }
    const cable: Cable = { id: `c${++cableIdSeq}`, from, to };
    this.cables.push(cable);
    this.notify();
    return cable;
  }

  disconnect(cable: Cable) {
    const { from, to } = cable;
    if (from.node && to.target) {
      try {
        // @ts-ignore
        from.node.disconnect(to.target as any);
      } catch {}
    }
    this.cables = this.cables.filter(c => c !== cable);
    this.notify();
  }

  disconnectPort(port: Port) {
    this.cables.filter(c => c.from === port || c.to === port).forEach(c => this.disconnect(c));
  }

  // Trigger a gate from a source port to its connected gate inputs.
  fireGate(from: Port, time: number, velocity: number, freq: number, duration: number) {
    for (const c of this.cables) {
      if (c.from === from && c.to.kind === "gate" && c.to.onGate) {
        c.to.onGate(time, velocity, freq, duration);
      }
    }
  }

  onChange(fn: () => void) { this.listeners.push(fn); }
  private notify() { this.listeners.forEach(l => l()); }
}

export const patchBay = new PatchBay();
