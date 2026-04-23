export type Lang = "ar" | "en" | "fr";

export function detectLang(input: {
  languageCode?: string;
  text?: string;
}): Lang {
  const code = (input.languageCode ?? "").toLowerCase();
  if (code.startsWith("ar")) return "ar";
  if (code.startsWith("fr")) return "fr";
  if (code.startsWith("en")) return "en";

  const text = input.text ?? "";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[àâçéèêëîïôûùüÿœæ]/i.test(text)) return "fr";
  return "en";
}

interface Strings {
  start: string;
  invalidUser: string;
  loading: string;
  accountInfo: string;
  name: string;
  username: string;
  id: string;
  createdAt: string;
  lastNameChange: string;
  followers: string;
  following: string;
  friends: string;
  notFound: string;
  unknownError: string;
  cancelled: string;
  adminPanelTitle: string;
  btnStats: string;
  btnBroadcast: string;
  btnDm: string;
  btnClose: string;
  promptBroadcast: string;
  promptTargetId: string;
  invalidId: string;
  promptTargetMessage: (id: number) => string;
  broadcasting: string;
  broadcastDone: (sent: number, failed: number) => string;
  dmSent: (id: number) => string;
  dmFailed: (msg: string) => string;
  statsUserCount: (n: number) => string;
  statsTopHeader: string;
  statsEmpty: string;
  pointsLabel: string;
  dbDisabled: string;
  notAvailable: string;
}

export const T: Record<Lang, Strings> = {
  ar: {
    start:
      "🎵 بوت معلومات تيك توك\n\nأرسل يوزر الحساب بدون @ وسأجيب لك معلوماته.\n\nمثال: username",
    invalidUser: "❌ أرسل يوزر صحيح.",
    loading: "⏳ جاري البحث...",
    accountInfo: "معلومات الحساب",
    name: "الاسم",
    username: "اليوزر",
    id: "ID",
    createdAt: "تاريخ الإنشاء",
    lastNameChange: "آخر تغيير للاسم",
    followers: "المتابعون",
    following: "يتابع",
    friends: "الأصدقاء",
    notFound: "الحساب غير موجود أو خاص.",
    unknownError: "خطأ غير معروف",
    cancelled: "تم الإلغاء.",
    adminPanelTitle: "🔧 لوحة الإدارة\nاختر إجراء:",
    btnStats: "📊 إحصائيات",
    btnBroadcast: "📢 بث رسالة للجميع",
    btnDm: "✉️ رسالة لمستخدم محدد",
    btnClose: "❌ إغلاق",
    promptBroadcast: "✏️ أرسل الآن الرسالة المراد بثها للجميع.\nأو /cancel للإلغاء.",
    promptTargetId: "✏️ أرسل ID المستخدم المستهدف.\nأو /cancel للإلغاء.",
    invalidId: "❌ ID غير صالح. أعد المحاولة أو /cancel.",
    promptTargetMessage: (id) => `✏️ أرسل الآن الرسالة لإرسالها إلى ${id}.`,
    broadcasting: "📢 جاري البث...",
    broadcastDone: (sent, failed) => `✅ تم البث.\nنجح: ${sent}\nفشل: ${failed}`,
    dmSent: (id) => `✅ أُرسلت الرسالة إلى ${id}.`,
    dmFailed: (m) => `❌ فشل الإرسال: ${m}`,
    statsUserCount: (n) => `👥 عدد المستخدمين: <b>${n}</b>`,
    statsTopHeader: "🏆 أعلى 10 نقاط:",
    statsEmpty: "لا يوجد مستخدمون بعد.",
    pointsLabel: "نقطة",
    dbDisabled: "⚠️ قاعدة البيانات غير مفعّلة.",
    notAvailable: "غير متوفر",
  },
  en: {
    start:
      "🎵 TikTok Info Bot\n\nSend a TikTok username without @ and I'll fetch its info.\n\nExample: username",
    invalidUser: "❌ Please send a valid username.",
    loading: "⏳ Searching...",
    accountInfo: "Account info",
    name: "Name",
    username: "Username",
    id: "ID",
    createdAt: "Created at",
    lastNameChange: "Last name change",
    followers: "Followers",
    following: "Following",
    friends: "Friends",
    notFound: "Account not found or private.",
    unknownError: "Unknown error",
    cancelled: "Cancelled.",
    adminPanelTitle: "🔧 Admin panel\nChoose an action:",
    btnStats: "📊 Stats",
    btnBroadcast: "📢 Broadcast to all",
    btnDm: "✉️ Message a user",
    btnClose: "❌ Close",
    promptBroadcast: "✏️ Send the broadcast message now.\nOr /cancel to abort.",
    promptTargetId: "✏️ Send the target user ID.\nOr /cancel to abort.",
    invalidId: "❌ Invalid ID. Try again or /cancel.",
    promptTargetMessage: (id) => `✏️ Now send the message to deliver to ${id}.`,
    broadcasting: "📢 Broadcasting...",
    broadcastDone: (sent, failed) => `✅ Done.\nSent: ${sent}\nFailed: ${failed}`,
    dmSent: (id) => `✅ Message delivered to ${id}.`,
    dmFailed: (m) => `❌ Send failed: ${m}`,
    statsUserCount: (n) => `👥 Users: <b>${n}</b>`,
    statsTopHeader: "🏆 Top 10 by points:",
    statsEmpty: "No users yet.",
    pointsLabel: "pts",
    dbDisabled: "⚠️ Database is not configured.",
    notAvailable: "N/A",
  },
  fr: {
    start:
      "🎵 Bot d'infos TikTok\n\nEnvoyez un nom d'utilisateur TikTok sans @ et j'obtiendrai ses infos.\n\nExemple : username",
    invalidUser: "❌ Envoyez un nom d'utilisateur valide.",
    loading: "⏳ Recherche...",
    accountInfo: "Infos du compte",
    name: "Nom",
    username: "Utilisateur",
    id: "ID",
    createdAt: "Créé le",
    lastNameChange: "Dernier changement de nom",
    followers: "Abonnés",
    following: "Abonnements",
    friends: "Amis",
    notFound: "Compte introuvable ou privé.",
    unknownError: "Erreur inconnue",
    cancelled: "Annulé.",
    adminPanelTitle: "🔧 Panneau d'administration\nChoisissez une action :",
    btnStats: "📊 Statistiques",
    btnBroadcast: "📢 Diffuser à tous",
    btnDm: "✉️ Message à un utilisateur",
    btnClose: "❌ Fermer",
    promptBroadcast: "✏️ Envoyez le message à diffuser.\nOu /cancel pour annuler.",
    promptTargetId: "✏️ Envoyez l'ID de l'utilisateur cible.\nOu /cancel pour annuler.",
    invalidId: "❌ ID invalide. Réessayez ou /cancel.",
    promptTargetMessage: (id) => `✏️ Envoyez maintenant le message à livrer à ${id}.`,
    broadcasting: "📢 Diffusion...",
    broadcastDone: (sent, failed) => `✅ Terminé.\nEnvoyés : ${sent}\nÉchoués : ${failed}`,
    dmSent: (id) => `✅ Message livré à ${id}.`,
    dmFailed: (m) => `❌ Échec de l'envoi : ${m}`,
    statsUserCount: (n) => `👥 Utilisateurs : <b>${n}</b>`,
    statsTopHeader: "🏆 Top 10 par points :",
    statsEmpty: "Aucun utilisateur pour le moment.",
    pointsLabel: "pts",
    dbDisabled: "⚠️ Base de données non configurée.",
    notAvailable: "N/D",
  },
};
