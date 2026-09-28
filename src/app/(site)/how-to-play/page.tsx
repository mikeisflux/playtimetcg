import type { Metadata } from "next";
import Link from "next/link";
import { HOW_STEPS } from "@/lib/content";
import { buildMetadata, jsonLdFor } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/how-to-play", {
    title: "How to Play — Learn Play Time in a Minute | Play Time (18+)",
    description: "Roll the 12-sided die, draw a card from the matching category, read it out loud, then do it, tweak it, save it or pass. Setup, a full turn, special rolls and the ground rules for the Play Time card game for couples.",
    keywords: ["how to play Play Time", "couples card game rules", "Play Time rulebook", "adult card game instructions", "date night game rules"],
  });
}

interface Row { title: string; body: string }
interface Block { id: string; eyebrow: string; title: string; lead: string; color: string; rows: Row[] }

const BLOCKS: Block[] = [
  {
    id: "setup", eyebrow: "Before you start", title: "Setting up", color: "#3FD6C8",
    lead: "Five minutes, once. After the first night the deck stays sorted and setup is just opening the bag.",
    rows: [
      { title: "Sort the deck", body: "Split the 72 cards into seven piles by the color band on the front, one pile per category. Face down is fine; the color is all you need to see. Keep the quick start card within reach for your first night." },
      { title: "Set your ceiling", body: "Every card carries a spice rating from 1 to 5. Agree on the highest number you are both up for tonight and set aside anything above it. The ceiling can move later, but only if you both want it to." },
      { title: "Pull your vetoes", body: "Flip through the deck together and pull anything either of you would rather not see come up. No explanations required. A veto is not a judgment; it is how the deck becomes yours." },
      { title: "Make room for three piles", body: "Clear a spot for Played, Saved and Retired. Played is for cards you have done, Saved is for the ones you want to come back to, and Retired is for cards you pass on mid-game. Each pile tells you something about the night." },
      { title: "Pick a roller", body: "Decide who rolls first. Flip a coin, pick whoever suggested the game, or let the die decide with the highest roll going first. From there you take turns." },
    ],
  },
  {
    id: "turn", eyebrow: "Roller and partner", title: "A full turn", color: "#5AB8F0",
    lead: "Two roles, six steps. The roller drives the turn; the partner answers. Then you swap.",
    rows: [
      { title: "Roll the die", body: "The roller rolls the 12-sided die. The number points to a category, and the color on the die matches the color band on the pile: 1–2 is Soft Touch, all the way up to 12 for Free Play." },
      { title: "Draw from the pile", body: "The roller takes the top card from the matching pile. Want a little choice? Draw two, keep one, and slide the other back to the bottom of the pile." },
      { title: "Read it out loud", body: "The roller reads the card word for word, exactly as written. Saying it is half of it. The reading is part of the game, not a formality." },
      { title: "The partner answers", body: "The partner chooses one of the four answers: do it, tweak it, save it or pass. The roller can pass too. Nobody has to explain their answer." },
      { title: "Play the card", body: "If you are both in, play the card as written or as tweaked. Some cards give a time; others say Varies, which means the two of you decide." },
      { title: "Switch roles", body: "Move the card to Played, Saved or Retired, then hand over the die. The partner becomes the roller and the next turn begins." },
    ],
  },
  {
    id: "answers", eyebrow: "Every card, every time", title: "The four answers", color: "#A68CF5",
    lead: "There are exactly four things you can say to a card. All four are good answers.",
    rows: [
      { title: "Do it", body: "Play the card exactly as written. This is the default answer, and most cards are written to make it an easy one." },
      { title: "Tweak it", body: "Like the idea but not every detail? Change it. Swap the time, adjust the setting or trade roles. Say what you would change, agree on it, and go." },
      { title: "Save it", body: "Good idea, wrong moment. Put the card on the Saved pile. You can come back to it later tonight or another night, and it stays in play until you decide otherwise." },
      { title: "Pass", body: "Either of you can pass on any card at any time, and there is no limit on passes. Put it on Retired or back in the pile and the turn moves on. A pass is never a loss." },
    ],
  },
  {
    id: "special", eyebrow: "Eleven and twelve", title: "Special rolls", color: "#E86BD8",
    lead: "Ten of the twelve faces pair up into five categories. The last two faces each get a category of their own.",
    rows: [
      { title: "11: Focus on You", body: "An 11 puts the spotlight on one of you. The roller chooses who receives. The receiving partner reads the card and directs the details; the giving partner follows their lead." },
      { title: "12: Free Play", body: "A 12 is the wild slot. Draw from the Free Play pile and follow the card. There are four kinds, and each one hands the roller a little authorial control." },
      { title: "Dealer’s Choice", body: "The roller picks any card from the entire deck: any category, any spice level under your ceiling. You both play it." },
      { title: "Double Draw", body: "Draw two cards from any two piles. Play them back to back, or blend them into one longer turn." },
      { title: "Reverse Roles", body: "Play the next card drawn with the roles flipped. Whoever would normally give, receives, and the other way round." },
      { title: "Free Play Create", body: "Write your own card. Say it out loud like any other, give it a category and a spice level, and play it. The best ones tend to get written down for later." },
    ],
  },
  {
    id: "ending", eyebrow: "No score, no finish line", title: "Ending the night", color: "#FF6A3D",
    lead: "The game ends when one of you says so. That can be after three cards or thirty.",
    rows: [
      { title: "Call it when it feels right", body: "There is nothing to win and nothing to finish. When one of you says it is time, it is time. Stopping early is a perfectly good way to play." },
      { title: "Look at the piles", body: "Flip through Played and Saved together. Saved is your shortlist for next time. Retired is worth a glance too, with no pressure attached." },
      { title: "Reset the deck", body: "Shuffle everything back into the category piles, or leave the Saved pile aside so it is the first thing you draw next time. The die goes back in the bag." },
      { title: "Talk about it", body: "A minute or two of what worked goes a long way. Keep it kind, keep it specific and keep it short." },
    ],
  },
  {
    id: "rules", eyebrow: "The part that matters most", title: "Ground rules", color: "#FFD23F",
    lead: "Five rules that never change, whatever the card says.",
    rows: [
      { title: "Anyone can pass", body: "Any card, any time, no reason needed. Passing is built into the game, not a failure of it. The game only works because either of you can say no." },
      { title: "Change the card", body: "If a card is close but not quite, tweak it. The words on the card are a starting point, not a script you owe anyone." },
      { title: "Agree first", body: "Nothing starts until you both say yes to the card as it will actually be played. Agreement happens before, not during." },
      { title: "Stop means stop", body: "If either of you says stop, everything stops right then. No finishing the card, no one more minute. Check in, then decide together what comes next." },
      { title: "The last five minutes count", body: "How the night ends is what you will remember. Spend the last few minutes on each other, not on the tidy-up." },
    ],
  },
];

