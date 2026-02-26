import {
  DEFAULT_INPUT_FILE_MAX_BYTES,
  DEFAULT_INPUT_FILE_MAX_CHARS,
  DEFAULT_INPUT_FILE_MIMES,
  DEFAULT_INPUT_MAX_REDIRECTS,
  DEFAULT_INPUT_PDF_MAX_PAGES,
  DEFAULT_INPUT_PDF_MAX_PIXELS,
  DEFAULT_INPUT_PDF_MIN_TEXT_CHARS,
  DEFAULT_INPUT_TIMEOUT_MS,
  extractFileContentFromSource,
} from "../media/input-files.js";
import { detectMime } from "../media/mime.js";
import { saveMediaBuffer } from "../media/store.js";

export type ChatAttachment = {
  type?: string;
  mimeType?: string;
  fileName?: string;
  content?: unknown;
};

export type ChatImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

export type ParsedMessageWithImages = {
  message: string;
  images: ChatImageContent[];
};

type AttachmentLog = {
  warn: (message: string) => void;
};

function normalizeMime(mime?: string): string | undefined {
  if (!mime) {
    return undefined;
  }
  const cleaned = mime.split(";")[0]?.trim().toLowerCase();
  return cleaned || undefined;
}

async function sniffMimeFromBase64(base64: string): Promise<string | undefined> {
  const trimmed = base64.trim();
  if (!trimmed) {
    return undefined;
  }

  const take = Math.min(256, trimmed.length);
  const sliceLen = take - (take % 4);
  if (sliceLen < 8) {
    return undefined;
  }

  try {
    const head = Buffer.from(trimmed.slice(0, sliceLen), "base64");
    return await detectMime({ buffer: head });
  } catch {
    return undefined;
  }
}

function isImageMime(mime?: string): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}

/**
 * Parse attachments and extract images as structured content blocks.
 * Returns the message text and an array of image content blocks
 * compatible with Claude API's image format.
 */
export async function parseMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number; log?: AttachmentLog },
): Promise<ParsedMessageWithImages> {
  const maxBytes = opts?.maxBytes ?? 5_000_000; // 5 MB
  const log = opts?.log;
  if (!attachments || attachments.length === 0) {
    return { message, images: [] };
  }

  const images: ChatImageContent[] = [];
  const fileSections: string[] = [];
  const supportedFileMimes = new Set(DEFAULT_INPUT_FILE_MIMES);

  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const mime = att.mimeType ?? "";
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;

    if (typeof content !== "string") {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }

    let sizeBytes = 0;
    let b64 = content.trim();
    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...")
    const dataUrlMatch = /^data:[^;]+;base64,(.*)$/.exec(b64);
    if (dataUrlMatch) {
      b64 = dataUrlMatch[1];
    }
    // Basic base64 sanity: length multiple of 4 and charset check.
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    try {
      sizeBytes = Buffer.from(b64, "base64").byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }

    const providedMime = normalizeMime(mime);
    const sniffedMime = normalizeMime(await sniffMimeFromBase64(b64));
    const resolvedMime = sniffedMime ?? providedMime ?? normalizeMime(mime);

    if (resolvedMime && isImageMime(resolvedMime)) {
      if (sniffedMime && providedMime && sniffedMime !== providedMime) {
        log?.warn(
          `attachment ${label}: mime mismatch (${providedMime} -> ${sniffedMime}), using sniffed`,
        );
      }

      images.push({
        type: "image",
        data: b64,
        mimeType: resolvedMime,
      });
      continue;
    }

    if (resolvedMime && supportedFileMimes.has(resolvedMime)) {
      const extracted = await extractFileContentFromSource({
        source: {
          type: "base64",
          data: b64,
          mediaType: resolvedMime,
          filename: label,
        },
        limits: {
          allowUrl: false,
          allowedMimes: supportedFileMimes,
          maxBytes: Math.min(maxBytes, DEFAULT_INPUT_FILE_MAX_BYTES),
          maxChars: DEFAULT_INPUT_FILE_MAX_CHARS,
          maxRedirects: DEFAULT_INPUT_MAX_REDIRECTS,
          timeoutMs: DEFAULT_INPUT_TIMEOUT_MS,
          pdf: {
            maxPages: DEFAULT_INPUT_PDF_MAX_PAGES,
            maxPixels: DEFAULT_INPUT_PDF_MAX_PIXELS,
            minTextChars: DEFAULT_INPUT_PDF_MIN_TEXT_CHARS,
          },
        },
      });

      if (extracted.text && extracted.text.trim()) {
        fileSections.push(`[Вложение: ${extracted.filename}]\n${extracted.text.trim()}`);
      } else {
        fileSections.push(`[Вложение: ${extracted.filename}]\n(текст не извлечён)`);
      }
      if (extracted.images?.length) {
        for (const img of extracted.images) {
          images.push({ type: "image", data: img.data, mimeType: img.mimeType });
        }
      }
      continue;
    }

    try {
      const buffer = Buffer.from(b64, "base64");
      const saved = await saveMediaBuffer(
        buffer,
        resolvedMime ?? undefined,
        "inbound",
        Math.min(maxBytes, DEFAULT_INPUT_FILE_MAX_BYTES),
        label,
      );
      fileSections.push(
        `[Вложение: ${label}]\nФайл сохранён на gateway как "${saved.id}" (${saved.size} байт).`,
      );
    } catch (err) {
      log?.warn(`attachment ${label}: save failed: ${String(err)}`);
      fileSections.push(`[Вложение: ${label}]\n(не удалось сохранить файл)`);
    }
  }

  const suffix = fileSections.length > 0 ? fileSections.join("\n\n") : "";
  const nextMessage = suffix ? `${message}${message.trim() ? "\n\n" : ""}${suffix}` : message;
  return { message: nextMessage, images };
}

/**
 * @deprecated Use parseMessageWithAttachments instead.
 * This function converts images to markdown data URLs which Claude API cannot process as images.
 */
export function buildMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number },
): string {
  const maxBytes = opts?.maxBytes ?? 2_000_000; // 2 MB
  if (!attachments || attachments.length === 0) {
    return message;
  }

  const blocks: string[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const mime = att.mimeType ?? "";
    const content = att.content;
    const label = att.fileName || att.type || `attachment-${idx + 1}`;

    if (typeof content !== "string") {
      throw new Error(`attachment ${label}: content must be base64 string`);
    }
    if (!mime.startsWith("image/")) {
      throw new Error(`attachment ${label}: only image/* supported`);
    }

    let sizeBytes = 0;
    const b64 = content.trim();
    // Basic base64 sanity: length multiple of 4 and charset check.
    if (b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64)) {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    try {
      sizeBytes = Buffer.from(b64, "base64").byteLength;
    } catch {
      throw new Error(`attachment ${label}: invalid base64 content`);
    }
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      throw new Error(`attachment ${label}: exceeds size limit (${sizeBytes} > ${maxBytes} bytes)`);
    }

    const safeLabel = label.replace(/\s+/g, "_");
    const dataUrl = `![${safeLabel}](data:${mime};base64,${content})`;
    blocks.push(dataUrl);
  }

  if (blocks.length === 0) {
    return message;
  }
  const separator = message.trim().length > 0 ? "\n\n" : "";
  return `${message}${separator}${blocks.join("\n\n")}`;
}
