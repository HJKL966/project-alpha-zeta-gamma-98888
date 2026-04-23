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
  Cookie: "tt_webid_v2=7364759834132382213; ttwid=1%7CaGVsbG8%7C1714000000%7C; tt_chain_token=abc123def456;",
};

const API_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  Referer: "https://www.tiktok.com/",
  Cookie: "tt_webid_v2=7364759834132382213; ttwid=1%7CaGVsbG8%7C1714000000%7C; tt_chain_token=abc123def456;",
};

function extractFromHtml(html: string): TikTokUserInfo | null {
  const scriptMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!scriptMatch || !scriptMatch[1]) return null;

  let jsonData: Record<string, unknown>;
  try {
    jsonData = JSON.parse(scriptMatch[1]) as Record<string, unknown>;
  } catch {
    return null;
  }

  const defaultScope = (jsonData["__DEFAULT_SCOPE__"] ?? {}) as Record<string, unknown>;
  const webappDetail = (defaultScope["webapp.user-detail"] ?? {}) as Record<string, unknown>;
  const userInfo = (webappDetail["userInfo"] ?? {}) as Record<string, unknown>;
  const user = (userInfo["user"] ?? {}) as Record<string, unknown>;
  const stats = (userInfo["stats"] ?? {}) as Record<string, unknown>;

  if (!user["uniqueId"]) return null;

  const region =
    (typeof user["region"] === "string" && user["region"].length === 2 ? user["region"] : "") ||
    (typeof user["localRegion"] === "string" && user["localRegion"].length === 2 ? user["localRegion"] : "") ||
    "";

  return {
    username: (user["uniqueId"] as string),
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
    createTime: (user["createTime"] as number | undefined),
    nickNameModifyTime: (user["nickNameModifyTime"] as number | undefined),
    uniqueIdModifyTime: (user["uniqueIdModifyTime"] as number | undefined),
  };
}

async function fetchViaHtml(username: string): Promise<TikTokUserInfo | null> {
  try {
    const url = `https://www.tiktok.com/@${username}`;
    const response = await axios.get<string>(url, {
      headers: BROWSER_HEADERS,
      timeout: 15000,
      maxRedirects: 5,
    });
    return extractFromHtml(response.data);
  } catch {
    return null;
  }
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
      username: (user["uniqueId"] as string),
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
      createTime: (user["createTime"] as number | undefined),
      nickNameModifyTime: (user["nickNameModifyTime"] as number | undefined),
      uniqueIdModifyTime: (user["uniqueIdModifyTime"] as number | undefined),
    };
  } catch {
    return null;
  }
}

export async function getTikTokUser(username: string): Promise<TikTokUserInfo> {
  const [htmlResult, apiResult] = await Promise.allSettled([
    fetchViaHtml(username),
    fetchViaApi(username),
  ]);

  const fromHtml = htmlResult.status === "fulfilled" ? htmlResult.value : null;
  const fromApi = apiResult.status === "fulfilled" ? apiResult.value : null;

  const info = fromHtml ?? fromApi;
  if (!info) {
    throw new Error("__NOT_FOUND__");
  }
  return info;
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
      const finalUrl = (r.request?.res?.responseUrl as string | undefined) ?? "";
      const m1 = finalUrl.match(/@([A-Za-z0-9._]+)/);
      if (m1 && m1[1]) return m1[1];
      const m2 = (r.data ?? "").match(/"uniqueId"\s*:\s*"([A-Za-z0-9._]+)"/);
      if (m2 && m2[1]) return m2[1];
    } catch {
      /* try next */
    }
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
  } catch {
    /* ignore */
  }
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
    const m = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/,
    );
    if (!m || !m[1]) return null;
    const json = JSON.parse(m[1]) as Record<string, unknown>;
    const scope = (json["__DEFAULT_SCOPE__"] ?? {}) as Record<string, unknown>;
    const detail =
      (scope["webapp.reflow.video.detail"] ?? scope["webapp.video-detail"] ?? {}) as Record<
        string,
        unknown
      >;
    const itemInfo = (detail["itemInfo"] ?? {}) as Record<string, unknown>;
    const item = (itemInfo["itemStruct"] ?? {}) as Record<string, unknown>;
    const author = (item["author"] ?? {}) as Record<string, unknown>;
    const stats = (item["authorStats"] ?? item["stats"] ?? {}) as Record<string, unknown>;
    if (!author["uniqueId"] && !author["id"]) return null;
    return {
      username: (author["uniqueId"] as string) ?? "",
      nickname: (author["nickname"] as string) ?? "",
      bio: (author["signature"] as string) ?? "",
      following: Number(
        (stats["followingCount"] as number | undefined) ??
          (author["followingCount"] as number | undefined) ??
          0,
      ),
      followers: Number(
        (stats["followerCount"] as number | undefined) ??
          (author["followerCount"] as number | undefined) ??
          0,
      ),
      friends: Number((stats["friendCount"] as number | undefined) ?? 0),
      likes: Number(
        (stats["heartCount"] as number | undefined) ??
          (author["heartCount"] as number | undefined) ??
          0,
      ),
      verified: Boolean(author["verified"] ?? false),
      region:
        (typeof author["region"] === "string" ? author["region"] : "") ||
        (typeof author["localRegion"] === "string" ? author["localRegion"] : "") ||
        "",
      avatar: (author["avatarLarger"] as string) ?? "",
      id: (author["id"] as string) ?? "",
      createTime: author["createTime"] as number | undefined,
      nickNameModifyTime: author["nickNameModifyTime"] as number | undefined,
      uniqueIdModifyTime: author["uniqueIdModifyTime"] as number | undefined,
    };
  } catch {
    return null;
  }
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
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
    } catch {
      /* try next */
    }
  }
  return usernames;
}

export async function searchUsers(keyword: string): Promise<SearchHit[]> {
  const usernames = await searchViaDuckDuckGo(keyword);
  const hits: SearchHit[] = [];
  const limited = usernames.slice(0, 5);
  const results = await Promise.allSettled(limited.map((u) => getTikTokUser(u)));
  for (let i = 0; i < results.length; i++) {
    const res = results[i]!;
    const username = limited[i]!;
    if (res.status === "fulfilled") {
      const info = res.value;
      hits.push({
        username: info.username,
        nickname: info.nickname,
        followers: info.followers,
        verified: info.verified,
      });
    } else {
      hits.push({ username, nickname: "", followers: 0, verified: false });
    }
  }
  return hits;
}
