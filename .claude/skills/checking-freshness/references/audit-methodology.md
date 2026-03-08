# 감사 방법론 (Audit Methodology)

## 왜 병렬 에이전트인가

기존 git-diff 기반 타임스탬프 비교는 "언제" 수정되었는지만 알 수 있다.
실제로 스킬 문서가 코드와 일치하는지는 **내용 대조**가 필요하다.

Opus 4.6 수준의 모델은 코드베이스를 직접 탐색하여 동일한 답을 도출할 수 있으므로
(eval 결과: 12개 스킬 중 9개가 delta=0), 스킬이 제공하는 정보가 코드와 불일치하면
오히려 해롭다. 따라서 감사의 핵심은 **정확성**이다.

## === Change Intent Record: 스킬 합리화 시도와 복구 ===
##
## 배경:
## 12개 프로젝트 스킬의 실질적 가치를 측정하기 위해 skill-creator eval 루프를 실행.
## 24개 테스트(12 스킬 x 2 프롬프트)를 with_skill / without_skill 두 변종으로
## Opus 4.6 에이전트를 돌려 assertion 기반 채점 수행.
##
## v1 (e3d6702, PR #80): 전체 12개 스킬 품질 개선 + deploying-server 신규 스킬 생성.
##   당시에는 스킬이 많을수록 좋다고 판단.
##
## v2 (3155e73, PR #80): eval 결과 분석 — with_skill 97% vs without_skill 92%,
##   전체 delta +0.06 (5%p). 9/12 스킬이 delta=0.
##   - delta > 0 스킬: deploying-server(+3), tracking-todo(+1), checking-freshness(+1)
##   - delta = 0 스킬 (9개): understanding-project, working-with-anki, splitting-cards,
##     validating-cards, managing-embeddings, managing-prompts, managing-llm,
##     developing-web-api, developing-web-ui
##   - 원인: Opus 4.6은 코드베이스를 직접 탐색하여 스킬 없이도 동일 품질 달성.
##     delta > 0 스킬의 공통점: (1) 외부 인프라 지식 (deploying-server),
##     (2) 시간축 상태 추적 (tracking-todo), (3) 메타 스킬 (checking-freshness).
##   - 스킬 가치 분류:
##     (A) 코드베이스에 없는 외부 지식 → 높은 가치 (deploying-server)
##     (B) 시간축 상태 추적 → 중간 가치 (tracking-todo)
##     (C) 안전/행동 규칙 → 낮지만 유의미 (checking-freshness)
##     (D) 코드 문서화 → 측정 가치 없음 (나머지 9개, delta=0)
##   - 결정: 9개 스킬 삭제, 3개만 유지. checking-freshness를 병렬 에이전트 감사 도구로 업그레이드.
##   - 발견된 부작용: validating-cards 스킬이 실제 코드와 불일치하는 정보를 갖고 있었음
##     (validate/all이 4종 검증을 모두 실행하는데, 스킬은 Jaccard만 실행한다고 기술).
##     이는 스킬 유지보수 비용의 실제 위험을 증명.
##
## v3 (이번 변경): 사용자 판단으로 삭제 보류, 9개 전량 복원.
##   이유: "삭제는 아직까지는 잘 모르겠다" — eval delta=0이라는 정량 근거에도 불구하고
##   스킬을 제거하면 복구 비용이 높고, 토큰 절약은 큰 메리트가 아니며,
##   유지보수 비용이 관리 가능한 수준이면 보유하는 편이 안전하다고 판단.
##   checking-freshness 업그레이드(병렬 에이전트 기반)만 유지.
##
## 최종 상태:
##   - 12개 스킬 전량 유지 (원래대로)
##   - checking-freshness만 병렬 에이전트 기반 감사 도구로 업그레이드
##   - CLAUDE.md에 AnkiConnect server 프로필 안전 규칙 추가 (working-with-anki에서 추출)
##
## trade-off: 9개 스킬의 유지보수 비용을 계속 감수하지만,
##   삭제 후 필요할 때 재생성하는 비용(품질 저하 리스크 포함)을 회피.
##   eval이 증명한 "delta=0" 사실은 기록으로 남겨두어,
##   향후 스킬 정리가 필요할 때 데이터 기반 의사결정에 재활용.
##
## 핵심 교훈:
##   1. Opus 4.6급 모델에서 코드 문서화 스킬(D)은 측정 가능한 가치가 없다.
##   2. 스킬의 가치는 "코드베이스에 없는 정보"를 제공할 때 발생한다.
##   3. 스킬이 코드와 불일치하면 오히려 해롭다 (validating-cards 사례).
##   4. 삭제는 비가역적이므로 정량 근거가 있어도 보수적 판단이 합리적일 수 있다.
##
## 참조 데이터:
##   - eval-workspace는 삭제됨 (benchmark.json, evals.json, grading 결과 등)
##   - eval 실행 환경: Opus 4.6, 24 테스트, with_skill/without_skill 에이전트 병렬 실행
##   - generate_review.py로 HTML 리뷰 UI 생성하여 수동 검토 완료

