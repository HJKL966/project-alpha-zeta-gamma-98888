import https from "https";
import http from "http";
import { logger } from "./logger";

const HTTP_INTERVAL_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 15 * 1000;

let heartbeatCount = 0;

function getSelfUrl(): string | null {
  // Render sets this automatically
  const renderUrl = process.env["RENDER_EXTERNAL_URL"];
  if (renderUrl) return `${renderUrl}/api/healthz`;

  // Replit domains
  const replitDomains = process.env["REPLIT_DOMAINS"] ?? process.env["REPLIT_DEV_DOMAIN"] ?? "";
  const firstDomain = replitDomains.split(",")[0]?.trim();
  if (firstDomain) return `https://${firstDomain}/api/healthz`;

  return null;
}

function ping(url: string) {
  const client = url.startsWith("https") ? https : http;
  const req = client.get(url, (res) => {
    logger.info({ statusCode: res.statusCode }, "Keepalive ping OK");
    res.resume();
  });
  req.on("error", (err) => {
    logger.warn({ err: err.message }, "Keepalive ping failed — retrying next interval");
  });
  req.setTimeout(10000, () => {
    req.destroy();
  });
}

export function startKeepalive() {
  // 15-second heartbeat — keeps Node.js event loop alive
  setInterval(() => {
    heartbeatCount++;
    logger.debug({ heartbeatCount }, "Bot heartbeat — alive");
  }, HEARTBEAT_INTERVAL_MS);

  const url = getSelfUrl();

  if (!url) {
    logger.warn("No self URL found (RENDER_EXTERNAL_URL / REPLIT_DOMAINS not set) — HTTP keepalive disabled");
    return;
  }

  logger.info({ url, intervalMinutes: 5 }, "HTTP keepalive started");

  // Ping immediately on start then every 5 minutes
  ping(url);
  setInterval(() => {
    ping(url);
  }, HTTP_INTERVAL_MS);
}
