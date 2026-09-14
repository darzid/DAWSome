/**
 * Minimal static file server for local development.
 *
 * The app is a set of plain ES modules plus two JSON data files, so it only
 * needs a server that speaks the right content types and refuses to hand out
 * anything outside the project directory. `npm start` runs this file directly;
 * anything else can import `createServer` and listen on a port of its choosing.
 */
import { createServer as createHttpServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Content types for every kind of file the app ships. */
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mid": "audio/midi",
  ".midi": "audio/midi",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};
const FALLBACK_MIME = "application/octet-stream";

const INDEX_FILE = "index.html";
const DEFAULT_PORT = 8080;

function sendError(res, status, message) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(`${status} ${message}\n`);
}

/**
 * Turn a request URL into an absolute path inside `rootDir`.
 * @returns {{ path: string } | { error: number, message: string }}
 */
function resolveRequestPath(rootDir, requestUrl) {
  let pathname;
  try {
    // The origin is irrelevant; it only lets URL parse the path and drop the query.
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return { error: 400, message: `Bad Request: cannot parse "${requestUrl}".` };
  }
  if (pathname.endsWith("/")) pathname += INDEX_FILE;
  // resolve() normalises away "..", so anything escaping the root lands outside it.
  const path = resolve(rootDir, `.${pathname}`);
  if (path !== rootDir && !path.startsWith(rootDir + sep)) {
    return { error: 403, message: `Forbidden: "${pathname}" is outside the served root.` };
  }
  return { path };
}

async function serveFile(rootDir, req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendError(res, 405, `Method Not Allowed: ${req.method}.`);
    return;
  }

  const resolved = resolveRequestPath(rootDir, req.url);
  if (resolved.error !== undefined) {
    sendError(res, resolved.error, resolved.message);
    return;
  }

  let stats;
  try {
    stats = await stat(resolved.path);
  } catch {
    sendError(res, 404, `Not Found: ${req.url}`);
    return;
  }
  if (!stats.isFile()) {
    sendError(res, 404, `Not Found: ${req.url}`);
    return;
  }

  res.writeHead(200, {
    "Content-Type": MIME_TYPES[extname(resolved.path).toLowerCase()] ?? FALLBACK_MIME,
    "Content-Length": stats.size,
    "Cache-Control": "no-store"
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = createReadStream(resolved.path);
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

/**
 * Create an http.Server that serves the files under `root`.
 * @param {string} root directory to serve
 * @returns {import("node:http").Server}
 */
export function createServer(root) {
  if (typeof root !== "string" || root === "") {
    throw new TypeError("createServer(root) needs a directory path.");
  }
  const rootDir = resolve(root);
  return createHttpServer((req, res) => {
    serveFile(rootDir, req, res).catch((err) => {
      console.error(`Failed to serve ${req.url}`, err);
      if (res.headersSent) res.destroy();
      else sendError(res, 500, "Internal Server Error");
    });
  });
}

// Run directly (`node tools/serve.mjs`), but not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
  createServer(repositoryRoot).listen(port, () => {
    console.log(`DAWSome: serving ${repositoryRoot} on http://localhost:${port}/`);
  });
}
