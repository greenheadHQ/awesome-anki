/**
 * AllInOnePanel - 일괄 수정 패널
 *
 * 우측 패널 body 내부 (검증 결과 아래)에 배치.
 * Mockup v2: gradient header + #f5f3ff body + checkbox items + cost footer
 *
 * 적용 가능한 수정(YAGNI 제거, 팩트 정정)을 체크박스로 선택하고
 * 한 번의 Apply로 백업 + 수정 + (선택 시) Split 이동을 처리한다.
 */

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useFixApply } from "../../hooks/useClinicCache";
import type { AllValidationResult } from "../../lib/api";
import { applyFactCorrections, removeYagniClozes } from "../../lib/card-fixer";

interface AllInOnePanelProps {
  cardContent: string;
  noteId: number;
  deckName: string;
  validationResults: AllValidationResult["results"] | undefined;
}

export function AllInOnePanel({
  cardContent,
  noteId,
  deckName,
  validationResults,
}: AllInOnePanelProps) {
  const navigate = useNavigate();
  const fixApply = useFixApply();

  // --- 적용 가능 여부 계산 ---
  const isSplitRecommended = validationResults?.verbose?.details.recommendation === "split";
  const isYagni = validationResults?.yagni?.details.isYagni === true;
  const yagniClozes = useMemo(
    () => validationResults?.yagni?.details.affectedClozes ?? [],
    [validationResults],
  );

  const factCorrections = useMemo(() => {
    if (!validationResults?.factCheck?.details.claims) return [];
    return validationResults.factCheck.details.claims
      .filter((c) => !c.isVerified && c.correction)
      .map((c) => ({ claim: c.claim, correction: c.correction! }));
  }, [validationResults]);
  const hasFactCorrections = factCorrections.length > 0;

  const hasAnyAction = isSplitRecommended || isYagni || hasFactCorrections;

  // --- 체크박스 상태 (noteId 변경 시 리셋) ---
  const [splitChecked, setSplitChecked] = useState(false);
  const [yagniChecked, setYagniChecked] = useState(false);
  const [factChecked, setFactChecked] = useState(false);

  useEffect(() => {
    setSplitChecked(false);
    setYagniChecked(false);
    setFactChecked(false);
  }, [noteId]);

  const hasCheckedFixes = yagniChecked || factChecked;
  const hasCheckedAnything = splitChecked || hasCheckedFixes;

  // 체크된 항목 수
  const checkedCount = [splitChecked, yagniChecked, factChecked].filter(Boolean).length;

  // 권장 항목 수
  const recommendedCount = [isSplitRecommended, isYagni, hasFactCorrections].filter(Boolean).length;

  // --- Apply 로직 ---
  const handleApply = useCallback(async () => {
    try {
      let fixedContent = cardContent;

      // 1. YAGNI 제거
      if (yagniChecked && yagniClozes.length > 0) {
        fixedContent = removeYagniClozes(fixedContent, yagniClozes);
      }

      // 2. 팩트 정정
      if (factChecked && factCorrections.length > 0) {
        fixedContent = applyFactCorrections(fixedContent, factCorrections);
      }

      // 3. 수정 사항이 있으면 서버에 적용 (백업 포함)
      if (hasCheckedFixes && fixedContent !== cardContent) {
        const result = await fixApply.mutateAsync({ noteId, fixedContent, deckName });
        if (result.warning) {
          toast.warning("수정 적용 완료 (경고)", { description: result.warning });
        } else {
          toast.success("수정 적용 완료", { description: "백업이 자동 생성되었습니다." });
        }
      }

      // 4. Split 체크 시 Split 페이지로 이동
      if (splitChecked) {
        navigate(`/split?noteId=${noteId}&deck=${encodeURIComponent(deckName)}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      toast.error("수정 적용 실패", { description: message });
    }
  }, [
    cardContent,
    yagniChecked,
    yagniClozes,
    factChecked,
    factCorrections,
    hasCheckedFixes,
    fixApply,
    noteId,
    deckName,
    splitChecked,
    navigate,
  ]);

  if (!validationResults || !hasAnyAction) return null;

  return (
    <div className="mt-4" style={{ border: "2px solid #4f46e5", borderRadius: 10, overflow: "hidden" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 text-white"
        style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}
      >
        <div className="flex items-center gap-2 text-sm font-bold">
          <span>⚡</span>
          <span>All-in-One 적용</span>
        </div>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,255,255,0.2)" }}
        >
          {recommendedCount}건 권장
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3" style={{ background: "#f5f3ff" }}>
        {/* Split */}
        <AllInOneCheckboxItem
          checked={splitChecked}
          onChange={setSplitChecked}
          disabled={!isSplitRecommended}
          available={isSplitRecommended}
          icon="✂️"
          typeLabel="Split"
          typeColor="#4f46e5"
          detail={
            isSplitRecommended
              ? `${validationResults.verbose?.details.suggestedSplitCount ?? validationResults.verbose?.details.conceptCount}개 카드로 분할`
              : "해당 없음"
          }
        />

        {/* YAGNI */}
        <AllInOneCheckboxItem
          checked={yagniChecked}
          onChange={setYagniChecked}
          disabled={!isYagni}
          available={isYagni}
          icon="🗑️"
          typeLabel="YAGNI 제거"
          typeColor="#d97706"
          detail={
            isYagni
              ? `Cloze ${yagniClozes.length}개 제거`
              : "해당 없음"
          }
        />

        {/* Fact Correction */}
        <AllInOneCheckboxItem
          checked={factChecked}
          onChange={setFactChecked}
          disabled={!hasFactCorrections}
          available={hasFactCorrections}
          icon="🔧"
          typeLabel="팩트 정정"
          typeColor={hasFactCorrections ? "#2563eb" : "#9ca3af"}
          detail={
            hasFactCorrections
              ? `${factCorrections.length}건 수정`
              : "해당 없음"
          }
        />

        {/* Phase 3 — nid 링크 (disabled) */}
        <AllInOneCheckboxItem
          checked={false}
          onChange={() => {}}
          disabled
          available={false}
          icon="📎"
          typeLabel="nid 링크"
          typeColor="#9ca3af"
          detail="제안 없음"
        />

        {/* Phase 3 — 태그 추가 (disabled) */}
        <AllInOneCheckboxItem
          checked={false}
          onChange={() => {}}
          disabled
          available={false}
          icon="🏷️"
          typeLabel="태그 추가"
          typeColor="#9ca3af"
          detail="제안 없음"
          isLast
        />
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "#f5f3ff", borderTop: "1px solid #ede9fe" }}
      >
        <div className="text-xs text-[#6b7280]">
          예상 비용: $0.04
          <br />
          <span className="text-[11px]">백업 자동 생성됨</span>
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={!hasCheckedAnything || fixApply.isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-white border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:-translate-y-px"
          style={{
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            boxShadow: "0 2px 8px rgba(79,70,229,0.3)",
          }}
        >
          {fixApply.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              적용 중...
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>전체 적용 ({checkedCount > 0 ? checkedCount : recommendedCount}건)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function AllInOneCheckboxItem({
  checked,
  onChange,
  disabled,
  available,
  icon,
  typeLabel,
  typeColor,
  detail,
  isLast,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  available: boolean;
  icon: string;
  typeLabel: string;
  typeColor: string;
  detail: string;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 py-1.5 text-[13px]"
      style={{
        borderBottom: isLast ? "none" : "1px solid #ede9fe",
        opacity: available ? 1 : 0.4,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 shrink-0"
        style={{ accentColor: "#4f46e5" }}
      />
      <span className="text-base">{icon}</span>
      <span className="font-semibold min-w-[80px]" style={{ color: typeColor }}>
        {typeLabel}
      </span>
      <span
        className="flex-1 text-xs"
        style={{ color: available ? "#6b7280" : "#bbbbbb" }}
      >
        {detail}
      </span>
    </div>
  );
}
