/* Next 16 request proxy (the former middleware.ts). Kept deliberately thin:
   no database access here. Admin-managed redirects are applied in the
   not-found handler instead, where Prisma is available. */
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  /* trailing-slash and uppercase normalisation for SEO */
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    const u = url.clone(); u.pathname = u.pathname.replace(/\/+$/, "");
    return NextResponse.redirect(u, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|api/|uploads/|favicon.ico|robots.txt|sitemap.xml|og.png|icon.svg).*)"],
};
