import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { newResetToken } from "@/lib/auth";
import { sendTemplate } from "@/lib/sendgrid";
import { siteUrl } from "@/lib/settings";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const e = String(email || "").trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: e } });
    /* always answer ok — don't reveal which emails exist */
    if (user) {
      const { token, hash } = newResetToken();
      await prisma.user.update({ where: { id: user.id }, data: { resetToken: hash, resetExpiry: new Date(Date.now() + 60 * 60_000) } });
      const url = `${await siteUrl()}/reset?token=${token}`;
      await sendTemplate("password_reset", user.email, {
        subject: "Reset your Play Time password",
        fallbackText: `Reset your password: ${url} (valid for one hour)`,
        name: user.name, resetUrl: url,
      }, { userId: user.id });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }
}
