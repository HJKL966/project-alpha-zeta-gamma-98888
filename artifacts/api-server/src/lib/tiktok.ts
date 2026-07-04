import axios from "axios";

export interface TikTokUserInfo {
  username: string;
  nickname: string;
  bio: string;
  following: number;
  followers: number;
  friends: number;
  likes: number;
  verified: boolean;
  region: string;
  avatar: string;
  id: string;
  createTime?: number;
  nickNameModifyTime?: number;
  uniqueIdModifyTime?: number;
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  Referer: "https://www.tiktok.com/",
};

const API_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  Referer: "https://www.tiktok.com/",
};

type ExtractResult =
  | { kind: "ok"; info: TikTokUserInfo }
  | { kind: "banned" }
  | { kind: "notfound" };

// نتيجة داخلية تحمل أيضاً secUid لاستخدامه في جلب الدولة لاحقاً
type ParsedPage = {
  extract: ExtractResult;
  secUid?: string;
};

function extractUserFromJson(jsonData: Record<string, unknown>): ParsedPage {
  const defaultScope = (jsonData["__DEFAULT_SCOPE__"] ?? {}) as Record<string, unknown>;
  const webappDetail = (defaultScope["webapp.user-detail"] ?? {}) as Record<string, unknown>;

  const statusCode = webappDetail["statusCode"];
  const statusMsg = webappDetail["statusMsg"];
  if (statusCode === 10221 || (typeof statusMsg === "string" && /banned/i.test(statusMsg))) {
    return { extract: { kind: "banned" } };
  }

  const userInfo = (webappDetail["userInfo"] ?? {}) as Record<string, unknown>;
  const user = (userInfo["user"] ?? {}) as Record<string, unknown>;
  const stats = (userInfo["stats"] ?? {}) as Record<string, unknown>;

  if (!user["uniqueId"]) return { extract: { kind: "notfound" } };

  // استخراج secUid – لا يزال موجوداً حتى بعد إخفاء region
  const secUid = typeof user["secUid"] === "string" && (user["secUid"] as string).length > 10
    ? (user["secUid"] as string)
    : undefined;

  const region =
    (typeof user["region"] === "string" && user["region"].length === 2 ? user["region"] : "") ||
    (typeof user["localRegion"] === "string" && user["localRegion"].length === 2 ? user["localRegion"] : "") ||
    "";

  return {
    secUid,
    extract: {
      kind: "ok",
      info: {
        username: user["uniqueId"] as string,
        nickname: (user["nickname"] as string) ?? "",
        bio: (user["signature"] as string) ?? "",
        following: Number((stats["followingCount"] as number | undefined) ?? 0),
        followers: Number((stats["followerCount"] as number | undefined) ?? 0),
        friends: Number((stats["friendCount"] as number | undefined) ?? 0),
        likes: Number((stats["heartCount"] as number | undefined) ?? 0),
        verified: Boolean(user["verified"] ?? false),
        region,
        avatar: (user["avatarLarger"] as string) ?? "",
        id: (user["id"] as string) ?? "",
        createTime: user["createTime"] as number | undefined,
        nickNameModifyTime: user["nickNameModifyTime"] as number | undefined,
        uniqueIdModifyTime: user["uniqueIdModifyTime"] as number | undefined,
      },
    },
  };
}

function parseHtmlFull(html: string): ParsedPage {
  const scriptMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!scriptMatch || !scriptMatch[1]) return { extract: { kind: "notfound" } };
  try {
    const jsonData = JSON.parse(scriptMatch[1]) as Record<string, unknown>;
    return extractUserFromJson(jsonData);
  } catch {
    return { extract: { kind: "notfound" } };
  }
}

