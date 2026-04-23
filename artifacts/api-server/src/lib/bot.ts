import TelegramBot from "node-telegram-bot-api";
import { sql, desc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getTikTokUser, formatNumber, getRegionLabel, formatDate } from "./tiktok";
import { logger } from "./logger";
import { detectLang, T, type Lang } from "./i18n";

const ADMIN_ID = 5543925120;
const TIKTOK_URL = "https://1l.u";

let bot: TelegramBot | null = null;

type AdminState =
  | { type: "idle" }
  | { type: "awaiting_broadcast" }
  | { type: "awaiting_target_id" }
  | { type: "awaiting_target_message"; targetId: number };

const adminState = new Map<number, AdminState>();
const userLang = new Map<number, Lang>();

function langOf(msg: TelegramBot.Message): Lang {
  const tgId = msg.from?.id;
  const detected = detectLang({
    languageCode: msg.from?.language_code,
    text: msg.text,
  });
  if (tgId) userLang.set(tgId, detected);
  return detected;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function trackUser(msg: TelegramBot.Message, addPoint: boolean) {
  try {
    if (!db) return;
    const tgId = msg.from?.id;
    if (!tgId) return;
    const username = msg.from?.username ?? null;
    const firstName = msg.from?.first_name ?? null;

    await db
      .insert(usersTable)
      .values({
        telegramId: tgId,
        username,
        firstName,
        points: addPoint ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: usersTable.telegramId,
        set: {
          username,
          firstName,
          lastSeen: new Date(),
          ...(addPoint ? { points: sql`${usersTable.points} + 1` } : {}),
        },
      });
  } catch (err) {
    logger.error({ err }, "Failed to track user");
  }
}

function adminPanelMarkup(lang: Lang): TelegramBot.SendMessageOptions {
  const t = T[lang];
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: t.btnStats, callback_data: "admin:stats" }],
        [{ text: t.btnBroadcast, callback_data: "admin:broadcast" }],
        [{ text: t.btnDm, callback_data: "admin:dm" }],
        [{ text: t.btnClose, callback_data: "admin:close" }],
      ],
    },
  };
}

async function sendAdminPanel(chatId: number, lang: Lang) {
  await bot!.sendMessage(chatId, T[lang].adminPanelTitle, adminPanelMarkup(lang));
}

async function showStats(chatId: number, lang: Lang) {
  const t = T[lang];
  if (!db) {
    await bot!.sendMessage(chatId, t.dbDisabled);
    return;
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable);

  const top = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.points))
    .limit(10);

  const lines = [t.statsUserCount(count), ``, t.statsTopHeader];
  if (top.length === 0) {
    lines.push(t.statsEmpty);
  } else {
    top.forEach((u, i) => {
      const name = u.username
        ? `@${escapeHtml(u.username)}`
        : escapeHtml(u.firstName ?? String(u.telegramId));
      lines.push(`${i + 1}. ${name} — <code>${u.telegramId}</code> — ${u.points} ${t.pointsLabel}`);
    });
  }
  await bot!.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML" });
}

