---
phase: 19-game-modes
plan: "01"
subsystem: server
tags: [game-mode, ruleset, modePick, durable-object, leak, tdd, tracer]
status: complete

requires:
  - phase: 15~18 (심부름·목격 기록·밤 흔적·튜토리얼)
    provides: errand 단계·me.errand·me.record·morning.trace·seen·day.evidence·tutorial 단계
provides:
  - "GameMode(basic·extended, 기본 extended)·메시지 modePick·view.mode (공개 값)"
  - "Ruleset 의 errand·witness·trace 플래그와 rulesetOf·modeOf·politicsOn"
  - "pickMode(방장·대기실/결과·허용 값) 와 방 DO handleModePick"
  - "nextPhaseOf — basic 판은 낮 시작 발표 다음이 토론"
  - "basic 판 서버 차단: 흔적·마지막 목격·심부름·기록 키 없음, 튜토리얼 무시, 봇 심부름 없음, 다시 하기·대기실 복귀 유지"
affects: [19-02, 19-03, 19-04, 19-05, 19-06, 19-07, 19-08]

actuals:
  tokens: 24200
  tasks: 3
  commits: 5

plan_head_before: 543c7ea7c8e7f707e6c3b943eb342dea16e1ff22
plan_head_after: 89c84f99e0f385bc48c0d04b1f3f78aeb494e8ec
commits: 5

tech-stack:
  added: []
  patterns:
    - "규칙 인자 규칙: 규칙이 필요한 서버 순수 함수는 마지막 선택 인자 rules = rulesetOf(modeOf(state)) 를 받는다 (전역 값이 아니다)"
    - "판 종류는 optional 필드 + 읽는 쪽 기본값(modeOf) — mode 없는 저장 방은 그대로 extended"

key-files:
  created:
    - shared/game/mode.ts
    - test/unit/gameMode.test.ts
    - test/worker/modePick.test.ts
    - test/worker/modeBasic.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/ruleset.ts
    - shared/game/room.ts
    - shared/game/phases.ts
    - shared/game/tick.ts
    - shared/game/view.ts
    - shared/game/night.ts
    - shared/game/bots.ts
    - shared/game/rematch.ts
    - shared/game/testTools.ts
    - worker/room.ts
    - scripts/e2e/lib.mjs
    - test/unit/ruleset.test.ts
    - test/unit/schemas.test.ts
    - test/unit/soundProtocol.test.ts
    - test/unit/view.test.ts
    - test/worker/leak.test.ts

key-decisions:
  - "ruleset.ts 는 ../protocol 에서 값(DEFAULT_MODE·GAME_MODES)도 가져온다 — protocol.ts 는 런타임 import 가 없어 순환이 생기지 않는다 (계획의 '타입 전용' 과 다름)"
  - "쉬는 사람(bench) view 도 mode 를 싣는다 — 공개 값이라 허용 키 목록에 한 키를 더했다"
  - "RULESET·BASIC_RULESET 은 남겨 두고 둘 다 rulesetOf(DEFAULT_MODE) 객체를 가리킨다 — 지우는 일은 19-02"

requirements-completed: [D-01, D-02, D-04, D-05, D-06, D-08, D-10, D-11, D-12]