// ─── الحل الجذري: جلب الدولة من قائمة مقاطع الفيديو ──────────────────────
// تيك توك أخفى region في صفحة الحساب لكنه لا يزال يعيده في بيانات الفيديو.
// نتحقق من أن كل مقطع ينتمي لصاحب الـ secUid المطلوب لتجنب إعادة دولة خاطئة.
async function fetchRegionFromVideos(secUid: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      secUid,
      count: "5",
      cursor: "0",
      aid: "1988",
      app_language: "ar",
      device_platform: "web_mobile",
      region: "SA",
      os: "ios",
      app_name: "tiktok_web",
    });
    const url = `https://www.tiktok.com/api/post/item_list/?${params.toString()}`;
    const response = await axios.get<Record<string, unknown>>(url, {
      headers: {
        ...API_HEADERS,
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 TikTok/30.7.4 i",
      },
      timeout: 15000,
      validateStatus: () => true,
    });
    const data = response.data;
    const itemList = (data["itemList"] ?? []) as Record<string, unknown>[];
    for (const item of itemList) {
      const author = (item["author"] ?? {}) as Record<string, unknown>;
      // ✅ تحقق أن المقطع ينتمي فعلاً لصاحب الـ secUid المطلوب
      const authorSecUid = typeof author["secUid"] === "string" ? author["secUid"] : "";
      if (authorSecUid && authorSecUid !== secUid) continue;
      const r =
        (typeof author["region"] === "string" ? author["region"] : "") ||
        (typeof author["localRegion"] === "string" ? author["localRegion"] : "");
      if (r && r.length === 2) return r.toUpperCase();
    }
  } catch { /* تجاهل الخطأ */ }

  return "";
}

// ─── جلب الدولة عبر API تفاصيل المستخدم مع msToken وهمي ─────────────────
async function fetchRegionFromUserDetailApi(username: string): Promise<string> {
  const paramSets = [
    // النهج الأول: web_mobile مع aid=1988
    new URLSearchParams({
      uniqueId: username,
      aid: "1988",
      app_language: "ar",
      device_platform: "web_mobile",
      region: "SA",
      os: "ios",
      app_name: "tiktok_web",
    }),
    // النهج الثاني: web مع aid=1988
    new URLSearchParams({
      uniqueId: username,
      aid: "1988",
      device_platform: "web",
      region: "US",
    }),
    // النهج الثالث: محاكاة طلب تطبيق الجوال
    new URLSearchParams({
      uniqueId: username,
      aid: "1233",
      app_name: "musical_ly",
      device_platform: "android",
      region: "SA",
      version_code: "310503",
    }),
  ];

  const baseUrls = [
    "https://www.tiktok.com/api/user/detail/",
    "https://api19-normal-c-useast1a.tiktokv.com/aweme/v1/user/profile/other/",
    "https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/user/profile/other/",
  ];

  for (let i = 0; i < baseUrls.length; i++) {
    const baseUrl = baseUrls[i]!;
    const params = paramSets[Math.min(i, paramSets.length - 1)]!;
    try {
      const url = `${baseUrl}?${params.toString()}`;
      const headers: Record<string, string> = {
        ...API_HEADERS,
      };
      if (i >= 1) {
        // تطبيق الجوال يستخدم User-Agent مختلف
        headers["User-Agent"] = "com.ss.android.ugc.trill/310503 (Linux; U; Android 11; en_SA; Pixel 4; Build/RQ3A.210905.001; Cronet/TTNetVersion:b4d74d15 2023-04-28 QuicVersion:0144d358 2023-04-27)";
      }
      const response = await axios.get<Record<string, unknown>>(url, {
        headers,
        timeout: 15000,
        validateStatus: () => true,
      });
      const data = response.data;
      // مسار web API
      const userInfo = (data["userInfo"] ?? {}) as Record<string, unknown>;
      const user = (userInfo["user"] ?? {}) as Record<string, unknown>;
      // مسار mobile API
      const userData = (data["user"] ?? user) as Record<string, unknown>;
      const r =
        (typeof userData["region"] === "string" ? userData["region"] : "") ||
        (typeof userData["localRegion"] === "string" ? userData["localRegion"] : "");
      if (r && r.length === 2) return r.toUpperCase();
    } catch { /* جرّب التالي */ }
  }

  return "";
}

// ─── ScraperAPI: يرسم الصفحة بمتصفح حقيقي = تيك توك يرجع region الصحيحة ───
async function fetchViaScraperApi(username: string): Promise<ParsedPage> {
  const key = process.env["SCRAPER_API_KEY"];
  if (!key) return { extract: { kind: "notfound" } };
  try {
    const targetUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
    const response = await axios.get<string>("https://api.scraperapi.com/", {
      params: { api_key: key, url: targetUrl, render: "true" },
      timeout: 90000,
    });
    return parseHtmlFull(response.data);
  } catch {
    return { extract: { kind: "notfound" } };
  }
}

