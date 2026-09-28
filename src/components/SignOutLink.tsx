"use client";
export default function SignOutLink({ className }: { className?: string }) {
  return (
    <button className={className ?? "btn btn--text"} onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}>Sign out</button>
  );
}
