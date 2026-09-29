/* Tiny effects bus. Components fire light events; the FxLayer draws them.
   Nothing here touches the DOM during render, so it is safe anywhere. */
export type FxEvent =
  | { kind: "burst"; color: string; x?: number; y?: number; count?: number; spread?: number }
  | { kind: "flash"; color: string; strength?: number }
  | { kind: "strobe"; color: string; times?: number }
  | { kind: "ring"; color: string; x?: number; y?: number };

export function fx(detail: FxEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FxEvent>("pt:fx", { detail }));
}

/* Haptics on phones that have them; a no-op everywhere else. */
export function buzz(pattern: number | number[]) {
  try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern); } catch { /* ignore */ }
}

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Center of an element in viewport pixels — where a burst should start. */
export function centerOf(el: Element | null | undefined): { x: number; y: number } | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
