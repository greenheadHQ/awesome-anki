/**
 * Media API - Anki 미디어 파일 프록시
 */

import { ankiConnect, NotFoundError } from "@anki-splitter/core";
import { Hono } from "hono";

const media = new Hono();

/**
 * GET /api/media/:filename
 * Anki 미디어 파일을 프록시로 제공
 */
media.get("/:filename", async (c) => {
  const filename = decodeURIComponent(c.req.param("filename"));

  // AnkiConnect retrieveMediaFile API 호출
  const result = (await ankiConnect("retrieveMediaFile", { filename })) as string | null;

  if (!result) {
    throw new NotFoundError(`미디어 파일을 찾을 수 없습니다: ${filename}`);
  }

  // Base64 디코딩
  const binaryString = atob(result);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 파일 확장자로 MIME 타입 결정
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    mp4: "video/mp4",
    webm: "video/webm",
  };

  const contentType = mimeTypes[ext] || "application/octet-stream";

  return new Response(bytes, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400", // 24시간 캐시
    },
  });
});

export default media;
