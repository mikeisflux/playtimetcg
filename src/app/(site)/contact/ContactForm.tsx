"use client";
import { useState } from "react";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "ok" } | { kind: "err"; message: string };

export default function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [form, setForm] = useState({ name: "", email: "", orderNumber: "", message: "", website: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setStatus({ kind: "ok" });
        setForm({ name: "", email: "", orderNumber: "", message: "", website: "" });
      } else {
        setStatus({ kind: "err", message: data.error || "Something went wrong. Please try again in a moment." });
      }
    } catch {
      setStatus({ kind: "err", message: "We couldn’t reach the server. Check your connection and try again." });
    }
  }

  return (
    <form className="form form--wide" onSubmit={submit} noValidate>
      <div className="grid g-230" style={{ gap: 20 }}>
        <div className="field">
          <label htmlFor="c-name">Name</label>
          <input id="c-name" className="input" name="name" autoComplete="name" required value={form.name} onChange={set("name")} />
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" className="input" name="email" type="email" autoComplete="email" required value={form.email} onChange={set("email")} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-order">Order number <span style={{ textTransform: "none", letterSpacing: 0, color: "var(--text-faint)" }}>(optional)</span></label>
        <input id="c-order" className="input" name="orderNumber" inputMode="numeric" placeholder="e.g. 1042" value={form.orderNumber} onChange={set("orderNumber")} />
      </div>
      <div className="field">
        <label htmlFor="c-message">Message</label>
        <textarea id="c-message" className="input" name="message" required minLength={10} value={form.message} onChange={set("message")} />
      </div>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <div style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }} aria-hidden>
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
      </div>
      <div className="row" style={{ gap: 20 }}>
        <button className="btn" type="submit" disabled={status.kind === "sending"}>{status.kind === "sending" ? "Sending…" : "Send message"}</button>
        {status.kind === "ok" && <div className="note note--ok" role="status">Thanks. Your message is in. We’ll reply within 1–2 business days.</div>}
        {status.kind === "err" && <div className="note note--err" role="alert">{status.message}</div>}
      </div>
    </form>
  );
}
