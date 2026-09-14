/**
 * DAWSome headless smoke test.
 *
 * Purpose
 *   Boots the app the way a browser would — a real static server in front of the repository
 *   root, a real Chromium page loading index.html, Tone.js from cdnjs and src/main.js as an
 *   ES module — then asserts that the shell came up: three demo tracks, the three panel tabs,
 *   device cards with parameter rows, mixer strips, and a transport that responds to the
 *   Space key. It is a wiring check, not a unit test: it fails loudly when the module graph,
 *   the DOM contract or the browser console goes wrong.
 *
 * Usage
 *   node tools/smoke.mjs
 *
 * Environment variables
 *   SMOKE_HEADLESS=0          Run Chromium headed so you can watch the run (default: headless).
 *   SMOKE_TIMEOUT=<ms>        Per-operation timeout in milliseconds (default: 20000).
 *   SMOKE_SCREENSHOT=<path>   Write a full-page screenshot to <path> after the checks.
 *
 * Output
 *   A JSON summary { url, passed, failed, results, consoleErrors } on stdout.
 *   Exit code 0 when every check passed, 1 otherwise.
 *
 * Dependencies
 *   Node built-ins plus Playwright (loaded from the global install at
 *   /opt/node22/lib/node_modules/playwright, falling back to a local resolution).
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

import { createServer } from "./serve.mjs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Repository root: this file lives in <root>/tools/. */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Headed mode is opt-in via SMOKE_HEADLESS=0. */
const HEADLESS = process.env.SMOKE_HEADLESS !== "0";

/** Timeout for navigation, waits and clicks. Falls back to 20s on a missing/bad value. */
const TIMEOUT = (() => {
  const raw = Number(process.env.SMOKE_TIMEOUT);
  return Number.isFinite(raw) && raw > 0 ? raw : 20000;
})();

/** Optional screenshot destination. */
const SCREENSHOT = process.env.SMOKE_SCREENSHOT || "";

/** Expected shape of the demo project / UI, per the app contract. */
const EXPECTED_TRACKS = ["Kick", "Bass", "ClosedHat"];
const EXPECTED_TABS = ["Clip editor", "Devices", "Mixer"];

/** Transport button glyphs: ■ while playing, ▶ while stopped. */
const GLYPH_STOP = "■";
const GLYPH_PLAY = "▶";

// ---------------------------------------------------------------------------
// Playwright
// ---------------------------------------------------------------------------

let chromium;
try {
  // Prefer the global Playwright install (its browsers live under PLAYWRIGHT_BROWSERS_PATH).
  const require = createRequire("/opt/node22/lib/node_modules/playwright/package.json");
  ({ chromium } = require("playwright"));
} catch {
  // Fall back to whatever "playwright" resolves to for this project.
  ({ chromium } = await import("playwright"));
}

// ---------------------------------------------------------------------------
// Result collection
// ---------------------------------------------------------------------------

/** @type {{ name: string, ok: boolean, detail: string }[]} */
const results = [];

/** Console errors and uncaught page errors — these fail the run. */
/** @type {{ type: string, text: string, location: string }[]} */
const consoleErrors = [];

/** Console warnings — collected for context, but they do not fail the run. */
/** @type {{ type: string, text: string, location: string }[]} */
const consoleWarnings = [];

/**
 * Run one check. The callback may return `true` / `undefined` for a pass, or an
 * object `{ ok, detail }`. Anything it throws is recorded as a failure, so a
 * broken check never aborts the run before the summary is printed.
 */
async function check(name, fn) {
  let entry;
  try {
    const out = await fn();
    if (out === true || out === undefined) entry = { name, ok: true, detail: "" };
    else entry = { name, ok: Boolean(out && out.ok), detail: String((out && out.detail) || "") };
  } catch (err) {
    entry = { name, ok: false, detail: `threw: ${err && err.message ? err.message : String(err)}` };
  }
  results.push(entry);
  return entry.ok;
}

