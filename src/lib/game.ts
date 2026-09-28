/* Online play: the two-player game state machine. State is a JSON blob on
   GameRoom; clients poll /api/play/rooms/[code] and post actions. Every
   mutation runs through `reduce` on the server so both players see the same
   thing and the rules (passes are unlimited, stop means stop) are enforced. */
import { CATEGORIES, categoryForRoll, type Category } from "./content";

export interface GameCardRef {
  code: string; title: string; category: Category | string; rarity: string; spice: number; time: string; text: string;
}

export interface PlayerState {
  userId: string;
  name: string;
  ceiling: number;         // max spice 1–5
  vetoes: string[];        // card codes removed before the night
  ready: boolean;
}

export type Phase = "lobby" | "roll" | "draw" | "read" | "answer" | "ended";
export type Answer = "do" | "tweak" | "save" | "pass";

export interface GameState {
  phase: Phase;
  players: PlayerState[];
  rollerIndex: number;          // whose turn to roll
  roll: number | null;
  rolling: boolean;
  category: Category | null;
  hand: GameCardRef[];          // 1 or 2 drawn cards (draw two, keep one)
  current: GameCardRef | null;
  piles: { played: GameCardRef[]; saved: GameCardRef[]; retired: GameCardRef[] };
  deckCounts: Record<string, number>; // remaining per category (host deck + guest deck merged)
  drawn: string[];              // codes drawn this session
  log: Array<{ t: number; who: string; text: string }>;
  turn: number;
  lastFinalSeconds?: number;    // "the last five minutes count"
  endedAt?: number;
  specialMode?: "focus" | "free" | null;
}

export function newGame(host: { userId: string; name: string }): GameState {
  return {
    phase: "lobby",
    players: [{ userId: host.userId, name: host.name, ceiling: 3, vetoes: [], ready: false }],
    rollerIndex: 0,
    roll: null, rolling: false, category: null,
    hand: [], current: null,
    piles: { played: [], saved: [], retired: [] },
    deckCounts: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
    drawn: [],
    log: [{ t: Date.now(), who: "system", text: `${host.name} opened the room.` }],
    turn: 0,
    specialMode: null,
  };
}

export type Action =
  | { type: "join"; userId: string; name: string }
  | { type: "leave"; userId: string }
  | { type: "setCeiling"; userId: string; ceiling: number }
  | { type: "setVetoes"; userId: string; vetoes: string[] }
  | { type: "ready"; userId: string; ready: boolean }
  | { type: "start"; userId: string }
  | { type: "roll"; userId: string; n: number }
  | { type: "draw"; userId: string; cards: GameCardRef[] }   // server supplies cards
  | { type: "keep"; userId: string; code: string }
  | { type: "read"; userId: string }
  | { type: "answer"; userId: string; answer: Answer }
  | { type: "playSaved"; userId: string; code: string }
  | { type: "stop"; userId: string }
  | { type: "end"; userId: string };

export function ceilingFor(s: GameState): number {
  return Math.min(...s.players.map((p) => p.ceiling));
}

const log = (s: GameState, who: string, text: string) => {
  s.log = [...s.log.slice(-60), { t: Date.now(), who, text }];
};

