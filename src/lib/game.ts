/* Online play: the two-player game state machine, following the printed
   rulebook. State is a JSON blob on GameRoom; clients poll
   /api/play/rooms/[code] and post actions. Every mutation runs through
   `reduce` on the server so both players see the same thing.

   Rulebook points encoded here:
   - Roll → draw (one, or two-keep-one; the other slides back into its pile)
     → read out loud → answer.
   - Do it / Tweak it: card goes to Played and the partner becomes the roller.
   - Save it: card goes to Saved and the SAME roller rolls again.
   - Pass: card goes back to the bottom of its pile; same roller rolls again.
     No limit on passes.
   - 11 Focus on You: before drawing, the roller decides who receives.
   - 12 Free Play: draws from the four Free Play cards; once that pile is
     empty, a 12 means the roller picks any card from any pile.
   - Empty pile: roll again, or step one category up the ramp.
   - Stop means stop: either player ends the night at any moment. */
import { CATEGORIES, categoryForRoll, type Category } from "./content";

export interface GameCardRef {
  code: string; title: string; category: Category | string; rarity: string; spice: number; time: string; text: string;
  art?: string | null;
}

export interface PlayerState {
  userId: string;
  name: string;
  ceiling: number;         // max spice 1–5
  vetoes: string[];        // card codes removed before the night
  ready: boolean;
}

export type Phase = "lobby" | "roll" | "focus" | "draw" | "read" | "answer" | "ended";
export type Answer = "do" | "tweak" | "save" | "pass";
export type SpecialMode = "focus" | "free" | "dealer" | null;

export interface GameState {
  phase: Phase;
  players: PlayerState[];
  rollerIndex: number;          // whose turn to roll
  receiverIndex: number | null; // Focus on You: who receives
  roll: number | null;
  rolling: boolean;
  category: Category | null;
  hand: GameCardRef[];          // 1 or 2 drawn cards (draw two, keep one)
  current: GameCardRef | null;
  piles: { played: GameCardRef[]; saved: GameCardRef[]; retired: GameCardRef[] };
  deckCounts: Record<string, number>; // remaining per category, under the ceiling
  drawn: string[];              // codes out of the piles right now (played or in hand)
  passStreak: number;           // passes in a row (two is information, not failure)
  emptyPile: boolean;           // the rolled pile has nothing left under the ceiling
  log: Array<{ t: number; who: string; text: string }>;
  turn: number;
  endedAt?: number;
  specialMode?: SpecialMode;
}

