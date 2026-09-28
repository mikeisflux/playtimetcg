import OrdersList from "@/components/admin/OrdersList";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <OrdersList initialStatus={sp.status || ""} initialQuery={sp.q || ""} />;
}
