"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinCodeForm() {
  const [code, setCode] = useState("");
  const router = useRouter();
  return (
    <form className="row" onSubmit={(e) => { e.preventDefault(); if (code.length === 6) router.push(`/join/${code}`); }}>
      <input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="ABC123" aria-label="Room code" style={{ letterSpacing: "0.3em", fontSize: 20, textTransform: "uppercase", maxWidth: 200 }} />
      <button className="btn btn--outline" type="submit" disabled={code.length !== 6}>Join</button>
    </form>
  );
}
