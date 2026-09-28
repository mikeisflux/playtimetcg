import Link from "next/link";

const TABS = [
  { href: "/play", label: "Play" },
  { href: "/play/collection", label: "Collection" },
  { href: "/play/packs", label: "Packs" },
];

/* Sub-navigation across /play, /play/collection and /play/packs. */
export default function PlayTabs({ active }: { active: string }) {
  return (
    <nav className="tabs playtabs" aria-label="Online play">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={active === t.href ? "page" : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