coverage:
  - id: D1
    description: "방장의 modePick 이 서버에 저장되어 모든 소켓에 state 한 프레임씩 방송되고 view.mode 는 모두에게 같다. 거절(방장 아님·진행 중·허용 밖 값)은 보낸 소켓 state 한 프레임, 같은 값은 0프레임"
    requirement: D-05
    verification:
      - kind: integration
        ref: "test/worker/modePick.test.ts#판 종류 고르기 서버 (D-01, D-05, L40)"
        status: pass
      - kind: unit
        ref: "test/unit/gameMode.test.ts#pickMode (D-05·D-06, L40)"
        status: pass
      - kind: unit
        ref: "test/unit/schemas.test.ts#ClientMessageSchema modePick (19-01, D-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ruleset 의 errand·witness·trace 플래그와 rulesetOf·modeOf·politicsOn — basic 은 셋 다 꺼짐, extended 는 켜짐, 정치 장치 다섯은 두 판 모두 꺼짐. mode 없는 방은 extended"
    requirement: D-02
    verification:
      - kind: unit
        ref: "test/unit/gameMode.test.ts#rulesetOf (D-02)"
        status: pass
      - kind: unit
        ref: "test/unit/gameMode.test.ts#modeOf (D-01·D-04)"
        status: pass
      - kind: unit
        ref: "test/unit/gameMode.test.ts#normalizeStoredRoom — 저장 방의 mode (D-04, T-19-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "basic 판은 낮 시작 발표 뒤 errand 없이 토론으로 가고, 어떤 단계·어떤 소켓의 view 에도 me.errand·me.record·day.evidence·day.morning.trace·day.morning.seen 키가 없다. 고르지 않은 판은 지금처럼 errand 로 간다"
    requirement: D-08
    verification:
      - kind: integration
        ref: "test/worker/modeBasic.test.ts#기본 마피아 판 한 판 전체 (D-08, D-11, D-12)"
        status: pass
      - kind: integration
        ref: "test/worker/modePick.test.ts#트레이서 — basic 으로 고른 판은 심부름을 건너뛴다 (D-06, D-08)"
        status: pass
      - kind: unit
        ref: "test/unit/gameMode.test.ts#buildView — basic 판에는 심부름·기록·흔적 키가 없다"
        status: pass
      - kind: unit
        ref: "test/unit/gameMode.test.ts#enterMorning — basic 판은 흔적·마지막 목격을 만들지 않는다 (D-08, T-19-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "basic 방은 tutorial: true 로 시작해도 튜토리얼 없이 assigning 으로 가고, 봇은 심부름 행동을 계획하지 않으며, 다시 하기·테스트 대기실 복귀 뒤에도 mode 가 남는다"
    requirement: D-10
    verification:
      - kind: integration
        ref: "test/worker/modeBasic.test.ts#기본 마피아 판의 시작·유지 (D-06, D-10)"
        status: pass
      - kind: unit
        ref: "test/unit/gameMode.test.ts#봇 계획 — basic 판은 심부름 행동이 없다 (D-11)"
        status: pass
      - kind: unit
        ref: "test/unit/gameMode.test.ts#다시 하기·대기실 복귀 뒤에도 mode 가 남는다 (D-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "basic 판 한 판 전체(로비→ended)의 모든 프레임에서 산 사람에게 남의 역할이 가지 않는다 — 관전 키·직업 키 없음, role·allies 는 본인 칸에만"
    requirement: D-12
    verification:
      - kind: integration
        ref: "test/worker/modeBasic.test.ts#그 판의 산 사람 프레임에는 관전 키·직업 키가 없고 role·allies 는 본인 칸에만 있으며, view.mode 는 모든 소켓에 basic 으로 같다 (D-12, T-19-04)"
        status: pass
      - kind: integration
        ref: "test/worker/leak.test.ts (확장판 전수, 고치지 않은 기대 그대로)"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-11-12
---

# Phase 19 Plan 01: 판 종류 서버 (modePick · basic 판 차단) 요약

**방장이 `{ t: "modePick", mode }` 로 고른 판 종류(basic·extended, 기본 extended)를 방 DO 가 판정·저장·방송하고, basic 판은 낮 시작 발표 뒤 errand 없이 토론으로 가며 심부름·기록·흔적·마지막 목격을 만들지도 싣지도 않는다.**

## 진행

- 걸린 시간: 22분 (2026-11-12T11:44:45Z ~ 12:07Z)
- Task 3개 완료, 커밋 5개(시험 3 · 구현 2), 바뀐 파일 22개

## 한 일

