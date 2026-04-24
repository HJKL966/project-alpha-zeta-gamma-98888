import { GoogleGenAI } from "@google/genai";
import { logger } from "./logger";

const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI | null {
  if (!baseUrl || !apiKey) return null;
  if (!client) {
    client = new GoogleGenAI({
      apiKey,
      httpOptions: { baseUrl },
    });
  }
  return client;
}

export type VisionExtractResult = {
  username: string | null;
  numericId: string | null;
  videoUrl: string | null;
};

const SYSTEM_PROMPT = `You are an extractor that finds a TikTok account identifier in an image.

The image may be a screenshot of a TikTok profile, a video page, a chat message, or any photo containing TikTok account info. The username may be in Arabic, English, numbers, dots, or underscores. Arabic usernames are valid (TikTok allows Arabic letters in usernames).

Look carefully for ANY of:
1. A TikTok username — usually shown as "@username" or as the handle under the display name. Extract WITHOUT the "@" prefix. Preserve Arabic characters exactly as written. Username may contain: arabic letters, latin letters, digits, dots, underscores.
2. A numeric TikTok user ID (long number, usually 16-19 digits).
3. A TikTok video URL (tiktok.com/@user/video/..., vm.tiktok.com/..., vt.tiktok.com/...).

Return ONLY valid JSON, no markdown, no explanation:
{"username": "<username or null>", "numericId": "<id or null>", "videoUrl": "<url or null>"}

Rules:
- Set fields you cannot find to null.
- If you see "@" before text, that text is the username. Strip the "@".
- Do NOT confuse the display name (nickname) with the username. The username is what appears with "@" or under the display name in smaller text.
- Do NOT invent values. If unsure, return null.
- Preserve exact characters including Arabic, dots, underscores, and digits.`;

export async function extractTikTokIdentifierFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<VisionExtractResult> {
  const ai = getClient();
  if (!ai) {
    logger.warn("Gemini client not configured — vision disabled");
    return { username: null, numericId: null, videoUrl: null };
  }

  const base64 = imageBuffer.toString("base64");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inlineData: {
              mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const text = response.text?.trim() ?? "";
  if (!text) {
    return { username: null, numericId: null, videoUrl: null };
  }

  try {
    const parsed = JSON.parse(text) as Partial<VisionExtractResult>;
    const username =
      typeof parsed.username === "string" && parsed.username.trim()
        ? parsed.username.trim().replace(/^@/, "")
        : null;
    const numericId =
      typeof parsed.numericId === "string" && /^\d{6,}$/.test(parsed.numericId.trim())
        ? parsed.numericId.trim()
        : null;
    const videoUrl =
      typeof parsed.videoUrl === "string" && parsed.videoUrl.trim()
        ? parsed.videoUrl.trim()
        : null;
    return { username, numericId, videoUrl };
  } catch (err) {
    logger.error({ err, text }, "Failed to parse vision JSON response");
    return { username: null, numericId: null, videoUrl: null };
  }
}
