/* Network helpers shared by the fact-check scripts (scan.mjs, and the API fetch helper to come).
   See FACT_CHECK_PLAN.md, step 1.

   Behind an HTTPS proxy (the cloud containers set HTTPS_PROXY), Node's built-in fetch ignores the
   proxy unless NODE_USE_ENV_PROXY=1 is set, so every request fails as if the host did not exist.
   useEnvProxy() re-runs the current script with it set. And through a policy proxy, a host the
   environment does not allow fails exactly like a dead one, so whyFailed() asks the proxy directly
   and tells the two apart: a link the environment won't let us reach is not a dead link (a person,
   or WebFetch, which runs outside the container, can still follow it).
   No dependencies. */
import { spawnSync } from "node:child_process";
import { request } from "node:http";

export const proxyUrl = () => process.env.HTTPS_PROXY || process.env.https_proxy || "";

/* Re-run this script with NODE_USE_ENV_PROXY=1 when a proxy is set and Node is not using it yet.
   Call it before the script writes anything; it does not return when it re-runs. */
export function useEnvProxy(){
  if (!proxyUrl() || process.env.NODE_USE_ENV_PROXY) return;
  const args = [...process.execArgv, "--disable-warning=UNDICI-EHPA", ...process.argv.slice(1)];
  const r = spawnSync(process.execPath, args, { stdio: "inherit", env: { ...process.env, NODE_USE_ENV_PROXY: "1" } });
  if (r.error) throw r.error;
  process.exit(r.status ?? 1);
}

/* Ask the proxy for a tunnel to host:443: { code, message }, or { code: 0, message } if the proxy can't be reached */
export function proxyConnect(host, timeoutMs = 10000){
  return new Promise(resolve => {
    let p; try { p = new URL(proxyUrl()); } catch { return resolve({ code: 0, message: "no proxy" }); }
    const auth = p.username ? { "proxy-authorization": "Basic " + Buffer.from(decodeURIComponent(p.username) + ":" + decodeURIComponent(p.password)).toString("base64") } : {};
    const req = request({ host: p.hostname, port: p.port || 80, method: "CONNECT", path: `${host}:443`, headers: { host: `${host}:443`, ...auth }, timeout: timeoutMs });
    req.on("connect", (res, sock) => { sock.destroy(); resolve({ code: res.statusCode, message: res.statusMessage || "" }); });
    req.on("timeout", () => { req.destroy(); resolve({ code: 0, message: "proxy timeout" }); });
    req.on("error", e => resolve({ code: 0, message: e.code || e.message }));
    req.end();
  });
}

/* After a fetch threw (no HTTP response at all): why?
     { state: "blocked", error }  the proxy refuses the host: this environment's network policy, not the link
     { state: "broken", error }   anything else (DNS failure, refused, timeout), with a hint when Node bypassed the proxy */
export async function whyFailed(url, err){
  const error = String(err?.cause?.code || err?.cause?.message || err?.name || err?.message || err);
  if (!proxyUrl()) return { state: "broken", error };
  let host; try { host = new URL(url).hostname; } catch { return { state: "broken", error }; }
  const c = await proxyConnect(host);
  if (c.code === 403 || c.code === 407) return { state: "blocked", error: `proxy ${c.code}: ${c.message || "host not allowed"}` };
  if (c.code === 200 && process.env.NODE_USE_ENV_PROXY !== "1")
    return { state: "broken", error: `${error} (the proxy allows ${host}, but Node did not use it: run with NODE_USE_ENV_PROXY=1, on Node 22.21+ or 24.5+)` };
  return { state: "broken", error };
}
