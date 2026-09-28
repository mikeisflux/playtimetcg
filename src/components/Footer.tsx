import Link from "next/link";

const COLS = [
  { head: "Shop", links: [["Base set", "/shop/base"], ["Bundles", "/shop#bundles"], ["Expansions", "/expansions"], ["Play online", "/play"]] },
  { head: "The game", links: [["How to play", "/how-to-play"], ["The deck", "/the-deck"], ["Pricing", "/pricing"]] },
  { head: "Help", links: [["Shipping", "/shipping"], ["Returns", "/returns"], ["Contact", "/contact"], ["Account", "/account"]] },
  { head: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"]] },
];

export default function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap grid g-180 ftr__grid">
        <div className="stack gap-12">
          <div className="wordmark">Play Time</div>
          <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-dim)" }}>For consenting adults 18+. Play at your own pace. Stop whenever you want.</div>
        </div>
        {COLS.map((c) => (
          <div key={c.head} className="stack gap-12">
            <div className="ftr__head">{c.head}</div>
            {c.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
          </div>
        ))}
      </div>
      <div className="wrap ftr__bar">
        <div>© {new Date().getFullYear()} Play Time</div>
        <div>Roll the die. Raise the heat.</div>
      </div>
    </footer>
  );
}
