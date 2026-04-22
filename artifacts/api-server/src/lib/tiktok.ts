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
    throw new Error("الحساب غير موجود أو خاص.");
  }
  return info;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

const REGION_MAP: Record<string, string> = {
  IQ: "🇮🇶 - IQ", SA: "🇸🇦 - SA", AE: "🇦🇪 - AE", EG: "🇪🇬 - EG",
  US: "🇺🇸 - US", GB: "🇬🇧 - GB", TR: "🇹🇷 - TR", DE: "🇩🇪 - DE",
  FR: "🇫🇷 - FR", IN: "🇮🇳 - IN", PK: "🇵🇰 - PK", JO: "🇯🇴 - JO",
  LB: "🇱🇧 - LB", SY: "🇸🇾 - SY", PS: "🇵🇸 - PS", KW: "🇰🇼 - KW",
  QA: "🇶🇦 - QA", BH: "🇧🇭 - BH", OM: "🇴🇲 - OM", YE: "🇾🇪 - YE",
  LY: "🇱🇾 - LY", MA: "🇲🇦 - MA", TN: "🇹🇳 - TN", DZ: "🇩🇿 - DZ",
  SD: "🇸🇩 - SD", RU: "🇷🇺 - RU", CN: "🇨🇳 - CN", BR: "🇧🇷 - BR",
  MX: "🇲🇽 - MX", NG: "🇳🇬 - NG", ID: "🇮🇩 - ID", PH: "🇵🇭 - PH",
  TH: "🇹🇭 - TH", VN: "🇻🇳 - VN", MM: "🇲🇲 - MM", MY: "🇲🇾 - MY",
  SG: "🇸🇬 - SG",
};

export function getRegionLabel(code: string): string {
  if (!code) return "غير متوفر";
  return REGION_MAP[code.toUpperCase()] ?? `🌍 - ${code.toUpperCase()}`;
}

export function formatDate(ts: number | undefined): string {
  if (!ts || ts === 0) return "غير متوفر";
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