// ─── HTML عادي بدون JS rendering ─────────────────────────────────────────
async function fetchViaHtml(username: string): Promise<ParsedPage> {
  const urls = [
    `https://www.tiktok.com/@${encodeURIComponent(username)}`,
    `https://www.tiktok.com/@${encodeURIComponent(username)}?lang=ar`,
  ];
  for (const url of urls) {
    try {
      const response = await axios.get<string>(url, {
        headers: BROWSER_HEADERS,
        timeout: 15000,
        maxRedirects: 5,
      });
      const parsed = parseHtmlFull(response.data);
      if (parsed.extract.kind !== "notfound") return parsed;
    } catch { /* جرّب التالي */ }
  }
  return { extract: { kind: "notfound" } };
}

async function fetchViaApi(username: string): Promise<TikTokUserInfo | null> {
  try {
    const params = new URLSearchParams({
      uniqueId: username,
      aid: "1988",
      app_language: "ar",
      device_platform: "web_mobile",
      region: "SA",
    });
    const url = `https://www.tiktok.com/api/user/detail/?${params.toString()}`;
    const response = await axios.get<Record<string, unknown>>(url, {
      headers: API_HEADERS,
      timeout: 15000,
    });

    const data = response.data;
    const userInfo = (data["userInfo"] ?? {}) as Record<string, unknown>;
    const user = (userInfo["user"] ?? {}) as Record<string, unknown>;
    const stats = (userInfo["stats"] ?? {}) as Record<string, unknown>;
    if (!user["uniqueId"]) return null;

    const region =
      (typeof user["region"] === "string" ? user["region"] : "") ||
      (typeof user["localRegion"] === "string" ? user["localRegion"] : "") ||
      "";

    return {
      username: user["uniqueId"] as string,
      nickname: (user["nickname"] as string) ?? "",
      bio: (user["signature"] as string) ?? "",
      following: Number((stats["followingCount"] as number | undefined) ?? 0),
      followers: Number((stats["followerCount"] as number | undefined) ?? 0),
      friends: Number((stats["friendCount"] as number | undefined) ?? 0),
      likes: Number((stats["heartCount"] as number | undefined) ?? 0),
      verified: Boolean(user["verified"] ?? false),
      region,
      avatar: (user["avatarLarger"] as string) ?? "",
      id: (user["id"] as string) ?? "",
      createTime: user["createTime"] as number | undefined,
      nickNameModifyTime: user["nickNameModifyTime"] as number | undefined,
      uniqueIdModifyTime: user["uniqueIdModifyTime"] as number | undefined,
    };
  } catch {
    return null;
  }
}

// ─── tikwm.com: مصدر خارجي موثوق – يُعيد region من الفيديو الأول للمستخدم ───
// tikwm مجاني، لا يُحجب، ويحمل region في كل فيديو (ليس في بيانات المستخدم)
async function fetchRegionFromTikwm(username: string, secUid?: string): Promise<string> {
  // نبني قائمة params لتجريب كلٍّ من unique_id و sec_uid
  const paramSets: URLSearchParams[] = [
    new URLSearchParams({ unique_id: username, count: "5", cursor: "0" }),
  ];
  if (secUid) {
    paramSets.push(new URLSearchParams({ unique_id: username, sec_uid: secUid, count: "5", cursor: "0" }));
  }

  for (const params of paramSets) {
    try {
      const url = `https://www.tikwm.com/api/user/posts?${params.toString()}`;
      const response = await axios.get<Record<string, unknown>>(url, {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
        timeout: 15000,
        validateStatus: () => true,
      });
      const data = response.data;
      if ((data["code"] as number) !== 0) continue;
      const videos = ((data["data"] as Record<string, unknown>)?.["videos"] ?? []) as Record<string, unknown>[];
      for (const video of videos) {
        const r = typeof video["region"] === "string" ? video["region"] : "";
        // region في tikwm هي دولة رفع الفيديو = دولة المستخدم
        if (r && r.length === 2 && /^[A-Z]{2}$/.test(r.toUpperCase())) return r.toUpperCase();
      }
    } catch { /* جرّب التالي */ }
  }
  return "";
}

