/* Default transactional templates. Dark, table layout, inline CSS, ramp strip
   of the seven heat colors at the top. {{var}} escapes, {{{var}}} is raw. */

const RAMP = ["#3FD6C8", "#5AB8F0", "#A68CF5", "#E86BD8", "#FF5C8A", "#FF6A3D", "#FFD23F"];
const F = "Archivo, Arial, Helvetica, sans-serif";

function shell(title: string, body: string, cta?: { href: string; label: string }) {
  const ramp = RAMP.map((c) => `<td style="height:6px;background:${c};font-size:0;line-height:0">&nbsp;</td>`).join("");
  const button = cta ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px"><tr><td style="background:#FF5C8A"><a href="${cta.href}" style="display:inline-block;padding:16px 24px;font-family:${F};font-weight:800;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#0d0b10;text-decoration:none">${cta.label}</a></td></tr></table>` : "";
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0d0b10;color:#f2f0f4;font-family:${F}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0b10"><tr><td align="center" style="padding:0 16px 40px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
  <tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${ramp}</tr></table></td></tr>
  <tr><td style="padding:28px 0 8px;font-family:${F};font-weight:900;font-size:18px;letter-spacing:.14em;text-transform:uppercase;color:#ffffff">{{siteName}}</td></tr>
  <tr><td style="border-top:2px solid #2a272e;padding:28px 0 0">
    <h1 style="margin:0 0 18px;font-family:${F};font-weight:900;font-size:34px;line-height:.95;letter-spacing:-.01em;text-transform:uppercase;color:#ffffff">${title}</h1>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#d8d4de">${body}</div>
    ${button}
  </td></tr>
  <tr><td style="padding:36px 0 0;border-top:1px solid #2a272e;margin-top:32px">
    <p style="margin:24px 0 0;font-family:'JetBrains Mono',Consolas,monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#7a7681;line-height:1.7">
      {{siteName}} · <a href="{{siteUrl}}" style="color:#8b8693;text-decoration:none">{{siteUrl}}</a><br>
      Questions? <a href="mailto:{{supportEmail}}" style="color:#8b8693;text-decoration:none">{{supportEmail}}</a><br>
      For adults 18+. © {{currentYear}} {{siteName}}.
    </p>
  </td></tr>
</table></td></tr></table>
</body></html>`;
}

const row = (label: string, val: string) => `<tr><td style="padding:6px 0;color:#8b8693;font-family:Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:.1em">${label}</td><td align="right" style="padding:6px 0;color:#f2f0f4;font-family:Arial,sans-serif;font-size:14px">${val}</td></tr>`;
const p = (s: string) => `<p style="margin:0 0 14px">${s}</p>`;
const mono = (s: string) => `<span style="font-family:'JetBrains Mono',Consolas,monospace;color:#FFD23F">${s}</span>`;

export interface DefaultTemplate { slug: string; name: string; description: string; subject: string; html: string; text?: string }

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    slug: "order_receipt", name: "Order receipt", description: "Sent when an order is paid. Vars: name, orderNumber, itemsHtml, subtotal, shipping, tax, total, shippingAddress",
    subject: "Your {{siteName}} order #{{orderNumber}}",
    html: shell("Thank you, {{name}}.", p("Order ${mono('#{{orderNumber}}')} is confirmed. Here’s what you picked up:") +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px;border-top:2px solid #3a363f">{{{itemsHtml}}}</table>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${row("Subtotal", "${{subtotal}}")}${row("Shipping", "${{shipping}}")}${row("Tax", "${{tax}}")}${row("Total", "<strong style=\"font-size:18px\">${{total}}</strong>")}</table>` +
      `{{#if shippingAddress}}<p style="margin:22px 0 6px;color:#8b8693;font-size:12px;letter-spacing:.1em;text-transform:uppercase">Ships to</p><p style="margin:0;white-space:pre-line">{{shippingAddress}}</p><p style="margin:14px 0 0;color:#8b8693;font-size:13px">Discreet packaging, no branding on the outside.</p>{{/if}}`,
      { href: "{{siteUrl}}/account", label: "View your order" }),
  },
  {
    slug: "order_shipped", name: "Order shipped", description: "Sent when an order is marked shipped. Vars: name, orderNumber, trackingNumber, trackingCarrier",
    subject: "Order #{{orderNumber}} is on its way",
    html: shell("It’s on the way.", p("Hi {{name}} — order ${mono('#{{orderNumber}}')} left the building.") +
      `{{#if trackingNumber}}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #3a363f">${row("Carrier", "{{trackingCarrier}}")}${row("Tracking", mono("{{trackingNumber}}"))}</table>{{else}}${p("We’ll send tracking as soon as the carrier scans it.")}{{/if}}` +
      p("The box is plain on the outside. What’s inside is up to you two."), { href: "{{siteUrl}}/how-to-play", label: "Brush up on the rules" }),
  },
  {
    slug: "welcome", name: "Welcome", description: "Sent after sign-up. Vars: name",
    subject: "Welcome to {{siteName}}",
    html: shell("Welcome, {{name}}.", p("Your account is ready. Roll the die, draw a card, read it out loud — every word, exactly as written.") + p("From here you can track orders, open digital packs and jump into online play."), { href: "{{siteUrl}}/account", label: "Go to your account" }),
  },
  {
    slug: "password_reset", name: "Password reset", description: "Vars: name, resetUrl (valid 1 hour)",
    subject: "Reset your {{siteName}} password",
    html: shell("Reset your password.", p("Hi {{name}} — someone (hopefully you) asked to reset the password for this account. The link below works for one hour.") + p("If you didn’t ask for this, ignore it and nothing changes."), { href: "{{resetUrl}}", label: "Choose a new password" }),
  },
  {
    slug: "subscription_started", name: "Subscription started", description: "Vars: name, plan, planName, amount, nextBilling",
    subject: "You’re in — {{planName}}",
    html: shell("You’re subscribed.", p("Hi {{name}} — your ${mono('{{planName}}')} subscription is active.") +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #3a363f">${row("Plan", "{{planName}}")}${row("Amount", "${{amount}} / {{interval}}")}${row("Next billing", "{{nextBilling}}")}</table>` +
      p("Manage or cancel any time from your account."), { href: "{{siteUrl}}/account", label: "Manage subscription" }),
  },
  {
    slug: "subscription_renewed", name: "Subscription renewed", description: "Vars: name, planName, amount, periodEnd",
    subject: "Your {{planName}} renewed",
    html: shell("Renewed.", p("Hi {{name}} — your ${mono('{{planName}}')} subscription renewed for ${mono('${{amount}}')}. It runs through {{periodEnd}}.") + p("Nothing to do. Carry on."), { href: "{{siteUrl}}/account", label: "View account" }),
  },
  {
    slug: "subscription_payment_failed", name: "Subscription payment failed", description: "Vars: name, planName, amount, retryUrl",
    subject: "Action needed: payment for {{planName}} failed",
    html: shell("Payment didn’t go through.", p("Hi {{name}} — we couldn’t collect ${mono('${{amount}}')} for your ${mono('{{planName}}')} subscription.") + p("You keep access for 7 days. Update your payment method to avoid an interruption."), { href: "{{retryUrl}}", label: "Update payment" }),
  },
  {
    slug: "subscription_cancelled", name: "Subscription cancelled", description: "Vars: name, planName, accessUntil",
    subject: "Your {{planName}} subscription is cancelled",
    html: shell("Cancelled.", p("Hi {{name}} — your ${mono('{{planName}}')} subscription has been cancelled.{{#if accessUntil}} You keep access until {{accessUntil}}.{{/if}}") + p("Come back any time — your collection stays put."), { href: "{{siteUrl}}/pricing", label: "Resubscribe" }),
  },
  {
    slug: "digital_pack_delivered", name: "Digital pack delivered", description: "Vars: name, packName, qty",
    subject: "{{qty}} new pack(s) are waiting",
    html: shell("Packs delivered.", p("Hi {{name}} — ${mono('{{qty}} × {{packName}}')} landed in your account, sealed and ready.") + p("Open them online to reveal the cards. Rares glow."), { href: "{{siteUrl}}/account/packs", label: "Open your packs" }),
  },
  {
    slug: "contact_autoreply", name: "Contact auto-reply", description: "Sent to whoever uses the contact form. Vars: name, subject",
    subject: "We got your message",
    html: shell("Got it.", p("Hi {{name}} — thanks for writing. A real person reads every message and we usually reply within one business day.") + p("Your subject: ${mono('{{subject}}')}")),
  },
  {
    slug: "monthly_cards_shipped", name: "Monthly cards shipped", description: "Vars: name, month, trackingNumber, trackingCarrier",
    subject: "Your {{month}} cards have shipped",
    html: shell("This month’s cards are out.", p("Hi {{name}} — your three cards for {{month}} are on their way.") +
      `{{#if trackingNumber}}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #3a363f">${row("Carrier", "{{trackingCarrier}}")}${row("Tracking", mono("{{trackingNumber}}"))}</table>{{/if}}` +
      p("Plain envelope. Read them together."), { href: "{{siteUrl}}/account", label: "Your subscription" }),
  },
];

