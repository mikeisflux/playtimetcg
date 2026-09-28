import { prisma } from "@/lib/db";
import { publicState, reduce, firstMatch, type Action, type Answer, type GameState } from "@/lib/game";
import { requireUser, json, fail, asState, toJson, statusFor, isParticipant, buildDeck, resolveCard } from "../../_shared";

type Params = { params: Promise<{ code: string }> };
type Body = { type?: unknown; [k: string]: unknown };

const ANSWERS: Answer[] = ["do", "tweak", "save", "pass"];

/* GET ?v=<version>: the room state for a participant, or {unchanged:true}. */
export async function GET(req: Request, { params }: Params) {
  const auth = await requireUser();
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
    case "leave": case "read": case "stop": case "end": case "reroll": case "stepUp":
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
    case "playSaved": {
      const c = str("code");
      if (!c) return "Which card?";
      return { type: "playSaved", userId: me.id, code: c };
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
  const auth = await requireUser();
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
    try {
      if (body.type === "start") {
        /* Build the shuffled deck server-side so neither client sees the order. */
        const deck = await buildDeck(state);
        next = reduce(state, { type: "start", userId: me.id, deck });
      } else if (body.type === "draw" || body.type === "pickAny") {
        if (state.phase !== "draw") return fail("Not time to draw.");
        if (state.players[state.rollerIndex]?.userId !== me.id) return fail("It isn’t your draw.");
        const deck = Array.isArray(state.deck) ? state.deck : [];
        let code: string | null = null;
        if (body.type === "pickAny" || state.specialMode === "dealer") {
          /* Dealer's Choice: a 12 once all four Free Play cards are out */
          if (state.specialMode !== "dealer") return fail("You can only pick any card on a Free Play roll once the four Free Play cards are out.");
          code = typeof body.code === "string" ? body.code : null;
          if (!code || !deck.some((d) => d.code === code)) return fail("That card isn’t in the deck.");
        } else {
          if (!state.category) return fail("Roll first.");
          const idx = firstMatch(deck, state.category);
          if (idx < 0) return fail("No back matching your roll is left. Roll again or step one category up the ramp.");
          code = deck[idx].code;
        }
        const card = await resolveCard(code);
        if (!card) return fail("That card isn’t available any more.");
        next = reduce(state, { type: "draw", userId: me.id, card });
      } else {
        const action = buildAction(body, me);
        if (typeof action === "string") return fail(action);
        next = reduce(state, action);
      }
    } catch (e) {
      return fail(e instanceof Error ? e.message : "That didn’t work.");
    }

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