// ─── tikwm.com: جلب معلومات المستخدم الأساسية (fallback عند حجب TikTok) ─────
async function fetchUserFromTikwm(username: string): Promise<TikTokUserInfo | null> {
  try {
    const params = new URLSearchParams({ unique_id: username });
    const response = await axios.get<Record<string, unknown>>(
      `https://www.tikwm.com/api/user/info?${params.toString()}`,
      { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }, timeout: 15000, validateStatus: () => true }
    );
    const data = response.data;
    if ((data["code"] as number) !== 0) return null;
    const user = ((data["data"] as Record<string, unknown>)?.["user"] ?? {}) as Record<string, unknown>;
    if (!user["uniqueId"]) return null;
    const secUid = typeof user["secUid"] === "string" ? user["secUid"] : undefined;
    // جلب الدولة من الفيديوهات (لأن user/info لا يُعيد region)
    const region = secUid ? await fetchRegionFromTikwm(username, secUid) : await fetchRegionFromTikwm(username);
    return {
      username: user["uniqueId"] as string,
      nickname: (user["nickname"] as string) ?? "",
      bio: (user["signature"] as string) ?? "",
      following: 0, // tikwm/user/info لا يُعيد stats – نتركها صفر
      followers: 0,
      friends: 0,
      likes: 0,
      verified: Boolean(user["verified"] ?? false),
      region,
      avatar: (user["avatarLarger"] as string) ?? "",
      id: (user["id"] as string) ?? "",
      createTime: typeof user["createTime"] === "number" ? user["createTime"] : undefined,
    };
  } catch { return null; }
}

// ─── تحسين الدولة: يُجري كل الطرق المجانية بالتوازي إذا كانت region فارغة ──
async function enrichRegion(info: TikTokUserInfo, secUid?: string): Promise<TikTokUserInfo> {
  if (info.region && info.region.length === 2) return info; // الدولة موجودة، لا حاجة لشيء آخر

  // شغّل كل الطرق بالتوازي لأقصى سرعة
  const tasks: Promise<string>[] = [
    fetchRegionFromTikwm(info.username, secUid),        // tikwm (يعمل من أي خادم)
    fetchRegionFromUserDetailApi(info.username),        // TikTok API بنهج مختلف
  ];
  if (secUid) {
    tasks.push(fetchRegionFromVideos(secUid));           // TikTok post/item_list
  }

  const results = await Promise.all(tasks.map((t) => t.catch(() => "")));
  const region = results.find((r) => r && r.length === 2) ?? "";

  return { ...info, region };
}

