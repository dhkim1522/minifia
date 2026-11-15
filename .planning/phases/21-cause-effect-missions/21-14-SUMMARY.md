---
phase: 21-cause-effect-missions
plan: "14"
subsystem: test-world-unlock-client
tags: [cause-effect, tests, migration, client, leak-tests]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-13 의 lockCauseInFile·underCauseLock(test/helpers/playable.ts)과 단위·워커 잠금 제거, 21-01 의 lockCause·openCause"
provides:
  - "화면(client) 시험 setup 이 원인 흐름을 더는 잠그지 않는다 — test/client/setup.ts 삭제, vitest.config.ts client 프로젝트의 setupFiles 줄 제거(21-01 이전 모양). 화면 시험의 기본 세계 = 제품(확장판 = 원인 흐름)"
  - "단위·워커·화면 세 프로젝트 모두 원인 흐름 잠금 없이 시작한다"
affects: [21-15, 21-16]

requirements-completed: [DAYFLOW-01, LEAK-02]

estimate:
  tokens: 80000
  raw_tokens: 80000
  tasks: 2
  confidence: low

actuals:
  tokens: 20000
  tasks: 2
  commits: 4

plan_head_before: 401f4dcb843bdb0836c783ed83525924663349a8
plan_head_after: ef40de766011bf97f35597a3792b1e3b22970cfc
commits: 4

tech-stack:
  added: []
  patterns:
    - "순서와 무관한 화면 시험은 view 에 mode basic 을 둔다(갈래 A) — 단언은 그대로, 기본 마피아 판이 실제 제품 세계다"
    - "꺼진 옛 확장판 화면은 시험 단위 underCauseLock·파일 머리 lockCauseInFile·시험 안 lockCause 로 보존한다(갈래 B)"
    - "원인 흐름 확장판 화면은 mode extended 로 새 순서를 단언한다(갈래 C)"

key-files:
  created: []
  modified:
    - vitest.config.ts
    - test/client/atmosphere.test.tsx
    - test/client/boardDiscussion.test.tsx
    - test/client/callGlow.test.tsx
    - test/client/characterAudit.test.tsx
    - test/client/errandScreen.test.tsx
    - test/client/gameMap.test.tsx
    - test/client/guide.test.tsx
    - test/client/hostBand.test.tsx
    - test/client/nightChat.test.tsx
    - test/client/nightMap.test.tsx
    - test/client/recordTrace.test.tsx
    - test/client/roleCardSheet.test.tsx
    - test/client/willFlow.test.tsx
    - test/client/worldStage.test.tsx
  deleted:
    - test/client/setup.ts

key-decisions:
  - "client setup 에는 lockCause 밖에 없어 파일을 지우고 setupFiles 줄도 함께 지웠다(계획의 '비면 둘 다' 규칙)"
  - "view 가 mode 를 싣지 않아 확장판으로 읽히던 화면 시험은 view 에 mode basic 을 명시했다 — 시험이 우연한 기본값에 기대지 않는다"
  - "기본 view 가 basic 이 된 gameMap·roleCardSheet 는 makeView 에 mode 선택 인자를 더하고 원인 흐름 시험은 mode extended 를 명시한다"

duration: 1 session
completed: 2026-11-15
---

# Phase 21 Plan 14: 화면 시험 원인 흐름 잠금 걷기 Summary

**화면 시험 setup 의 원인 흐름 잠금을 걷고(RED 75건/14개 파일) 파일마다 기본 마피아 판 view(A)·꺼진 옛 경로 보존(B)·새 흐름 단언(C)으로 옮겨 `npx vitest run --project client` 가 잠금 없이 99개 파일 3253건 통과 — 누설 성격 단언은 하나도 지우거나 줄이지 않았다.**

## 실행한 일

1. **Task 1**: `test/client/setup.ts`(lockCause 만 있던 파일)를 지우고 `vitest.config.ts` client 프로젝트의 `setupFiles` 줄을 지웠다(`grep -c setupFiles vitest.config.ts` = 2, 단위·워커만 남음). 곧바로 `npx vitest run --project client` 의 실패 목록을 기록했다. 커밋 09856c75.
2. **Task 2**: 실패한 14개 파일을 A/B/C 로 옮겼다(커밋 662096bc·bd456526·ef40de76). 다른 파일은 잠금을 걷어도 초록이라 건드리지 않았다.

