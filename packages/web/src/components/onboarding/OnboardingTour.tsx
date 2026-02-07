import Joyride, { type CallBackProps, STATUS, type Step } from "react-joyride";
import { useOnboarding } from "../../hooks/useOnboarding";

const steps: Step[] = [
  {
    target: "body",
    content: (
      <div className="text-left">
        <h3 className="font-bold text-lg mb-2">
          Anki Splitter에 오신 것을 환영합니다!
        </h3>
        <p className="text-sm text-gray-600">
          이 도구는 정보 밀도가 높은 Anki 카드를 원자적 단위로 분할해줍니다.
          간단한 가이드를 통해 주요 기능을 알아보세요.
        </p>
      </div>
    ),
    placement: "center",
    disableBeacon: true,
  },
  {
    target: '[data-tour="deck-selector"]',
    content: (
      <div className="text-left">
        <h3 className="font-bold mb-2">1. 덱 선택</h3>
        <p className="text-sm text-gray-600">
          먼저 작업할 덱을 선택하세요.
          <br />
          <br />
          선택하면 통계 카드(총 노트, 분할 후보, 임베딩 상태)와 빠른 작업 버튼이
          표시됩니다.
        </p>
      </div>
    ),
    placement: "bottom",
  },
  {
    target: '[data-tour="nav-split"]',
    content: (
      <div className="text-left">
        <h3 className="font-bold mb-2">2. Split 페이지</h3>
        <p className="text-sm text-gray-600">
          분할 후보를 선택하고 미리보기를 확인한 후 분할을 적용합니다. 3단
          레이아웃으로 원본과 결과를 비교할 수 있습니다.
        </p>
      </div>
    ),
    placement: "right",
    spotlightPadding: 0,
  },
  {
    target: '[data-tour="nav-backups"]',
    content: (
      <div className="text-left">
        <h3 className="font-bold mb-2">3. Backups 페이지</h3>
        <p className="text-sm text-gray-600">
          분할 적용 전 자동으로 백업이 생성됩니다. 언제든지 롤백하여 원래 상태로
          복구할 수 있습니다.
        </p>
      </div>
    ),
    placement: "right",
    spotlightPadding: 0,
  },
  {
    target: '[data-tour="nav-help"]',
    content: (
      <div className="text-left">
        <h3 className="font-bold mb-2">4. 도움말</h3>
        <p className="text-sm text-gray-600">
          더 자세한 기능 설명과 FAQ는 Help 페이지에서 확인하세요. 언제든지 다시
          볼 수 있습니다!
        </p>
      </div>
    ),
    placement: "right",
    spotlightPadding: 0,
  },
];

interface OnboardingTourProps {
  run?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ run, onComplete }: OnboardingTourProps) {
  // run prop이 전달되면 외부에서 제어, 아니면 내부 hook 사용
  const internalState = useOnboarding();
  const isRunning = run !== undefined ? run : internalState.shouldRun;
  const handleComplete = onComplete || internalState.completeOnboarding;

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      handleComplete();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={isRunning}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: "#3b82f6",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: "8px",
          padding: "16px",
        },
        buttonNext: {
          borderRadius: "6px",
          padding: "8px 16px",
        },
        buttonBack: {
          marginRight: "8px",
        },
        buttonSkip: {
          color: "#6b7280",
        },
      }}
      locale={{
        back: "이전",
        close: "닫기",
        last: "완료",
        next: "다음",
        skip: "건너뛰기",
      }}
    />
  );
}
