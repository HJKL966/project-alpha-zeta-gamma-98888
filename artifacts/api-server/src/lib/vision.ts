import { logger } from "./logger";

export type VisionExtractResult = {
  username: string | null;
  numericId: string | null;
  videoUrl: string | null;
  rawText?: string;
};

const OCR_SPACE_API_KEY = process.env["OCR_SPACE_API_KEY"];
const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";

export function isVisionConfigured(): boolean {
  return Boolean(OCR_SPACE_API_KEY);
}

const ARABIC_RANGES =
  "\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF";
const ARABIC_DIACRITICS = "\u064B-\u065F\u0670\u06D6-\u06ED";

const URL_REGEX =
  /https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s'")]+/i;
const SHORT_URL_REGEX = /https?:\/\/(?:vm|vt)\.tiktok\.com\/[^\s'")]+/i;
const NUMERIC_ID_REGEX = /\b\d{16,19}\b/;
const AT_SIGN_CLASS = "[@©]";
const USERNAME_REGEX = new RegExp(
  `${AT_SIGN_CLASS}\\s*([A-Za-z0-9._${ARABIC_RANGES}][A-Za-z0-9._${ARABIC_RANGES}${ARABIC_DIACRITICS}]{1,40})`,
  "u",
);

export function parseTikTokIdentifier(text: string): VisionExtractResult {
  const result: VisionExtractResult = {
    username: null,
    numericId: null,
    videoUrl: null,
    rawText: text,
  };

  const cleaned = text
    .replace(/[\u200B-\u200F\uFEFF\u202A-\u202E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const urlMatch = cleaned.match(URL_REGEX) ?? cleaned.match(SHORT_URL_REGEX);
  if (urlMatch) result.videoUrl = urlMatch[0];

  const idMatch = cleaned.match(NUMERIC_ID_REGEX);
  if (idMatch) result.numericId = idMatch[0];

  const userMatch = cleaned.match(USERNAME_REGEX);
  if (userMatch && userMatch[1]) {
    let u = userMatch[1].trim();
    u = u.replace(/[.\u060C\u061B,;:!?]+$/, "");
    if (u.length >= 2) result.username = u;
  }

  return result;
}

type OcrSpaceResponse = {
  ParsedResults?: Array<{ ParsedText?: string; ErrorMessage?: string }>;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  OCRExitCode?: number;
};

async function runOcrSpace(
  imageBuffer: Buffer,
  mimeType: string,
  language: "ara" | "eng",
): Promise<string> {
  const apiKey = OCR_SPACE_API_KEY!;
  const form = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";
  form.append("file", blob, `image.${ext}`);
  form.append("language", language);
  form.append("OCREngine", "2");
  form.append("scale", "true");
  form.append("isTable", "false");
  form.append("detectOrientation", "true");

  const res = await fetch(OCR_SPACE_ENDPOINT, {
    method: "POST",
    headers: { apikey: apiKey },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`OCR.space HTTP ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as OcrSpaceResponse;
  if (json.IsErroredOnProcessing) {
    const msg = Array.isArray(json.ErrorMessage)
      ? json.ErrorMessage.join("; ")
      : json.ErrorMessage ?? "unknown OCR error";
    throw new Error(`OCR.space error: ${msg}`);
  }

  const text = json.ParsedResults?.map((p) => p.ParsedText ?? "").join("\n") ?? "";
  return text;
}

export async function extractTikTokIdentifierFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<VisionExtractResult> {
  if (!OCR_SPACE_API_KEY) {
    logger.warn("OCR.space API key not set — vision disabled");
    return { username: null, numericId: null, videoUrl: null };
  }

  logger.info(
    { mimeType, sizeKB: Math.round(imageBuffer.length / 1024) },
    "Vision: calling OCR.space",
  );

  let text = "";
  try {
    text = await runOcrSpace(imageBuffer, mimeType, "ara");
  } catch (err) {
    logger.error({ err }, "Vision: OCR.space (ara) failed");
  }

  let result = parseTikTokIdentifier(text);
  const hasMatch = result.videoUrl || result.numericId || result.username;

  if (!hasMatch) {
    try {
      const engText = await runOcrSpace(imageBuffer, mimeType, "eng");
      const combined = `${text}\n${engText}`;
      result = parseTikTokIdentifier(combined);
    } catch (err) {
      logger.error({ err }, "Vision: OCR.space (eng) fallback failed");
    }
  }

  logger.info(
    {
      username: result.username,
      numericId: result.numericId,
      videoUrl: result.videoUrl,
      textPreview: (result.rawText ?? "").slice(0, 200),
    },
    "Vision: extracted identifiers",
  );

  return result;
}
