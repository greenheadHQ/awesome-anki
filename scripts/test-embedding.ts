#!/usr/bin/env bun
/**
 * 임베딩 통합 테스트 스크립트
 *
 * 실제 Anki 데이터를 사용하여 임베딩 기능을 테스트합니다.
 * 실행: bun run scripts/test-embedding.ts
 */

import "dotenv/config";
import {
  type CardForComparison,
  checkSimilarity,
  extractTextField,
  getCacheStatus,
  getDeckNotes,
  getEmbedding,
  getSemanticSimilarity,
  preprocessTextForEmbedding,
} from "@anki-splitter/core";

const DECK_NAME = "[책] 이것이 취업을 위한 컴퓨터 과학이다";
const TEST_NOTE_IDS = [1757399484677, 1757400981612, 1757407967676]; // DNS 관련 카드

async function testEmbeddingGeneration() {
  console.log("\n=== 1. 임베딩 생성 테스트 ===\n");

  const notes = await getDeckNotes(DECK_NAME);
  console.log(`덱: ${DECK_NAME}`);
  console.log(`총 노트 수: ${notes.length}`);

  // 테스트 카드 가져오기
  const testNote = notes.find((n) => TEST_NOTE_IDS.includes(n.noteId));
  if (!testNote) {
    console.error("테스트 카드를 찾을 수 없습니다.");
    return;
  }

  const text = extractTextField(testNote);
  console.log(`\n테스트 카드 (nid: ${testNote.noteId}):`);
  console.log(`원본 텍스트 길이: ${text.length}자`);

  const processed = preprocessTextForEmbedding(text);
  console.log(`전처리 후 길이: ${processed.length}자`);

  console.log("\n임베딩 생성 중...");
  const startTime = Date.now();
  const embedding = await getEmbedding(text);
  const elapsed = Date.now() - startTime;

  console.log(`임베딩 생성 완료 (${elapsed}ms)`);
  console.log(`차원: ${embedding.length}`);
  console.log(
    `샘플 (처음 5개): [${embedding
      .slice(0, 5)
      .map((v) => v.toFixed(4))
      .join(", ")}...]`,
  );
}

async function testSemanticSimilarity() {
  console.log("\n=== 2. 의미적 유사도 테스트 ===\n");

  const notes = await getDeckNotes(DECK_NAME);

  // DNS 관련 카드들 선택
  const dnsCards = notes.filter((n) => TEST_NOTE_IDS.includes(n.noteId));
  if (dnsCards.length < 2) {
    console.error("DNS 카드가 2개 이상 필요합니다.");
    return;
  }

  const card1Text = extractTextField(dnsCards[0]);
  const card2Text = extractTextField(dnsCards[1]);

  console.log("카드 1:", `${card1Text.slice(0, 100)}...`);
  console.log("카드 2:", `${card2Text.slice(0, 100)}...`);

  const similarity = await getSemanticSimilarity(card1Text, card2Text);
  console.log(`\n의미적 유사도: ${similarity}%`);

  // 전혀 다른 카드와 비교
  const otherCard = notes.find(
    (n) =>
      !TEST_NOTE_IDS.includes(n.noteId) && extractTextField(n).length > 100,
  );
  if (otherCard) {
    const otherText = extractTextField(otherCard);
    console.log("\n다른 카드:", `${otherText.slice(0, 100)}...`);

    const otherSimilarity = await getSemanticSimilarity(card1Text, otherText);
    console.log(`DNS 카드 vs 다른 주제 카드 유사도: ${otherSimilarity}%`);
  }
}

async function testEmbeddingSimilarityCheck() {
  console.log("\n=== 3. 임베딩 기반 유사성 검사 테스트 ===\n");

  const notes = await getDeckNotes(DECK_NAME);
  const testNote = notes.find((n) => TEST_NOTE_IDS.includes(n.noteId));
  if (!testNote) {
    console.error("테스트 카드를 찾을 수 없습니다.");
    return;
  }

  const targetCard: CardForComparison = {
    noteId: testNote.noteId,
    text: extractTextField(testNote),
  };

  // 처음 20개 카드만 테스트 (API 비용 절약)
  const allCards: CardForComparison[] = notes.slice(0, 20).map((n) => ({
    noteId: n.noteId,
    text: extractTextField(n),
  }));

  console.log(`대상 카드: nid ${targetCard.noteId}`);
  console.log(`비교 카드 수: ${allCards.length}`);

  // Jaccard 검사
  console.log("\n[Jaccard 유사도 검사]");
  const jaccardStart = Date.now();
  const jaccardResult = await checkSimilarity(targetCard, allCards, {
    useEmbedding: false,
    threshold: 50,
  });
  console.log(`소요 시간: ${Date.now() - jaccardStart}ms`);
  console.log(`상태: ${jaccardResult.status}`);
  console.log(`유사 카드 수: ${jaccardResult.details.similarCards.length}`);
  if (jaccardResult.details.similarCards.length > 0) {
    console.log("상위 유사 카드:");
    jaccardResult.details.similarCards.slice(0, 3).forEach((c) => {
      console.log(`  - nid ${c.noteId}: ${c.similarity}%`);
    });
  }

  // 임베딩 검사
  console.log("\n[임베딩 유사도 검사]");
  const embeddingStart = Date.now();
  const embeddingResult = await checkSimilarity(targetCard, allCards, {
    useEmbedding: true,
    deckName: DECK_NAME,
    threshold: 70,
  });
  console.log(`소요 시간: ${Date.now() - embeddingStart}ms`);
  console.log(`상태: ${embeddingResult.status}`);
  console.log(`방식: ${embeddingResult.details.method}`);
  console.log(`유사 카드 수: ${embeddingResult.details.similarCards.length}`);
  if (embeddingResult.details.similarCards.length > 0) {
    console.log("상위 유사 카드:");
    embeddingResult.details.similarCards.slice(0, 3).forEach((c) => {
      console.log(`  - nid ${c.noteId}: ${c.similarity}%`);
    });
  }
}

async function testCacheStatus() {
  console.log("\n=== 4. 캐시 상태 확인 ===\n");

  const status = getCacheStatus(DECK_NAME);
  console.log(`캐시 존재: ${status.exists}`);
  if (status.exists) {
    console.log(`덱: ${status.deckName}`);
    console.log(`차원: ${status.dimension}`);
    console.log(`저장된 임베딩 수: ${status.totalEmbeddings}`);
    console.log(`마지막 업데이트: ${status.lastUpdated}`);
    console.log(`캐시 파일: ${status.cacheFilePath}`);
  }
}

async function main() {
  console.log("========================================");
  console.log("  임베딩 통합 테스트");
  console.log("========================================");

  if (!process.env.GEMINI_API_KEY) {
    console.error("ERROR: GEMINI_API_KEY가 설정되지 않았습니다.");
    process.exit(1);
  }

  try {
    await testEmbeddingGeneration();
    await testSemanticSimilarity();
    await testEmbeddingSimilarityCheck();
    await testCacheStatus();

    console.log("\n========================================");
    console.log("  모든 테스트 완료!");
    console.log("========================================\n");
  } catch (error) {
    console.error("테스트 실패:", error);
    process.exit(1);
  }
}

main();
