import Link from "next/link";
import SignOutLink from "./SignOutLink";

const TABS = [
  ["/account", "Overview"], ["/account/orders", "Orders"], ["/account/subscriptions", "Subscriptions"],
  ["/play/collection", "Collection"], ["/account/settings", "Settings"],
] as const;

export default function AccountNav({ current, name }: { current: string; name: string }) {
  return (
    <div className="stack gap-20" style={{ marginBottom: 40 }}>
      <div className="stack gap-12">
        <div className="eyebrow" style={{ color: "var(--primary)" }}>Account</div>
        <h1 className="t-h2">Hi, {name}.</h1>
      </div>
      <nav className="tabs" aria-label="Account">
        {TABS.map(([href, label]) => <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>)}
        <span style={{ marginLeft: "auto" }}><SignOutLink /></span>
      </nav>
    </div>
  );
}
