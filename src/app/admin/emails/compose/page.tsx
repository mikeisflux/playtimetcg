import Compose from "@/components/admin/Compose";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <Compose prefill={{ to: sp.to || "", subject: sp.subject || "", threadId: sp.threadId || "", quote: sp.quote || "", cc: sp.cc || "" }} />;
}