export async function getTikTokUser(username: string): Promise<TikTokUserInfo> {
  const isSecUid = /^MS4wLjABAAAA[A-Za-z0-9_-]{20,}$/.test(username);
  const hasScraperKey = !!process.env["SCRAPER_API_KEY"];

  if (isSecUid) {
    const parsed = hasScraperKey
      ? await fetchViaScraperApi(username).catch(() => fetchViaHtml(username))
      : await fetchViaHtml(username).catch((): ParsedPage => ({ extract: { kind: "notfound" } }));
    const { extract, secUid } = parsed;
    if (extract.kind === "ok") return enrichRegion(extract.info, secUid ?? username);
    if (extract.kind === "banned") throw new Error("__BANNED__");
    throw new Error("__NOT_FOUND__");
  }

  if (hasScraperKey) {
    // ScraperAPI أولاً + HTML وAPI بالتوازي كـ fallback
    const [scraperParsed, htmlParsed, apiResult] = await Promise.all([
      fetchViaScraperApi(username).catch((): ParsedPage => ({ extract: { kind: "notfound" } })),
      fetchViaHtml(username).catch((): ParsedPage => ({ extract: { kind: "notfound" } })),
      fetchViaApi(username).catch(() => null),
    ]);

    // ScraperAPI هو الأولوية لأنه يعطي نتائج أفضل
    if (scraperParsed.extract.kind === "ok") {
      return enrichRegion(scraperParsed.extract.info, scraperParsed.secUid);
    }
    if (htmlParsed.extract.kind === "ok") {
      return enrichRegion(htmlParsed.extract.info, htmlParsed.secUid);
    }
    if (apiResult) return enrichRegion(apiResult);
    if (scraperParsed.extract.kind === "banned" || htmlParsed.extract.kind === "banned") {
      throw new Error("__BANNED__");
    }
    throw new Error("__NOT_FOUND__");
  }

  // بدون ScraperAPI: HTML + API بالتوازي
  const [htmlParsed, apiResult] = await Promise.all([
    fetchViaHtml(username).catch((): ParsedPage => ({ extract: { kind: "notfound" } })),
    fetchViaApi(username).catch(() => null),
  ]);

  const { extract: htmlExtract, secUid } = htmlParsed;
  if (htmlExtract.kind === "ok") return enrichRegion(htmlExtract.info, secUid);
  if (apiResult) return enrichRegion(apiResult);
  if (htmlExtract.kind === "banned") throw new Error("__BANNED__");
  throw new Error("__NOT_FOUND__");
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function codeToFlag(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return "🌍";
  const codePoints = [...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
}

export function getRegionLabel(code: string, fallback: string): string {
  if (!code) return fallback;
  const cc = code.toUpperCase();
  return `${codeToFlag(cc)} ${cc}`;
}

export function formatDate(ts: number | undefined, fallback: string): string {
  if (!ts || ts === 0) return fallback;
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function resolveUsernameById(userId: string): Promise<string | null> {
  const ARABIC = "\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u064B-\u065F\u0670\u06D6-\u06ED";
  const candidates = [
    `https://m.tiktok.com/h5/share/usr/${userId}.html`,
    `https://www.tiktok.com/share/user/${userId}`,
  ];
  for (const url of candidates) {
    try {
      const r = await axios.get<string>(url, {
        headers: BROWSER_HEADERS,
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      const html = r.data ?? "";
      const secMatch = html.match(/"secUid"\s*:\s*"(MS4wLjABAAAA[A-Za-z0-9_-]{20,})"/);
      if (secMatch && secMatch[1]) return secMatch[1];
      const finalUrl = (r.request?.res?.responseUrl as string | undefined) ?? "";
      const finalSec = finalUrl.match(/@(MS4wLjABAAAA[A-Za-z0-9_-]{20,})/);
      if (finalSec && finalSec[1]) return finalSec[1];
      const userRe = new RegExp(`@([A-Za-z0-9._${ARABIC}-]+)`, "u");
      const m1 = finalUrl.match(userRe);
      if (m1 && m1[1]) return m1[1];
      const uidRe = new RegExp(`"uniqueId"\\s*:\\s*"([A-Za-z0-9._${ARABIC}-]+)"`, "u");
      const m2 = html.match(uidRe);
      if (m2 && m2[1]) return m2[1];
    } catch { /* try next */ }
  }
  return null;
}

export async function resolveUsernameFromVideoUrl(rawUrl: string): Promise<string | null> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const direct = url.match(/tiktok\.com\/@([A-Za-z0-9._]+)(?:\/|$)/i);
  if (direct && direct[1] && !direct[1].startsWith("MS4wLj")) return direct[1];
  try {
    const r = await axios.get<string>(url, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    const finalUrl = (r.request?.res?.responseUrl as string | undefined) ?? "";
    const m = finalUrl.match(/tiktok\.com\/@([A-Za-z0-9._]+)(?:\/|$)/i);
    if (m && m[1] && !m[1].startsWith("MS4wLj")) return m[1];
  } catch { /* ignore */ }
  return null;
}

export async function getUserFromVideoUrl(rawUrl: string): Promise<TikTokUserInfo | null> {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const r = await axios.get<string>(url, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    const html = r.data ?? "";
    const m = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m || !m[1]) return null;
    const json = JSON.parse(m[1]) as Record<string, unknown>;
    const scope = (json["__DEFAULT_SCOPE__"] ?? {}) as Record<string, unknown>;
    const detail = (scope["webapp.reflow.video.detail"] ?? scope["webapp.video-detail"] ?? {}) as Record<string, unknown>;
    const itemInfo = (detail["itemInfo"] ?? {}) as Record<string, unknown>;
    const item = (itemInfo["itemStruct"] ?? {}) as Record<string, unknown>;
    const author = (item["author"] ?? {}) as Record<string, unknown>;
    const stats = (item["authorStats"] ?? item["stats"] ?? {}) as Record<string, unknown>;
    if (!author["uniqueId"] && !author["id"]) return null;
    const region =
      (typeof author["region"] === "string" ? author["region"] : "") ||
      (typeof author["localRegion"] === "string" ? author["localRegion"] : "") ||
      "";
    const info: TikTokUserInfo = {
      username: (author["uniqueId"] as string) ?? "",
      nickname: (author["nickname"] as string) ?? "",
      bio: (author["signature"] as string) ?? "",
      following: Number((stats["followingCount"] as number | undefined) ?? (author["followingCount"] as number | undefined) ?? 0),
      followers: Number((stats["followerCount"] as number | undefined) ?? (author["followerCount"] as number | undefined) ?? 0),
      friends: Number((stats["friendCount"] as number | undefined) ?? 0),
      likes: Number((stats["heartCount"] as number | undefined) ?? (author["heartCount"] as number | undefined) ?? 0),
      verified: Boolean(author["verified"] ?? false),
      region,
      avatar: (author["avatarLarger"] as string) ?? "",
      id: (author["id"] as string) ?? "",
      createTime: author["createTime"] as number | undefined,
      nickNameModifyTime: author["nickNameModifyTime"] as number | undefined,
      uniqueIdModifyTime: author["uniqueIdModifyTime"] as number | undefined,
    };
    // الفيديو قد يحمل region في بيانات المؤلف مباشرة، لكن إن كانت فارغة نحاول الإثراء
    const secUid = typeof author["secUid"] === "string" ? (author["secUid"] as string) : undefined;
    return enrichRegion(info, secUid);
  } catch { return null; }
}

export interface SearchHit {
  username: string;
  nickname: string;
  followers: number;
  verified: boolean;
}

async function searchViaDuckDuckGo(keyword: string): Promise<string[]> {
  const usernames: string[] = [];
  const seen = new Set<string>();
  const endpoints = [
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`tiktok ${keyword}`)}`,
    `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(`tiktok ${keyword}`)}`,
  ];
  for (const url of endpoints) {
    try {
      const r = await axios.get<string>(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true,
      });
      const html = r.data ?? "";
      const re = /tiktok\.com(?:%2F|\/)@?(?:%40)?([A-Za-z0-9._]{2,24})/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const u = m[1]!;
        if (seen.has(u) || u.startsWith("MS4wLj")) continue;
        seen.add(u);
        usernames.push(u);
        if (usernames.length >= 10) return usernames;
      }
      if (usernames.length > 0) return usernames;
    } catch { /* try next */ }
  }
  return usernames;
}

export async function searchUsers(keyword: string): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const directCandidate = keyword.trim().replace(/^@+/, "");
  if (/^[A-Za-z0-9._]{2,24}$/.test(directCandidate)) {
    try {
      const info = await getTikTokUser(directCandidate);
      seen.add(info.username.toLowerCase());
      hits.push({ username: info.username, nickname: info.nickname, followers: info.followers, verified: info.verified });
    } catch { /* not a direct hit */ }
  }
  const usernames = await searchViaDuckDuckGo(keyword);
  const remaining = usernames.filter((u) => !seen.has(u.toLowerCase())).slice(0, 5);
  const results = await Promise.allSettled(remaining.map((u) => getTikTokUser(u)));
  for (let i = 0; i < results.length; i++) {
    const res = results[i]!;
    const username = remaining[i]!;
    if (res.status === "fulfilled") {
      const info = res.value;
      if (seen.has(info.username.toLowerCase())) continue;
      seen.add(info.username.toLowerCase());
      hits.push({ username: info.username, nickname: info.nickname, followers: info.followers, verified: info.verified });
    } else {
      if (seen.has(username.toLowerCase())) continue;
      seen.add(username.toLowerCase());
      hits.push({ username, nickname: "", followers: 0, verified: false });
    }
  }
  return hits;
}