- **판 종류 값과 메시지**: `GAME_MODES`·`GameMode`·`DEFAULT_MODE`(shared/protocol.ts), `{ t: "modePick", mode }`, `RoomView.mode`(서버는 늘 싣는다 — 쉬는 사람 view 포함), 스키마 `z.enum(GAME_MODES)`.
- **규칙**: `Ruleset` 에 `errand`·`witness`·`trace`. `rulesetOf(mode)` 는 판마다 얼린 객체 하나, `modeOf(holder)` 는 허용 밖·없음이면 extended, `politicsOn(rules)` 는 정치 장치 다섯만 본다.
- **고르기**: `pickMode`(shared/game/mode.ts)가 방장 → 단계(lobby·ended) → 허용 값 순으로 판정하고 같은 값이면 입력 그대로. 방 DO `handleModePick` 은 맵 선택과 같은 응답 모양(거절 = 보낸 소켓 state 한 프레임, 같은 값 = 0프레임).
- **흐름**: `nextPhaseOf(phase, rules)` 가 낮 시작 발표 다음만 `rules.errand ? errand : discussion` 으로 고르고, tick 이 한 걸음마다 방 상태에서 규칙을 얻어 넘긴다. `PHASE_DEFS` 데이터는 그대로다.
- **basic 차단**: `enterMorning` 의 흔적 조각(`rules.trace`)·마지막 목격(`rules.witness`), `buildView` 의 me.errand·me.record·morning.trace·seen·day.evidence, 봇 계획의 errand 갈래, `beginGame` 의 튜토리얼 조건.
- **유지**: `REMATCH_ROOM_KEYS` 에 mode, `resetToLobby` 가 mode 를 남김, `normalizeStoredRoom` 이 허용 밖 mode 를 키째 뺌(mode 없는 방은 같은 객체).

## Task 커밋

1. **Task 1 (트레이서)**: `bc309c86` (test) → `79626eac` (feat)
2. **Task 2 (basic 차단·유지)**: `4d7155f1` (test) → `2a83c9c1` (feat)
3. **Task 3 (basic 한 판 전체·누설)**: `89c84f99` (test)

## RED 증거

