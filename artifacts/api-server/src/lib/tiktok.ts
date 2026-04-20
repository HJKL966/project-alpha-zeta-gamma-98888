import axios from "axios";

export interface TikTokUserInfo {
  username: string;
  nickname: string;
  bio: string;
  following: number;
  followers: number;
  likes: number;
  verified: boolean;
  region: string;
  avatar: string;
  id: string;
  createTime?: number;
  nickNameModifyTime?: number;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.tiktok.com/",
};

export async function getTikTokUser(username: string): Promise<TikTokUserInfo> {
  const url = `https://www.tiktok.com/@${username}`;

  const response = await axios.get(url, {
    headers: HEADERS,
    timeout: 15000,
  });

  const html: string = response.data as string;

  const scriptMatch = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );

  if (!scriptMatch || !scriptMatch[1]) {
    throw new Error("لم أتمكن من جلب بيانات الحساب. تأكد من صحة اليوزر.");
  }

  let jsonData: Record<string, unknown>;
  try {
    jsonData = JSON.parse(scriptMatch[1]) as Record<string, unknown>;
  } catch {
    throw new Error("خطأ في تحليل بيانات TikTok.");
  }

  const defaultScope = (jsonData["__DEFAULT_SCOPE__"] ?? {}) as Record<string, unknown>;
  const webappDetail = (defaultScope["webapp.user-detail"] ?? {}) as Record<string, unknown>;
  const userInfo = (webappDetail["userInfo"] ?? {}) as Record<string, unknown>;
  const user = (userInfo["user"] ?? {}) as Record<string, unknown>;
  const stats = (userInfo["stats"] ?? {}) as Record<string, unknown>;

  if (!user["uniqueId"]) {
    throw new Error("الحساب غير موجود أو خاص.");
  }

  // TikTok removed region from public APIs — field is simply absent
  const region =
    (typeof user["region"] === "string" && user["region"].length === 2 ? user["region"] : "") ||
    (typeof user["localRegion"] === "string" && user["localRegion"].length === 2 ? user["localRegion"] : "") ||
    "";

  return {
    username: (user["uniqueId"] as string) ?? username,
    nickname: (user["nickname"] as string) ?? "",
    bio: (user["signature"] as string) ?? "",
    following: Number((stats["followingCount"] as number | undefined) ?? 0),
    followers: Number((stats["followerCount"] as number | undefined) ?? 0),
    likes: Number((stats["heartCount"] as number | undefined) ?? 0),
    verified: Boolean(user["verified"] ?? false),
    region,
    avatar: (user["avatarLarger"] as string) ?? "",
    id: (user["id"] as string) ?? "",
    createTime: (user["createTime"] as number | undefined),
    nickNameModifyTime: (user["nickNameModifyTime"] as number | undefined),
  };
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
