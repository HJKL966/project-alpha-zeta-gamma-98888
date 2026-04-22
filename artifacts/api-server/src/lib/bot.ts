import TelegramBot from "node-telegram-bot-api";
import { sql } from "drizzle-orm";
import { eq, desc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { getTikTokUser, formatNumber, getRegionLabel, formatDate } from "./tiktok";
import { logger } from "./logger";

const ADMIN_ID = 5543925120;

let bot: TelegramBot | null = null;

type AdminState =
  | { type: "idle" }
  | { type: "awaiting_broadcast" }
  | { type: "awaiting_target_id" }
  | { type: "awaiting_target_message"; targetId: number };

const adminState = new Map<number, AdminState>();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function trackUser(msg: TelegramBot.Message, addPoint: boolean) {
  try {
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

function adminPanelMarkup(): TelegramBot.SendMessageOptions {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📊 إحصائيات", callback_data: "admin:stats" }],
        [{ text: "📢 بث رسالة للجميع", callback_data: "admin:broadcast" }],
        [{ text: "✉️ رسالة لمستخدم محدد", callback_data: "admin:dm" }],
        [{ text: "❌ إغلاق", callback_data: "admin:close" }],
      ],
    },
  };
}

async function sendAdminPanel(chatId: number) {
  await bot!.sendMessage(chatId, "🔧 لوحة الإدارة\nاختر إجراء:", adminPanelMarkup());
}

async function showStats(chatId: number) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable);

  const top = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.points))
    .limit(10);

  const lines = [
    `👥 عدد المستخدمين: <b>${count}</b>`,
    ``,
    `🏆 أعلى 10 نقاط:`,
  ];
  if (top.length === 0) {
    lines.push("لا يوجد مستخدمون بعد.");
  } else {
    top.forEach((u, i) => {
      const name = u.username ? `@${escapeHtml(u.username)}` : escapeHtml(u.firstName ?? String(u.telegramId));
      lines.push(`${i + 1}. ${name} — <code>${u.telegramId}</code> — ${u.points} نقطة`);
    });
  }
  await bot!.sendMessage(chatId, lines.join("\n"), { parse_mode: "HTML" });
}

async function broadcastToAll(text: string): Promise<{ sent: number; failed: number }> {
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
    const chatId = msg.chat.id;
    bot!.sendMessage(
      chatId,
      `🎵 بوت معلومات تيك توك\n\nأرسل يوزر الحساب بدون @ وسأجيب لك معلوماته.\n\nمثال: username`,
    );
  });

  bot.onText(/^\/admin$/, async (msg) => {
    const fromId = msg.from?.id;
    if (fromId !== ADMIN_ID) {
      return;
    }
    adminState.set(fromId, { type: "idle" });
    await sendAdminPanel(msg.chat.id);
  });

  bot.on("callback_query", async (cb) => {
    const fromId = cb.from.id;
    if (fromId !== ADMIN_ID) {
      await bot!.answerCallbackQuery(cb.id);
      return;
    }
    const chatId = cb.message?.chat.id;
    if (!chatId) return;
    const data = cb.data ?? "";

    try {
      if (data === "admin:stats") {
        await bot!.answerCallbackQuery(cb.id);
        await showStats(chatId);
      } else if (data === "admin:broadcast") {
        adminState.set(fromId, { type: "awaiting_broadcast" });
        await bot!.answerCallbackQuery(cb.id);
        await bot!.sendMessage(chatId, "✏️ أرسل الآن الرسالة المراد بثها للجميع.\nأو أرسل /cancel للإلغاء.");
      } else if (data === "admin:dm") {
        adminState.set(fromId, { type: "awaiting_target_id" });
        await bot!.answerCallbackQuery(cb.id);
        await bot!.sendMessage(chatId, "✏️ أرسل ID المستخدم المستهدف.\nأو /cancel للإلغاء.");
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
      adminState.set(fromId, { type: "idle" });
      await bot!.sendMessage(msg.chat.id, "تم الإلغاء.");
    }
  });

  bot.on("message", async (msg) => {
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const fromId = msg.from?.id;

    if (fromId === ADMIN_ID) {
      const state = adminState.get(fromId) ?? { type: "idle" };

      if (state.type === "awaiting_broadcast") {
        adminState.set(fromId, { type: "idle" });
        const status = await bot!.sendMessage(chatId, "📢 جاري البث...");
        const { sent, failed } = await broadcastToAll(msg.text);
        await bot!.editMessageText(`✅ تم البث.\nنجح: ${sent}\nفشل: ${failed}`, {
          chat_id: chatId,
          message_id: status.message_id,
        });
        return;
      }

      if (state.type === "awaiting_target_id") {
        const targetId = Number(msg.text.trim());
        if (!Number.isFinite(targetId) || targetId <= 0) {
          await bot!.sendMessage(chatId, "❌ ID غير صالح. أعد المحاولة أو /cancel.");
          return;
        }
        adminState.set(fromId, { type: "awaiting_target_message", targetId });
        await bot!.sendMessage(chatId, `✏️ أرسل الآن الرسالة لإرسالها إلى ${targetId}.`);
        return;
      }

      if (state.type === "awaiting_target_message") {
        const target = state.targetId;
        adminState.set(fromId, { type: "idle" });
        try {
          await bot!.sendMessage(target, msg.text);
          await bot!.sendMessage(chatId, `✅ أُرسلت الرسالة إلى ${target}.`);
        } catch (err) {
          const m = err instanceof Error ? err.message : "خطأ غير معروف";
          await bot!.sendMessage(chatId, `❌ فشل الإرسال: ${m}`);
        }
        return;
      }
    }

    const username = msg.text.trim().replace(/^@/, "");

    if (!username || username.length < 1) {
      await bot!.sendMessage(chatId, "❌ أرسل يوزر صحيح.");
      return;
    }

    const loading = await bot!.sendMessage(chatId, "⏳ جاري البحث...");

    try {
      const info = await getTikTokUser(username);
      await trackUser(msg, true);

      const verifiedBadge = info.verified ? " ✅" : "";
      const regionLabel = getRegionLabel(info.region);
      const createDateStr = formatDate(info.createTime);
      const lastNameChange = formatDate(info.nickNameModifyTime);

      const reply = [
        `<b>معلومات الحساب</b>`,
        `الدوله : ${escapeHtml(regionLabel)}`,
        `الاسم : ${escapeHtml(info.nickname)}${verifiedBadge}`,
        `اليوزر : ${escapeHtml(info.username)}`,
        `ID : <code>${escapeHtml(info.id)}</code>`,
        `تاريخ إنشاء : ${escapeHtml(createDateStr)}`,
        `آخر تغيير الاسم : ${escapeHtml(lastNameChange)}`,
        `المتابعون : ${formatNumber(info.followers)}`,
        `تابع : ${formatNumber(info.following)}`,
        `الاصدقاء : ${formatNumber(info.friends)}`,
        `——————————`,
        `<a href="https://1l.u">TIKTOK</a>`,
      ].join("\n");

      await bot!.deleteMessage(chatId, loading.message_id);
      await bot!.sendMessage(chatId, reply, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "خطأ غير معروف";
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