- **Task 1 RED**: `npx vitest run test/unit/gameMode.test.ts test/unit/schemas.test.ts test/worker/modePick.test.ts --reporter=tap-flat` → 212 중 **not ok 21** · ok 191, 종료 1. `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(target_test_failed). 대상 시험 "방장이 basic 을 고르면 모든 소켓이 정확히 한 state 를 받고…" 가 `expected '[error:BAD_MESSAGE] [] []' to be '[state:lobby] [state:lobby] [state:lobby]'` 로 실패. 의미 판단: 자리 함수가 있어 불러오기 오류가 아니고, 스키마가 modePick 을 모르는 것·자리 함수가 규칙을 돌려주지 않는 것이 실패 이유다(통과한 것은 이미 참인 부정 시험 — 모르는 값 거절·mode 없는 방은 errand).
- **Task 2 RED**: `npx vitest run test/unit/gameMode.test.ts --reporter=tap-flat` → 46 중 **not ok 13** · ok 33, 종료 1. `RED_EVIDENCE_OK`(target_test_failed). 대상 시험 "basic: 피해자가 나온 밤이어도 morning 에 eliminated 뿐이고…" 가 `expected 'true/eliminated,seen,trace' to be 'true/eliminated'` 로 실패. 의미 판단: basic 에서도 흔적·마지막 목격이 만들어지는 것이 실패 이유이고, 확장판 대조 시험은 통과했다.
- **Task 3 RED(처음 실행 결과 그대로)**: `npx vitest run test/worker/modeBasic.test.ts --reporter=tap-flat` → 7 중 **not ok 2** · ok 5. 두 실패는 서버가 아니라 시험 쪽 원인이다 — 한 판을 1초 안에 걸어 방장 소켓이 연결당 1초 20개 한도(RATE_LIMITED)를 넘었고, 넘친 testSkip 이 버려져 찬반 단계가 실제 마감(10초)까지 머물렀다(`awaitTransition: verdict 에서 바뀐 단계의 state 를 … 받지 못했다`). 시험에 한도 창을 비우는 `clearRates` 를 넣은 뒤 7/7 통과(세 번 반복 통과). 서버 코드는 고치지 않았다. Task 1·2 가 이미 구현했으므로 이 task 는 RED 없이 초록으로 시작하는 것이 계획대로다.
  - 시험이 실제로 가르는지 확인(커밋하지 않은 임시 변경): 흔적 차단 두 줄을 빼면 "모든 state 프레임에 … 키가 하나도 없다" 가 `Received: "eliminated,trace"` 로 실패, `nextPhaseOf` 를 늘 errand 로 바꾸면 3건 실패. 되돌린 뒤 작업 트리 깨끗함.

## 검증 결과

| 명령 | 결과 |
|------|------|
| Task 1 verify (gameMode·schemas·ruleset·view·soundProtocol·e2eContract·modePick·mapPick·leak) | 9 파일 통과 · 458 통과 · 17 건너뜀(정치 장치 켜짐 전용) |
| Task 2 verify (`test/unit` 전체 + trace·morningCards·errand·errandLeak·rematch·tutorial·bots) | 146 파일 통과 · 4735 통과 · 110 건너뜀 |
| Task 3 verify (modeBasic·modePick·basicOff·leak) | 4 파일 통과 · 36 통과 · 4 건너뜀 |
| `npx vitest run` (전체) | 281 파일 통과 · 8155 통과 · 261 건너뜀 · 실패 0 |
| `npm run typecheck` | 종료 0 |
| 위생 git grep(바뀐 파일) | 0건 (커밋마다) |

- leak.test.ts 의 "기본판 — 꺼진 장치 키 0건" describe 는 건너뛰지 않고 돈다(조건을 `politicsOn(RULESET)` 로 바꿈 — tap 출력에서 실행 확인).
- 확장판 시험(trace·morningCards·errand·errandLeak·bots)은 고치지 않은 채 통과했다(성공 기준 4).
- 건너뜀은 모두 `RULESET.badge·whisper·pickTurn·runoff·showdown` 이 켜졌을 때만 도는 기존 시험이다.
- spec-less probe fallback 건너뜀: 요구사항 ID 없음 — ROADMAP 성공 기준과 19-CONTEXT D-nn 으로 대신했다.

## 바뀐 시그니처

- `rulesetOf(mode: GameMode): Ruleset` · `modeOf(holder: { readonly mode?: unknown }): GameMode` · `politicsOn(rules: Ruleset): boolean` — shared/game/ruleset.ts
- `pickMode(state, actorId, mode): { ok: true; state } | { ok: false }` — shared/game/mode.ts
- `nextPhaseOf(phase: PhaseId, rules: Ruleset): PhaseId | null` — shared/game/phases.ts
- `enterMorning(state, randInt = () => 0, rules = rulesetOf(modeOf(state)))` — 세 번째 인자가 규칙이다. tick 의 ON_ENTER 는 `(s, r) => enterMorning(s, r)` 로 감싼다(진입 시각 at 이 규칙 자리로 들어가지 않게)
- `planBotSteps(state, now, randInt, rules = rulesetOf(modeOf(state)))` · 내부 `planFor(state, bot, now, randInt, rules)`
- `buildDay(state, rules)`(view.ts 내부) · `beginGame` 의 `tutorial = opts?.tutorial === true && modeOf(state) === "extended"`
- `RoomState.mode?: GameMode` · `RoomView.mode?: GameMode` · `REMATCH_ROOM_KEYS` 에 `"mode"`

## 계획과 달라진 점

**1. [Rule 3] ruleset.ts 가 ../protocol 에서 값도 가져온다**
- 계획: `import type { GameMode }` 하나만(타입 전용).
- 실제: `import { DEFAULT_MODE, GAME_MODES } from "../protocol"` 도 쓴다. 계획이 정한 `modeOf`(GAME_MODES 안이면 그 값, 아니면 DEFAULT_MODE)와 `RULESET = rulesetOf(DEFAULT_MODE)` 는 값이 있어야 한다. shared/protocol.ts 는 런타임 import 가 없어 순환이 생기지 않는다(계획의 의도 = 순환 방지). 머리 주석을 "../protocol 외에는 import 하지 않는다" 로 적었다. 커밋 `79626eac`.

**2. [Rule 1] 쉬는 사람 view 허용 키 목록에 mode**
- 계획은 `TOP_KEYS` 한 곳만 적었지만, `buildRestingView` 도 mode 를 싣도록 한 계획 그대로 구현하니 test/unit/view.test.ts 의 쉬는 사람 허용 키 문자열(`RESTING_TOP`·`RESTING_TOP_MAP`)이 실패했다. 두 문자열에 `mode` 를 더했다(공개 값, D-12). 커밋 `79626eac`.

**3. Task 3 의 판 진행을 손으로 고정했다**
- 계획: 봇 투표 `{ exec: "yes", pick: "other" }` 만으로 testSkip 80번 안에 ended.
- 실제: 그 구성만으로는 끝이 정해지지 않는다 — 찬반은 `찬성 × 2 > 유권자` 라 봇 둘의 찬성만으로는 통과하지 못하고(유권자 4), 방장이 마피아가 아니면 밤 판정이 봇 난수에 달린다. 그래서 방장을 마피아로 지정(testRole)하고, 사람 소켓이 지목·찬반·밤 고르기를 보내며, 산 의사 봇의 밤 고르기를 방장으로 고정했다(editRoom, 구출이 나지 않게). 결과: 1일차 처형 → 밤 탈락(흔적이 생길 조건) → 2일차 처형 → ended 가 매번 같다. 계획이 요구한 단언(단계 열·없는 키·누설·튜토리얼·다시 하기·대조)은 모두 그대로 있고, "피해자가 나온 아침이 실제로 있었다" 단언을 더해 키 없음 검사가 빈 검사가 아니게 했다.
- 계획이 본보기로 든 test/worker/basicOff.test.ts 에는 봇 판을 끝까지 걷는 모양이 없어 helpers.ts 의 `skipOnce`·`editRoom`·`clearBotSteps` 를 썼다.

**4. Task 3 시험의 연결당 메시지 한도**
- 위 RED 증거 참고. 시험 파일 안의 `clearRates`(DO 메모리의 한도 창을 새로 만든다)로 풀었다. 서버 변경 없음. 커밋 `89c84f99`.

**5. 작은 차이**
- tick 은 규칙을 `rulesetOf(modeOf(closing))`(마감 훅을 지난 상태)에서 얻는다 — mode 는 훅이 바꾸지 않아 계획의 `current` 와 같은 값이다.
- Task 1 RED 커밋의 `GAME_MODES`·`GameMode`·`DEFAULT_MODE` 는 자리 값이 아니라 실제 값이다(상수라 자리 함수로 둘 것이 없다). 함수 다섯은 자리 함수로 먼저 두었다.
- 계획에 없던 시험을 더했다: 테스트 대기실 복귀(testReset) 워커 시험, `modeOf` 의 숫자·null·`"toString"` 값, tick 경로의 아침 흔적.

**합계:** 계획의 의도를 지킨 조정 5건. 범위 밖 변경 없음, 서버 동작은 계획 그대로.

## Threat 처리

| Threat | 처리 |
|--------|------|
| T-19-01 | pickMode 가 방장·단계·enum 을 서버 상태로 판정, 스키마가 enum 밖을 BAD_MESSAGE — modePick.test 가 참가자·진행 중·모르는 값을 단언 |
| T-19-02 | 거절은 사유와 무관하게 보낸 소켓 state 한 프레임(오류 프레임 없음) |
| T-19-03 | enterMorning 이 basic 에서 흔적·마지막 목격을 만들지 않고 buildView 도 규칙으로 막음 — modeBasic.test 가 모든 프레임 키 경로 전수 |
| T-19-04 | view.mode 는 모든 소켓에 같음을 단언(수용) |
| T-19-05 | normalizeStoredRoom 이 허용 밖 mode 를 키째 뺌 |
| T-19-SC | 패키지 설치 없음 |

계획의 threat_model 밖에 새로 생긴 표면은 없다.

## 19-02 에 넘기는 것

- **`RULESET`·`BASIC_RULESET` 은 아직 남아 있다.** 둘 다 `rulesetOf(DEFAULT_MODE)`(= extended 규칙 객체)를 가리킨다. 정치 장치 다섯 값은 두 판에서 같아 지금 읽는 곳의 동작은 그대로다. 이름과 달리 `BASIC_RULESET` 은 basic 판 규칙이 아니다 — 지울 때까지 새 코드에서 쓰지 않는다.
- 아직 전역 값을 읽는 곳(19-02 가 옮긴다): shared/game 의 `tick.ts`(ON_ENTER·ON_DEADLINE 표를 모듈 로드 때 `RULESET.pickTurn·showdown` 으로 만든다 — 방마다 고르려면 표를 함수로 바꿔야 한다)·`phases.ts`(`PHASE_DEFS.nomination.durationMs`)·`nomination.ts`·`room.ts`(normalizeStoredRoom 의 isLegacyNomination)·`view.ts`(badge·turn·runoff·showdown 키)·`bots.ts`(주석)·`testTools.ts`, `worker/room.ts`(badge·whisper 거절), `src/game/badgeView.ts`·`whisperView.ts`·`resultText.ts`·`src/screens/GameMap.tsx`, `scripts/e2e/avatar.mjs`·`flows.mjs`·`scripts/smoke.mjs`.
- test/unit/ruleset.test.ts 는 `RULESET === BASIC_RULESET` 과 여덟 키 JSON, "분기 모듈은 ./ruleset 에서 가져온다", "방 DO·view·화면 모델은 RULESET 으로 읽는다" 를 고정한다 — 19-02 가 RULESET 을 지우면 이 시험을 같이 고쳐야 한다. test/worker/leak.test.ts 는 `politicsOn(RULESET)`·`politicsPathsFor(BASIC_RULESET)` 를 쓴다.
- 클라이언트는 `view.mode` 를 `modeOf(view)` 로 읽으면 된다(타입은 optional, 서버는 늘 싣는다).

## 다음 계획이 알아야 할 것

- 워커 시험에서 한 판을 testSkip 으로 끝까지 걸으면 방장 소켓이 **연결당 1초 20개 한도**를 넘는다 — 넘친 메시지는 조용히 버려지고 단계가 실제 마감까지 머문다. test/worker/modeBasic.test.ts 의 `clearRates` 모양을 쓰거나 DO 를 evict(editRoom) 한다.
- 찬반 통과는 `찬성 × 2 > 유권자` 다 — 봇 표만으로는 사람이 섞인 판에서 통과하지 못할 수 있다.
- 서버 view 키 허용 목록 사본 두 곳(test/unit/view.test.ts `TOP_KEYS`, scripts/e2e/lib.mjs `VIEW_TOP_KEYS`)에 `mode` 가 있다. E2E 는 이 계획에서 돌리지 않았다(서버만 바뀜 — 19-08 이 두 판 완주를 돌린다).
- basic 판의 서버 상태에는 `errandPlaces`·`errandSeen`·`errandLast`·`morning.trace`·`morning.seen` 이 만들어지지 않는다. 판 종류는 대기실·결과에서만 바뀌므로 판 도중에 규칙이 바뀌는 경우는 없다.
- push·배포는 하지 않았다(19-08).

## Self-Check: PASSED

- 만든 파일 4개 존재 확인: shared/game/mode.ts · test/unit/gameMode.test.ts · test/worker/modePick.test.ts · test/worker/modeBasic.test.ts
- 커밋 5개가 HEAD 의 조상임을 확인: bc309c86 · 79626eac · 4d7155f1 · 2a83c9c1 · 89c84f99
- acceptance criteria: Task 1 여섯(1·1·2·3·2·1), Task 2 다섯(2·5·1·1·1), Task 3(파일 있음·errand 10줄) 모두 통과

---
*Phase: 19-game-modes · Plan 01*
*Completed: 2026-11-12*
