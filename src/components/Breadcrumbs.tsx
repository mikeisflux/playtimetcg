import Link from "next/link";
import { JsonLd } from "./ui";
import { breadcrumbLd } from "@/lib/seo";

/* Visible breadcrumb trail for inner pages plus its BreadcrumbList JSON-LD.
   The last item is the current page (no link). Home is prepended. */
export default async function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  const trail = [{ name: "Home", href: "/" }, ...items];
  const ld = await breadcrumbLd(trail);
  return (
    <>
      <JsonLd data={ld} />
      <nav className="wrap crumbs" aria-label="Breadcrumb">
        <ol>
          {trail.map((it, i) => (
            <li key={it.href}>
              {i < trail.length - 1 ? <Link href={it.href}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
