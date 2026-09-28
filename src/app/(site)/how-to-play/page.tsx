import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/ui";
import Breadcrumbs from "@/components/Breadcrumbs";
import { HOW_STEPS } from "@/lib/content";
import { buildMetadata, jsonLdFor, howToLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/how-to-play", {
    title: "How to Play — Learn the Rules in a Minute",
    description: "Roll the 12-sided die, draw a card from the matching category, read it out loud, then do it, tweak it, save it or pass. Setup, special rolls and ground rules.",
    keywords: ["how to play Play Time", "couples card game rules", "Play Time rulebook", "adult card game instructions", "date night game rules"],
  });
}

interface Row { title: string; body: string }
interface Block { id: string; eyebrow: string; title: string; lead: string; color: string; rows: Row[] }

const BLOCKS: Block[] = [
  {
    id: "setup", eyebrow: "Before the first roll", title: "Setting up", color: "#3FD6C8",
    lead: "Two minutes the first time. Thirty seconds every time after.",
    rows: [
      { title: "Sort the deck", body: "Split the cards into seven piles by category color. Shuffle each pile and set it face down. The die tells you which pile to draw from." },
      { title: "Set your ceiling", body: "Agree on the highest Spice level you’re playing tonight. Anything above it stays in the box. The three All In cards stay out unless you both ask for them." },
      { title: "Pull your vetoes", body: "Either of you can take any card out before you start. No reason needed. It’s out for tonight, not forever." },
      { title: "Make room for three piles", body: "Played, Saved and Retired. Every card you draw ends the night in one of them." },
      { title: "Pick a roller", body: "Whoever suggested playing rolls first." },
    ],
  },
  {
    id: "turn", eyebrow: "Turn by turn", title: "A full turn", color: "#5AB8F0",
    lead: "Every turn has two roles. The roller rolls and reads. The partner answers. If a card says to roll the die or set a timer, do it — the numbers are part of the card.",
    rows: [
      { title: "Roll", body: "The number picks the pile. 1–2 Soft Touch, 3–4 Flirty Fun, 5–6 Classic Heat, 7–8 Turn It Up, 9–10 Wild Card, 11 Focus on You, 12 Free Play." },
      { title: "Draw", body: "Take the top card. Want a choice? Draw two, keep one, and slide the other to the bottom of its pile." },
      { title: "Read it out loud", body: "Every word, exactly as written. Saying it is half of it." },
      { title: "Get an answer", body: "Do it, tweak it, save it, or pass. Either of you can pass. See The Four Answers." },
      { title: "Play it", body: "Unless the card says otherwise, “you” means the roller and “your partner” means the other one. The time on the card is a floor. Keep going as long as it’s working." },
      { title: "Clear it", body: "When you’re both ready to move on, the card goes on the Played pile. The partner becomes the roller." },
    ],
  },
  {
    id: "answers", eyebrow: "What happens next", title: "The four answers", color: "#A68CF5",
    lead: "Two passes in a row is information, not failure. Step down one category for the next roll.",
    rows: [
      { title: "Do it", body: "Play the card as written. The default, and usually the right call." },
      { title: "Tweak it", body: "Change one detail, like the place, the pace or the part that doesn’t work, and play the rest. Agree on the change before you start, not halfway through." },
      { title: "Save it", body: "You both want it, just not now. It goes on the Saved pile. Cards that need a morning, a car, a date or a hotel go here automatically, and the roller rolls again." },
      { title: "Pass", body: "Either of you, any card, no reason. It goes to the bottom of its pile and the same roller rolls again. There is no limit on passes." },
    ],
  },
  {
    id: "special", eyebrow: "Eleven, twelve & the odd ones", title: "Special rolls", color: "#E86BD8",
    lead: "Your ceiling applies to every special roll. Dealer’s Choice can’t pick a card you left in the box.",
    rows: [
      { title: "11 · Focus on You", body: "Before drawing, the roller decides who receives: themselves or their partner. The receiver doesn’t reciprocate, doesn’t hurry and doesn’t apologize. The card ends when they say so." },
      { title: "12 · Free Play", body: "Four cards that hand the night back to you. Dealer’s Choice: the roller looks through every pile and picks one card. Double Draw: roll twice, take one card from each pile and combine them. Reverse Roles: roll again; on that card, the partner does what the roller would have done. Free Play Create: invent something together, right now." },
      { title: "All four played?", body: "Once the Free Play pile is empty, a 12 means the roller picks any card from any pile." },
      { title: "Empty pile", body: "Roll again, or step one category up the ramp. Focus on You has only six cards, so it usually runs out first." },
    ],
  },
  {
    id: "ending", eyebrow: "How it ends", title: "Ending the night", color: "#FF6A3D",
    lead: "No winner, no loser. The only score is whether you both want to play again.",
    rows: [
      { title: "Either of you calls it", body: "Stop means stop. No last card, no explanation owed." },
      { title: "The timer goes", body: "If you set one, it wins." },
      { title: "You’re both done", body: "The most common ending, and the best one." },
      { title: "The last five minutes", body: "Stay in the room. Water, closeness, a little talking." },
      { title: "One keep, one retire", body: "Each of you names one card from tonight you’d play again, and one you never need to see. Retired cards go back in the box apart from the deck, until you both want them back." },
      { title: "Reset", body: "Shuffle Played cards back into their piles. Keep the Saved pile on top of the box. Next time, start by drawing from it instead of rolling." },
    ],
  },
  {
    id: "rules", eyebrow: "Non-negotiable", title: "Ground rules", color: "#FFD23F",
    lead: "Five things that make the rest of it work. For consenting adults. Play at your own pace. Stop whenever you want.",
    rows: [
      { title: "Anyone can pass", body: "No reason needed and no penalty. Put the card back, roll again, move on. A pass is part of the game, not a failure at it." },
      { title: "Change the card", body: "If most of a card sounds great and one detail does not, do the part that works. The cards are prompts, not instructions from management." },
      { title: "Agree first, then play", body: "Talk about what is off the table before the first roll. Then stop negotiating and enjoy yourselves — mid-card is a bad time to renegotiate." },
      { title: "Stop means stop", body: "Not slow down, not convince me. The game ends the moment either of you wants it to, with no discussion owed." },
      { title: "The last five minutes count", body: "Stay in the room afterwards. How a night ends is most of what either of you will remember about it." },
    ],
  },
  {
    id: "house", eyebrow: "Six ways to change it", title: "House rules", color: "#FF5C8A",
    lead: "Invent your own. The best house rule is the one you’d be embarrassed to explain to anyone else.",
    rows: [
      { title: "The ladder", body: "Ignore the die. Start at Soft Touch and climb one category per turn. Stop wherever you like." },
      { title: "Category lock", body: "Pick one category before you start and stay there all night. Ignore the die entirely." },
      { title: "Trade the roll", body: "Once per night, either of you can hand a roll to the other and make them take it." },
      { title: "The save pile", body: "Set aside cards you both want but not tonight. Next time, start with that pile instead of rolling." },
      { title: "Speed round", body: "Fifteen-minute timer, Spice 1 and 2 only. Built for weeknights when nobody has the energy for a whole evening." },
      { title: "Blind draw", body: "Draw face down and commit before reading. High trust only, and never on a first play." },
    ],
  },
];

