import https from "https";
import http from "http";
import { logger } from "./logger";

const INTERVAL_MS = 4 * 60 * 1000; // كل 4 دقائق

function getSelfUrl(): string | null {
  const domains = process.env["REPLIT_DOMAINS"] ?? process.env["REPLIT_DEV_DOMAIN"] ?? "";
  const firstDomain = domains.split(",")[0]?.trim();
  if (!firstDomain) return null;
  return `https://${firstDomain}/api/healthz`;
}

function ping(url: string) {
  const client = url.startsWith("https") ? https : http;
  const req = client.get(url, (res) => {
    logger.info({ statusCode: res.statusCode }, "Keepalive ping OK");
    res.resume();
  });
  req.on("error", (err) => {
    logger.warn({ err: err.message }, "Keepalive ping failed — will retry next interval");
  });
  req.setTimeout(10000, () => {
    req.destroy();
  });
}

export function startKeepalive() {
  const url = getSelfUrl();
  if (!url) {
    logger.warn("REPLIT_DOMAINS not set — keepalive disabled");
    return;
  }

  logger.info({ url, intervalMinutes: 4 }, "Keepalive started");

  setInterval(() => {
    ping(url);
  }, INTERVAL_MS);
}
