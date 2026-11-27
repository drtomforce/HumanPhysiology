#!/usr/bin/env node
/* Check of fact-check/net.mjs, with a fake local proxy, so it needs no network:
     node tests/factcheck-net-check.mjs
   - whyFailed() calls a link "blocked" when the proxy refuses its host (403 / 407 on CONNECT), and
     "broken" when the proxy lets it through or there is no proxy;
   - useEnvProxy() re-runs a script with NODE_USE_ENV_PROXY=1 when HTTPS_PROXY is set, keeps its exit
     code, and leaves it alone without a proxy. */
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const net = join(dirname(fileURLToPath(import.meta.url)), "..", "fact-check", "net.mjs");
let failed = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed++; };

/* a proxy that refuses blocked.example (like the cloud proxy), answers 407 for auth.example, and lets anything else through */
const proxy = createServer();
proxy.on("connect", (req, sock) => {
  const host = req.url.split(":")[0];
  if (host === "blocked.example") sock.end("HTTP/1.1 403 Forbidden (agent proxy: no rule or network setting allows this host)\r\n\r\n");
  else if (host === "auth.example") sock.end("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n");
  else sock.end("HTTP/1.1 200 Connection Established\r\n\r\n");
});
await new Promise(r => proxy.listen(0, "127.0.0.1", r));
const PROXY = `http://127.0.0.1:${proxy.address().port}`;

const saved = { HTTPS_PROXY: process.env.HTTPS_PROXY, https_proxy: process.env.https_proxy, NODE_USE_ENV_PROXY: process.env.NODE_USE_ENV_PROXY };
const { whyFailed } = await import(pathToFileURL(net).href);
const err = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });

process.env.HTTPS_PROXY = PROXY; delete process.env.https_proxy; process.env.NODE_USE_ENV_PROXY = "1";
let r = await whyFailed("https://blocked.example/page", err);
check(r.state === "blocked" && /403/.test(r.error), `host refused by the proxy → blocked (${r.state}: ${r.error})`);
r = await whyFailed("https://auth.example/page", err);
check(r.state === "blocked" && /407/.test(r.error), `proxy wants a login → blocked (${r.state}: ${r.error})`);
r = await whyFailed("https://allowed.example/page", err);
check(r.state === "broken" && r.error === "ENOTFOUND", `host allowed, fetch failed anyway → broken (${r.state}: ${r.error})`);
delete process.env.NODE_USE_ENV_PROXY;
r = await whyFailed("https://allowed.example/page", err);
check(r.state === "broken" && /NODE_USE_ENV_PROXY=1/.test(r.error), "Node bypassed an allowing proxy → broken, with the hint");
delete process.env.HTTPS_PROXY;
r = await whyFailed("https://blocked.example/page", err);
check(r.state === "broken", "no proxy → broken");

/* useEnvProxy: re-run a child script and look at what it sees */
const dir = mkdtempSync(join(tmpdir(), "net-check-"));
const script = join(dir, "child.mjs");
writeFileSync(script, `import { useEnvProxy } from ${JSON.stringify(pathToFileURL(net).href)};\nuseEnvProxy();\nconsole.log("NODE_USE_ENV_PROXY=" + (process.env.NODE_USE_ENV_PROXY || ""));\nprocess.exit(Number(process.argv[2] || 0));\n`);
const run = (env, code) => spawnSync(process.execPath, [script, String(code)], { encoding: "utf8", env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?_proxy|NODE_USE_ENV_PROXY)$/i.test(k))), ...env } });
let c = run({ HTTPS_PROXY: PROXY }, 3);
check(c.stdout.trim() === "NODE_USE_ENV_PROXY=1" && c.status === 3, `behind a proxy: re-run with NODE_USE_ENV_PROXY=1, exit code kept (${JSON.stringify(c.stdout.trim())}, exit ${c.status})`);
check(!/UNDICI-EHPA|EnvHttpProxyAgent/.test(c.stderr), "no experimental-proxy warning on stderr");
c = run({}, 0);
check(c.stdout.trim() === "NODE_USE_ENV_PROXY=" && c.status === 0, "no proxy: not re-run");
c = run({ HTTPS_PROXY: PROXY, NODE_USE_ENV_PROXY: "0" }, 0);
check(c.stdout.trim() === "NODE_USE_ENV_PROXY=0", "NODE_USE_ENV_PROXY already set: left as it is");
rmSync(dir, { recursive: true, force: true });

for (const [k, v] of Object.entries(saved)) if (v == null) delete process.env[k]; else process.env[k] = v;
proxy.close();
console.log(failed ? `\n${failed} check(s) failed` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