/** Build a `{ ok, detail }` from a deep-equality assertion. */
function expect(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  return { ok: a === e, detail: a === e ? `${label} = ${a}` : `${label}: expected ${e}, got ${a}` };
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let url = "";
let server = null;
let browser = null;

try {
  // --- static server on an ephemeral loopback port ---------------------------
  server = createServer(ROOT);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address !== "object") {
    throw new Error("server.address() did not return an AddressInfo object");
  }
  url = `http://127.0.0.1:${address.port}/`;

  // --- browser ---------------------------------------------------------------
  browser = await chromium.launch({
    headless: HEADLESS,
    // Let the transport start audio without a click, and keep the machine quiet.
    args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT);

  // Collect console noise before navigating, so nothing from boot is missed.
  page.on("console", (msg) => {
    const type = msg.type();
    if (type !== "error" && type !== "warning") return;
    const loc = msg.location();
    const entry = {
      type,
      text: msg.text(),
      location: loc && loc.url ? `${loc.url}:${loc.lineNumber}:${loc.columnNumber}` : "",
    };
    (type === "error" ? consoleErrors : consoleWarnings).push(entry);
  });
  page.on("pageerror", (err) => {
    consoleErrors.push({
      type: "pageerror",
      text: err && err.stack ? err.stack : String(err),
      location: "",
    });
  });

  // --- page helpers (defined before use; they close over `page`) --------------

  /** Trimmed labels of the tab-strip buttons, in DOM order. */
  const tabLabels = () =>
    page.$$eval("#tabStrip button.btn", (els) => els.map((el) => (el.textContent || "").trim()));

  /** Click the tab whose trimmed label matches exactly. */
  const clickTab = async (label) => {
    const labels = await tabLabels();
    const index = labels.indexOf(label);
    if (index < 0) throw new Error(`tab "${label}" not found; tabs are ${JSON.stringify(labels)}`);
    await page.locator("#tabStrip button.btn").nth(index).click();
  };

  /** Computed `display` of the first element matching `selector`. */
  const displayOf = (selector) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).display : "<missing>";
    }, selector);

  /** Trimmed text content of the first element matching `selector`. */
  const textOf = (selector) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? (el.textContent || "").trim() : "<missing>";
    }, selector);

  /**
   * Press Space on the document and give the UI 300 ms to settle. Focus is dropped
   * first so the key reaches the global transport shortcut rather than re-activating
   * a button clicked by an earlier check.
   */
  const pressSpace = async () => {
    await page.evaluate(() => {
      const el = document.activeElement;
      if (el && el !== document.body && typeof el.blur === "function") el.blur();
    });
    await page.keyboard.press("Space");
    await sleep(300);
  };

  // --- boot -------------------------------------------------------------------
  await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT });
  await page.waitForFunction(
    () => globalThis.dawsome && globalThis.dawsome.started === true,
    null,
    { timeout: TIMEOUT },
  );

  // --- checks -----------------------------------------------------------------

  // Tone.js actually loaded from the CDN.
  await check("Tone.js loaded", async () => {
    const toneType = await page.evaluate(() => typeof globalThis.Tone);
    return {
      ok: toneType === "function" || toneType === "object",
      detail: `typeof Tone = ${toneType}`,
    };
  });

  // Three demo tracks, in order, with the expected names.
  await check("3 demo tracks with expected names", async () => {
    const names = await page.$$eval("#trackHeaders .track", (els) =>
      els.map((el) => {
        const input = el.querySelector("input.name");
        return input ? input.value : null;
      }),
    );
    return expect(names, EXPECTED_TRACKS, "track names");
  });

  // Tab strip: one button per panel, in order.
  await check("tab strip has the 3 panel tabs", async () => {
    const labels = await tabLabels();
    return expect(labels, EXPECTED_TABS, "tab labels");
  });

  // The clip editor is the panel shown on boot.
  await check("clip editor panel visible on boot", async () => {
    const display = await displayOf("#clipEditorPanel");
    return { ok: display === "flex", detail: `#clipEditorPanel display = ${display}` };
  });

  // The Devices tab swaps panels and renders device cards with parameter rows.
  await check("Devices tab shows device cards with param rows", async () => {
    await clickTab("Devices");
    const state = await page.evaluate(() => {
      const devices = document.querySelector("#devicesPanel");
      const clipEditor = document.querySelector("#clipEditorPanel");
      return {
        devicesDisplay: devices ? getComputedStyle(devices).display : "<missing>",
        clipEditorDisplay: clipEditor ? getComputedStyle(clipEditor).display : "<missing>",
        cards: document.querySelectorAll("#devicesPanel .device-card").length,
        rows: document.querySelectorAll("#devicesPanel .device-card .param-row").length,
      };
    });
    const ok =
      state.devicesDisplay === "flex" &&
      state.clipEditorDisplay === "none" &&
      state.cards >= 1 &&
      state.rows >= 1;
    return { ok, detail: JSON.stringify(state) };
  });

  // The Mixer tab shows one strip per track.
  await check("Mixer tab shows 3 strips", async () => {
    await clickTab("Mixer");
    const count = await page.$$eval("#mixerPanel .mixer-strip", (els) => els.length);
    return expect(count, 3, "mixer strip count");
  });

  // Space toggles the transport in both directions.
  await check("Space toggles transport", async () => {
    await pressSpace();
    const playing = await textOf("#playBtn");
    await pressSpace();
    const stopped = await textOf("#playBtn");
    const ok = playing === GLYPH_STOP && stopped === GLYPH_PLAY;
    return { ok, detail: `#playBtn after first Space = "${playing}", after second = "${stopped}"` };
  });

  // The position readout keeps its bar.beat.tick shape.
  await check("position readout is bar.beat.tick", async () => {
    const pos = await textOf("#posReadout");
    return { ok: /^\d+\.\d+\.\d+$/.test(pos), detail: `#posReadout = "${pos}"` };
  });

  // Nothing blew up in the console during any of the above.
  await check("no console errors", () => {
    const warned = consoleWarnings.length ? ` (${consoleWarnings.length} warning(s) ignored)` : "";
    return {
      ok: consoleErrors.length === 0,
      detail: consoleErrors.length
        ? consoleErrors
            .map((e) => `[${e.type}] ${e.text}${e.location ? ` @ ${e.location}` : ""}`)
            .join("\n")
        : `clean${warned}`,
    };
  });

  // --- optional screenshot -----------------------------------------------------
  if (SCREENSHOT) {
    await page.screenshot({ path: SCREENSHOT, fullPage: true });
  }
} catch (err) {
  // Anything that escaped the individual checks (server, launch or boot failure).
  results.push({
    name: "harness",
    ok: false,
    detail: err && err.stack ? err.stack : String(err),
  });
} finally {
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* ignore teardown errors */
    }
  }
  if (server) {
    try {
      // Drop any socket the browser left behind so close() cannot hang.
      if (typeof server.closeAllConnections === "function") server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    } catch {
      /* ignore teardown errors */
    }
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;

console.log(JSON.stringify({ url, passed, failed, results, consoleErrors }, null, 2));

process.exit(failed ? 1 : 0);