## RED 증거 (잠금을 걷은 직후)

`npx vitest run --project client` → 전체 3329건 중 **실패 75건 / 14개 파일**(통과 3177, 건너뜀 77). 수집 실패·워커 사망 없음.

## 인벤토리

| 파일 | RED 실패 | 실패 원인 | 갈래 | 바꾼 것 |
|---|---|---|---|---|
| nightMap | 23 | view 가 mode 없음 → 확장판 원인 흐름의 밤(얼굴 목록 대신 집·조명 nightCitizen 등)이 그려짐 | A | makeView 에 `mode: "basic"` 한 줄 — 얼굴 목록 동일·배지·시민 편 어둠 표식 단언 그대로 |
| recordTrace | 18 | 낮 토론 [기록] 단추·아침 공개 흔적 카드·이름표 표시(옛 확장판 경로, 원인 흐름에서는 보드·카드 없음) | B | 파일 머리 lockCauseInFile + '꺼진 옛 확장판 경로' 주석(단언 그대로, 컴포넌트 구역은 영향 없음) |
| gameMap | 9 | 기본 view 가 확장판으로 읽혀 헤더 단추 2개([보드])·제목 순서가 다름(6건), 원인 흐름이 잠긴 심부름 단언 1건, '지금 그대로 extended' [기록]·증거 카드 2건 | A + B | makeView 에 mode 선택 인자(기본 basic) — 헤더 6건은 A; 심부름(저녁) 시험은 mode extended + 잠금 구간을 lockCause 로 직접 잠금; extended [기록]·증거 카드 2건은 underCauseLock |
| guide | 7 | 띠 문장이 원인 흐름 문구(단서를 말로 나눠 보세요·집을 눌러 주세요)로 바뀜 | A | makeView `mode: "basic"` — 역할별 띠 한 줄(HOST-05 다른 역할 줄 없음) 단언 그대로 |
| errandScreen | 3 | 시작 카드 뒤 띠 문장('빛나는 곳을 찾아 처리해 주세요')·카드를 눌러 닫기·callPlace 가 옛 심부름 목록 경로 | B | 세 시험만 underCauseLock + 주석(나머지 23건은 원인 흐름 세계에서 그대로 통과) |
| atmosphere | 3 | 밤 조명이 시민 편 nightCitizen 으로 달라짐 | A | makeView `mode: "basic"` |
| callGlow | 3 | 밤 얼굴 칸이 원인 흐름 밤에서 없음 | A | makeView `mode: "basic"` — 산 사람 모두 같은 얼굴 칸·유령 0개 단언 그대로 |
| hostBand | 2 | 토론 띠 문구가 원인 흐름 문구 | A | makeView `mode: "basic"` |
| worldStage | 2 | `__mfTown` 의 lampLit 이 확장판 마을에서 배열(1건), '원인 흐름이 잠긴(기본 setup) 마을' 이 setup 잠금에 기댐(1건) | A + B | 우체국 `__mfTown` 시험은 마을 view 에 mode basic(lamp 필드 null 단언 그대로); 잠긴 마을 시험은 underCauseLock(async) 로 직접 잠금 |
| boardDiscussion | 1 | '옛 확장판(원인 흐름이 닫힌 판)' 시험이 `restore()` 를 '잠긴 상태'로 가정 | B | lockCause 로 그 시험 동안만 잠금(openCause 기본은 그대로) |
| characterAudit | 1 | 이름표 이름 단언이 확장판 맵 화면(밤)에서 달라짐 | A | makeView `mode: "basic"` |
| nightChat | 1 | 산 마피아 밤: 채팅 패널 없음·얼굴 목록 대신 확장판 밤 | A | makeView `mode: "basic"` — 마피아 밤 채팅 패널 없음 단언 그대로 |
| willFlow | 1 | 밤 경찰·의사의 [유언] 행동 줄이 확장판 밤에서 얼굴 목록 아래에 없음 | A | makeView `mode: "basic"` |
| roleCardSheet | 1 | 원인 흐름 마피아 카드에 '길게 누르면 심지를 잘라요' 안내 줄이 설명과 동료 줄 사이에 더해짐 | A + C | makeView mode 선택 인자(기본 basic)로 기존 단언 그대로, 원인 흐름 확장판은 새 순서(마피아·설명·심지 줄·동료)와 경찰엔 심지 줄 없음을 새 시험으로 단언 |

