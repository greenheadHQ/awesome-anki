---
name: syncing-prompts
description: |
  프롬프트 원격 업데이트 워크플로. 코드 수정 없이 API 호출만으로 원격 DB의
  시스템 프롬프트를 업데이트한다. prompts.ts는 폴백일 뿐, 실제 프롬프트는 원격 DB가 SoT.
  Triggers: "프롬프트 업데이트", "원격 프롬프트", "프롬프트 동기화",
  "프롬프트 푸시", "syncing prompts", "prompt update", "prompt sync".
---

# 프롬프트 원격 동기화

## 아키텍처

프롬프트 시스템은 이중 구조:

| 계층 | 위치 | 역할 |
|------|------|------|
| **원격 DB (SoT)** | AnkiConnect config (`awesomeAnki.prompts.system`) | 런타임에서 실제 사용되는 프롬프트 |
| **코드 폴백** | `packages/core/src/gemini/prompts.ts` `SYSTEM_PROMPT` | 원격 DB가 없을 때만 사용 |

`client.ts`에서 `prompts?.systemPrompt ?? SYSTEM_PROMPT` 패턴으로 원격 값이 항상 우선.

**핵심: 프롬프트를 업데이트하려면 코드를 수정하는 것이 아니라 API를 호출해야 한다.**

## 업데이트 절차

### Step 1: 현재 revision 조회

```bash
curl -s https://anki.greenhead.dev/api/prompts/system | python3 -m json.tool
```

응답에서 `revision` 값을 확인한다 (CAS에 필요).

### Step 2: 새 프롬프트 푸시

```bash
curl -X POST https://anki.greenhead.dev/api/prompts/system \
  -H "Content-Type: application/json" \
  -d '{
    "expectedRevision": <현재 revision>,
    "systemPrompt": "<새 프롬프트 텍스트>",
    "reason": "<변경 사유>"
  }'
```

또는 Bun으로 코드의 SYSTEM_PROMPT를 직접 읽어서 푸시:

```bash
bun -e "
import { SYSTEM_PROMPT } from './packages/core/src/gemini/prompts.ts';
const resp = await fetch('https://anki.greenhead.dev/api/prompts/system', {
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
curl -s https://anki.greenhead.dev/api/prompts/system | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'revision: {d[\"revision\"]}')
print(f'version: {d[\"activeVersion\"][\"name\"]}')
print(f'prompt 앞 50자: {d[\"systemPrompt\"][:50]}...')
"
```

## 주의사항

- **CAS 필수**: `expectedRevision`이 현재 revision과 일치해야 한다. 불일치 시 409 Conflict.
- **prompts.ts 변경만으로는 반영 안 됨**: 코드를 변경해도 원격 DB의 프롬프트는 자동 업데이트되지 않는다.
- **롤백**: API가 실패하면 자동 롤백된다 (remote payload + active version 복구).
- **웹 UI 확인**: `https://anki.greenhead.dev/prompts`에서 활성 버전과 프롬프트 본문을 확인 가능.
