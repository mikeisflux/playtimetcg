/* Next.js instrumentation hook: starts the subscription renewal scheduler in
   the Node.js server runtime (every PM2 worker runs it; runRenewals() takes a
   Postgres advisory lock so only one actually works). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "test") return;
  if (process.env.PT_DISABLE_SCHEDULER === "1") return;
  const { runRenewals } = await import("./lib/subscriptions");
  const tick = async () => {
    try {
      const r = await runRenewals();
      if (!r.skipped && (r.charged || r.failed || r.ended)) console.log(`[renewals] charged=${r.charged} failed=${r.failed} ended=${r.ended}`);
    } catch (err) { console.error("[renewals] run failed:", err); }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 15 * 60_000).unref();
}
