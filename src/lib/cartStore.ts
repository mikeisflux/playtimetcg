"use client";
/* Client-side cart: persisted in localStorage, validated server-side at
   checkout. A tiny external store so the header badge, drawer and pages all
   share one state without a provider. */
import { useSyncExternalStore } from "react";

export interface CartLine {
  id: string;         // product id
  slug: string;
  name: string;
  priceCents: number;
  accent: string;
  qty: number;
  digital: boolean;
  choices?: string[]; // chosen expansion slugs for the bundle
  choiceNames?: string[];
}

export interface CartState { lines: CartLine[]; open: boolean }

const KEY = "pt-cart-v1";
let state: CartState = { lines: [], open: false };
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.lines)) state = { lines: parsed.lines, open: false };
    }
  } catch { /* ignore */ }
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ lines: state.lines })); } catch { /* private mode */ }
}

function set(next: Partial<CartState>) {
  state = { ...state, ...next };
  persist();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  load();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

const lineKey = (l: Pick<CartLine, "id" | "choices">) => `${l.id}::${(l.choices ?? []).slice().sort().join(",")}`;

export const cart = {
  add(line: Omit<CartLine, "qty">, qty = 1, open = true) {
    load();
    const k = lineKey(line);
    const existing = state.lines.find((l) => lineKey(l) === k);
    const lines = existing
      ? state.lines.map((l) => (lineKey(l) === k ? { ...l, qty: l.qty + qty } : l))
      : [...state.lines, { ...line, qty }];
    set({ lines, open: open ? true : state.open });
  },
  setQty(key: string, qty: number) {
    load();
    const lines = qty <= 0
      ? state.lines.filter((l) => lineKey(l) !== key)
      : state.lines.map((l) => (lineKey(l) === key ? { ...l, qty } : l));
    set({ lines });
  },
  remove(key: string) { cart.setQty(key, 0); },
  clear() { set({ lines: [] }); },
  open() { set({ open: true }); },
  close() { set({ open: false }); },
  key: lineKey,
};

const getSnapshot = () => { load(); return state; };
const serverSnapshot: CartState = { lines: [], open: false };

export function useCart() {
  const s = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const count = s.lines.reduce((n, l) => n + l.qty, 0);
  const subtotalCents = s.lines.reduce((n, l) => n + l.qty * l.priceCents, 0);
  return { ...s, count, subtotalCents };
}
