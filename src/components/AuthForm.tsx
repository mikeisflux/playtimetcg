"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

/* Email + password only. No magic links, no social login. */
export default function AuthForm({ mode }: { mode: "login" | "signup" | "forgot" | "reset" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/account";
  const token = params.get("token") || "";
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setNote(null);
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(f.entries());
    body.marketing = f.get("marketing") === "on";
    body.ageConfirmed = f.get("ageConfirmed") === "on";
    if (mode === "reset") body.token = token;
    const url = { login: "/api/auth/login", signup: "/api/auth/register", forgot: "/api/auth/forgot", reset: "/api/auth/reset" }[mode];
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setNote({ ok: false, text: data.error || "Something went wrong." }); return; }
    if (mode === "forgot") { setNote({ ok: true, text: "If that email has an account, a reset link is on its way. It’s valid for one hour." }); return; }
    if (mode === "reset") { setNote({ ok: true, text: "Password updated. Taking you to your account…" }); }
    router.push(next.startsWith("/") ? next : "/account");
    router.refresh();
  }

  return (
    <form className="form" onSubmit={submit}>
      {mode === "signup" && (
        <div className="field"><label htmlFor="name">Name</label><input className="input" id="name" name="name" required maxLength={80} autoComplete="name" /></div>
      )}
      {mode !== "reset" && (
        <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
      )}
      {mode !== "forgot" && (
        <div className="field">
          <label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</label>
          <input className="input" id="password" name="password" type="password" required minLength={mode === "login" ? 1 : 8} autoComplete={mode === "login" ? "current-password" : "new-password"} />
          {mode !== "login" && <div className="note">At least 8 characters.</div>}
        </div>
      )}
      {mode === "signup" && (
        <>
          <label className="check"><input type="checkbox" name="ageConfirmed" required /> <span>I am 18 or older and it is legal for me to buy adult products where I live.</span></label>
          <label className="check"><input type="checkbox" name="marketing" /> <span>Email me when new expansions and monthly cards drop.</span></label>
        </>
      )}
      {note && <div className={`note ${note.ok ? "note--ok" : "note--err"}`} role="status">{note.text}</div>}
      <div className="row">
        <button className="btn" disabled={busy}>
          {busy ? "One moment…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Set new password"}
        </button>
      </div>
      <div className="note" style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {mode === "login" && <><Link href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link><Link href="/forgot">Forgot your password?</Link></>}
        {mode === "signup" && <Link href={`/login?next=${encodeURIComponent(next)}`}>Already have an account? Sign in</Link>}
        {(mode === "forgot" || mode === "reset") && <Link href="/login">Back to sign in</Link>}
      </div>
    </form>
  );
}