export function newGame(host: { userId: string; name: string }): GameState {
  return {
    phase: "lobby",
    players: [{ userId: host.userId, name: host.name, ceiling: 3, vetoes: [], ready: false }],
    rollerIndex: 0,
    receiverIndex: null,
    roll: null, rolling: false, category: null,
    hand: [], current: null,
    piles: { played: [], saved: [], retired: [] },
    deckCounts: Object.fromEntries(CATEGORIES.map((c) => [c, 0])),
    drawn: [],
    passStreak: 0,
    emptyPile: false,
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
  | { type: "chooseReceiver"; userId: string; receiver: "roller" | "partner" }
  | { type: "reroll"; userId: string }
  | { type: "stepUp"; userId: string }
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

function clearTable(s: GameState) {
  s.current = null; s.hand = []; s.roll = null; s.category = null; s.specialMode = null; s.receiverIndex = null; s.emptyPile = false;
}

export function reduce(prev: GameState, a: Action): GameState {
  const s: GameState = JSON.parse(JSON.stringify(prev));
  if (s.passStreak === undefined) s.passStreak = 0;
  if (s.emptyPile === undefined) s.emptyPile = false;
  if (s.receiverIndex === undefined) s.receiverIndex = null;
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
      s.hand = [];
      s.emptyPile = false;
      s.receiverIndex = null;
      if (n === 11) { s.specialMode = "focus"; s.phase = "focus"; }
      else if (n === 12) { s.specialMode = (s.deckCounts["Free Play"] ?? 0) > 0 ? "free" : "dealer"; s.phase = "draw"; }
      else { s.specialMode = null; s.phase = "draw"; }
      log(s, roller.name, `rolled ${n} — ${face.category}${s.specialMode === "dealer" ? " (Free Play pile is empty: pick any card)" : ""}.`);
      return s;
    }
    case "chooseReceiver": {
      if (s.phase !== "focus") throw new Error("Nothing to decide.");
      if (!isRoller) throw new Error("The roller decides who receives.");
      s.receiverIndex = a.receiver === "roller" ? s.rollerIndex : (s.rollerIndex + 1) % s.players.length;
      s.phase = "draw";
      log(s, roller.name, `decided: ${s.players[s.receiverIndex].name} receives.`);
      return s;
    }
    case "reroll": {
      if (s.phase !== "draw" && s.phase !== "focus") throw new Error("Nothing to re-roll.");
      if (!isRoller) throw new Error("It isn’t your roll.");
      if (s.hand.length) throw new Error("You already drew.");
      clearTable(s);
      s.phase = "roll";
      log(s, roller.name, "rolls again.");
      return s;
    }
    case "stepUp": {
      if (s.phase !== "draw") throw new Error("Nothing to step up from.");
      if (!isRoller) throw new Error("It isn’t your turn.");
      if (s.hand.length) throw new Error("You already drew.");
      const i = CATEGORIES.indexOf(s.category ?? "Soft Touch");
      const next = CATEGORIES[Math.min(CATEGORIES.length - 1, i + 1)];
      if (next === s.category) throw new Error("Nowhere higher to go — roll again.");
      s.category = next;
      s.specialMode = next === "Free Play" ? ((s.deckCounts["Free Play"] ?? 0) > 0 ? "free" : "dealer") : null;
      s.emptyPile = false;
      log(s, roller.name, `stepped up the ramp to ${next}.`);
      return s;
    }
    case "draw": {
      if (s.phase !== "draw") throw new Error("Not time to draw.");
      if (!isRoller) throw new Error("It isn’t your draw.");
      if (!a.cards.length) throw new Error("That pile is empty. Roll again or step up the ramp.");
      s.hand = a.cards.slice(0, 2);
      s.drawn.push(...s.hand.map((c) => c.code));
      s.emptyPile = false;
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
      /* the other card slides to the bottom of its pile */
      if (other) s.drawn = s.drawn.filter((code) => code !== other.code);
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
      s.turn += 1;
      if (a.answer === "do" || a.answer === "tweak") {
        s.piles.played.push(c);
        s.passStreak = 0;
        log(s, me.name, a.answer === "do" ? `did “${c.title}”.` : `tweaked “${c.title}”.`);
        clearTable(s);
        s.rollerIndex = (s.rollerIndex + 1) % s.players.length;
        s.phase = "roll";
        log(s, "system", `${s.players[s.rollerIndex].name} rolls.`);
        return s;
      }
      if (a.answer === "save") {
        s.piles.saved.push(c);
        s.passStreak = 0;
        log(s, me.name, `saved “${c.title}” for later. ${roller.name} rolls again.`);
      } else {
        /* pass: back to the bottom of its pile, no penalty, same roller */
        s.drawn = s.drawn.filter((code) => code !== c.code);
        s.passStreak += 1;
        log(s, me.name, `passed on “${c.title}”. ${roller.name} rolls again.${s.passStreak >= 2 ? " Two passes in a row: maybe step down a category." : ""}`);
      }
      clearTable(s);
      s.phase = "roll";
      return s;
    }
    case "playSaved": {
      if (s.phase !== "roll") throw new Error("Finish the current card first.");
      if (!isRoller) throw new Error("It isn’t your turn.");
      const idx = s.piles.saved.findIndex((c) => c.code === a.code);
      if (idx < 0) throw new Error("That card isn’t saved.");
      const [c] = s.piles.saved.splice(idx, 1);
      s.current = c; s.hand = [c]; s.category = c.category as Category; s.phase = "read"; s.specialMode = null; s.emptyPile = false;
      log(s, me?.name ?? "someone", `brought back “${c.title}” from the Saved pile.`);
      return s;
    }
    case "stop":
    case "end": {
      if (s.phase === "ended") return s;
      s.phase = "ended";
      s.endedAt = Date.now();
      log(s, me?.name ?? "system", a.type === "stop" ? "said stop. Stop means stop." : "ended the night. Stay in the room — the last five minutes count.");
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
