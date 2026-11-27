/* Open textbook web pages, for checking a look-up's quote against the page it links to (FACT_CHECK_PLAN.md,
   "Next priorities", item 3). Only sites that serve their text in the HTML to a script are read: OpenStax,
   Klabunde's Cardiovascular Physiology Concepts and Neuroscience Online. Other sites keep the old rule (the link
   must answer). Pages are cached in fact-check/cache/ (git-ignored). No dependencies. */
import { cached, getText, locate, decode } from "./epmc.mjs";

export const PAGE_HOSTS = new Set(["openstax.org", "cvphysiology.com", "nba.uth.tmc.edu"]);
export const isPageUrl = u => { try { return PAGE_HOSTS.has(new URL(u).hostname.replace(/^www\./, "")); } catch { return false; } };

/* a page as units { where, text }: each paragraph, list item, table cell, caption or heading, named by the
   heading above it, so --find can say where an excerpt is */
export function pageUnits(html){
  if (!html) return [];
  const body = html.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<![^>]*>/g, " ");   /* comments, <!DOCTYPE> */
  const out = []; let heading = "page", buf = "";
  const flush = () => { const t = decode(buf.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(); if (t) out.push({ where: heading, text: t }); buf = ""; };
  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*>|([^<]+)/g)){
    const [, close, tag0, text] = m;
    if (text != null){ buf += text; continue; }
    const tag = tag0.toLowerCase();
    if (/^h[1-6]$/.test(tag)){ flush(); if (close) { /* the heading's own text became the last unit: use it as the name */ const h = out[out.length - 1]; if (h) heading = h.text.slice(0, 80); } continue; }
    if (/^(p|li|td|th|dd|dt|figcaption|caption|div|section|article|br|tr|blockquote|pre)$/.test(tag)) flush();
    /* inline tags (em, a, sup, span) add nothing: "10<sup>5</sup>" stays "105", as a reader's copy would */
  }
  flush();
  return out;
}

const robotCheck = t => /checking your browser|captcha|just a moment|enable javascript and cookies/i.test(t);
/* the page's address without its #fragment (a text fragment #:~:text=… is for the reader's browser) */
const bare = u => { const x = new URL(u); x.hash = ""; return x.href; };

/* Is the quote on the page the link points to? null for a site this doesn't read; otherwise
     { state: "ok", where } | { state: "not-verbatim", where, found } | { state: "missing", searched }
     | { state: "unchecked", why } (a robot check) | { state: "wrong-source", why } | { state: "error", why }
   `source` is the sources.json entry: a link must be on the same site as its "home" (and, for OpenStax, in the
   same book), so a quote from one textbook can't be filed under another */
export async function checkPageQuote(url, quote, source = {}, maxAgeDays = 30){
  if (!isPageUrl(url)) return null;
  const u = new URL(url);
  if (source.home){
    const h = new URL(source.home), book = p => (p.match(/^\/books\/[^/]+\//) || [""])[0];
    if (h.hostname.replace(/^www\./, "") !== u.hostname.replace(/^www\./, "") || book(h.pathname) !== book(u.pathname))
      return { state: "wrong-source", why: `the link is on ${u.hostname}${book(u.pathname)}, but the source's home is ${h.hostname}${book(h.pathname)}` };
  }
  let html;
  try { html = await cached(`page-${bare(url)}`, maxAgeDays, () => getText(bare(url))); } catch (e){ return { state: "error", why: e.message }; }
  if (!html) return { state: "missing", searched: "nothing: the page answered 404" };
  const units = pageUnits(html);
  if (robotCheck(units.slice(0, 40).map(x => x.text).join(" ")) && units.length < 40) return { state: "unchecked", why: "the site answered with a robot check" };
  /* a quote can run across a line break the site puts inside a paragraph: try the page as one run of text too */
  const hit = locate(units, quote)[0] || locate([{ where: "page", text: units.map(x => x.text).join(" ") }], quote)[0];
  if (!hit) return { state: "missing", searched: "the page" };
  return hit.how === "exact" ? { state: "ok", where: hit.where } : { state: "not-verbatim", where: hit.where, found: hit.found };
}
