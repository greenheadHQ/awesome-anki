/**
 * Gemini 임베딩 API 클라이언트
 *
 * 모델: gemini-embedding-001 (GA, MTEB 상위권)
 * 차원: 768 (기본값)
 * 입력 한도: 8K 토큰
 *
 * @see https://ai.google.dev/gemini-api/docs/embeddings
 */

import { GoogleGenAI } from "@google/genai";

const EMBEDDING_MODEL = "gemini-embedding-001";
const DEFAULT_DIMENSION = 768;

let genAI: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인해주세요.",
      );
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export interface EmbeddingOptions {
  /**
   * 출력 차원 (기본: 768)
   * 작을수록 저장 공간 절약, 클수록 정밀도 향상
   */
  dimension?: number;
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
  const client = getClient();
  const dimension = options.dimension ?? DEFAULT_DIMENSION;

  const processedText = preprocessTextForEmbedding(text);

  if (!processedText) {
    throw new Error("전처리 후 텍스트가 비어있습니다");
  }

  const response = await client.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: processedText,
    config: {
      taskType: "SEMANTIC_SIMILARITY",
      outputDimensionality: dimension,
    },
  });

  const embedding = response.embeddings?.[0]?.values;

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
  const client = getClient();
  const dimension = options.dimension ?? DEFAULT_DIMENSION;

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

  // 배치 처리 (API rate limit 대응)
  const BATCH_SIZE = 100; // Gemini 배치 제한
  const DELAY_MS = 500;

  const allEmbeddings: number[][] = new Array(texts.length).fill([]);
  let processedCount = 0;

  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batchTexts = validTexts.slice(i, i + BATCH_SIZE);
    const batchIndices = validIndices.slice(i, i + BATCH_SIZE);

    // 배치 임베딩 요청
    const response = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batchTexts,
      config: {
        taskType: "SEMANTIC_SIMILARITY",
        outputDimensionality: dimension,
      },
    });

    // 결과 매핑
    const embeddings = response.embeddings ?? [];
    for (let j = 0; j < batchIndices.length; j++) {
      const originalIndex = batchIndices[j];
      const embedding = embeddings[j]?.values ?? [];
      allEmbeddings[originalIndex] = embedding;
    }

    processedCount += batchTexts.length;
    onProgress?.(processedCount, validTexts.length);

    // Rate limit 대응
    if (i + BATCH_SIZE < validTexts.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
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

  // 코사인 유사도 계산
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);

  if (magnitude === 0) {
    return 0;
  }

  const similarity = dotProduct / magnitude;

  // 0~1을 0~100으로 변환 (임베딩은 보통 양수)
  return Math.round(Math.max(0, similarity) * 100);
}
