"use client";
import { cart } from "@/lib/cartStore";
import type { PublicProduct } from "@/lib/catalog";

export function addProduct(p: PublicProduct, qty = 1, choices?: { slugs: string[]; names: string[] }) {
  cart.add({
    id: p.id, slug: p.slug, name: p.name, priceCents: p.priceCents, accent: p.accent, digital: p.digital,
    choices: choices?.slugs, choiceNames: choices?.names,
  }, qty);
}

/* One button that adds a product. Bundles that require a choice link to the
   product page instead (the choice happens there). */
export default function AddToCart({ product, label = "Add to cart", className = "btn", style, qty = 1 }: { product: PublicProduct; label?: string; className?: string; style?: React.CSSProperties; qty?: number }) {
  if (product.requiresChoice) {
    return <a className={className} style={style} href={`/shop/${product.slug}`}>{label}</a>;
  }
  return (
    <button className={className} style={style} onClick={() => addProduct(product, qty)}>{label}</button>
  );
}
