import https from "https";
import http from "http";
import { logger } from "./logger";

const HTTP_INTERVAL_MS = 4 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 15 * 1000;

let heartbeatCount = 0;

function getSelfUrl(): string | null {
  const domains = process.env["REPLIT_DOMAINS"] ?? process.env["REPLIT_DEV_DOMAIN"] ?? "";
  const firstDomain = domains.split(",")[0]?.trim();
  if (!firstDomain) return null;
  return `https://${firstDomain}/api/healthz`;
}

function ping(url: string) {
  const client = url.startsWith("https") ? https : http;
  const req = client.get(url, (res) => {
    logger.info({ statusCode: res.statusCode }, "Keepalive HTTP ping OK");
    res.resume();
  });
  req.on("error", (err) => {
    logger.warn({ err: err.message }, "Keepalive HTTP ping failed — will retry next interval");
  });
  req.setTimeout(10000, () => {
    req.destroy();
  });
}

export function startKeepalive() {
  const url = getSelfUrl();

  setInterval(() => {
    heartbeatCount++;
    logger.debug({ heartbeatCount }, "Bot heartbeat — alive");
  }, HEARTBEAT_INTERVAL_MS);

  if (!url) {
    logger.warn("REPLIT_DOMAINS not set — HTTP keepalive disabled, heartbeat only");
    return;
  }

  logger.info({ url, httpIntervalMinutes: 4, heartbeatIntervalSec: 15 }, "Keepalive started");

  setInterval(() => {
    ping(url);
  }, HTTP_INTERVAL_MS);
}
