/**
 * Navigation benchmark: how fast every sidebar page opens, cold and after a hover, plus a cold-start probe.
 *
 * From the app-speed skill (references/measuring.md). Built in Ayudocs, hardened in Gurukul (2026-10-13/24),
 * generalised here: every app-specific value is a flag or a key in a JSON config file.
 *
 * SETUP (once, in the repo being measured):
 *   pnpm add -D playwright tsx && npx playwright install chromium
 *   copy this file to scripts/bench-navigation.mts
 *
 * RUN (credentials ONLY from env vars the user sets; a leading space keeps the line out of shell history):
 *    export BENCH_EMAIL=... BENCH_PASSWORD=...
 *   npx tsx scripts/bench-navigation.mts --url=https://staging.example.com
 *   npx tsx scripts/bench-navigation.mts --url=https://staging.example.com --throttle=3g --runs=3
 *   npx tsx scripts/bench-navigation.mts --url=https://staging.example.com --probe=30 --probe-path=/login,/dashboard
 *   npx tsx scripts/bench-navigation.mts --config=bench.admin.json --url=https://admin.example.com
 *
 * FLAGS (each can also be a key in --config=<file>.json, e.g. {"signInPath": "/login"}; a flag wins over the file)
 *   --url=<origin>              the deployed app to measure (required). Staging or a local `next start`.
 *                               NEVER `next dev`: it turns prefetching off, so its numbers mean nothing.
 *   --sign-in-path=/login       the sign-in page (visited first; the sign-in POST is made from inside it)
 *   --sign-in-endpoint=/api/auth/sign-in/email
 *                               the POST that signs in; body {email, password}; 200 = signed in (better-auth's
 *                               default). Another auth library: point this at its JSON sign-in endpoint.
 *   --start=/dashboard          the page every measurement starts from (the one with the sidebar)
 *   --sidebar=aside             CSS selector of the rail that holds the links to measure
 *   --module-buttons=aside button[aria-expanded]
 *                               buttons that open one group of links at a time ("" if the rail has none)
 *   --skeleton=main .animate-pulse
 *                               what a skeleton looks like in this app; "ready" waits until none is left
 *   --pin-cookie=name=value     a cookie that pins the sidebar open before the first paint (optional)
 *   --pin-storage=key=value     the same through localStorage (optional)
 *   --read-path=/api/read/      requests under this path count as "reads" (Server Action POSTs always do)
 *   --timing-metric=read        the Server-Timing entry a read route sends (`read;dur=12`), if any
 *   --app-dir=.                 where `.next/BUILD_ID` and `.env.production` live (monorepo: apps/web)
 *   --prod-host=app.example.com the production host; refused without --allow-production. Default: the host
 *                               of BETTER_AUTH_URL / NEXT_PUBLIC_APP_URL in <app-dir>/.env.production
 *   --allow-production          measure the live site on purpose (a run renders every page many times and
 *                               opens a session)
 *   --runs=3                    measurements per page and mode; the report takes the median
 *   --routes=/a,/b              only these sidebar hrefs (default: every link in the rail)
 *   --out=docs/benchmarks       where the report goes
 *   --headed                    watch it run
 *   --throttle=none             none, fast-4g, slow-4g or 3g (Chrome DevTools' presets), applied after sign-in
 *   --cpu=1                     CPU slowdown factor (4 = a mid-range phone, as Lighthouse uses)
 *   --probe=30                  cold-start probe instead: no browser, no sign-in (see below)
 *   --probe-path=/login,/x      paths the probe alternates over (default: the sign-in page)
 *
 * WHAT IT MEASURES, per sidebar page:
 *   cold   the click with no hover first:
 *            shown   click -> URL changes (Next committed the page or its loading.tsx skeleton)
 *            ready   click -> no skeleton left and every request it started has ended
 *            server  the page's RSC request: first byte and end of stream
 *            reads   Server Action POSTs and read-route GETs after the click, and the slowest one
 *            js      script bytes the click downloaded
 *   warm   the same click after resting on the link 300ms (the intent prefetch has landed):
 *            prefetch requests / ms / KB, then shown and ready as above
 *   load   RSC requests the start page makes with nobody touching it (target: only the planned queue)
 *   isolate  responses carrying `x-isolate-requests: 1` came from a fresh isolate (a cold start); the app
 *            must stamp that header itself (references/cloudflare.md), or cold and warm are not separated.
 *
 * Every page is measured from a fresh load of the start page, so one page's prefetch cannot flatter the next.
 *
 * SAFETY: reads only. It writes nothing to any database itself; the one side effect is the session its
 * sign-in creates (as any sign-in does). The password is never printed and never written; error text is cut to
 * its first line because Playwright's full errors can quote response headers, which carry the session cookie.
 *
 * OUTPUT: <out>/navigation-<date>-<HHMM UTC>-<host>[-throttle].md (slowest first) and .json (raw);
 *         <out>/probe-<date>-<HHMMSS>-<host>.md for the probe.
 */
