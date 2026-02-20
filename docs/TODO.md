# TODO / Roadmap

이 문서는 GitHub Issues 기반 작업을 빠르게 파악하기 위한 인덱스다.
실제 진행 상태의 단일 진실 소스(SoT)는 GitHub Issues를 사용한다.

## 1. 현재 상태 요약

- 완료: 품질 게이트 정비, core/server/web 빌드 안정화, CI 도입, 백업/롤백 무결성 개선, API 인증/프라이버시 모드 도입
- 남은 작업: 문서 체계 정합성 최종 정리

## 2. 이슈 운영 원칙

1. 작업은 반드시 이슈 단위로 수행한다.
2. 우선순위는 `priority:*`, 도메인은 `area:*` 라벨로 판단한다.
3. 완료 시 이슈 본문의 Acceptance Criteria 충족 여부를 확인한다.
4. 구현 변경이 문서에 영향을 주면 `README` 또는 `docs/*`를 동시 갱신한다.

## 3. 단기 체크리스트

- [ ] README와 `docs/*`의 내용이 최신 코드와 일치하는지 최종 검수
- [ ] `docs/TROUBLESHOOTING.md` 시나리오를 실제 로컬 환경에서 재현 점검
- [ ] 신규 기능 추가 시 `docs/FEATURES.md` 동기화 규칙 확정

## 4. 참고 명령

```bash
# 열린 이슈 조회
gh issue list --state open

# 우선순위 높은 이슈 조회
gh issue list --label "priority:high"

# 문서 변경 포함 전체 검증
bun run check
```
