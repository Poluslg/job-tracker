const HOST_ID = "job-ai-copilot-root";

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }

.fab {
  position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
  display: flex; align-items: center; gap: 8px;
  height: 40px; padding: 0 14px 0 12px;
  border: none; border-radius: 20px; cursor: pointer;
  background: #3b5bdb; color: #fff;
  font-size: 13px; font-weight: 600; line-height: 1;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.24);
}
.fab:hover { background: #364fc7; }
.fab .dot { width: 7px; height: 7px; border-radius: 50%; background: #69db7c; }
.fab .dot.warn { background: #ffd43b; }

.toast {
  position: fixed; right: 20px; bottom: 72px; z-index: 2147483000;
  max-width: 320px; padding: 10px 12px;
  border-radius: 10px; background: #1f2937; color: #f8fafc;
  font-size: 12px; line-height: 1.45;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.24);
}

.picker-bar {
  position: fixed; inset: 0 0 auto 0; z-index: 2147483001;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 10px 16px;
  background: #1f2937; color: #f8fafc; font-size: 13px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.3);
}
.picker-bar button {
  padding: 6px 12px; border: 1px solid rgba(248, 250, 252, 0.3);
  border-radius: 6px; background: transparent; color: inherit;
  font-size: 12px; cursor: pointer;
}
.picker-bar button.primary { background: #3b5bdb; border-color: #3b5bdb; }
.picker-highlight {
  position: fixed; z-index: 2147483000; pointer-events: none;
  border: 2px solid #3b5bdb; border-radius: 4px;
  background: rgba(59, 91, 219, 0.1);
}
`;

let host: HTMLElement | null = null;
let root: ShadowRoot | null = null;

function ensureRoot(): ShadowRoot {
  if (root && host?.isConnected) return root;
  host = document.createElement("div");
  host.id = HOST_ID;

  root = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  root.append(style);
  document.documentElement.append(host);
  return root;
}

export function removeOverlay(): void {
  host?.remove();
  host = null;
  root = null;
}

export interface FabOptions {
  label: string;
  detected: boolean;
  onClick: () => void;
}

export function renderFab(options: FabOptions): void {
  const shadow = ensureRoot();
  shadow.querySelector(".fab")?.remove();

  const button = document.createElement("button");
  button.className = "fab";
  button.type = "button";
  button.setAttribute("aria-label", options.label);

  const dot = document.createElement("span");
  dot.className = options.detected ? "dot" : "dot warn";
  const text = document.createElement("span");
  text.textContent = options.label;

  button.append(dot, text);
  button.addEventListener("click", options.onClick);
  shadow.append(button);
}

export function showToast(message: string, ms = 4000): void {
  const shadow = ensureRoot();
  shadow.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  shadow.append(el);
  setTimeout(() => el.remove(), ms);
}

let pickerCleanup: (() => void) | null = null;

export function isPicking(): boolean {
  return pickerCleanup !== null;
}

export function startManualSelection(
  onPick: (text: string) => void,
  onCancel: () => void,
): void {
  cancelManualSelection();
  const shadow = ensureRoot();

  const bar = document.createElement("div");
  bar.className = "picker-bar";
  const label = document.createElement("span");
  label.textContent =
    "Click the block of text that contains the job description.";
  const actions = document.createElement("span");
  const cancel = document.createElement("button");
  cancel.textContent = "Cancel (Esc)";
  actions.append(cancel);
  bar.append(label, actions);

  const highlight = document.createElement("div");
  highlight.className = "picker-highlight";
  highlight.style.display = "none";

  shadow.append(bar, highlight);

  let current: Element | null = null;

  const onMove = (e: MouseEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id === HOST_ID) return;

    let candidate: Element | null = el;
    while (
      candidate &&
      (candidate.textContent ?? "").trim().length < 200 &&
      candidate.parentElement
    ) {
      candidate = candidate.parentElement;
    }
    if (!candidate || candidate === current) return;
    current = candidate;
    const rect = candidate.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: "block",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const text = (current?.textContent ?? "").trim();
    cancelManualSelection();
    if (text.length > 100) onPick(text);
    else {
      showToast("That selection was too short. Try a larger block of text.");
      onCancel();
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      cancelManualSelection();
      onCancel();
    }
  };

  cancel.addEventListener("click", () => {
    cancelManualSelection();
    onCancel();
  });

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);

  pickerCleanup = () => {
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);
    bar.remove();
    highlight.remove();
    pickerCleanup = null;
  };
}

export function cancelManualSelection(): void {
  pickerCleanup?.();
}
