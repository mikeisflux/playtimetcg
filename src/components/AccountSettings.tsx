"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Addr { id: string; name: string; line1: string; line2: string; city: string; region: string; postal: string; country: string; phone: string; isDefault: boolean }

export default function AccountSettings({ user, addresses }: { user: { name: string; email: string; marketingOptIn: boolean }; addresses: Addr[] }) {
  const router = useRouter();
  const [n1, setN1] = useState<{ ok: boolean; text: string } | null>(null);
  const [n2, setN2] = useState<{ ok: boolean; text: string } | null>(null);
  const [n3, setN3] = useState<{ ok: boolean; text: string } | null>(null);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, text: res.ok ? "Saved." : data.error || "Something went wrong." };
  }

  return (
    <div className="grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
      <div className="stack gap-28">
        <form className="form" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); setN1(await post("/api/account/profile", { name: f.get("name"), marketing: f.get("marketing") === "on" })); router.refresh(); }}>
          <div className="t-item">Profile</div>
          <div className="field"><label htmlFor="name">Name</label><input className="input" id="name" name="name" defaultValue={user.name} required maxLength={80} /></div>
          <div className="field"><label>Email</label><input className="input" value={user.email} readOnly /><div className="note">Email is your sign-in and can’t be changed here — contact us if you need to.</div></div>
          <label className="check"><input type="checkbox" name="marketing" defaultChecked={user.marketingOptIn} /> <span>Email me when new expansions and monthly cards drop.</span></label>
          {n1 && <div className={`note ${n1.ok ? "note--ok" : "note--err"}`}>{n1.text}</div>}
          <button className="btn btn--md" style={{ alignSelf: "flex-start" }}>Save profile</button>
        </form>
        <form className="form" onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); setN2(await post("/api/account/password", { current: f.get("current"), password: f.get("password") })); form.reset(); }}>
          <div className="t-item">Password</div>
          <div className="field"><label htmlFor="current">Current password</label><input className="input" id="current" name="current" type="password" required autoComplete="current-password" /></div>
          <div className="field"><label htmlFor="password">New password</label><input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
          {n2 && <div className={`note ${n2.ok ? "note--ok" : "note--err"}`}>{n2.text}</div>}
          <button className="btn btn--md" style={{ alignSelf: "flex-start" }}>Change password</button>
        </form>
      </div>
      <div className="stack gap-20">
        <div className="t-item">Addresses</div>
        {addresses.length === 0 && <div className="t-body-sm">No saved addresses. One is saved automatically when you check out.</div>}
        {addresses.map((a) => (
          <div key={a.id} className="panel panel--surface">
            <div className="between">
              <div className="t-item-sm">{a.name}{a.isDefault ? " · default" : ""}</div>
              <div className="row" style={{ gap: 12 }}>
                {!a.isDefault && <button className="btn btn--text" onClick={async () => { setN3(await post("/api/account/profile", { defaultAddress: a.id })); router.refresh(); }}>Make default</button>}
                <button className="btn btn--text" onClick={async () => { if (!confirm("Remove this address?")) return; setN3(await post("/api/account/profile", { deleteAddress: a.id })); router.refresh(); }}>Remove</button>
              </div>
            </div>
            <div className="t-body-sm" style={{ whiteSpace: "pre-line" }}>{[a.line1, a.line2, `${a.city}, ${a.region} ${a.postal}`, a.country, a.phone].filter(Boolean).join("\n")}</div>
          </div>
        ))}
        {n3 && <div className={`note ${n3.ok ? "note--ok" : "note--err"}`}>{n3.text}</div>}
      </div>
    </div>
  );
}
