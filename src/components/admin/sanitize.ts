/* Minimal, dependency-free HTML sanitizer usable on the server (no DOM).
   Strips scripts/styles-with-imports/iframes/objects, event handler attributes
   and javascript: URLs. Regex based — good enough for rendering inbound mail in
   a sandboxed iframe, not a substitute for a full parser on trusted output. */
export function sanitizeHtml(input: string): string {
  if (!input) return "";
  let s = input;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|iframe|object|embed|applet|frame|frameset|meta|link|base|form|input|button|textarea|select)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  s = s.replace(/<(script|iframe|object|embed|applet|frame|meta|link|base|input|button)\b[^>]*\/?>/gi, "");
  s = s.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_m, css: string) =>
    `<style>${css.replace(/@import[^;]*;?/gi, "").replace(/expression\s*\(/gi, "").replace(/url\s*\(\s*['"]?\s*javascript:[^)]*\)/gi, "")}</style>`);
  // event handlers: on*="..." / on*='...' / on*=bare
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // javascript:/vbscript:/data:text/html URLs in href/src/action/formaction/xlink:href
  s = s.replace(/\s+(href|src|action|formaction|xlink:href|background|poster)\s*=\s*("|')?\s*(javascript|vbscript|data:text\/html)[^"'\s>]*("|')?/gi, ' $1="#"');
  // srcdoc / style expression()
  s = s.replace(/\s+srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/style\s*=\s*"([^"]*)"/gi, (_m, css: string) => `style="${css.replace(/expression\s*\(|javascript:|@import/gi, "")}"`);
  return s;
}

/* Wrap an HTML fragment/document for display inside a sandboxed iframe with a
   dark-friendly default style and links opening in a new tab. */
export function frameDoc(html: string, opts: { dark?: boolean } = {}): string {
  const head = `<base target="_blank"><meta charset="utf-8"><style>
  html,body{margin:0;padding:16px;font:14px/1.55 Arial,Helvetica,sans-serif;${opts.dark === false ? "background:#fff;color:#111" : "background:#0d0b10;color:#e8e4ec"}}
  a{color:#FF5C8A} img{max-width:100%;height:auto} pre{white-space:pre-wrap} blockquote{border-left:3px solid #3a363f;margin:8px 0;padding:4px 12px;color:#b8b3c0}
  </style>`;
  const clean = sanitizeHtml(html || "");
  if (/<html[\s>]/i.test(clean)) {
    return /<head[\s>]/i.test(clean) ? clean.replace(/<head([^>]*)>/i, `<head$1>${head}`) : clean.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
  }
  return `<!doctype html><html><head>${head}</head><body>${clean}</body></html>`;
}