async function broadcastToAll(text: string): Promise<{ sent: number; failed: number }> {
  if (!db) return { sent: 0, failed: 0 };
  const all = await db.select({ id: usersTable.telegramId }).from(usersTable);
  let sent = 0;
  let failed = 0;
  for (const u of all) {
    try {
      await bot!.sendMessage(u.id, text);
      sent++;
      await new Promise((r) => setTimeout(r, 40));
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}

export function startBot() {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN is not set — bot will not start");
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  logger.info("Telegram bot started (polling)");

  bot.onText(/^\/start$/, async (msg) => {
    await trackUser(msg, false);
    const lang = langOf(msg);
    bot!.sendMessage(msg.chat.id, T[lang].start);
  });

  bot.onText(/^\/admin$/, async (msg) => {
    const fromId = msg.from?.id;
    if (fromId !== ADMIN_ID) return;
    const lang = langOf(msg);
    adminState.set(fromId, { type: "idle" });
    await sendAdminPanel(msg.chat.id, lang);
  });

  bot.on("callback_query", async (cb) => {
    const fromId = cb.from.id;
    if (fromId !== ADMIN_ID) {
      await bot!.answerCallbackQuery(cb.id);
      return;
    }
    const chatId = cb.message?.chat.id;
    if (!chatId) return;
    const lang =
      userLang.get(fromId) ??
      detectLang({ languageCode: cb.from.language_code });
    const t = T[lang];
    const data = cb.data ?? "";

    try {
      if (data === "admin:stats") {
        await bot!.answerCallbackQuery(cb.id);
        await showStats(chatId, lang);
      } else if (data === "admin:broadcast") {
        adminState.set(fromId, { type: "awaiting_broadcast" });
        await bot!.answerCallbackQuery(cb.id);
        await bot!.sendMessage(chatId, t.promptBroadcast);
      } else if (data === "admin:dm") {
        adminState.set(fromId, { type: "awaiting_target_id" });
        await bot!.answerCallbackQuery(cb.id);
        await bot!.sendMessage(chatId, t.promptTargetId);
      } else if (data === "admin:close") {
        adminState.set(fromId, { type: "idle" });
        await bot!.answerCallbackQuery(cb.id);
        if (cb.message) {
          await bot!.deleteMessage(chatId, cb.message.message_id).catch(() => {});
        }
      }
    } catch (err) {
      logger.error({ err }, "callback_query error");
    }
  });

  bot.onText(/^\/cancel$/, async (msg) => {
    const fromId = msg.from?.id;
    if (fromId === ADMIN_ID) {
      const lang = langOf(msg);
      adminState.set(fromId, { type: "idle" });
      await bot!.sendMessage(msg.chat.id, T[lang].cancelled);
    }
  });

  bot.on("message", async (msg) => {
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const fromId = msg.from?.id;
    const lang = langOf(msg);
    const t = T[lang];

    if (fromId === ADMIN_ID) {
      const state = adminState.get(fromId) ?? { type: "idle" };

      if (state.type === "awaiting_broadcast") {
        adminState.set(fromId, { type: "idle" });
        const status = await bot!.sendMessage(chatId, t.broadcasting);
        const { sent, failed } = await broadcastToAll(msg.text);
        await bot!.editMessageText(t.broadcastDone(sent, failed), {
          chat_id: chatId,
          message_id: status.message_id,
        });
        return;
      }

      if (state.type === "awaiting_target_id") {
        const targetId = Number(msg.text.trim());
        if (!Number.isFinite(targetId) || targetId <= 0) {
          await bot!.sendMessage(chatId, t.invalidId);
          return;
        }
        adminState.set(fromId, { type: "awaiting_target_message", targetId });
        await bot!.sendMessage(chatId, t.promptTargetMessage(targetId));
        return;
      }

      if (state.type === "awaiting_target_message") {
        const target = state.targetId;
        adminState.set(fromId, { type: "idle" });
        try {
          await bot!.sendMessage(target, msg.text);
          await bot!.sendMessage(chatId, t.dmSent(target));
        } catch (err) {
          const m = err instanceof Error ? err.message : t.unknownError;
          await bot!.sendMessage(chatId, t.dmFailed(m));
        }
        return;
      }
    }

    const username = msg.text.trim().replace(/^@/, "");

    if (!username || username.length < 1) {
      await bot!.sendMessage(chatId, t.invalidUser);
      return;
    }

    const loading = await bot!.sendMessage(chatId, t.loading);

    try {
      const info = await getTikTokUser(username);
      await trackUser(msg, true);

      const verifiedBadge = info.verified ? " ✅" : "";
      const regionLabel = getRegionLabel(info.region, t.notAvailable);
      const createDateStr = formatDate(info.createTime, t.notAvailable);
      const lastNameChange = formatDate(info.nickNameModifyTime, t.notAvailable);

      const reply = [
        `<b>${t.accountInfo}</b>`,
        `${t.country} : ${escapeHtml(regionLabel)}`,
        `${t.name} : ${escapeHtml(info.nickname)}${verifiedBadge}`,
        `${t.username} : ${escapeHtml(info.username)}`,
        `${t.id} : <code>${escapeHtml(info.id)}</code>`,
        `${t.createdAt} : ${escapeHtml(createDateStr)}`,
        `${t.lastNameChange} : ${escapeHtml(lastNameChange)}`,
        `${t.followers} : ${formatNumber(info.followers)}`,
        `${t.following} : ${formatNumber(info.following)}`,
        `${t.friends} : ${formatNumber(info.friends)}`,
        `——————————`,
        `TikTok : <a href="${TIKTOK_URL}">${TIKTOK_URL.replace(/^https?:\/\//, "")}</a>`,
      ].join("\n");

      await bot!.deleteMessage(chatId, loading.message_id);
      await bot!.sendMessage(chatId, reply, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : t.unknownError;
      const errorMsg = raw === "__NOT_FOUND__" ? t.notFound : raw;
      logger.error({ err, username }, "Failed to fetch TikTok user");
      await bot!.deleteMessage(chatId, loading.message_id).catch(() => {});
      await bot!.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error — restarting in 10s");
    setTimeout(() => {
      if (bot) {
        bot.stopPolling().then(() => {
          bot!.startPolling();
          logger.info("Telegram polling restarted");
        }).catch(() => {
          stopBot();
          startBot();
        });
      }
    }, 10_000);
  });
}

export function stopBot() {
  if (bot) {
    bot.stopPolling();
    bot = null;
    logger.info("Telegram bot stopped");
  }
}
