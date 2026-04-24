import { createWorker, type Worker } from "tesseract.js";
import { logger } from "./logger";

export type VisionExtractResult = {
  username: string | null;
  numericId: string | null;
  videoUrl: string | null;
  rawText?: string;
};

export function isVisionConfigured(): boolean {
  return true;
}

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      logger.info("OCR: initializing Tesseract worker (ara+eng)…");
      const worker = await createWorker(["ara", "eng"]);
      logger.info("OCR: Tesseract worker ready");
      return worker;
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

const ARABIC_RANGES =
  "\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF";
const ARABIC_DIACRITICS = "\u064B-\u065F\u0670\u06D6-\u06ED";

const URL_REGEX =
  /https?:\/\/(?:www\.|vm\.|vt\.|m\.)?tiktok\.com\/[^\s'")]+/i;
const SHORT_URL_REGEX = /https?:\/\/(?:vm|vt)\.tiktok\.com\/[^\s'")]+/i;
const NUMERIC_ID_REGEX = /\b\d{16,19}\b/;
// OCR sometimes misreads "@" as "©" — accept both.
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

export async function extractTikTokIdentifierFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<VisionExtractResult> {
  logger.info(
    { mimeType, sizeKB: Math.round(imageBuffer.length / 1024) },
    "Vision: running OCR",
  );

  let text = "";
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(imageBuffer);
    text = data.text ?? "";
  } catch (err) {
    logger.error({ err }, "Vision: OCR failed");
    return { username: null, numericId: null, videoUrl: null };
  }

  logger.info(
    { textPreview: text.slice(0, 400), length: text.length },
    "Vision: OCR text extracted",
  );

  const result = parseTikTokIdentifier(text);
  logger.info(
    {
      username: result.username,
      numericId: result.numericId,
      videoUrl: result.videoUrl,
    },
    "Vision: parsed identifiers",
  );

  return result;
}
