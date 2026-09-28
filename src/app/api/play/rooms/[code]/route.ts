import { prisma } from "@/lib/db";
import { publicState, reduce, type Action, type Answer, type GameState } from "@/lib/game";
import { CATEGORIES } from "@/lib/content";
import { requirePlayer, json, fail, asState, toJson, statusFor, isParticipant, playablePool, countByCategory, sample } from "../../_shared";

type Params = { params: Promise<{ code: string }> };
type Body = { type?: unknown; [k: string]: unknown };

const ANSWERS: Answer[] = ["do", "tweak", "save", "pass"];

/* GET ?v=<version>: the room state for a participant, or {unchanged:true}. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  const { code } = await params;
  const room = await prisma.gameRoom.findUnique({ where: { code: code.toUpperCase() } });
  if (!room) return fail("No room with that code.", 404);
  if (!isParticipant(room, auth.user.id)) return fail("You’re not in this room.", 403);
  const v = Number(new URL(req.url).searchParams.get("v"));
  if (Number.isFinite(v) && v === room.version) return json({ unchanged: true });
  return json({ version: room.version, state: publicState(asState(room.state), auth.user.id), status: room.status });
}

/* Turn the client body into a full Action (the server owns userId). */
function buildAction(b: Body, me: { id: string; name: string }): Action | string {
  const str = (k: string) => (typeof b[k] === "string" ? (b[k] as string) : null);
  switch (b.type) {
    case "join": return { type: "join", userId: me.id, name: me.name };
    case "leave": case "start": case "read": case "stop": case "end": case "reroll": case "stepUp":
      return { type: b.type, userId: me.id };
    case "chooseReceiver": {
      const r = str("receiver");
      if (r !== "roller" && r !== "partner") return "Who receives?";
      return { type: "chooseReceiver", userId: me.id, receiver: r };
    }
    case "setCeiling": {
      const n = Number(b.ceiling);
      if (!Number.isFinite(n)) return "Pick a ceiling from 1 to 5.";
      return { type: "setCeiling", userId: me.id, ceiling: n };
    }
    case "setVetoes": {
      const v = Array.isArray(b.vetoes) ? (b.vetoes as unknown[]).filter((x): x is string => typeof x === "string") : null;
      if (!v) return "Vetoes must be a list of card codes.";
      return { type: "setVetoes", userId: me.id, vetoes: v };
    }
    case "ready": return { type: "ready", userId: me.id, ready: !!b.ready };
    case "roll": {
      const n = Number(b.n);
      if (!Number.isFinite(n)) return "Roll needs a number.";
      return { type: "roll", userId: me.id, n };
    }
    case "keep": case "playSaved": {
      const c = str("code");
      if (!c) return "Which card?";
      return { type: b.type, userId: me.id, code: c };
    }
    case "answer": {
      const a = str("answer");
      if (!a || !ANSWERS.includes(a as Answer)) return "Answer with do, tweak, save or pass.";
      return { type: "answer", userId: me.id, answer: a as Answer };
    }
    default: return "Unknown action.";
  }
}

/* POST: apply one action with an optimistic version check (one retry). */
export async function POST(req: Request, { params }: Params) {
  const auth = await requirePlayer();
  if (auth.res) return auth.res;
  const me = { id: auth.user.id, name: auth.user.name };
  const { code } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.type !== "string") return fail("Bad request.");

  for (let attempt = 0; attempt < 2; attempt++) {
    const room = await prisma.gameRoom.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) return fail("No room with that code.", 404);
    if (!isParticipant(room, me.id) && body.type !== "join") return fail("You’re not in this room.", 403);
    const state = asState(room.state);

    let next: GameState;
    let systemNote: string | null = null;
    let deckCounts: Record<string, number> | null = null;
    try {
      if (body.type === "draw" || body.type === "pickAny") {
        if (state.phase !== "draw") return fail("Not time to draw.");
        if (state.players[state.rollerIndex]?.userId !== me.id) return fail("It isn’t your draw.");
        const pool = await playablePool(state);
        let cards;
        if (body.type === "pickAny") {
          /* Dealer's Choice: a 12 once the Free Play pile is empty */
          if (state.specialMode !== "dealer") return fail("You can only pick any card on a Free Play roll with the pile empty.");
          const code = typeof body.code === "string" ? body.code : "";
          const card = pool.find((c) => c.code === code);
          if (!card) return fail("That card isn’t available under tonight’s ceiling.");
          cards = [card];
        } else {
          const count = Number(body.count) === 2 ? 2 : 1;
          const eligible = state.specialMode === "dealer" ? pool : pool.filter((c) => c.category === state.category);
          if (!eligible.length) {
            next = { ...state, emptyPile: true };
            deckCounts = countByCategory(pool);
            const status0 = statusFor(next.phase);
            await prisma.gameRoom.updateMany({ where: { id: room.id, version: room.version }, data: { state: toJson({ ...next, deckCounts: { ...Object.fromEntries(CATEGORIES.map((c) => [c, 0])), ...deckCounts } }), version: { increment: 1 }, status: status0 } });
            return fail("That pile is empty under tonight’s ceiling. Roll again or step one category up the ramp.");
          }
          cards = sample(eligible, count);
        }
        next = reduce(state, { type: "draw", userId: me.id, cards });
        deckCounts = countByCategory(pool, new Set(cards.map((c) => c.code)));
      } else {
        const action = buildAction(body, me);
        if (typeof action === "string") return fail(action);
        next = reduce(state, action);
        if (["start", "roll", "stepUp", "keep", "answer", "playSaved", "reroll", "chooseReceiver"].includes(action.type)) {
          const pool = await playablePool(next);
          deckCounts = countByCategory(pool);
          /* rulebook: an empty pile means roll again or step up the ramp;
             a 12 with no Free Play cards left means pick any card */
          if ((action.type === "roll" || action.type === "stepUp") && next.category) {
            const left = deckCounts[next.category] ?? 0;
            if (next.category === "Free Play" && left === 0) { next.specialMode = "dealer"; next.emptyPile = false; }
            else if (next.specialMode !== "dealer" && left === 0) { next.emptyPile = true; systemNote = `The ${next.category} pile is empty under the ceiling. Roll again or step one up the ramp.`; }
          }
        }
      }
    } catch (e) {
      return fail(e instanceof Error ? e.message : "That didn’t work.");
    }
    if (systemNote) next.log = [...next.log.slice(-60), { t: Date.now(), who: "system", text: systemNote }];
    if (deckCounts) next.deckCounts = { ...Object.fromEntries(CATEGORIES.map((c) => [c, 0])), ...deckCounts };

    const status = statusFor(next.phase);
    const r = await prisma.gameRoom.updateMany({
      where: { id: room.id, version: room.version },
      data: {
        state: toJson(next), version: { increment: 1 }, status,
        ...(body.type === "join" && !room.guestId && room.hostId !== me.id ? { guestId: me.id } : {}),
      },
    });
    if (r.count === 0) continue;
    return json({ version: room.version + 1, state: publicState(next, me.id), status });
  }
  return fail("The room changed while you were acting. Try again.", 409);
}
