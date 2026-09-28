"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cart, useCart } from "@/lib/cartStore";

const LINKS = [
  { href: "/how-to-play", label: "How to play" },
  { href: "/the-deck", label: "The deck" },
  { href: "/expansions", label: "Expansions" },
  { href: "/shop", label: "Shop" },
  { href: "/play", label: "Play online" },
];

export default function Header({ user }: { user: { name: string; isAdmin: boolean } | null }) {
  const { count } = useCart();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  useEffect(() => { setMenu(false); }, [path]);
  useEffect(() => {
    if (!menu) return;
    document.body.classList.add("locked");
    return () => document.body.classList.remove("locked");
  }, [menu]);

  return (
    <>
      <header className="hdr">
        <div className="wrap hdr__in">
          <Link href="/" className="wordmark" aria-label="Play Time — home">Play Time</Link>
          <nav className="hdr__links" aria-label="Primary">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>
            ))}
            <Link href={user ? "/account" : "/login"} aria-current={path.startsWith("/account") ? "page" : undefined}>
              {user ? "Account" : "Sign in"}
            </Link>
            {user?.isAdmin && <Link href="/admin">Admin</Link>}
            <CartButton count={count} />
          </nav>
          <div className="row" style={{ gap: 10 }}>
            <span className="menubtn-slot" style={{ display: "contents" }}>
              <button className="menubtn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-controls="mobile-menu">
                {menu ? "Close" : "Menu"}
              </button>
            </span>
            <span className="hdr__cart-mobile" style={{ display: "contents" }}>
              <MobileCart count={count} />
            </span>
          </div>
        </div>
      </header>
      {menu && (
        <div id="mobile-menu" className="sheet" role="dialog" aria-label="Menu">
          {LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}
          <Link href={user ? "/account" : "/login"}>{user ? "Account" : "Sign in"}</Link>
          {user?.isAdmin && <Link href="/admin">Admin</Link>}
          <Link href="/cart">Cart ({count})</Link>
        </div>
      )}
      <style>{`@media (min-width: 901px) { .hdr__cart-mobile { display: none !important; } }`}</style>
    </>
  );
}

function CartButton({ count }: { count: number }) {
  return (
    <button className="cartbtn" onClick={() => cart.open()} aria-label={`Open cart, ${count} items`}>
      <span>Cart</span><span className="cartbtn__n">{count}</span>
    </button>
  );
}

function MobileCart({ count }: { count: number }) {
  return (
    <button className="cartbtn menubtn" style={{ display: undefined }} onClick={() => cart.open()} aria-label={`Open cart, ${count} items`}>
      <span>Cart</span><span className="cartbtn__n">{count}</span>
    </button>
  );
}
