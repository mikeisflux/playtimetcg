import "@/app/light.css";
import { cookies } from "next/headers";
import Stage from "@/components/play/fx/Stage";
import FxLayer from "@/components/play/fx/FxLayer";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CartDrawer from "@/components/CartDrawer";
import AgeGate from "@/components/AgeGate";
import IntroVideo from "@/components/IntroVideo";
import { RampStrip } from "@/components/ui";
import { getSessionUser, AGE_COOKIE, INTRO_COOKIE } from "@/lib/auth";
import { getSettings, flag } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [user, jar, s] = await Promise.all([
    getSessionUser(),
    cookies(),
    getSettings(["INTRO_VIDEO_URL", "INTRO_VIDEO_POSTER", "INTRO_VIDEO_ENABLED", "AGE_GATE_LEAVE_URL", "DISCREET_PACKAGING", "STORE_ANNOUNCEMENT", "GA_MEASUREMENT_ID", "META_PIXEL_ID", "MAINTENANCE_MODE", "MAINTENANCE_MESSAGE"]),
  ]);
  const ageOk = jar.get(AGE_COOKIE)?.value === "1";
  const introSeen = jar.get(INTRO_COOKIE)?.value === "1";
  const showIntro = !!s.INTRO_VIDEO_URL && flag(s.INTRO_VIDEO_ENABLED, true) && !introSeen;
  const maintenance = flag(s.MAINTENANCE_MODE) && !user?.isAdmin;

  return (
    <div className="arena">
      <Stage />
      <FxLayer />
      <div className="arena__in">
      <RampStrip h={4} />
      {s.STORE_ANNOUNCEMENT && <div className="announce">{s.STORE_ANNOUNCEMENT}</div>}
      <Header user={user ? { name: user.name, isAdmin: user.isAdmin } : null} />
      {maintenance ? (
        <main className="wrap section">
          <div className="eyebrow" style={{ color: "var(--primary)", marginBottom: 12 }}>Back soon</div>
          <h1 className="t-h2">We’re making the bed.</h1>
          <p className="t-lead" style={{ marginTop: 20 }}>{s.MAINTENANCE_MESSAGE || "The site is down for a moment of maintenance. Check back shortly."}</p>
        </main>
      ) : (
        <main>{children}</main>
      )}
      <Footer />
      </div>
      <CartDrawer discreet={flag(s.DISCREET_PACKAGING)} />
      <AgeGate initiallyOpen={!ageOk} leaveUrl={s.AGE_GATE_LEAVE_URL || "https://www.google.com"} />
      {showIntro && <IntroVideo src={s.INTRO_VIDEO_URL} poster={s.INTRO_VIDEO_POSTER} initiallyOpen />}
      {s.GA_MEASUREMENT_ID && ageOk && (
        <>
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(s.GA_MEASUREMENT_ID)}`} />
          <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(s.GA_MEASUREMENT_ID)});` }} />
        </>
      )}
      {s.META_PIXEL_ID && ageOk && (
        <script dangerouslySetInnerHTML={{ __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(s.META_PIXEL_ID)});fbq('track','PageView');` }} />
      )}
    </div>
  );
}