export default async function HowToPlay() {
  const jsonLd = await jsonLdFor("/how-to-play");

  return (
    <>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}

      {/* Header */}
      <section id="top" className="wrap" style={{ paddingBlock: "clamp(48px, 8vw, 104px) 0" }} data-screen-label="How to play header">
        <div className="stack gap-12" style={{ maxWidth: 760 }}>
          <div className="eyebrow" style={{ color: "var(--primary)" }}>How to play</div>
          <h1 className="t-h2">Learn it in a minute.</h1>
          <p className="t-lead" style={{ marginTop: 8 }}>Roll the die, draw a card from the matching pile, read it out loud, then do it, tweak it, save it or pass. Everything below is detail. The four steps are the game.</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="wrap section" style={{ paddingTop: "clamp(40px, 6vw, 72px)" }} data-screen-label="How it works">
        <div className="grid g-230" style={{ gap: 0, borderTop: "2px solid var(--text)" }}>
          {HOW_STEPS.map((st) => (
            <div key={st.n} className="step">
              <div className="step__n" style={{ color: st.col }}>{st.n}</div>
              <div className="t-item">{st.title}</div>
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
                    <div className="t-item">{r.title}</div>
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
            <Link className="btn btn--dark" href="/shop/base">Buy the base set</Link>
          </div>
        </div>
      </section>
    </>
  );
}
