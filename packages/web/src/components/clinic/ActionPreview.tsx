/**
 * ActionPreview - 검증 결과 기반 수정 미리보기
 *
 * 중앙 패널 하단에 표시되며, 적용 가능한 수정을 diff 형태로 보여준다.
 * - verbose recommendation === "split" → Split 미리보기 (gray header)
 * - yagni isYagni → YAGNI 제거 미리보기 (amber header)
 * - factCheck corrections → 팩트 정정 미리보기 (blue header)
 *
 * Mockup v2: preview-area 스타일 (border rounded-lg, header+body 구조)
 */

import { useMemo } from "react";

import type { AllValidationResult } from "../../lib/api";
import { computeFactDiff, computeYagniDiff } from "../../lib/card-fixer";

interface ActionPreviewProps {
  cardContent: string;
  validationResults: AllValidationResult["results"] | undefined;
}

export function ActionPreview({ cardContent, validationResults }: ActionPreviewProps) {
  const verboseResult = validationResults?.verbose;
  const yagniResult = validationResults?.yagni;
  const factCheckResult = validationResults?.factCheck;

  const isSplitRecommended = verboseResult?.details.recommendation === "split";
  const isYagni = yagniResult?.details.isYagni === true;
  const factCorrections = useMemo(() => {
    if (!factCheckResult?.details.claims) return [];
    return factCheckResult.details.claims
      .filter((c) => !c.isVerified && c.correction)
      .map((c) => ({ claim: c.claim, correction: c.correction! }));
  }, [factCheckResult]);
  const hasFactCorrections = factCorrections.length > 0;

  const yagniDiff = useMemo(() => {
    if (!isYagni || !yagniResult?.details.affectedClozes.length) return null;
    return computeYagniDiff(cardContent, yagniResult.details.affectedClozes);
  }, [cardContent, isYagni, yagniResult]);

  const factDiff = useMemo(() => {
    if (!hasFactCorrections) return null;
    return computeFactDiff(cardContent, factCorrections);
  }, [cardContent, hasFactCorrections, factCorrections]);

  if (!isSplitRecommended && !isYagni && !hasFactCorrections) return null;

  return (
    <div className="space-y-3 mt-6">
      {/* Split 미리보기 */}
      {isSplitRecommended && (
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#374151]"
            style={{ background: "#f3f4f6" }}
          >
            <span>✂️ Split 미리보기</span>
            <span className="font-normal text-[#6b7280]">
              {verboseResult?.details.suggestedSplitCount
                ? `${verboseResult.details.suggestedSplitCount}개 카드로 분할`
                : `${verboseResult?.details.conceptCount}개 개념 감지`}
            </span>
          </div>
          <div className="p-3 text-xs leading-relaxed">
            {verboseResult?.details.concepts?.map((concept, i) => (
              <div key={`split-concept-${i}`}>
                {i > 0 && (
                  <hr className="border-none border-t border-dashed border-[#e5e7eb] my-2" />
                )}
                <p className="mb-1">
                  <strong>카드 {String.fromCharCode(65 + i)}</strong> — {concept}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* YAGNI 제거 미리보기 */}
      {isYagni && yagniDiff && yagniDiff.changes.length > 0 && (
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#374151]"
            style={{ background: "#fffbeb" }}
          >
            <span>🗑️ YAGNI 제거 미리보기</span>
            <span className="font-normal text-[#6b7280]">
              Cloze {yagniDiff.changes.length}개 제거
            </span>
          </div>
          <div className="p-3 text-xs leading-relaxed">
            <p className="mb-1.5 font-semibold">제거 대상:</p>
            {yagniDiff.changes.map((change, i) => (
              <p key={`yagni-change-${i}`} className="text-[#dc2626] line-through mb-1">
                - &quot;{change.before}&quot;
              </p>
            ))}
            {yagniResult?.details.reason && (
              <>
                <p className="mt-2 mb-1 font-semibold">사유:</p>
                <p className="text-[#6b7280]">{yagniResult.details.reason}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 팩트 정정 미리보기 */}
      {hasFactCorrections && factDiff && factDiff.changes.length > 0 && (
        <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
          <div
            className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#374151]"
            style={{ background: "#eff6ff" }}
          >
            <span>🔧 팩트 정정 미리보기</span>
            <span className="font-normal text-[#6b7280]">{factDiff.changes.length}건 정정</span>
          </div>
          <div className="p-3 text-xs leading-relaxed">
            {factCorrections.map((c, i) => (
              <div key={`fact-fix-${i}`} className={i > 0 ? "mt-3" : ""}>
                <p className="mb-1 font-semibold">정정 대상:</p>
                <p className="mb-1">
                  <span className="bg-[#fee2e2] text-[#991b1b] px-0.5 rounded-sm line-through">
                    {c.claim}
                  </span>
                </p>
                <p className="mb-2">
                  <span className="bg-[#dcfce7] text-[#166534] px-0.5 rounded-sm">
                    {c.correction}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
