/* Online play: the two-player game state machine, following the printed
   rulebook. State is a JSON blob on GameRoom; clients poll
   /api/play/rooms/[code] and post actions. Every mutation runs through
   `reduce` on the server so both players see the same thing.

   Rulebook points encoded here:
   - One shuffled deck. Every back is printed in its category color with its
     die numbers: roll, then take the FIRST card in the deck whose back
     matches. Nothing is sorted and nobody sees a card before it's drawn.
   - Read out loud → answer.
   - Do it / Tweak it: card goes to Played and the partner becomes the roller.
   - Save it: card goes to Saved and the SAME roller rolls again.
   - Pass: card goes to the bottom of the deck, face down; same roller rolls
     again. No limit on passes (two in a row: step down a category).
   - 11 Focus on You: before drawing, the roller decides who receives.
   - 12 Free Play: the first Free Play back in the deck; once all four are
     out, a 12 means the roller picks any card in the deck (Dealer's Choice).
   - No match left: roll again, or step one category up the ramp.
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

/* A face-down card in the deck: only its back (category) is visible. */
export interface DeckSlot { code: string; category: Category | string }

export interface GameState {
  phase: Phase;
  players: PlayerState[];
  rollerIndex: number;          // whose turn to roll
  receiverIndex: number | null; // Focus on You: who receives
  roll: number | null;
  rolling: boolean;
  category: Category | null;
  hand: GameCardRef[];          // the drawn card (kept for compatibility)
  current: GameCardRef | null;
  piles: { played: GameCardRef[]; saved: GameCardRef[]; retired: GameCardRef[] };
  deck: DeckSlot[];             // the shuffled deck, top first — backs only
  deckCounts: Record<string, number>; // remaining per category (derived from deck)
  drawn: string[];              // codes out of the deck right now
  passStreak: number;           // passes in a row (two is information, not failure)
  emptyPile: boolean;           // no back matching the roll is left in the deck
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
    deck: [],
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
  | { type: "start"; userId: string; deck: DeckSlot[] }        // server supplies the shuffled deck
  | { type: "roll"; userId: string; n: number }
  | { type: "chooseReceiver"; userId: string; receiver: "roller" | "partner" }
  | { type: "reroll"; userId: string }
  | { type: "stepUp"; userId: string }
  | { type: "draw"; userId: string; card: GameCardRef }        // server resolves the first matching back
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

export function countDeck(deck: DeckSlot[]): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const d of deck) out[d.category] = (out[d.category] ?? 0) + 1;
  return out;
}

/* Index of the first card in the deck whose back matches the category. */
export function firstMatch(deck: DeckSlot[], category: string): number {
  return deck.findIndex((d) => d.category === category);
}

function refreshDeck(s: GameState) {
  s.deckCounts = countDeck(s.deck);
}

function clearTable(s: GameState) {
  s.current = null; s.hand = []; s.roll = null; s.category = null; s.specialMode = null; s.receiverIndex = null; s.emptyPile = false;
}

/* After a roll or a step up: is there a matching back? A 12 with no Free
   Play left becomes Dealer's Choice. */
function settleTarget(s: GameState) {
  if (!s.category) return;
  if (s.category === "Free Play") {
    if (firstMatch(s.deck, "Free Play") < 0) { s.specialMode = "dealer"; s.emptyPile = s.deck.length === 0; return; }
    s.specialMode = "free"; s.emptyPile = false; return;
  }
  s.emptyPile = firstMatch(s.deck, s.category) < 0;
}

export function reduce(prev: GameState, a: Action): GameState {
  const s: GameState = JSON.parse(JSON.stringify(prev));
  if (s.passStreak === undefined) s.passStreak = 0;
  if (s.emptyPile === undefined) s.emptyPile = false;
  if (s.receiverIndex === undefined) s.receiverIndex = null;
  if (!Array.isArray(s.deck)) s.deck = [];
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
      if (s.phase !== "lobby") throw new Error("The ceiling is set before the first roll.");
      me.ceiling = Math.max(1, Math.min(5, Math.round(a.ceiling)));
      return s;
    }
    case "setVetoes": {
      if (!me) throw new Error("Not in this room.");
      if (s.phase !== "lobby") throw new Error("Vetoes are pulled before the first roll.");
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
      if (!a.deck.length) throw new Error("There are no cards to play under tonight’s ceiling.");
      s.deck = a.deck;
      s.drawn = [];
      refreshDeck(s);
      s.phase = "roll";
      s.turn = 1;
      log(s, "system", `One deck of ${s.deck.length} cards shuffled. Ceiling ${ceilingFor(s)}/5. ${roller.name} rolls first.`);
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
      s.receiverIndex = null;
      s.specialMode = null;
      settleTarget(s);
      if (n === 11) { s.specialMode = "focus"; s.phase = "focus"; }
      else s.phase = "draw";
      const mode = s.specialMode as SpecialMode;
      log(s, roller.name, `rolled ${n} — ${face.category}${mode === "dealer" ? " (all four Free Play cards are out: pick any card in the deck)" : s.emptyPile ? " — no matching back left" : ""}.`);
      return s;
    }
    case "chooseReceiver": {
      if (s.phase !== "focus") throw new Error("Nothing to decide.");
      if (!isRoller) throw new Error("The roller decides who receives.");
      s.receiverIndex = a.receiver === "roller" ? s.rollerIndex : (s.rollerIndex + 1) % s.players.length;
      s.specialMode = "focus";
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
      s.specialMode = null;
      settleTarget(s);
      log(s, roller.name, `stepped up the ramp to ${next}.`);
      return s;
    }
    case "draw": {
      if (s.phase !== "draw") throw new Error("Not time to draw.");
      if (!isRoller) throw new Error("It isn’t your draw.");
      const idx = s.deck.findIndex((d) => d.code === a.card.code);
      if (idx < 0) throw new Error("That card isn’t in the deck.");
      if (s.specialMode !== "dealer" && s.category && s.deck[idx].category !== s.category) throw new Error("That back doesn’t match the roll.");
      s.deck.splice(idx, 1);
      s.drawn.push(a.card.code);
      refreshDeck(s);
      s.hand = [a.card];
      s.current = a.card;
      s.emptyPile = false;
      s.phase = "read";
      log(s, roller.name, s.specialMode === "dealer" ? `picked ${a.card.title} from the deck.` : `drew ${a.card.title}.`);
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
        /* pass: to the bottom of the deck, face down, no penalty, same roller */
        s.deck.push({ code: c.code, category: c.category });
        s.drawn = s.drawn.filter((code) => code !== c.code);
        refreshDeck(s);
        s.passStreak += 1;
        log(s, me.name, `passed on “${c.title}” — it goes to the bottom of the deck. ${roller.name} rolls again.${s.passStreak >= 2 ? " Two passes in a row: maybe step down a category." : ""}`);
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
     player's vetoes (that list is private by design); the deck is shown as
     backs only — codes are stripped so the fronts stay unknown until drawn */
  const roller = s.players[s.rollerIndex];
  /* Dealer's Choice: the roller looks through the whole deck, so they see codes */
  const reveal = s.phase === "draw" && s.specialMode === "dealer" && roller?.userId === viewerId;
  return {
    ...s,
    deck: (s.deck ?? []).map((d) => ({ code: reveal ? d.code : "", category: d.category })),
    players: s.players.map((p) => (p.userId === viewerId ? p : { ...p, vetoes: [] })),
  };
}

export function randomRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
