/* Ambient stage behind the game: two drifting light fields in the heat
   colors, a perspective floor grid that scrolls toward you, scanlines and a
   vignette. Pure CSS, fixed behind the content, tinted by --arena-tint.
   Decorative only — hidden from assistive tech. */
export default function Stage() {
  return (
    <div className="stage" aria-hidden>
      <div className="stage__aurora stage__aurora--a" />
      <div className="stage__aurora stage__aurora--b" />
      <div className="stage__aurora stage__aurora--c" />
      <div className="stage__floor" />
      <div className="stage__scan" />
      <div className="stage__vignette" />
    </div>
  );
}
