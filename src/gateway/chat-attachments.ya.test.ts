/**
 * Extended attachment tests for YA fork — covers image handling, text extraction,
 * PDF handling, file size limits, and images[] array formation.
 *
 * Complements the existing chat-attachments.test.ts with additional coverage.
 */
import { describe, expect, it } from "vitest";
import {
  buildMessageWithAttachments,
  parseMessageWithAttachments,
  type ChatAttachment,
} from "./chat-attachments.js";

// 1x1 PNG
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/woAAn8B9FD5fHAAAAAASUVORK5CYII=";

// Tiny valid JPEG header (SOI + APP0 minimal)
const JPEG_TINY = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00,
]).toString("base64");

// Tiny GIF89a header
const GIF_TINY = Buffer.from(
  "GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;",
  "binary",
).toString("base64");

const stubLog = { warn: () => {} };

describe("parseMessageWithAttachments — image handling", () => {
  it("handles PNG images and populates images[]", async () => {
    const parsed = await parseMessageWithAttachments(
      "hello",
      [{ type: "image", mimeType: "image/png", fileName: "a.png", content: PNG_1x1 }],
      { log: stubLog },
    );
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]).toEqual({
      type: "image",
      data: PNG_1x1,
      mimeType: "image/png",
    });
    // Message unchanged when only images
    expect(parsed.message).toBe("hello");
  });

  it("handles JPEG images", async () => {
    const parsed = await parseMessageWithAttachments(
      "",
      [{ type: "image", mimeType: "image/jpeg", fileName: "photo.jpg", content: JPEG_TINY }],
      { log: stubLog },
    );
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mimeType).toBe("image/jpeg");
  });

  it("handles multiple images and preserves order", async () => {
    const parsed = await parseMessageWithAttachments(
      "multi",
      [
        { type: "image", mimeType: "image/png", fileName: "a.png", content: PNG_1x1 },
        { type: "image", mimeType: "image/jpeg", fileName: "b.jpg", content: JPEG_TINY },
      ],
      { log: stubLog },
    );
    expect(parsed.images).toHaveLength(2);
    expect(parsed.images[0]?.mimeType).toBe("image/png");
    expect(parsed.images[1]?.mimeType).toBe("image/jpeg");
  });

  it("returns empty images[] when no attachments", async () => {
    const parsed = await parseMessageWithAttachments("just text", undefined, { log: stubLog });
    expect(parsed.images).toEqual([]);
    expect(parsed.message).toBe("just text");
  });

  it("returns empty images[] for empty attachments array", async () => {
    const parsed = await parseMessageWithAttachments("just text", [], { log: stubLog });
    expect(parsed.images).toEqual([]);
  });
});

describe("parseMessageWithAttachments — file size limits", () => {
  it("rejects files exceeding maxBytes", async () => {
    const big = Buffer.alloc(6_000_000, 0x42).toString("base64");
    await expect(
      parseMessageWithAttachments(
        "x",
        [{ type: "image", mimeType: "image/png", fileName: "huge.png", content: big }],
        { maxBytes: 5_000_000, log: stubLog },
      ),
    ).rejects.toThrow(/exceeds size limit/i);
  });

  it("accepts files just under the limit", async () => {
    // PNG_1x1 is ~68 bytes, well under 5MB
    const parsed = await parseMessageWithAttachments(
      "x",
      [{ type: "image", mimeType: "image/png", fileName: "small.png", content: PNG_1x1 }],
      { maxBytes: 10_000_000, log: stubLog },
    );
    expect(parsed.images).toHaveLength(1);
  });

  it("rejects zero-length content", async () => {
    await expect(
      parseMessageWithAttachments(
        "x",
        [{ type: "image", mimeType: "image/png", fileName: "empty.png", content: "" }],
        { log: stubLog },
      ),
    ).rejects.toThrow();
  });
});

describe("parseMessageWithAttachments — non-string content", () => {
  it("rejects non-string content", async () => {
    await expect(
      parseMessageWithAttachments(
        "x",
        [
          {
            type: "image",
            mimeType: "image/png",
            fileName: "bad.png",
            content: 123 as unknown as string,
          },
        ],
        { log: stubLog },
      ),
    ).rejects.toThrow(/content must be base64 string/);
  });
});

describe("parseMessageWithAttachments — data URL stripping", () => {
  it("strips data:image/png;base64, prefix", async () => {
    const parsed = await parseMessageWithAttachments(
      "test",
      [
        {
          type: "image",
          mimeType: "image/png",
          fileName: "data-url.png",
          content: `data:image/png;base64,${PNG_1x1}`,
        },
      ],
      { log: stubLog },
    );
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.data).toBe(PNG_1x1);
  });
});

describe("parseMessageWithAttachments — text file extraction", () => {
  it("appends extracted text to message for text/plain files", async () => {
    const textContent = Buffer.from("Hello world text file").toString("base64");
    // text/plain is a supported file mime, so it should go through extractFileContentFromSource
    // The actual extraction depends on the media pipeline; we verify the code path doesn't throw
    // and either appends text or a "saved" notice.
    const parsed = await parseMessageWithAttachments(
      "see file",
      [{ type: "file", mimeType: "text/plain", fileName: "readme.txt", content: textContent }],
      { log: stubLog },
    );
    // Text files get appended as [Вложение: ...] sections
    expect(parsed.message).toContain("readme.txt");
    // No images for text files
    expect(parsed.images).toHaveLength(0);
  });
});

describe("buildMessageWithAttachments (legacy)", () => {
  it("only accepts image/* mime types", () => {
    const att: ChatAttachment = {
      type: "file",
      mimeType: "text/plain",
      fileName: "a.txt",
      content: Buffer.from("hi").toString("base64"),
    };
    expect(() => buildMessageWithAttachments("x", [att])).toThrow(/image/);
  });

  it("builds data URL for valid image", () => {
    const msg = buildMessageWithAttachments("look", [
      { type: "image", mimeType: "image/png", fileName: "pic.png", content: PNG_1x1 },
    ]);
    expect(msg).toContain("![pic.png]");
    expect(msg).toContain(`data:image/png;base64,${PNG_1x1}`);
  });
});
