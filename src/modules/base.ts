import { patchBay, type Port } from "../patch";

export interface ModuleSpec {
  type: string;
  title: string;
}

export abstract class Module {
  el!: HTMLElement;
  body!: HTMLElement;
  jacksEl!: HTMLElement;
  inCol!: HTMLElement;
  outCol!: HTMLElement;
  ports: Port[] = [];

  constructor(public spec: ModuleSpec) {
    this.build();
  }

  protected build() {
    this.el = document.createElement("div");
    this.el.className = `module module-${this.spec.type}`;

    const head = document.createElement("div");
    head.className = "module-head";
    const title = document.createElement("div");
    title.className = "module-title";
    title.textContent = this.spec.title;
    const close = document.createElement("button");
    close.className = "module-close";
    close.textContent = "×";
    close.onclick = () => this.destroy();
    head.append(title, close);

    this.body = document.createElement("div");
    this.body.className = "module-body";

    this.jacksEl = document.createElement("div");
    this.jacksEl.className = "jacks";
    this.inCol = document.createElement("div");
    this.inCol.className = "jack-col ins";
    this.outCol = document.createElement("div");
    this.outCol.className = "jack-col outs";
    this.jacksEl.append(this.inCol, this.outCol);

    this.el.append(head, this.body, this.jacksEl);
  }

  protected addJack(port: Port, label: string) {
    const jack = document.createElement("div");
    jack.className = `jack ${port.dir}`;
    jack.dataset.portId = port.id;
    const dot = document.createElement("div");
    dot.className = "jack-port";
    const text = document.createElement("span");
    text.textContent = label;
    if (port.dir === "in") jack.append(dot, text);
    else jack.append(text, dot);
    port.el = dot;
    if (port.dir === "in") this.inCol.appendChild(jack);
    else this.outCol.appendChild(jack);
    this.ports.push(port);
  }

  destroy() {
    for (const p of this.ports) patchBay.disconnectPort(p);
    this.onDestroy();
    this.el.remove();
  }

  protected onDestroy() {}
}
