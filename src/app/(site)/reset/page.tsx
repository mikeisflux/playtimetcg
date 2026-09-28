import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getSessionUser } from "@/lib/auth";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("/reset", { title: "Reset password", noindex: true });
}

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getSessionUser();
  const sp = await searchParams;
  const MODE: string = "reset";
  if (user && (MODE === "login" || MODE === "signup")) redirect(sp.next && sp.next.startsWith("/") ? sp.next : "/account");
  return (
    <section className="wrap section grid g-420" style={{ gap: "clamp(32px, 5vw, 72px)", alignItems: "start" }}>
      <div className="stack gap-28">
        <div className="eyebrow" style={{ color: "var(--primary)" }}>Reset password</div>
        <h1 className="t-h2">Choose a new password.</h1>
        <p className="t-lead" style={{ maxWidth: 480 }}>Pick something you’ll remember. Every other session is signed out.</p>
      </div>
      <Suspense fallback={null}><AuthForm mode="reset" /></Suspense>
    </section>
  );
}
