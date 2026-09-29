import "@/app/play.css";
import Stage from "@/components/play/fx/Stage";
import FxLayer from "@/components/play/fx/FxLayer";

/* The arena: everything under /play gets the ambient stage (aurora, floor
   grid, vignette) behind it and the FX layer (light bursts, flashes) over
   it. Tinted by the current category through --arena-tint on <html>. */
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="arena">
      <Stage />
      <FxLayer />
      <div className="arena__in">{children}</div>
    </div>
  );
}