import { chromium, type Page, type Request } from "playwright";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Arguments and config ─────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const cliArg = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const flag = (name: string) => argv.includes(`--${name}`);

function fail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/** camelCase key in the config file for a --kebab-case flag. */
const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

const config: Record<string, unknown> = (() => {
  const file = cliArg("config");
  if (!file) return {};
  if (!existsSync(file)) fail(`--config=${file} not found.`);
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) fail(`--config=${file} must hold a JSON object.`);
    return parsed as Record<string, unknown>;
  } catch {
    fail(`--config=${file} is not valid JSON.`);
  }
})();

/** A flag's value, else the config file's, else the default. */
function opt(name: string, fallback: string): string;
function opt(name: string): string | undefined;
function opt(name: string, fallback?: string): string | undefined {
  const fromCli = cliArg(name);
  if (fromCli !== undefined) return fromCli;
  const fromFile = config[camel(name)];
  if (typeof fromFile === "string" || typeof fromFile === "number") return String(fromFile);
  return fallback;
}

function pair(value: string | undefined, label: string): { key: string; value: string } | null {
  if (!value) return null;
  const i = value.indexOf("=");
  if (i <= 0) fail(`--${label} must look like name=value.`);
  return { key: value.slice(0, i), value: value.slice(i + 1) };
}

const base = opt("url")?.replace(/\/$/, "") ?? fail("Missing --url=<origin>, e.g. --url=https://staging.example.com");
const signInPath = opt("sign-in-path", "/login");
const signInEndpoint = opt("sign-in-endpoint", "/api/auth/sign-in/email");
const startPath = opt("start", "/dashboard");
const SIDEBAR = opt("sidebar", "aside");
const MODULE_BUTTONS = opt("module-buttons", `${SIDEBAR} button[aria-expanded]`);
const SKELETON = opt("skeleton", "main .animate-pulse");
const pinCookie = pair(opt("pin-cookie"), "pin-cookie");
const pinStorage = pair(opt("pin-storage"), "pin-storage");
const readPath = opt("read-path", "/api/read/");
const timingMetric = opt("timing-metric", "read");
const appDir = opt("app-dir", ".");
const runs = Math.max(1, Number(opt("runs", "3")) || 3);
const outDir = opt("out", "docs/benchmarks");
const onlyRoutes = opt("routes")?.split(",").map((r) => r.trim()).filter(Boolean);
const probeCount = Number(opt("probe", "0")) || 0;
const probePath = opt("probe-path", signInPath);

// The build this checkout last built, to compare with the one the site serves.
const localBuildId = (() => {
  const f = join(appDir, ".next", "BUILD_ID");
  return existsSync(f) ? readFileSync(f, "utf8").trim() || null : null;
})();

/** The build id inside a served HTML page (App Router flight data `"b":"<id>"`, or the static manifest path). */
function servedBuildId(html: string): string | null {
  if (localBuildId && html.includes(localBuildId)) return localBuildId;
  const m =
    /\/_next\/static\/([\w-]{8,})\/_(?:buildManifest|ssgManifest)\.js/.exec(html) ??
    /\\?"b\\?":\\?"([\w-]{8,})\\?"/.exec(html) ??
    /"buildId":"([\w-]+)"/.exec(html);
  return m?.[1] ?? null;
}

// Chrome DevTools' presets (latency as DevTools applies it), throughput in kbit/s.
const THROTTLE: Record<string, { latencyMs: number; downKbps: number; upKbps: number } | null> = {
  none: null,
  "fast-4g": { latencyMs: 165, downKbps: 9000, upKbps: 1500 },
  "slow-4g": { latencyMs: 563, downKbps: 1600, upKbps: 750 },
  "3g": { latencyMs: 2000, downKbps: 400, upKbps: 400 },
};
const throttleName = opt("throttle", "none");
if (!(throttleName in THROTTLE)) fail(`Unknown --throttle=${throttleName}. One of: ${Object.keys(THROTTLE).join(", ")}`);
const throttle = THROTTLE[throttleName] ?? null;
const cpuRate = Math.max(1, Number(opt("cpu", "1")) || 1);
const throttleLabel = [throttle ? throttleName : null, cpuRate > 1 ? `cpu-${cpuRate}x` : null].filter(Boolean).join("-");
const email = probeCount ? "" : (process.env.BENCH_EMAIL ?? fail("Set BENCH_EMAIL (and BENCH_PASSWORD) in your shell for the account to sign in as."));
const password = probeCount ? "" : (process.env.BENCH_PASSWORD ?? fail("Set BENCH_PASSWORD in your shell."));

