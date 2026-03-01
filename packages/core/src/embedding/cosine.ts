/**
 * 코사인 유사도 계산
 *
 * 두 벡터 간의 각도를 기반으로 유사도 측정
 * 결과: 0 (완전히 다름) ~ 100 (동일)
 */

/**
 * 두 벡터의 코사인 유사도 계산
 * @param vec1 첫 번째 벡터
 * @param vec2 두 번째 벡터
 * @returns 유사도 (0-100)
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error(`벡터 차원이 일치하지 않습니다: ${vec1.length} vs ${vec2.length}`);
  }

  if (vec1.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);

  if (magnitude === 0) {
    return 0;
  }

  // 코사인 유사도는 -1 ~ 1 범위
  // 텍스트 임베딩은 보통 0 ~ 1 범위이므로 0-100으로 변환
  const similarity = dotProduct / magnitude;

  // -1~1을 0~100으로 변환 (음수 유사도도 처리)
  return Math.round(((similarity + 1) / 2) * 100);
}

/**
 * 벡터의 L2 정규화 (단위 벡터로 변환)
 */
export function normalizeVector(vec: number[]): number[] {
  let norm = 0;
  for (const val of vec) {
    norm += val * val;
  }
  norm = Math.sqrt(norm);

  if (norm === 0) {
    return vec;
  }

  return vec.map((v) => v / norm);
}

/**
 * 정규화된 벡터 간의 빠른 코사인 유사도 계산
 * (L2 정규화된 벡터에서는 dot product만으로 계산 가능)
 */
export function fastCosineSimilarity(normalizedVec1: number[], normalizedVec2: number[]): number {
  if (normalizedVec1.length !== normalizedVec2.length) {
    throw new Error("벡터 차원이 일치하지 않습니다");
  }

  let dotProduct = 0;
  for (let i = 0; i < normalizedVec1.length; i++) {
    dotProduct += normalizedVec1[i] * normalizedVec2[i];
  }

  // -1~1을 0~100으로 변환
  return Math.round(((dotProduct + 1) / 2) * 100);
}
