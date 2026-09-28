import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import GuestJoin from "@/components/play/GuestJoin";

export const metadata: Metadata = { title: "Join a room | Play Time", robots: { index: false, follow: false } };

/* The invite link. Signed in → straight into the room (it joins you).
   Not signed in → enter a name and play as a guest. No subscription needed:
   the host's deck is the night's deck. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const user = await getSessionUser();
  if (user) redirect(`/play/room/${code}`);
  const room = await prisma.gameRoom.findUnique({ where: { code }, include: { host: { select: { name: true } } } });
  const problem = !room ? "No room with that code." : room.status === "ended" ? "That night is over." : room.guestId ? "That room is full." : null;
  return (
    <div className="wrap section--tight" style={{ paddingTop: 48, maxWidth: 640 }}>
      <div className="stack gap-12" style={{ marginBottom: 32 }}>
        <div className="eyebrow" style={{ color: "var(--primary)" }}>Room {code}</div>
        <h1 className="t-h2">{problem ? problem : `${room!.host.name.split(" ")[0]} invited you.`}</h1>
        {!problem && <p className="t-lead">Enter a name so they know it’s you. No account, no subscription, nothing to install. Two adults, one deck, one die.</p>}
      </div>
      {problem ? (
        <div className="row"><Link className="btn btn--outline" href="/play">Back to play</Link></div>
      ) : (
        <GuestJoin code={code} />
      )}
      <p className="note" style={{ marginTop: 24 }}>Already have a Play Time account? <Link href={`/login?next=${encodeURIComponent(`/play/room/${code}`)}`}>Sign in</Link> and you’ll join as yourself.</p>
    </div>
  );
}