## 에이전트 프롬프트 상세

### deploying-server 감사

```
스킬 'deploying-server'의 감사를 수행한다.

이 스킬은 코드베이스에 없는 외부 인프라 지식을 담고 있다.
따라서 코드 대조보다 다음에 집중:

1. 스킬 문서 전체 읽기 (SKILL.md + references/)
2. 프로젝트의 배포 관련 파일 확인:
   - nix/ 디렉토리, flake.nix
   - Containerfile, docker-compose*.yml
   - lefthook.yml (배포 관련 훅)
3. 검증 항목:
   - 컨테이너 이미지 빌드 명령이 Containerfile과 일치하는가?
   - NixOS 모듈 경로와 설정이 nix/ 파일과 일치하는가?
   - 포트 번호, 도메인, 환경변수가 코드와 일치하는가?
   - 서버 접속 방법(Tailscale IP 등)이 최신인가?
4. 결과 보고 (정확/불일치/누락/삭제필요)
```

### tracking-todo 감사

```
스킬 'tracking-todo'의 감사를 수행한다.

이 스킬은 시간축 기반 상태를 추적한다.
코드 대조와 함께 상태 정보의 최신성을 확인:

1. 스킬 문서 전체 읽기
2. 프로젝트의 실제 상태 확인:
   - package.json의 scripts, dependencies
   - 주요 기능 파일 존재 여부
   - GitHub Issues (있다면)
   - 최근 커밋 히스토리
3. 검증 항목:
   - "구현됨"으로 표시된 기능이 실제로 존재하는가?
   - "미구현"으로 표시된 기능이 이미 구현되었는가?
   - 기술 부채 목록이 현재 코드 상태를 반영하는가?
   - 로드맵이 최근 방향과 일치하는가?
4. 결과 보고
```

### checking-freshness 자기 감사

```
스킬 'checking-freshness'의 자기 감사를 수행한다.

1. SKILL.md와 references/ 전체 읽기
2. CLAUDE.md의 라우팅 테이블과 비교:
   - 라우팅 테이블에 있는 스킬이 실제로 존재하는가?
   - 각 스킬의 trigger 키워드가 SKILL.md description과 일치하는가?
3. check-docs-freshness.sh의 매핑이 현재 스킬 목록과 일치하는가?
4. 결과 보고
```

## 판정 기준

| 판정 | 기준 |
|------|------|
| 정확 | 문서의 기술이 실제 코드/상태와 완전히 일치 |
| 불일치 | 문서와 실제가 다름 (파일명, 함수명, 동작 방식, 설정값 등) |
| 누락 | 코드에 중요한 변경이 있지만 문서에 반영되지 않음 |
| 삭제필요 | 문서에 기술되어 있지만 코드에서 이미 제거됨 |

## 감사 주기

- **커밋 시**: pre-commit hook이 타임스탬프 경고 (자동)
- **수동 요청 시**: 병렬 에이전트 감사 실행
- **대규모 리팩터링 후**: 전체 스킬 감사 권장
