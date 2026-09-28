import UsersList from "@/components/admin/UsersList";
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return <UsersList initialQuery={sp.q || ""} />;
}
