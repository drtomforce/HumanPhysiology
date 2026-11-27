/* Editing fact-check/sources.json without reformatting it: only the entries that change are rewritten, so
   a diff shows exactly what changed. Used by ids.mjs and fetch.mjs. No dependencies. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SOURCES = join(dirname(fileURLToPath(import.meta.url)), "sources.json");

/* { sources, set(id, fields, { overwrite }) → true if changed, save() → number of entries changed } */
export function openSources(){
  const lines = readFileSync(SOURCES, "utf8").split("\n"), sources = JSON.parse(lines.join("\n")), at = {}, changed = new Set();
  lines.forEach((l, i) => { const m = l.match(/^ ("[^"]+"): \{/); if (m) at[JSON.parse(m[1])] = i; });
  const fmt = (id, v, comma) => ` ${JSON.stringify(id)}: {${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${JSON.stringify(x)}`).join(", ")}}${comma ? "," : ""}`;
  return {
    sources,
    set(id, fields, { overwrite = false } = {}){
      const v = sources[id]; let ch = false;
      if (!v || at[id] == null) throw new Error(`${id}: not in sources.json`);
      for (const [k, x] of Object.entries(fields)) if (x != null && x !== "" && v[k] !== x){
        if (v[k] != null && !overwrite) throw new Error(`${id}: ${k} is ${JSON.stringify(v[k])} in sources.json, not ${JSON.stringify(x)}: settle it by hand`);
        v[k] = x; ch = true;
      }
      if (ch){ lines[at[id]] = fmt(id, v, lines[at[id]].trimEnd().endsWith(",")); changed.add(id); }
      return ch;
    },
    save(){
      if (changed.size){ writeFileSync(SOURCES, lines.join("\n")); JSON.parse(readFileSync(SOURCES, "utf8")); }
      return changed.size;
    },
  };
}
