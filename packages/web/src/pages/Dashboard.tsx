import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  FileStack,
  FolderOpen,
  Loader2,
  RotateCcw,
  Scissors,
  Shield,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HelpTooltip } from "../components/help/HelpTooltip";
import { OnboardingTour } from "../components/onboarding/OnboardingTour";
import { Button } from "../components/ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/Card";
import { useDeckStats, useDecks } from "../hooks/useDecks";
import { useOnboarding } from "../hooks/useOnboarding";
import { api } from "../lib/api";

export function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: decksData, isLoading: isLoadingDecks } = useDecks();
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null);
  const { data: stats, isLoading: isLoadingStats } = useDeckStats(selectedDeck);
  const {
    isCompleted: onboardingCompleted,
    shouldRun: onboardingShouldRun,
    startOnboarding,
    completeOnboarding,
  } = useOnboarding();

  // 임베딩 상태 조회
  const { data: embeddingStatus, isLoading: isLoadingEmbedding } = useQuery({
    queryKey: ["embedding-status", selectedDeck],
    queryFn: () => api.embedding.status(selectedDeck as string),
    enabled: !!selectedDeck,
    staleTime: 30000,
  });

  // 프라이버시 상태 조회
  const { data: privacyStatus, isLoading: isLoadingPrivacy } = useQuery({
    queryKey: ["privacy", "status"],
    queryFn: () => api.privacy.status(),
    staleTime: 60 * 1000,
  });

  // 임베딩 생성 뮤테이션
  const generateMutation = useMutation({
    mutationFn: () => api.embedding.generate(selectedDeck as string, false),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["embedding-status", selectedDeck],
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Onboarding Tour */}
      <OnboardingTour
        run={onboardingShouldRun}
        onComplete={completeOnboarding}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Anki 카드를 원자적 단위로 분할하세요
          </p>
        </div>
        {onboardingCompleted && (
          <Button variant="ghost" size="sm" onClick={startOnboarding}>
            <RotateCcw className="mr-2 h-4 w-4" />
            가이드 다시 보기
          </Button>
        )}
      </div>

      {/* Deck Selector */}
      <Card data-tour="deck-selector">
        <CardHeader>
          <CardTitle className="text-lg">덱 선택</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingDecks ? (
            <p className="text-muted-foreground">로딩 중...</p>
          ) : (
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={selectedDeck || ""}
              onChange={(e) => setSelectedDeck(e.target.value || null)}
            >
              <option value="">덱을 선택하세요</option>
              {decksData?.decks.map((deck) => (
                <option key={deck} value={deck}>
                  {deck}
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-600" />
            프라이버시 모드
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPrivacy ? (
            <div className="text-sm text-muted-foreground">로딩 중...</div>
          ) : (
            <div className="space-y-1">
              <div className="text-base font-semibold">
                {privacyStatus?.mode ?? "unknown"}
              </div>
              <p className="text-xs text-muted-foreground">
                {privacyStatus?.description ?? "상태를 불러올 수 없습니다."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {selectedDeck && (
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          data-tour="stats-cards"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">총 노트</CardTitle>
              <FileStack className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? "..." : stats?.totalNotes || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                분할 후보
                <HelpTooltip helpKey="splitCandidate" />
              </CardTitle>
              <Scissors className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? "..." : stats?.splitCandidates || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                Hard Split
                <HelpTooltip helpKey="hardSplit" />
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {isLoadingStats ? "..." : stats?.hardSplitCount || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                Soft Split
                <HelpTooltip helpKey="softSplit" />
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {isLoadingStats ? "..." : stats?.softSplitCount || 0}
              </div>
            </CardContent>
          </Card>

          {/* 임베딩 상태 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1">
                임베딩
                <HelpTooltip helpKey="embeddingCoverage" />
              </CardTitle>
              <Sparkles className="h-4 w-4 text-violet-500" />
            </CardHeader>
            <CardContent>
              {isLoadingEmbedding ? (
                <div className="text-2xl font-bold text-muted-foreground">
                  ...
                </div>
              ) : embeddingStatus?.exists ? (
                <div>
                  <div className="text-2xl font-bold text-violet-600">
                    {embeddingStatus.coverage}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {embeddingStatus.totalEmbeddings} /{" "}
                    {embeddingStatus.totalNotes}
                  </p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">없음</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      {selectedDeck && (
        <Card data-tour="quick-actions">
          <CardHeader>
            <CardTitle className="text-lg">빠른 작업</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <Button
              onClick={() =>
                navigate("/split", { state: { deckName: selectedDeck } })
              }
            >
              <Scissors className="mr-2 h-4 w-4" />
              분할 시작
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                navigate("/browse", { state: { deckName: selectedDeck } })
              }
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              카드 브라우저
            </Button>
            <Button
              variant="outline"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  임베딩 생성 중...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  임베딩 생성
                  {embeddingStatus?.exists &&
                    embeddingStatus.coverage < 100 && (
                      <span className="ml-1 text-xs opacity-70">
                        ({embeddingStatus.coverage}%)
                      </span>
                    )}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