// The live site only on purpose.
const host = new URL(base).host;
const prodHost = (() => {
  const explicit = opt("prod-host");
  if (explicit) return explicit;
  const envFile = join(appDir, ".env.production");
  if (!existsSync(envFile)) return null;
  const lines = readFileSync(envFile, "utf8").split(/\r?\n/);
  for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL"]) {
    const line = lines.find((l) => l.startsWith(`${key}=`));
    if (!line) continue;
    try {
      return new URL(line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "")).host;
    } catch {
      // not a URL; try the next key
    }
  }
  return null;
})();
if (prodHost && host === prodHost && !flag("allow-production")) {
  fail(`${host} is production. Pass --allow-production to measure the live site on purpose.`);
}

// ── Request log ──────────────────────────────────────────────────────────────────────────────────
interface Rec {
  url: string;
  type: string;
  rsc: boolean;
  start: number;
  end: number | null;
  ttfb: number | null;
  bytes: number;
  serverMs: number | null;
  /** A Server Action POST (header `next-action`). */
  action: boolean;
  /** x-isolate-requests stamped by the app: 1 means a fresh isolate answered. */
  isolateRequests: number | null;
  isolateAgeMs: number | null;
}

const TRACKED = new Set(["document", "fetch", "xhr", "script"]);
const timingRe = new RegExp(`(?:^|,)\\s*${timingMetric.replace(/[^\w-]/g, "")};dur=(\\d+(?:\\.\\d+)?)`);

function track(page: Page) {
  const recs: Rec[] = [];
  const open = new Map<Request, Rec>();
  page.on("request", (req) => {
    if (!TRACKED.has(req.resourceType())) return;
    const rec: Rec = {
      url: req.url(),
      type: req.resourceType(),
      rsc: req.headers()["rsc"] === "1",
      action: req.method() === "POST" && Boolean(req.headers()["next-action"]),
      start: Date.now(),
      end: null,
      ttfb: null,
      bytes: 0,
      serverMs: null,
      isolateRequests: null,
      isolateAgeMs: null,
    };
    recs.push(rec);
    open.set(req, rec);
  });
  const finish = async (req: Request) => {
    const rec = open.get(req);
    if (!rec) return;
    open.delete(req);
    rec.end = Date.now();
    const t = req.timing();
    if (t.responseStart > 0) rec.ttfb = Math.round(t.responseStart);
    try {
      rec.bytes = Math.max(0, (await req.sizes()).responseBodySize);
      const headers = (await req.response())?.headers() ?? {};
      const m = timingRe.exec(headers["server-timing"] ?? "");
      if (m) rec.serverMs = Number(m[1]);
      if (headers["x-isolate-requests"]) rec.isolateRequests = Number(headers["x-isolate-requests"]);
      if (headers["x-isolate-age-ms"]) rec.isolateAgeMs = Number(headers["x-isolate-age-ms"]);
    } catch {
      // A request the page abandoned has no sizes; it still counts as ended.
    }
  };
  page.on("requestfinished", finish);
  page.on("requestfailed", finish);
  return {
    recs,
    inflight: () => open.size,
    since: (t: number) => recs.filter((r) => r.start >= t),
  };
}

type Tracker = ReturnType<typeof track>;

