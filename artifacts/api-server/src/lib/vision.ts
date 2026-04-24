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

const SYSTEM_PROMPT = `Extract a TikTok identifier from this image.

Look for ANY of these (in priority order):
1. A TikTok video URL (tiktok.com/..., vm.tiktok.com/..., vt.tiktok.com/...). Copy it exactly.
2. A long numeric user ID (16-19 digits).
3. A username — usually shown next to "@" sign. Strip the "@". The username may contain Arabic letters, English letters, digits, dots, underscores. Preserve Arabic letters and diacritics EXACTLY as you see them.

Important:
- TikTok profile screenshots show a big display name (nickname) and a smaller "@handle" below it. The "@handle" is the username — extract that, not the display name.
- If you see ONLY one name with "@", that is the username.
- If the display name and the @handle look similar but slightly different (e.g. one has extra symbols/stars), the @handle is correct.
- Always try to extract SOMETHING. Look at all text in the image including small fonts and corners.

Reply with ONLY this JSON (no markdown, no commentary):
{"username":"...","numericId":"...","videoUrl":"..."}

Use null (without quotes) for fields you cannot find. Do not invent values.`;

export function isVisionConfigured(): boolean {
  return Boolean(baseUrl && apiKey);
}

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
  logger.info({ mimeType, sizeKB: Math.round(imageBuffer.length / 1024) }, "Vision: calling Gemini");

  let response;
  try {
    response = await ai.models.generateContent({
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
        temperature: 0,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
  } catch (err) {
    logger.error({ err }, "Vision: Gemini call failed");
    return { username: null, numericId: null, videoUrl: null };
  }

  const text = response.text?.trim() ?? "";
  logger.info({ rawResponse: text }, "Vision: Gemini raw response");
  if (!text) {
    return { username: null, numericId: null, videoUrl: null };
  }

  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Partial<VisionExtractResult>;
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
    logger.info({ username, numericId, videoUrl }, "Vision: extracted identifiers");
    return { username, numericId, videoUrl };
  } catch (err) {
    logger.error({ err, text }, "Vision: failed to parse JSON response");
    return { username: null, numericId: null, videoUrl: null };
  }
}