위에 없는 나머지 화면 시험 파일(lampEvening·nightHouse·morningScene·phaseScreens 등)은 잠금을 걷어도 초록이라 건드리지 않았다.

## 시험 결과 (실제 출력)

- `npx vitest run --project client` → `Test Files  99 passed (99)`, `Tests  3253 passed | 77 skipped (3330)` (RED 3329 → 3330: roleCardSheet 새 시험 1건).
- `npx tsc -p tsconfig.app.json --noEmit` → 종료 코드 0, `npx tsc -p tsconfig.worker.json --noEmit` → 종료 코드 0, `npm run typecheck` 끝까지 오류 없음.
- `grep -c "setupFiles" vitest.config.ts` = 2, `test -f test/client/setup.ts` 없음, `export function lockCause` 는 test/helpers/playable.ts 에 남음(21-13 이 쓴다).

## 누설 성격 단언 (T-21-46)

역할별 DOM 동일·이름표 0건·다른 역할 줄 없음·유령 채널 같은 누설 보증 단언은 (nightMap·guide·callGlow·nightChat·hostBand·characterAudit·atmosphere·willFlow) **mode 한 줄만 더했을 뿐 본문은 diff 에 없다**. `git diff 401f4dcb..HEAD -- test/client` 의 삭제 줄은 import 줄·시험 머리/꼬리(`it(... () => {` → `underCauseLock(() => {`)·되돌리기 코드 교체·gameMap 심부름 시험의 잠금 후반 4줄(같은 단언을 lockCause 블록 안으로 옮김)·삭제한 setup 파일뿐이며 `expect` 가 든 단언이 사라진 곳은 없다(옮긴 단언은 추가 줄에 그대로 있다).

## skip 수 (불변)

시작 전 `grep -rlE "\.skip\(|it\.skip|describe\.skip" test/client | wc -l` = 3 (badgeUi·gameMap·whisperUi), 끝난 뒤도 3. 새 skip 없음(기존은 `it.skipIf(!GAME_RULES.badge)` 류). 시간 제한 늘리기 없음.

## Deviations from Plan

### 자동으로 고친 것

없음 — 계획대로 실행(제품 코드 버그는 드러나지 않았다). 21-13 이 건드린 test/unit·test/worker·test/helpers·scripts 는 수정하지 않았다.

### 계획과 다르게 한 것

- Task 2 의 묶음 커밋을 갈래별 세 개(A·B·C)로 나눴다(14개 파일이 작은 기계적 이전이라 읽히는 단위로 충분).
- 계획이 인벤토리 후보로 적은 test/client 파일 중 실제로 실패한 14개만 바꿨다(frontmatter 의 나머지 후보는 잠금 없이도 초록이라 변경 없음).

## 알려진 한계·넘기는 것

- A 갈래 파일들은 view 에 mode basic 을 두어 확장판 원인 흐름 화면의 같은 항목(예: 원인 흐름 밤 화면의 역할별 DOM 동일)은 이 파일들이 아니라 21-0x 의 lampEvening·nightHouse·morningScene·boardDiscussion 이 본다. 원인 흐름 밤 화면에 대한 역할별 DOM 동일 단언이 화면 시험에 따로 있는지는 21-15(E2E)·21-16(검증)에서 확인할 만하다.
- 화면 시험 전체 실행에서 간헐 실패는 관찰되지 않았다(한 번 전체 실행).

## Threat Flags

없음 (새 네트워크·인증·파일 경로 없음).

## Known Stubs

없음.

## Self-Check: PASSED

- 커밋 존재: 09856c75 · 662096bc · bd456526 · ef40de76 (HEAD 의 조상 확인)
- 파일: test/client/setup.ts 없음, vitest.config.ts·수정한 14개 시험 파일 존재, skip 파일 수 3 → 3
- 수용 기준: `grep -c setupFiles vitest.config.ts` = 2, client 전체 종료 코드 0, 인벤토리 표 있음
