import { ImageResponse } from "next/og";
import { RAMP } from "@/lib/content";

export const runtime = "nodejs";

/* Open Graph image: dark ground, the wordmark and a ramp strip. No
   photography, so link previews are safe everywhere. */
export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, background: "#0d0b10", display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "Arial Black, Arial, sans-serif" }}>
        <div style={{ display: "flex", height: 14 }}>
          {RAMP.map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "0 72px", gap: 28 }}>
          <div style={{ color: "#8b8693", fontSize: 22, letterSpacing: 6, fontFamily: "monospace" }}>A CARD GAME FOR COUPLES · 18+</div>
          <div style={{ display: "flex", flexDirection: "column", color: "#ffffff", fontSize: 150, fontWeight: 900, lineHeight: 0.88, letterSpacing: -6 }}>
            <div>PLAY TIME</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 44, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
            <div style={{ color: "#f2f0f4" }}>ROLL THE DIE.</div>
            <div style={{ color: "#FFD23F" }}>RAISE THE HEAT.</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 72px 40px", color: "#7a7681", fontSize: 20, letterSpacing: 4, fontFamily: "monospace" }}>
          <div>72 CARDS · D12 · 7 CATEGORIES</div>
          <div>PLAYTIMETCG.COM</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