async function quiet(t: Tracker, quietMs = 500, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let calmSince = Date.now();
  while (Date.now() < deadline) {
    if (t.inflight() > 0) calmSince = Date.now();
    else if (Date.now() - calmSince >= quietMs) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

const skeletonCount = (page: Page) => page.locator(SKELETON).count();
const railLinks = `${SIDEBAR} a[href^="/"]`;

/**
 * An UNPINNED rail may sit off-screen until the pointer touches the left edge. Rest the pointer there and
 * wait for its links. A no-op when the rail is pinned. (A Gurukul baseline measured 0 pages because of this.)
 */
async function revealSidebar(page: Page): Promise<void> {
  const visible = () =>
    page.locator(railLinks).evaluateAll((els) =>
      els.some((e) => {
        const r = (e as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.right > 0 && r.left < window.innerWidth;
      })
    );
  if (await visible()) return;
  await page.mouse.move(4, 450);
  for (let i = 0; i < 20 && !(await visible()); i++) await page.waitForTimeout(100);
}

/** href -> index of the module button whose group holds it (absent: always visible). */
const moduleOf = new Map<string, number>();

async function openModuleFor(page: Page, href: string): Promise<void> {
  await revealSidebar(page);
  const i = moduleOf.get(href);
  if (i === undefined || !MODULE_BUTTONS) return;
  const btn = page.locator(MODULE_BUTTONS).nth(i);
  if ((await btn.getAttribute("aria-expanded")) !== "true") {
    await btn.click();
    await page.locator(`${SIDEBAR} a[href="${href}"]`).first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  }
}

/** A fresh start page, the pointer parked over the content. */
async function freshStart(page: Page, t: Tracker): Promise<void> {
  await page.goto(base + startPath, { waitUntil: "load" });
  await quiet(t);
  await page.mouse.move(900, 500);
  await quiet(t);
}

// ── One measurement ──────────────────────────────────────────────────────────────────────────────
interface Sample {
  shownMs: number;
  readyMs: number;
  skeletonTimedOut: boolean;
  /** RSC requests the new page fired by itself after the click (its own links prefetching). */
  pagePrefetches: number;
  /** The request that ended last, which is what "ready" waited for. */
  lastRequest: string | null;
  /** The page's server render came from a fresh isolate. */
  coldRender: boolean;
  rscTtfbMs: number | null;
  rscEndMs: number | null;
  reads: number;
  slowestReadMs: number | null;
  jsKb: number;
  prefetchRequests?: number;
  prefetchMs?: number;
  prefetchKb?: number;
}

const pathOf = (href: string) => new URL(href, base).pathname + new URL(href, base).search;

async function measure(page: Page, t: Tracker, href: string, warm: boolean): Promise<Sample | null> {
  await freshStart(page, t);
  await openModuleFor(page, href);
  // Park the pointer INSIDE the rail (an unpinned rail stays open while hovered).
  await page.mouse.move(40, 870);
  await quiet(t);
  const link = page.locator(`${SIDEBAR} a[href="${href}"]`).first();
  if (!(await link.isVisible())) return null;

  let prefetch: Pick<Sample, "prefetchRequests" | "prefetchMs" | "prefetchKb"> = {};
  if (warm) {
    const h0 = Date.now();
    await link.hover();
    await page.waitForTimeout(300);
    await quiet(t);
    const recs = t.since(h0).filter((r) => r.rsc);
    const ends = recs.map((r) => r.end ?? h0);
    prefetch = {
      prefetchRequests: recs.length,
      prefetchMs: recs.length ? Math.max(...ends) - h0 : 0,
      prefetchKb: Math.round(recs.reduce((a, r) => a + r.bytes, 0) / 1024),
    };
  }

  const target = pathOf(href);
  const t0 = Date.now();
  await link.click();
  await page.waitForURL((u) => u.pathname + u.search === target, { timeout: 30_000 });
  const shownMs = Date.now() - t0;

  let skeletonTimedOut = false;
  let skeletonGoneAt = Date.now();
  try {
    await page.waitForFunction((sel) => document.querySelectorAll(sel).length === 0, SKELETON, { timeout: 30_000 });
    skeletonGoneAt = Date.now();
  } catch {
    skeletonTimedOut = true;
  }
  await quiet(t);
  if ((await skeletonCount(page)) > 0) skeletonTimedOut = true;

  const after = t.since(t0);
  const lastEnd = Math.max(skeletonGoneAt, ...after.map((r) => r.end ?? t0));
  const rscAll = after.filter((r) => r.rsc && r.type === "fetch");
  const rsc = rscAll[0];
  const last = [...after].filter((r) => r.end !== null).sort((a, b) => (b.end ?? 0) - (a.end ?? 0))[0];
  const short = (u: string) => {
    const x = new URL(u);
    return `${x.pathname}${x.search.includes("_rsc") ? " (rsc)" : ""}`.slice(0, 60);
  };
  const reads = after.filter((r) => r.action || (readPath !== "" && new URL(r.url).pathname.startsWith(readPath)));
  // Server Actions send no Server-Timing; their whole round trip is the honest figure.
  const readTimes = reads.map((r) => r.serverMs ?? (r.end !== null ? r.end - r.start : null)).filter((v): v is number => v !== null);

  return {
    shownMs,
    readyMs: lastEnd - t0,
    skeletonTimedOut,
    rscTtfbMs: rsc?.ttfb ?? null,
    rscEndMs: rsc?.end ? rsc.end - rsc.start : null,
    reads: reads.length,
    slowestReadMs: readTimes.length ? Math.max(...readTimes) : null,
    jsKb: Math.round(after.filter((r) => r.type === "script").reduce((a, r) => a + r.bytes, 0) / 1024),
    pagePrefetches: Math.max(0, rscAll.length - 1),
    lastRequest: last && last.end !== null ? `${short(last.url)} ${last.end - last.start}ms` : null,
    coldRender: rsc?.isolateRequests === 1,
    ...prefetch,
  };
}

function median(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : Math.round((v[mid - 1]! + v[mid]!) / 2);
}

function summarise(samples: Sample[]) {
  const pick = <K extends keyof Sample>(k: K) => median(samples.map((s) => s[k] as number | null | undefined));
  return {
    shownMs: pick("shownMs"),
    readyMs: pick("readyMs"),
    rscTtfbMs: pick("rscTtfbMs"),
    rscEndMs: pick("rscEndMs"),
    reads: pick("reads"),
    slowestReadMs: pick("slowestReadMs"),
    jsKb: pick("jsKb"),
    prefetchRequests: pick("prefetchRequests"),
    prefetchMs: pick("prefetchMs"),
    prefetchKb: pick("prefetchKb"),
    skeletonStuck: samples.some((s) => s.skeletonTimedOut),
    pagePrefetches: pick("pagePrefetches"),
    lastRequest: samples[Math.floor(samples.length / 2)]?.lastRequest ?? null,
    coldRenders: samples.filter((s) => s.coldRender).length,
  };
}

const firstLine = (err: unknown) => String((err as Error)?.message ?? err).split("\n")[0];
process.on("unhandledRejection", (err) => fail(`Stopped: ${firstLine(err)}`));
process.on("uncaughtException", (err) => fail(`Stopped: ${firstLine(err)}`));

// ── Probe: cold starts without a browser or a sign-in ───────────────────────────────────────────
// `--probe=30` requests each path in --probe-path 30 times, alternating, each on a new connection, and
// reports every response's first byte with the isolate that answered. Give it two paths to split the cost:
// a page that needs the server bundle but no database (the sign-in page) and a signed-out protected path the
// middleware answers with a redirect. A fast redirect and a slow page on fresh isolates = the cold start is the
// bundle load inside the first request. (It cannot be timed from inside: a Worker's clock only moves at I/O.)
if (probeCount) {
  const paths = probePath.split(",").map((p) => p.trim()).filter(Boolean);
  type Row = {
    i: number;
    path: string;
    ttfbMs: number;
    status: number;
    isolateRequests: number | null;
    isolateAgeMs: number | null;
    serverTiming: string | null;
    placement: string | null;
    buildId: string | null;
  };
  const rows: Row[] = [];
  const num = (v: string | null) => (v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
  for (let i = 1; i <= probeCount; i++) {
    for (const path of paths) {
      const t = performance.now();
      const res = await fetch(base + path, { redirect: "manual", headers: { connection: "close" } });
      const ttfbMs = Math.round(performance.now() - t);
      const body = await res.text();
      rows.push({
        i,
        path,
        ttfbMs,
        status: res.status,
        isolateRequests: num(res.headers.get("x-isolate-requests")),
        isolateAgeMs: num(res.headers.get("x-isolate-age-ms")),
        serverTiming: res.headers.get("server-timing"),
        placement: res.headers.get("cf-placement"),
        buildId: (res.headers.get("content-type") ?? "").includes("text/html") ? servedBuildId(body) : null,
      });
    }
  }
  // Medians come from the rows; an empty group prints "-", never a 0 ms median (an old bug).
  const med = (v: number[]) => {
    const m = median(v);
    return m === null ? "-" : `${m} ms`;
  };
  const now = new Date();
  const stampP = `${now.toISOString().slice(0, 10)}-${now.toISOString().slice(11, 19).replace(/:/g, "")}`;
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `probe-${stampP}-${host.replace(/[^a-z0-9.-]/gi, "_")}.md`);
  const builds = [...new Set(rows.map((r) => r.buildId).filter((b): b is string => b !== null))];
  const buildLine = builds.length
    ? `Served build id: ${builds.map((b) => `\`${b}\``).join(", ")}${builds.length > 1 ? " (MORE THAN ONE: a deploy landed mid-probe)" : ""}` +
      (localBuildId ? (builds.includes(localBuildId) ? ` - matches ${appDir}/.next/BUILD_ID.` : ` - NOT the local build \`${localBuildId}\`.`) : ".")
    : `Served build id: not found in any HTML response${localBuildId ? ` (local build \`${localBuildId}\`)` : ""}.`;
  const placements = [...new Set(rows.map((r) => r.placement).filter((p): p is string => p !== null))];
  const summary = paths.map((path) => {
    const mine = rows.filter((r) => r.path === path);
    const fresh = mine.filter((r) => r.isolateRequests === 1);
    const warm = mine.filter((r) => (r.isolateRequests ?? 0) > 1);
    const unknown = mine.filter((r) => r.isolateRequests === null).length;
    const all = mine.map((r) => r.ttfbMs);
    const head =
      `- \`${path}\` (status ${[...new Set(mine.map((r) => r.status))].join("/")}): **${mine.length}** requests, ` +
      `median first byte **${med(all)}**, slowest **${Math.max(...all)} ms**`;
    if (unknown === mine.length) return `${head} (no isolate headers, so cold and warm are not separated)`;
    return (
      `${head}; fresh isolate **${fresh.length}**, median **${med(fresh.map((r) => r.ttfbMs))}**; ` +
      `warm **${warm.length}**, median **${med(warm.map((r) => r.ttfbMs))}**` +
      (unknown ? `; ${unknown} without isolate headers` : "")
    );
  });
  const cell = (v: string | number | null) => (v === null ? "-" : String(v));
  const lines = [
    `# Cold-start probe - ${host} - ${stampP} UTC`,
    ``,
    `${probeCount} rounds over ${paths.length} path(s), alternating, each request on a new connection.`,
    ``,
    buildLine,
    placements.length ? `cf-placement: ${placements.join(", ")}` : `cf-placement: not sent (not on Cloudflare, or no placement set).`,
    ``,
    ...summary,
    ``,
    `| # | path | first byte ms | status | isolate requests | isolate age ms | server-timing | build id |`,
    `|---|---|---|---|---|---|---|---|`,
    ...rows.map(
      (r) =>
        `| ${r.i} | \`${r.path}\` | ${r.ttfbMs} | ${r.status} | ${cell(r.isolateRequests)} | ${cell(r.isolateAgeMs)} | ${r.serverTiming ? `\`${r.serverTiming}\`` : "-"} | ${cell(r.buildId)} |`
    ),
    ``,
  ];
  writeFileSync(file, lines.join("\n"));
  for (const r of rows) {
    console.log(
      `  ${String(r.i).padStart(3)} ${r.path.padEnd(20)} ${String(r.ttfbMs).padStart(6)}ms ${r.status}` +
        `  isolate ${cell(r.isolateRequests)} age ${cell(r.isolateAgeMs)}ms  build ${cell(r.buildId)}`
    );
  }
  console.log(`\n  ${buildLine}\n${summary.map((l) => "  " + l).join("\n")}\n  Report: ${file}\n`);
  process.exit(0);
}

// ── Navigation run ───────────────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: !flag("headed") });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// Pin the rail before the first paint: an unpinned rail sits off-screen. revealSidebar() is the fallback.
if (pinCookie) await context.addCookies([{ name: pinCookie.key, value: pinCookie.value, url: base }]);
if (pinStorage) {
  await context.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Storage blocked: revealSidebar() peeks the rail in instead.
      }
    },
    [pinStorage.key, pinStorage.value] as const
  );
}

// Signed in from inside the page, as the app's own form does, so the cookie lands in this browser.
const page = await context.newPage();
await page.goto(base + signInPath, { waitUntil: "load" });
const signInStatus = await page.evaluate(
  async ([endpoint, e, p]) =>
    (
      await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      })
    ).status,
  [signInEndpoint, email, password] as const
);
if (signInStatus !== 200) fail(`Sign-in failed (${signInStatus}) at ${signInEndpoint}. Check BENCH_EMAIL / BENCH_PASSWORD for ${host}, or --sign-in-endpoint.`);

// Throttling goes on the page's CDP session, which outlives every goto below.
if (throttle || cpuRate > 1) {
  const cdp = await context.newCDPSession(page);
  if (throttle) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: throttle.latencyMs,
      downloadThroughput: (throttle.downKbps * 1000) / 8,
      uploadThroughput: (throttle.upKbps * 1000) / 8,
    });
  }
  if (cpuRate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuRate });
}
const tracker = track(page);

// Requests the start page makes on its own.
const loadT0 = Date.now();
const startResponse = await page.goto(base + startPath, { waitUntil: "load" });
await quiet(tracker, 1500);
if (new URL(page.url()).pathname !== new URL(base + startPath).pathname) {
  fail(`Opening ${startPath} landed on ${new URL(page.url()).pathname}: the sign-in did not hold, or this account cannot open it. Pass --start=<a page with the sidebar>.`);
}
const navBuildId = startResponse ? servedBuildId(await startResponse.text().catch(() => "")) : null;
const idlePrefetches = tracker.since(loadT0).filter((r) => r.rsc).length;

await freshStart(page, tracker);
await revealSidebar(page);
const sidebarHrefs = () =>
  page.locator(railLinks).evaluateAll((els) =>
    els
      .filter((e) => {
        const r = (e as HTMLElement).getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > 0;
      })
      .map((e) => e.getAttribute("href") ?? "")
  );
const found = new Set(await sidebarHrefs());
const moduleCount = MODULE_BUTTONS ? await page.locator(MODULE_BUTTONS).count() : 0;
for (let i = 0; i < moduleCount; i++) {
  const btn = page.locator(MODULE_BUTTONS).nth(i);
  if (!(await btn.isVisible())) continue;
  await revealSidebar(page);
  if ((await btn.getAttribute("aria-expanded")) !== "true") await btn.click();
  await page.waitForTimeout(400);
  for (const h of await sidebarHrefs()) {
    if (!found.has(h)) {
      found.add(h);
      moduleOf.set(h, i);
    }
  }
}
if (found.size === 0) {
  await browser.close();
  fail(`Found no links in "${SIDEBAR}" on ${startPath}. The rail is collapsed or off-screen (set --pin-cookie / --pin-storage), or --sidebar is wrong: run with --headed to look.`);
}
const hrefs = [...found].filter(
  (h) => h && h !== startPath && h !== signInPath && !h.startsWith(signInPath + "?") && (!onlyRoutes || onlyRoutes.includes(h))
);
if (hrefs.length === 0) {
  await browser.close();
  fail(`No rail link left to measure on ${startPath}${onlyRoutes ? ` matching --routes=${onlyRoutes.join(",")}` : ""}. Found: ${[...found].join(", ")}`);
}

console.log(`\n  ${host}, build ${navBuildId ?? "unknown"}${localBuildId ? (navBuildId === localBuildId ? " (matches local)" : ` (local is ${localBuildId})`) : ""}`);
console.log(`  ${hrefs.length} rail pages, ${runs} run(s) each, cold and warm, ${throttleLabel || "no throttling"}.`);
console.log(`  Start page made ${idlePrefetches} prefetch request(s) with nobody touching it.\n`);

const results: { href: string; cold: ReturnType<typeof summarise> | null; warm: ReturnType<typeof summarise> | null; raw: { cold: Sample[]; warm: Sample[] } }[] = [];
for (const href of hrefs) {
  const raw = { cold: [] as Sample[], warm: [] as Sample[] };
  for (let i = 0; i < runs; i++) {
    for (const warm of [false, true]) {
      try {
        const s = await measure(page, tracker, href, warm);
        if (s) (warm ? raw.warm : raw.cold).push(s);
      } catch (err) {
        console.warn(`  ${href} (${warm ? "warm" : "cold"}) failed: ${firstLine(err)}`);
      }
    }
  }
  const row = { href, cold: raw.cold.length ? summarise(raw.cold) : null, warm: raw.warm.length ? summarise(raw.warm) : null, raw };
  results.push(row);
  console.log(
    `  ${href.padEnd(42)} cold shown ${String(row.cold?.shownMs ?? "-").padStart(5)}ms ready ${String(row.cold?.readyMs ?? "-").padStart(5)}ms` +
      `   warm shown ${String(row.warm?.shownMs ?? "-").padStart(5)}ms ready ${String(row.warm?.readyMs ?? "-").padStart(5)}ms`
  );
}
await browser.close();

// 0 pages measured is a broken run, not a fast one: say so and exit non-zero, writing no report.
const measured = results.filter((r) => r.cold || r.warm).length;
if (measured === 0) {
  fail(`Measured 0 of ${hrefs.length} pages: every rail link was off-screen or failed at the click. Run with --headed to watch, or pass --routes=/a,/b.`);
}
if (measured < hrefs.length) console.warn(`\n  Only ${measured} of ${hrefs.length} pages measured; the rest are marked "link not visible".`);

// ── Report ───────────────────────────────────────────────────────────────────────────────────────
const now = new Date();
const date = now.toISOString().slice(0, 10);
const stamp = `${date}-${now.toISOString().slice(11, 16).replace(":", "")}`;
mkdirSync(outDir, { recursive: true });
// A throttled run says so in its file name, so it is never read as the unthrottled baseline.
const stem = join(outDir, `navigation-${stamp}-${host.replace(/[^a-z0-9.-]/gi, "_")}${throttleLabel ? `-${throttleLabel}` : ""}`);
const allRecs = tracker.recs.filter((r) => r.isolateRequests !== null && r.ttfb !== null);
const freshRecs = allRecs.filter((r) => r.isolateRequests === 1);
const warmRecs = allRecs.filter((r) => (r.isolateRequests ?? 0) > 1);
const coldSummary = allRecs.length
  ? `Server responses from a fresh isolate (cold start): **${freshRecs.length} of ${allRecs.length}**, median first byte **${median(freshRecs.map((r) => r.ttfb)) ?? "-"} ms** against **${median(warmRecs.map((r) => r.ttfb)) ?? "-"} ms** warm.`
  : `No isolate headers in the responses: the app does not stamp x-isolate-requests (references/cloudflare.md), so cold and warm are not separated.`;
writeFileSync(`${stem}.json`, JSON.stringify({ host, buildId: navBuildId, date, runs, startPath, throttle: throttleLabel || "none", idlePrefetches, coldSummary, results }, null, 2));

const n = (v: number | null | undefined) => (v === null || v === undefined ? "-" : String(v));
const sorted = [...results].sort((a, b) => (b.cold?.readyMs ?? 0) - (a.cold?.readyMs ?? 0));
const lines = [
  `# Navigation benchmark - ${host} - ${date}`,
  ``,
  `Served build id: ${navBuildId ? `\`${navBuildId}\`` : "not found"}${localBuildId ? (navBuildId === localBuildId ? " (matches the local build)" : ` (local build is \`${localBuildId}\`)`) : ""}.`,
  ``,
  `Median of ${runs} run(s) per page, each from a fresh load of \`${startPath}\`. Times in ms, sizes in KB. Slowest first by cold "ready".`,
  throttle || cpuRate > 1
    ? `Throttled: ${throttle ? `${throttleName} (${throttle.latencyMs}ms latency, ${throttle.downKbps}/${throttle.upKbps} kbit/s down/up)` : "no network throttling"}, CPU ${cpuRate}x.`
    : `No throttling: full network speed and CPU.`,
  ``,
  `- Start page prefetch requests with nobody touching it: **${idlePrefetches}** (only the planned queue: home in full plus one shell per rail row).`,
  `- ${coldSummary}`,
  `- **cold**: click with no hover. **warm**: click after resting on the link for 300ms.`,
  `- **shown**: click to the new page or its skeleton. **ready**: click to no skeleton and no request in flight.`,
  `- **page prefetches**: RSC requests the opened page fired by itself. **last request**: what "ready" waited for.`,
  `- **RSC ttfb / end**: the page's server render. **reads**: Server Action POSTs and ${readPath || "read-route"} GETs after the click, and the slowest.`,
  ``,
  `| Page | cold shown | cold ready | RSC ttfb | RSC end | reads | slowest read | JS KB | hover requests | hover ms | hover KB | warm shown | warm ready | page prefetches | last request (cold) | cold renders | note |`,
  `|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|`,
  ...sorted.map((r) =>
    [
      `\`${r.href}\``,
      n(r.cold?.shownMs),
      n(r.cold?.readyMs),
      n(r.cold?.rscTtfbMs),
      n(r.cold?.rscEndMs),
      n(r.cold?.reads),
      n(r.cold?.slowestReadMs),
      n(r.cold?.jsKb),
      n(r.warm?.prefetchRequests),
      n(r.warm?.prefetchMs),
      n(r.warm?.prefetchKb),
      n(r.warm?.shownMs),
      n(r.warm?.readyMs),
      n(r.cold?.pagePrefetches),
      r.cold?.lastRequest ? `\`${r.cold.lastRequest}\`` : "-",
      `${(r.cold?.coldRenders ?? 0) + (r.warm?.coldRenders ?? 0)} of ${r.raw.cold.length + r.raw.warm.length}`,
      !r.cold && !r.warm ? "link not visible" : r.cold?.skeletonStuck || r.warm?.skeletonStuck ? "a skeleton never cleared" : "",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |")
  ),
  ``,
];
writeFileSync(`${stem}.md`, lines.join("\n"));
console.log(`\n  Report: ${stem}.md\n`);