export const SAMPLE_VARS: Record<string, unknown> = {
  name: "Alex", email: "alex@example.com", orderNumber: 1042, subtotal: "59.00", shipping: "6.00", tax: "0.00", total: "65.00",
  itemsHtml: `<tr><td style="padding:8px 0;border-bottom:1px solid #2a272e;color:#f2f0f4">1× Play Time — Base Set</td><td align="right" style="padding:8px 0;border-bottom:1px solid #2a272e;color:#f2f0f4">$59.00</td></tr>`,
  shippingAddress: "Alex Example\n123 Main St\nAustin, TX 78701\nUS", trackingNumber: "9400 1000 0000 0000 0000 00", trackingCarrier: "USPS",
  resetUrl: "https://playtimetcg.com/reset?token=example", retryUrl: "https://playtimetcg.com/account", plan: "online_play", planName: "Online Play", amount: "9.00", interval: "month",
  nextBilling: "Oct 28, 2026", periodEnd: "Oct 28, 2026", accessUntil: "Oct 28, 2026", packName: "Date Night Pack", qty: 2, subject: "Question about shipping", month: "October",
  siteName: "Play Time", siteUrl: "https://playtimetcg.com", supportEmail: "hello@playtimetcg.com", currentYear: new Date().getFullYear(),
};
