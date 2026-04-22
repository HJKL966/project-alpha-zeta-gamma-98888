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
                        `🎵 بوت معلومات تيك توك\n\nأرسل يوزر الحساب بدون @ وسأجيب لك معلوماته.\n\nمثال: username`,
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
                        const regionLabel = getRegionLabel(info.region);
                        const createDateStr = formatDate(info.createTime);
                        const lastNameChange = formatDate(info.nickNameModifyTime);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      const lastUsernameChange = formatDate(info.uniqueIdModifyTime);

      const reply = [
        `معلومات الحساب`,
        `الدوله : ${regionLabel}`,
        `الاسم : ${info.nickname}${verifiedBadge}`,
        `اليوزر : ${info.username}`,
        `\u200F: ID ${info.id}`,
        `تاريخ إنشاء : ${createDateStr}`,
        `آخر تغيير الاسم : ${lastNameChange}`,
        `آخر تغيير اليوزر : ${lastUsernameChange}`,
        `المتابعون : ${formatNumber(info.followers)}`,
        `تابع : ${formatNumber(info.following)}`,
        `الاصدقاء : ${formatNumber(info.friends)}`,
      ].join("\n");

      await bot!.deleteMessage(chatId, loading.message_id);
      await bot!.sendMessage(chatId, reply, { disable_web_page_preview: true });
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
