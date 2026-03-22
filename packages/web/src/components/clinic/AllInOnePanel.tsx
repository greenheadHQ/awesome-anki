/**
 * AllInOnePanel - 일괄 수정 패널
 *
 * 우측 패널 하단에 고정 배치.
 * 적용 가능한 수정(YAGNI 제거, 팩트 정정)을 체크박스로 선택하고
 * 한 번의 Apply로 백업 + 수정 + (선택 시) Split 이동을 처리한다.
 */

import { Loader2, Scissors, Tag, Link2, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useFixApply } from "../../hooks/useClinicCache";
import type { AllValidationResult } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

interface AllInOnePanelProps {
  cardContent: string;
  noteId: number;
  deckName: string;
  validationResults: AllValidationResult["results"] | undefined;
}

// --- 순수 문자열 조작 (core/validator/card-fixer 미러) ---

function removeYagniClozes(content: string, clozesToRemove: number[]): string {
  if (clozesToRemove.length === 0) return content;

  let result = content;
  for (const clozeNum of clozesToRemove) {
    const pattern = new RegExp(
      `\\{\\{c${clozeNum}::([^}]+?)(?:::[^}]+)?\\}\\}`,
      "g",
    );
    result = result.replace(pattern, "");
  }

  return result
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*\n/gm, "\n")
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");
}

function applyFactCorrections(
  content: string,
  corrections: Array<{ claim: string; correction: string }>,
): string {
  let result = content;
  for (const { claim, correction } of corrections) {
    if (!claim || !correction || claim === correction) continue;
    const escaped = claim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "g");
    if (!pattern.test(result)) continue;
    const fresh = new RegExp(escaped, "g");
    result = result.replace(fresh, correction);
  }
  return result;
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
  const isSplitRecommended =
    validationResults?.verbose?.details.recommendation === "split";
  const isYagni = validationResults?.yagni?.details.isYagni === true;
  const yagniClozes = validationResults?.yagni?.details.affectedClozes ?? [];

  const factCorrections = useMemo(() => {
    if (!validationResults?.factCheck?.details.claims) return [];
    return validationResults.factCheck.details.claims
      .filter((c) => !c.isVerified && c.correction)
      .map((c) => ({ claim: c.claim, correction: c.correction! }));
  }, [validationResults]);
  const hasFactCorrections = factCorrections.length > 0;

  const hasAnyAction = isSplitRecommended || isYagni || hasFactCorrections;

  // --- 체크박스 상태 ---
  const [splitChecked, setSplitChecked] = useState(false);
  const [yagniChecked, setYagniChecked] = useState(false);
  const [factChecked, setFactChecked] = useState(false);

  const hasCheckedFixes = yagniChecked || factChecked;
  const hasCheckedAnything = splitChecked || hasCheckedFixes;

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
        await fixApply.mutateAsync({ noteId, fixedContent, deckName });
        toast.success("수정 적용 완료", { description: "백업이 자동 생성되었습니다." });
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
    <div className="border-t bg-gradient-to-r from-purple-600 to-indigo-600 p-3 shrink-0">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-white/90">All-in-One 수정</p>

        {/* 체크박스 목록 */}
        <div className="space-y-1.5">
          {/* Split */}
          <CheckboxRow
            checked={splitChecked}
            onChange={setSplitChecked}
            disabled={!isSplitRecommended}
            icon={<Scissors className="w-3.5 h-3.5" />}
            label="Split 분할"
            available={isSplitRecommended}
          />

          {/* YAGNI */}
          <CheckboxRow
            checked={yagniChecked}
            onChange={setYagniChecked}
            disabled={!isYagni}
            icon={<Trash2 className="w-3.5 h-3.5" />}
            label={`YAGNI 제거 (${yagniClozes.length}개)`}
            available={isYagni}
          />

          {/* Fact Correction */}
          <CheckboxRow
            checked={factChecked}
            onChange={setFactChecked}
            disabled={!hasFactCorrections}
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            label={`팩트 정정 (${factCorrections.length}개)`}
            available={hasFactCorrections}
          />

          {/* Phase 3 — disabled */}
          <CheckboxRow
            checked={false}
            onChange={() => {}}
            disabled={true}
            icon={<Link2 className="w-3.5 h-3.5" />}
            label="nid 링크 정리"
            available={false}
            phase3
          />
          <CheckboxRow
            checked={false}
            onChange={() => {}}
            disabled={true}
            icon={<Tag className="w-3.5 h-3.5" />}
            label="태그 정리"
            available={false}
            phase3
          />
        </div>

        {/* Apply 버튼 */}
        <Button
          size="sm"
          className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
          variant="outline"
          onClick={handleApply}
          disabled={!hasCheckedAnything || fixApply.isPending}
        >
          {fixApply.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              적용 중...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-1.5" />
              {splitChecked && !hasCheckedFixes
                ? "Split으로 이동"
                : `선택 항목 적용${splitChecked ? " + Split" : ""}`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function CheckboxRow({
  checked,
  onChange,
  disabled,
  icon,
  label,
  available,
  phase3,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  available: boolean;
  phase3?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors cursor-pointer",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-white/10",
        checked && !disabled && "bg-white/15",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="accent-white w-3.5 h-3.5 shrink-0"
      />
      <span className="text-white/80 shrink-0">{icon}</span>
      <span className={cn("text-white/90 flex-1", !available && "line-through")}>
        {label}
      </span>
      {phase3 && (
        <span className="text-[10px] text-white/50 bg-white/10 px-1 py-0.5 rounded">
          Phase 3
        </span>
      )}
    </label>
  );
}