export default async function HowToPlay() {
  const [jsonLd, howTo] = await Promise.all([
    jsonLdFor("/how-to-play"),
    howToLd("How to play Play Time", "Learn the Play Time card game for couples in a minute: roll, draw, read it out loud, then do it, tweak it or pass.", HOW_STEPS, "/how-to-play"),
  ]);

  return (
    <>
      <JsonLd data={jsonLd || howTo} />
      <Breadcrumbs items={[{ name: "How to play", href: "/how-to-play" }]} />

      {/* Header */}
      <section id="top" className="wrap" style={{ paddingBlock: "clamp(48px, 8vw, 104px) 0" }} data-screen-label="How to play header">
        <div className="stack gap-12" style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ color: "var(--primary)" }}>How to play</div>
          <h1 className="t-h2">Learn it in a minute.</h1>
          <p className="t-lead" style={{ marginTop: 8 }}>The thirty-second version: roll the twelve-sided die, draw one or two cards from the matching category, read the card out loud, do it, tweak it or save it for later, then switch turns and keep going. That’s it. No complicated rules. Just better nights.</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="wrap section" style={{ paddingTop: "clamp(40px, 6vw, 72px)" }} data-screen-label="How it works">
        <div className="grid g-230" style={{ gap: 0, borderTop: "2px solid var(--text)" }}>
          {HOW_STEPS.map((st) => (
            <div key={st.n} className="step">
              <div className="step__n" style={{ color: st.col }}>{st.n}</div>
              <h2 className="t-item">{st.title}</h2>
              <div className="t-body">{st.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Six numbered-row sections */}
      {BLOCKS.map((b, i) => {
        const inner = (
          <div className="wrap section grid g-380" style={{ gap: "clamp(32px, 5vw, 80px)", alignItems: "start" }}>
            <div className="stack gap-12">
              <div className="eyebrow" style={{ color: b.color }}>{b.eyebrow}</div>
              <h2 className="t-h3">{b.title}</h2>
              <p className="t-body" style={{ fontSize: 17, maxWidth: 420, marginTop: 8 }}>{b.lead}</p>
            </div>
            <div className="rows">
              {b.rows.map((r, j) => (
                <div key={r.title} className="numrow">
                  <div className="numrow__n" style={{ color: b.color }}>{String(j + 1).padStart(2, "0")}</div>
                  <div className="numrow__body">
                    <h3 className="t-item">{r.title}</h3>
                    <div className="t-body">{r.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
        return i % 2 === 0 ? (
          <section key={b.id} id={b.id} className="surface" data-screen-label={b.title}>{inner}</section>
        ) : (
          <section key={b.id} id={b.id} data-screen-label={b.title}>{inner}</section>
        );
      })}

      {/* Close */}
      <section style={{ background: "var(--primary)", color: "var(--ink)" }} data-screen-label="Close">
        <div className="wrap section grid g-420" style={{ gap: 40, alignItems: "end" }}>
          <h2 className="t-poster">Ready when<br />you are.</h2>
          <div className="stack" style={{ gap: 22, alignItems: "flex-start" }}>
            <p style={{ fontSize: 20, lineHeight: 1.5, fontWeight: 500, maxWidth: 440 }}>72 cards, one die, and a quick start card that gets you playing tonight. Either of you can pass, tweak or stop at any time.</p>
            <div className="row"><Link className="btn btn--dark" href="/shop/base">Buy the base set</Link><Link className="btn btn--dark" href="/the-deck">Next: the deck</Link></div>
          </div>
        </div>
      </section>
    </>
  );
}
