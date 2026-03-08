---
name: checking-freshness
description: |
  스킬과 문서의 최신성을 병렬 에이전트로 대규모 감사하는 도구.
  코드-문서 동기화 상태 확인, 오래된 스킬 탐지, 구조적 품질 검증을 수행한다.
  단순 git log 확인이 아니라 실제 코드와 문서 내용을 대조하여 정확도를 높인다.
  Triggers: "문서 오래됐어", "스킬 최신화", "스킬 감사", "스킬 점검",
  "git log 수정일", "코드 문서 동기화", "스킬 업데이트 필요해",
  "오래된 스킬", "docs freshness", "skill audit", "skill review",
  "스킬 품질 확인", "스킬 정리", "skill cleanup", "routing table 점검".
  Make sure to use this skill whenever the user mentions skill maintenance,
  documentation staleness, code-docs sync, or wants to audit skill quality —
  even if they don't explicitly say "freshness".
---

# 스킬 감사 (Parallel Agent-based Audit)

이 스킬은 프로젝트의 스킬과 문서가 실제 코드베이스와 동기화되어 있는지를
**병렬 에이전트**를 사용하여 대규모로, 정확하게 검증한다.

## 감사 대상

현재 프로젝트의 활성 스킬 목록 (CLAUDE.md 라우팅 테이블 참조):

| 스킬 | 핵심 가치 |
|------|-----------|
| `deploying-server` | 코드베이스에 없는 외부 인프라 지식 (NixOS, Podman, Caddy 등) |
| `tracking-todo` | 시간축 기반 상태 추적 (구현/미구현, 기술 부채, 로드맵) |
| `checking-freshness` | 스킬 자체의 품질과 최신성 유지 (이 스킬) |

## 감사 실행 방법

### 1. 병렬 에이전트 감사 (권장)

각 스킬에 대해 **독립적인 Explore 에이전트**를 병렬로 실행하여 감사한다.
토큰을 아끼지 않고 철저하게 검증하는 것이 핵심이다.

```
각 스킬에 대해 Agent(subagent_type="Explore")를 병렬 실행:

에이전트 프롬프트 템플릿:
"스킬 '{skill_name}'의 감사를 수행한다.

1. 스킬 문서 읽기: .claude/skills/{skill_name}/SKILL.md 및 references/ 전체
2. 소스 코드 탐색: 스킬이 다루는 소스 경로의 실제 코드 확인
3. 다음 항목을 검증:
   - 스킬에 기술된 파일 경로가 실제로 존재하는가?
   - 스킬에 기술된 함수/클래스/타입이 실제 코드와 일치하는가?
   - 스킬에 기술된 동작 방식이 실제 구현과 일치하는가?
   - 스킬에 누락된 중요 코드 변경이 있는가?
4. 결과를 다음 형식으로 보고:
   - 정확한 항목 (코드와 일치)
   - 불일치 항목 (코드와 다름) + 구체적 차이점
   - 누락 항목 (코드에는 있지만 문서에 없음)
   - 삭제 필요 (문서에는 있지만 코드에서 삭제됨)"
```

### 2. 빠른 타임스탬프 확인

간단한 시간 기반 확인이 필요할 때:

```bash
# 전체 스킬 최신성 한 줄 확인
for f in .claude/skills/*/SKILL.md; do
  echo "$(basename $(dirname $f)): $(git log -1 --format='%ar' -- "$f")"
done

# 소스 vs 스킬 수정일 비교
git log -1 --format='%ar' -- packages/server/  # 소스
git log -1 --format='%ar' -- .claude/skills/deploying-server/  # 스킬
```

### 3. 구조적 품질 검증

스킬 구조가 올바른지 확인하는 체크리스트:

- [ ] YAML frontmatter에 `name`과 `description` 존재
- [ ] `description`의 trigger 키워드가 CLAUDE.md 라우팅 테이블과 일치
- [ ] references/ 파일이 SKILL.md에서 참조됨
- [ ] 존재하지 않는 파일 경로를 참조하지 않음

## 소스-스킬 매핑

| 소스 경로 | 대응 스킬 |
|-----------|-----------|
| `nix/`, `Containerfile`, `docker-compose*.yml` | `deploying-server` |
| `packages/server/src/` (배포 관련) | `deploying-server` |
| `.claude/skills/` | `checking-freshness` |
| `CLAUDE.md` (라우팅 테이블) | `checking-freshness` |

> 위 매핑에 없는 소스 경로는 스킬이 아닌 코드베이스 직접 탐색으로 해결한다.

## 자동화: lefthook pre-commit

`lefthook.yml`의 `docs-freshness` 커맨드가 staged 파일 중 `packages/**/*.{ts,tsx}` 또는
`.claude/skills/**` 변경 감지 시 `.claude/scripts/check-docs-freshness.sh`를 호출하여
대응 스킬의 최종 수정일 확인 (경고만, 블록하지 않음).

## 감사 결과 처리

감사 결과에서 불일치가 발견되면:

1. **불일치 항목**: 스킬 문서를 실제 코드에 맞게 수정
2. **누락 항목**: 중요한 변경이면 스킬 문서에 추가
3. **삭제 필요**: 코드에서 제거된 기능은 스킬 문서에서도 제거
4. **정확한 항목**: 변경 불필요

## 상세 참조

- `references/audit-methodology.md` — 감사 방법론, 에이전트 프롬프트 상세, 판정 기준
- `references/troubleshooting.md` — 감사 중 자주 발생하는 오류 해결
