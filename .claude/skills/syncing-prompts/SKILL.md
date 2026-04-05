---
name: syncing-prompts
description: |
  프롬프트 원격 업데이트 워크플로. 코드 수정 없이 API 호출만으로 AnkiConnect config의
  시스템 프롬프트를 업데이트한다. prompts.ts는 폴백일 뿐, 실제 프롬프트는 원격 config가 SoT.
  Triggers: "프롬프트 업데이트", "원격 프롬프트", "프롬프트 동기화",
  "프롬프트 푸시", "시스템 프롬프트 변경", "시스템 프롬프트 바꿔",
  "syncing prompts", "prompt update", "prompt sync",
  "push prompt", "update system prompt", "remote prompt update".
---

# 프롬프트 원격 동기화

## 아키텍처

프롬프트 시스템은 이중 구조:

| 계층 | 위치 | 역할 |
|------|------|------|
| **원격 Config (SoT)** | AnkiConnect config (`awesomeAnki.prompts.system`) | 런타임에서 실제 사용되는 프롬프트 |
| **코드 폴백** | `packages/core/src/gemini/prompts.ts` `SYSTEM_PROMPT` | 원격 config가 없을 때만 사용 |

`client.ts`에서 `prompts?.systemPrompt ?? SYSTEM_PROMPT` 패턴으로 원격 값이 항상 우선.

**핵심: 프롬프트를 업데이트하려면 코드를 수정하는 것이 아니라 API를 호출해야 한다.**

## 업데이트 절차

서버 URL은 CLAUDE.md의 AnkiConnect 설정을 참조한다 (현재 기본: `anki.greenhead.dev`).

### Step 1: 현재 revision 조회

```bash
curl -s https://<서버>/api/prompts/system | jq .
```

응답에서 `revision` 값을 확인한다 (CAS에 필요).
404가 반환되면 원격이 미초기화 상태이며, `expectedRevision: 0`으로 최초 POST를 수행한다.

### Step 2: 새 프롬프트 푸시

```bash
curl -X POST https://<서버>/api/prompts/system \
  -H "Content-Type: application/json" \
  -d '{
    "expectedRevision": <현재 revision>,
    "systemPrompt": "<새 프롬프트 텍스트>",
    "reason": "<변경 사유>"
  }'
```

또는 Bun으로 코드의 SYSTEM_PROMPT를 직접 읽어서 푸시 (프로젝트 루트에서 실행):

```bash
bun -e "
import { SYSTEM_PROMPT } from './packages/core/src/gemini/prompts.ts';
const resp = await fetch('https://<서버>/api/prompts/system', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    expectedRevision: <현재 revision>,
    systemPrompt: SYSTEM_PROMPT,
    reason: '<변경 사유>'
  })
});
console.log(await resp.json());
"
```

### Step 3: 검증

```bash
curl -s https://<서버>/api/prompts/system | jq '{revision, version: .activeVersion.name, preview: (.systemPrompt[:50] + "...")}'
```

## 주의사항

- **CAS 필수**: `expectedRevision`이 현재 revision과 일치해야 한다. 불일치 시 409 Conflict.
- **prompts.ts 변경만으로는 반영 안 됨**: 코드를 변경해도 원격 config의 프롬프트는 자동 업데이트되지 않는다.
- **롤백**: POST 과정에서 실패하면 remote payload + active version이 자동 복구된다.
- **에러 코드**: 400 (validation 실패/활성 버전 없음), 404 (원격 미초기화), 409 (revision 충돌), 503 (sync 실패).
- **웹 UI**: 프롬프트 관리 페이지(`/prompts`)에서 활성 버전과 본문을 확인 가능.
- **managing-prompts 스킬과의 관계**: 버전 관리, A/B 테스트, 품질 추적 등 프롬프트 시스템 전반은 `managing-prompts` 참조. 이 스킬은 원격 업데이트 절차에만 집중.
