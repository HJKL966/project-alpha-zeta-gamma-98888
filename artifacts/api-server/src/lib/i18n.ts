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
  country: string;
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
  cmdIdUsage: string;
  cmdVideoUsage: string;
  cmdSearchUsage: string;
  searching: string;
  searchNoResults: string;
  searchResultsHeader: (q: string) => string;
  searchHint: string;
  videoNotResolved: string;
  idNotResolved: string;
}

export const T: Record<Lang, Strings> = {
  ar: {
    start:
      "🎵 بوت معلومات تيك توك\n\nأرسل يوزر الحساب بدون @ وسأجيب لك معلوماته.\nمثال: username\n\n📋 أوامر إضافية:\n/id <رقم_المعرف> — البحث برقم الحساب\n/video <رابط_فيديو> — جلب صاحب الفيديو\n/search <اسم> — البحث بالاسم",
    invalidUser: "❌ أرسل يوزر صحيح.",
    loading: "⏳ جاري البحث...",
    accountInfo: "معلومات الحساب",
    country: "الدوله",
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
    cmdIdUsage: "📌 الاستخدام: /id <رقم_المعرف>\nمثال: /id 6745196765562864646",
    cmdVideoUsage: "📌 الاستخدام: /video <رابط_الفيديو>\nمثال: /video https://www.tiktok.com/@user/video/123",
    cmdSearchUsage: "📌 الاستخدام: /search <اسم_للبحث>\nمثال: /search احمد",
    searching: "🔎 جاري البحث...",
    searchNoResults: "❌ لم يتم العثور على نتائج.",
    searchResultsHeader: (q) => `🔍 نتائج البحث عن: <b>${q}</b>\nاضغط على اليوزر لاستعراض معلوماته:`,
    searchHint: "أرسل اليوزر للحصول على المعلومات الكاملة.",
    videoNotResolved: "❌ تعذر استخراج الحساب من الرابط. تأكد أنه رابط فيديو تيك توك صحيح.",
    idNotResolved: "❌ تعذر العثور على حساب بهذا المعرف.",
  },
  en: {
    start:
      "🎵 TikTok Info Bot\n\nSend a TikTok username without @ and I'll fetch its info.\nExample: username\n\n📋 More commands:\n/id <user_id> — lookup by numeric ID\n/video <video_url> — get the video's author\n/search <name> — search by display name",
    invalidUser: "❌ Please send a valid username.",
    loading: "⏳ Searching...",
    accountInfo: "Account info",
    country: "Country",
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
    cmdIdUsage: "📌 Usage: /id <user_id>\nExample: /id 6745196765562864646",
    cmdVideoUsage: "📌 Usage: /video <video_url>\nExample: /video https://www.tiktok.com/@user/video/123",
    cmdSearchUsage: "📌 Usage: /search <name>\nExample: /search ahmed",
    searching: "🔎 Searching...",
    searchNoResults: "❌ No results found.",
    searchResultsHeader: (q) => `🔍 Search results for: <b>${q}</b>\nTap a username to view its details:`,
    searchHint: "Send the username to get full info.",
    videoNotResolved: "❌ Could not extract account from URL. Make sure it's a valid TikTok video link.",
    idNotResolved: "❌ Could not find an account with this ID.",
  },
  fr: {
    start:
      "🎵 Bot d'infos TikTok\n\nEnvoyez un nom d'utilisateur TikTok sans @ et j'obtiendrai ses infos.\nExemple : username\n\n📋 Commandes supplémentaires :\n/id <id_utilisateur> — recherche par ID\n/video <url_vidéo> — auteur de la vidéo\n/search <nom> — recherche par nom",
    invalidUser: "❌ Envoyez un nom d'utilisateur valide.",
    loading: "⏳ Recherche...",
    accountInfo: "Infos du compte",
    country: "Pays",
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
    cmdIdUsage: "📌 Utilisation : /id <id_utilisateur>\nExemple : /id 6745196765562864646",
    cmdVideoUsage: "📌 Utilisation : /video <url_vidéo>\nExemple : /video https://www.tiktok.com/@user/video/123",
    cmdSearchUsage: "📌 Utilisation : /search <nom>\nExemple : /search ahmed",
    searching: "🔎 Recherche...",
    searchNoResults: "❌ Aucun résultat trouvé.",
    searchResultsHeader: (q) => `🔍 Résultats pour : <b>${q}</b>\nAppuyez sur un nom pour voir ses détails :`,
    searchHint: "Envoyez le nom d'utilisateur pour obtenir les infos complètes.",
    videoNotResolved: "❌ Impossible d'extraire le compte. Vérifiez que c'est un lien vidéo TikTok valide.",
    idNotResolved: "❌ Aucun compte trouvé avec cet ID.",
  },
};
