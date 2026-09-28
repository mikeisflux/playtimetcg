import Inbox from "@/components/admin/Inbox";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <Inbox initialId={sp.id || null} initialFolder={sp.folder || "inbox"} />;
}
