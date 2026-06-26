export interface KnobOptions {
  label: string;
  min: number;
  max: number;
  value: number;
  step?: number;
  curve?: "linear" | "log";
  unit?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}

export function makeKnob(opts: KnobOptions): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "knob";

  const dial = document.createElement("div");
  dial.className = "knob-dial";

  const label = document.createElement("div");
  label.className = "knob-label";
  label.textContent = opts.label;

  const value = document.createElement("div");
  value.className = "knob-value";

  let v = opts.value;
  const update = () => {
    const norm = opts.curve === "log"
      ? Math.log(Math.max(v, opts.min)) - Math.log(opts.min)
      : v - opts.min;
    const range = opts.curve === "log"
      ? Math.log(opts.max) - Math.log(opts.min)
      : opts.max - opts.min;
    const pct = norm / range;
    const angle = -135 + pct * 270;
    dial.style.setProperty("--angle", `${angle}deg`);
    value.textContent = opts.format ? opts.format(v) : formatNum(v) + (opts.unit ?? "");
  };

  const setVal = (n: number) => {
    n = Math.max(opts.min, Math.min(opts.max, n));
    if (opts.step) n = Math.round(n / opts.step) * opts.step;
    v = n;
    update();
    opts.onChange(v);
  };

  let dragStartY = 0;
  let dragStartV = 0;
  const onMove = (e: MouseEvent) => {
    const dy = dragStartY - e.clientY;
    const range = opts.curve === "log"
      ? Math.log(opts.max) - Math.log(opts.min)
      : opts.max - opts.min;
    const factor = e.shiftKey ? 0.001 : 0.005;
    const delta = dy * factor * range;
    if (opts.curve === "log") {
      const newV = Math.exp(Math.log(Math.max(dragStartV, opts.min)) + delta);
      setVal(newV);
    } else {
      setVal(dragStartV + delta);
    }
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  dial.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragStartY = e.clientY;
    dragStartV = v;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
  dial.addEventListener("dblclick", () => setVal(opts.value));

  wrap.append(dial, label, value);
  update();
  return wrap;
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 10) return n.toFixed(2);
  return n.toFixed(3);
}
