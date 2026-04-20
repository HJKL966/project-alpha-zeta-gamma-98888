import TelegramBot from "node-telegram-bot-api";
import { getTikTokUser, formatNumber, getRegionLabel, formatDate } from "./tiktok";
import { logger } from "./logger";

let bot: TelegramBot | null = null;

export function startBot() {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN is not set — bot will not start");
    return;
  }

  bot = new TelegramBot(token, { polling: true });
  logger.info("Telegram bot started (polling)");

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot!.sendMessage(
      chatId,
      `🎵 *بوت معلومات تيك توك*\n\nأرسل لي يوزر الحساب بدون @ وسأجيب لك معلوماته الكاملة.\n\nمثال: \`username\``,
      { parse_mode: "Markdown" }
    );
  });

  bot.on("message", async (msg) => {
    if (!msg.text) return;
    if (msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const username = msg.text.trim().replace(/^@/, "");

    if (!username || username.length < 2) {
      await bot!.sendMessage(chatId, "❌ أرسل يوزر صحيح.");
      return;
    }

    const loading = await bot!.sendMessage(chatId, "⏳ جاري البحث...");

    try {
      const info = await getTikTokUser(username);

      const verifiedBadge = info.verified ? " ✅" : "";
      const regionLabel = info.region ? getRegionLabel(info.region) : "غير محدد";
      const createDateStr = info.createTime ? formatDate(info.createTime) : "غير متوفر";

      const text =
        `- Done sir .\n` +
        ` - By : @YourBot Ch : @YourChannel .\n` +
        ` - الدولة (${regionLabel})•\n` +
        ` - الانشاء (${createDateStr})•\n` +
        ` - ايدي (${info.id})•\n` +
        ` - متابعهم (${formatNumber(info.following)})•\n` +
        ` - متابعين (${formatNumber(info.followers)})•\n` +
        ` - الاسم (${info.nickname}${verifiedBadge})•\n` +
        (info.bio ? ` - البايو (${info.bio})•\n` : "") +
        ` - الاعجابات (${formatNumber(info.likes)})•`;

      await bot!.deleteMessage(chatId, loading.message_id);
      await bot!.sendMessage(chatId, text);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "خطأ غير معروف";
      logger.error({ err, username }, "Failed to fetch TikTok user");
      await bot!.deleteMessage(chatId, loading.message_id);
      await bot!.sendMessage(chatId, `❌ ${errorMsg}`);
    }
  });

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });
}

export function stopBot() {
  if (bot) {
    bot.stopPolling();
    bot = null;
    logger.info("Telegram bot stopped");
  }
}