export function reduce(prev: GameState, a: Action): GameState {
  const s: GameState = JSON.parse(JSON.stringify(prev));
  const me = s.players.find((p) => p.userId === ("userId" in a ? a.userId : ""));
  const roller = s.players[s.rollerIndex];
  const isRoller = !!me && roller?.userId === me.userId;

  switch (a.type) {
    case "join": {
      if (s.players.some((p) => p.userId === a.userId)) return s;
      if (s.players.length >= 2) throw new Error("Room is full.");
      s.players.push({ userId: a.userId, name: a.name, ceiling: 3, vetoes: [], ready: false });
      log(s, "system", `${a.name} joined.`);
      return s;
    }
    case "leave": {
      const p = s.players.find((x) => x.userId === a.userId);
      if (!p) return s;
      if (s.phase !== "lobby") { s.phase = "ended"; s.endedAt = Date.now(); log(s, "system", `${p.name} left. Night over.`); return s; }
      s.players = s.players.filter((x) => x.userId !== a.userId);
      s.rollerIndex = 0;
      log(s, "system", `${p.name} left.`);
      return s;
    }
    case "setCeiling": {
      if (!me) throw new Error("Not in this room.");
      me.ceiling = Math.max(1, Math.min(5, Math.round(a.ceiling)));
      return s;
    }
    case "setVetoes": {
      if (!me) throw new Error("Not in this room.");
      me.vetoes = a.vetoes.slice(0, 200);
      return s;
    }
    case "ready": {
      if (!me) throw new Error("Not in this room.");
      me.ready = a.ready;
      return s;
    }
    case "start": {
      if (s.phase !== "lobby") return s;
      if (s.players.length < 2) throw new Error("You need two players.");
      if (!s.players.every((p) => p.ready)) throw new Error("Both players must be ready.");
      s.phase = "roll";
      s.turn = 1;
      log(s, "system", `Ceiling set to ${ceilingFor(s)}/5. ${roller.name} rolls first.`);
      return s;
    }
    case "roll": {
      if (s.phase !== "roll") throw new Error("Not time to roll.");
      if (!isRoller) throw new Error("It isn’t your roll.");
      const n = Math.max(1, Math.min(12, Math.round(a.n)));
      s.roll = n;
      const face = categoryForRoll(n);
      s.category = face.category;
      s.specialMode = n === 11 ? "focus" : n === 12 ? "free" : null;
      s.phase = "draw";
      s.hand = [];
      log(s, roller.name, `rolled ${n} — ${face.category}.`);
      return s;
    }
    case "draw": {
      if (s.phase !== "draw") throw new Error("Not time to draw.");
      if (!isRoller) throw new Error("It isn’t your draw.");
      if (!a.cards.length) throw new Error("No cards left in that pile.");
      s.hand = a.cards.slice(0, 2);
      s.drawn.push(...s.hand.map((c) => c.code));
      if (s.hand.length === 1) { s.current = s.hand[0]; s.phase = "read"; }
      log(s, roller.name, s.hand.length === 2 ? "drew two." : `drew ${s.hand[0].title}.`);
      return s;
    }
    case "keep": {
      if (s.phase !== "draw" || s.hand.length < 2) throw new Error("Nothing to choose.");
      if (!isRoller) throw new Error("It isn’t your choice.");
      const keep = s.hand.find((c) => c.code === a.code);
      if (!keep) throw new Error("That card isn’t in your hand.");
      const other = s.hand.find((c) => c.code !== a.code);
      if (other) s.piles.retired.push(other);
      s.current = keep;
      s.hand = [keep];
      s.phase = "read";
      log(s, roller.name, `kept ${keep.title}.`);
      return s;
    }
    case "read": {
      if (s.phase !== "read") throw new Error("Nothing to read.");
      s.phase = "answer";
      return s;
    }
    case "answer": {
      if (s.phase !== "answer" || !s.current) throw new Error("Nothing to answer.");
      if (!me) throw new Error("Not in this room.");
      const c = s.current;
      if (a.answer === "do") { s.piles.played.push(c); log(s, me.name, `did “${c.title}”.`); }
      if (a.answer === "tweak") { s.piles.played.push(c); log(s, me.name, `tweaked “${c.title}”.`); }
      if (a.answer === "save") { s.piles.saved.push(c); log(s, me.name, `saved “${c.title}” for later.`); }
      if (a.answer === "pass") { s.piles.retired.push(c); log(s, me.name, `passed on “${c.title}”. Passes are unlimited.`); }
      s.current = null; s.hand = []; s.roll = null; s.category = null; s.specialMode = null;
      s.rollerIndex = (s.rollerIndex + 1) % s.players.length;
      s.turn += 1;
      s.phase = "roll";
      return s;
    }
    case "playSaved": {
      if (s.phase !== "roll") throw new Error("Finish the current card first.");
      const idx = s.piles.saved.findIndex((c) => c.code === a.code);
      if (idx < 0) throw new Error("That card isn’t saved.");
      const [c] = s.piles.saved.splice(idx, 1);
      s.current = c; s.hand = [c]; s.category = c.category as Category; s.phase = "read";
      log(s, me?.name ?? "someone", `brought back “${c.title}”.`);
      return s;
    }
    case "stop":
    case "end": {
      if (s.phase === "ended") return s;
      s.phase = "ended";
      s.endedAt = Date.now();
      log(s, me?.name ?? "system", a.type === "stop" ? "said stop. Stop means stop." : "ended the night.");
      return s;
    }
    default:
      return s;
  }
}

export function publicState(s: GameState, viewerId: string): GameState {
  /* nothing is hidden between two consenting players except the other
     player's vetoes (that list is private by design) */
  return {
    ...s,
    players: s.players.map((p) => (p.userId === viewerId ? p : { ...p, vetoes: [] })),
  };
}

export function randomRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
