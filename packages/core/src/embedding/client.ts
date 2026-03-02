/**
 * OpenAI 임베딩 API 클라이언트
 *
 * 모델: text-embedding-3-large
 * 기본 차원: 3072
 * 입력 한도: 8K 토큰
 *
 * @see https://platform.openai.com/docs/guides/embeddings
 */

import type OpenAI from "openai";

import { cosineSimilarity } from "./cosine.js";

export const EMBEDDING_PROVIDER = "openai";
export const EMBEDDING_MODEL = "text-embedding-3-large";
export const EMBEDDING_EXPECTED_DIMENSION = 3072;

const EMBEDDING_BATCH_SIZE = 100;
const EMBEDDING_RETRY_DELAY_MS = 350;
const EMBEDDING_BATCH_DELAY_MS = 350;
const EMBEDDING_MAX_ATTEMPTS = 2;

let openaiClient: OpenAI | null = null;

async function getClient(): Promise<OpenAI> {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.");
    }
    const { default: OpenAI } = await import("openai");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface EmbeddingOptions {
  /**
   * text-embedding-3 모델 계열에서 지원하는 선택적 차원 축소 옵션.
   * 지정하지 않으면 모델 기본 차원(3072)을 사용한다.
   */
  dimensions?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableEmbeddingError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const err = error as { status?: number; code?: string };
    if (
      typeof err.status === "number" &&
      [408, 409, 425, 429, 500, 502, 503, 504].includes(err.status)
    ) {
      return true;
    }

    if (
      typeof err.code === "string" &&
      ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"].includes(err.code)
    ) {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  return /timeout|temporar|rate limit|network/i.test(message);
}

async function requestEmbeddings(
  input: string | string[],
  options: EmbeddingOptions = {},
): Promise<number[][]> {
  if (
    options.dimensions !== undefined &&
    (!Number.isInteger(options.dimensions) ||
      options.dimensions < 1 ||
      options.dimensions > EMBEDDING_EXPECTED_DIMENSION)
  ) {
    throw new Error(`dimensions는 1 이상 ${EMBEDDING_EXPECTED_DIMENSION} 이하의 정수여야 합니다.`);
  }

  const client = await getClient();
  let lastError: unknown;

  for (let attempt = 1; attempt <= EMBEDDING_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input,
        ...(typeof options.dimensions === "number" && options.dimensions > 0
          ? { dimensions: options.dimensions }
          : {}),
      });

      const vectors = response.data.map((item) => item.embedding);
      if (vectors.length === 0 || vectors.some((vector) => vector.length === 0)) {
        throw new Error("임베딩 응답이 비어있습니다");
      }
      return vectors;
    } catch (error) {
      lastError = error;
      if (attempt < EMBEDDING_MAX_ATTEMPTS && isRetryableEmbeddingError(error)) {
        await sleep(EMBEDDING_RETRY_DELAY_MS);
        continue;
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("임베딩 생성에 실패했습니다.");
}

/**
 * 텍스트 전처리 (임베딩용)
 * - Cloze 구문 제거 (내용만 추출)
 * - HTML 태그 제거
 * - 컨테이너 구문 제거
 * - 과도한 공백 정리
 */
export function preprocessTextForEmbedding(text: string): string {
  return text
    .replace(/\{\{c\d+::([^}]+?)(?:::[^}]+)?\}\}/g, "$1") // Cloze 내용만 추출
    .replace(/<[^>]+>/g, " ") // HTML 태그 제거
    .replace(/:::\s*\w+[^\n]*\n?/g, "") // 컨테이너 시작 제거
    .replace(/^:::\s*$/gm, "") // 컨테이너 끝 제거
    .replace(/\[([^\]|]+)\|nid\d{13}\]/g, "$1") // nid 링크에서 제목만 추출
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 단일 텍스트의 임베딩 생성
 */
export async function getEmbedding(
  text: string,
  options: EmbeddingOptions = {},
): Promise<number[]> {
  const processedText = preprocessTextForEmbedding(text);

  if (!processedText) {
    throw new Error("전처리 후 텍스트가 비어있습니다");
  }

  const [embedding] = await requestEmbeddings(processedText, options);

  if (!embedding || embedding.length === 0) {
    throw new Error("임베딩 응답이 비어있습니다");
  }

  return embedding;
}

/**
 * 여러 텍스트의 임베딩 배치 생성
 *
 * @param texts 텍스트 배열
 * @param options 옵션
 * @param onProgress 진행 콜백 (completed, total)
 * @returns 각 텍스트의 임베딩 배열
 */
export async function getEmbeddings(
  texts: string[],
  options: EmbeddingOptions = {},
  onProgress?: (completed: number, total: number) => void,
): Promise<number[][]> {
  // 빈 텍스트 필터링 및 전처리
  const processedTexts = texts.map((text) => preprocessTextForEmbedding(text));

  // 빈 텍스트 인덱스 추적
  const emptyIndices = new Set<number>();
  const validTexts: string[] = [];
  const validIndices: number[] = [];

  processedTexts.forEach((text, index) => {
    if (text) {
      validTexts.push(text);
      validIndices.push(index);
    } else {
      emptyIndices.add(index);
    }
  });

  if (validTexts.length === 0) {
    return texts.map(() => []);
  }

  const allEmbeddings: number[][] = Array.from({ length: texts.length }, () => []);
  let processedCount = 0;

  for (let i = 0; i < validTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batchTexts = validTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchIndices = validIndices.slice(i, i + EMBEDDING_BATCH_SIZE);

    // 배치 임베딩 요청
    const embeddings = await requestEmbeddings(batchTexts, options);
    if (embeddings.length !== batchIndices.length) {
      throw new Error(
        `임베딩 응답 개수가 일치하지 않습니다: expected=${batchIndices.length}, actual=${embeddings.length}`,
      );
    }

    // 결과 매핑
    for (let j = 0; j < batchIndices.length; j++) {
      const originalIndex = batchIndices[j];
      allEmbeddings[originalIndex] = embeddings[j] ?? [];
    }

    processedCount += batchTexts.length;
    onProgress?.(processedCount, validTexts.length);

    // Rate limit 대응
    if (i + EMBEDDING_BATCH_SIZE < validTexts.length) {
      await sleep(EMBEDDING_BATCH_DELAY_MS);
    }
  }

  return allEmbeddings;
}

/**
 * 두 텍스트 간의 의미적 유사도 계산
 *
 * @returns 유사도 (0-100)
 */
export async function getSemanticSimilarity(
  text1: string,
  text2: string,
  options: EmbeddingOptions = {},
): Promise<number> {
  const [embedding1, embedding2] = await getEmbeddings([text1, text2], options);

  if (embedding1.length === 0 || embedding2.length === 0) {
    return 0;
  }
  return cosineSimilarity(embedding1, embedding2);
}
