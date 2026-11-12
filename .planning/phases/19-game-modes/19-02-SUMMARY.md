---
phase: 19-game-modes
plan: "02"
subsystem: server
tags: [game-mode, ruleset, tick-hooks, view-mode, refactor, tdd, leak]
status: complete

requires:
  - phase: 19-01 (판 종류 서버)
    provides: GameMode·view.mode·rulesetOf·modeOf·politicsOn, 규칙 인자 규칙(마지막 선택 인자 rules)
provides:
  - "전역 판 규칙 상수 없음 — src·shared·worker·test·scripts 에 옛 이름 0줄"
  - "tick 의 판별 훅 표 hooksOf(rules)·HOOKS[mode] 와 타입 PhaseHooks·EnterHook·DeadlineHook"
  - "resolveNomination(state, rules = rulesetOf(modeOf(state)))"
  - "화면의 규칙 판정은 rulesetOf(modeOf(view)) — whisperView·badgeView·GameMap"
  - "RESULT_PANEL_TEXT.preNotice(whisper) 함수와 LineSheet 의 whisper 속성"
  - "basic 판 화면·사회자 줄 시험(기록·흔적·증거 DOM 0, 심부름·증거 키 0)"
affects: [19-03, 19-04, 19-05, 19-06, 19-07, 19-08]

actuals:
  tokens: 54400
  tasks: 3
  commits: 7

plan_head_before: ef997aad1d590b3bccc02a2d8d4ee7e9209cfadc
plan_head_after: ba3f54360465fcdf70e63305f928b792bf35bb0c
commits: 7

tech-stack:
  added: []
  patterns:
    - "판별 훅 표: 규칙에 따라 갈리는 진입·마감 훅은 hooksOf(rules) 가 만들고 모듈을 읽을 때 판마다 한 번씩 만들어 둔다(HOOKS) — tick 은 한 걸음마다 방 상태의 판 종류로 고른다"
    - "화면 규칙: 컴포넌트·화면 모델은 rulesetOf(modeOf(view)) 로 규칙을 얻고, 문구 표처럼 view 를 받지 않는 곳은 규칙 값을 인자·속성으로 받는다"
    - "시험의 판 규칙: 파일 머리의 const GAME_RULES = rulesetOf(\"extended\") — 꺼진 장치 시험은 skipIf(!GAME_RULES.x)"

key-files:
  created: []
  modified:
    - shared/game/ruleset.ts
    - shared/game/tick.ts
    - shared/game/phases.ts
    - shared/game/nomination.ts
    - shared/game/room.ts
    - shared/game/view.ts
    - worker/room.ts
    - src/game/whisperView.ts
    - src/game/badgeView.ts
    - src/game/resultText.ts
    - src/components/v2/LineSheet.tsx
    - src/screens/GameMap.tsx
    - test/unit/ruleset.test.ts
    - test/unit/gameMode.test.ts
    - test/client/gameMap.test.tsx
    - test/unit/hostLine.test.ts
    - test/unit/flakeGuard.test.ts
    - docs/architecture.md

key-decisions:
  - "ruleset.test 의 0건 검사는 코드 폴더 다섯(src·shared·worker·test·scripts)의 소스를 부분 문자열로 훑는다 — 계획(src·shared·worker, 낱말 경계)보다 넓고 must_haves 의 git grep 과 같은 범위다"
  - "ruleset.ts 내부 표 이름을 RULES_BY_MODE 로 바꿨다 — 옛 이름이 부분 문자열로 남아 git grep 0줄을 막았다"
  - "phases.ts 는 rulesetOf 를 가져오지 않는다 — nextPhaseOf 가 규칙을 인자로 받는다(타입만 import). 시험이 그 모양을 고정한다"
  - "LineSheet 의 whisper 속성은 선택(기본 false) — 예고 줄이 없는 한마디 시트 호출부는 넘기지 않는다"

requirements-completed: [D-03, D-09, D-11, D-12]

coverage:
  - id: D1
    description: "서버 흐름(tick·phases·nomination·room·view·방 DO)이 방 상태의 판 종류에서 얻은 규칙을 읽는다 — tick 은 판마다 진입·마감 훅 표를 고르고 resolveNomination 은 규칙을 인자로 받는다. 동작은 그대로다"
    requirement: D-03
    verification:
      - kind: unit
        ref: "test/unit/gameMode.test.ts#hooksOf — 판마다 진입·마감 훅 표 (D-03)"
        status: pass
      - kind: unit
        ref: "test/unit/gameMode.test.ts#resolveNomination — 규칙은 두 번째 인자다 (D-03)"
        status: pass
      - kind: integration
        ref: "npx vitest run test/unit test/worker (192 파일 통과 · 5232 통과 · 184 건너뜀, 고치지 않은 기대 그대로)"
        status: pass
    human_judgment: false
  - id: D2
    description: "화면(whisperView·badgeView·GameMap)이 view.mode 에서 규칙을 얻고, 공개 예고 문구는 규칙 값을 인자·속성으로 받는다"
    requirement: D-03
    verification:
      - kind: unit
        ref: "test/client/gameMap.test.tsx#공개 예고 문구 — 규칙은 인자다 (19-02, D-03)"
        status: pass
      - kind: unit
        ref: "test/unit/ruleset.test.ts#화면 모델은 규칙을 view.mode 에서 얻는다 — rulesetOf 를 가져오고, 문구 표는 규칙을 가져오지 않고 인자로 받는다"
        status: pass
    human_judgment: false
  - id: D3
    description: "basic 판 화면에 [기록] 머리 단추·목격 기록 카드·증거 카드·이름표 흔적 표시가 DOM 에 없고, 사회자 줄 키가 어느 단계에서도 errand.*·witness·discussion.evidence 가 아니다. extended 는 지금 그대로다"
    requirement: D-09
    verification:
      - kind: automated_ui
        ref: "test/client/gameMap.test.tsx#GameMap — 기본 마피아 판 화면 (19-02, D-09)"
        status: pass
      - kind: unit
        ref: "test/unit/hostLine.test.ts#기본 마피아 판의 사회자 줄 (19-02, E-3)"
        status: pass
    human_judgment: false
  - id: D4
    description: "전역 판 규칙 상수가 저장소 코드에 없다 — ruleset.ts 는 타입 하나와 함수 셋만 내보내고, 시험 33개는 rulesetOf 로 규칙을 얻으며 건너뛰는 시험 수는 그대로다(봇·누설 판정이 방의 판 규칙을 따른다)"
    requirement: D-11
    verification:
      - kind: unit
        ref: "test/unit/ruleset.test.ts#전역 규칙 상수가 없다 (19-02, D-03)"
        status: pass
      - kind: other
        ref: "git grep -q 'RULESET' -- src shared worker test scripts → 종료 코드 1"
        status: pass
      - kind: integration
        ref: "npm test (287 파일 중 281 통과·6 건너뜀 · 8182 통과 · 261 건너뜀 · 실패 0)"
        status: pass
      - kind: integration
        ref: "test/worker/basicOff.test.ts + test/worker/leak.test.ts (20 통과 · 4 건너뜀 — 기본판 꺼짐 describe 는 돈다)"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-11-12
---

# Phase 19 Plan 02: 전역 판 규칙 상수 제거 요약

**전역 규칙 상수를 지우고, 서버는 방 상태의 판 종류에서(tick 의 판별 훅 표 `hooksOf(rules)`), 화면은 `view.mode` 에서 `rulesetOf(modeOf(…))` 로 규칙을 얻게 했다. basic 판 화면에 기록·흔적·증거가 그려지지 않고 사회자 줄이 심부름·증거를 말하지 않음을 시험으로 고정했다.**

## 진행

- 걸린 시간: 23분 (2026-11-12T12:09:23Z ~ 12:32Z)
- Task 3개 완료, 커밋 7개(시험 3 · 구현 3 · 문서 1), 바뀐 파일 56개

## 한 일

- **tick**: 모듈 상수 표 둘을 `hooksOf(rules)` 가 만드는 `{ enter, deadline }` 표로 바꿨다. 규칙에 따라 갈리는 줄은 넷 — 투표 진입(`enterNomination`/`enterVote`), 투표 마감(`stepNomination`/`resolveNomination(s, rules)`), 낮 시작 발표 마감(결전이 켜졌을 때만), 아침 진입(`enterMorning(s, r, rules)`). 두 판의 표는 모듈을 읽을 때 한 번씩 만들어 `HOOKS` 에 두고, 루프가 한 걸음마다 `modeOf(current)` 로 고른다.
- **phases·nomination·room·view·방 DO**: `PHASE_DEFS.nomination.durationMs` 는 `NOMINATION_MS` 하나(순차 지목 길이는 진입 훅 뒤 `phaseDurationOf` 가 다시 구한다 — 주석에 적음), `resolveNomination` 의 두 번째 인자, `normalizeStoredRoom` 의 `rulesetOf(modeOf(stored)).pickTurn`, `buildView`·`buildDay` 의 정치 장치 일곱 판정, 방 DO 의 `rulesNow()`(방이 없으면 기본 판 규칙).
- **화면**: `whisperVisible`·`floatVisible` 과 GameMap 의 배지 live 줄이 `rulesetOf(modeOf(view))` 를 읽는다. `RESULT_PANEL_TEXT.preNotice` 는 `(whisper: boolean) => string`, LineSheet 는 `whisper` 속성을 받고 GameMap 이 판 규칙 값을 넘긴다.
- **시험 옮기기**: 시험 33개의 import 를 `rulesetOf` 로, 코드의 옛 이름을 `GAME_RULES`(`rulesetOf("extended")`)로, 주석·시험 이름의 낱말을 "판 규칙" 으로 바꿨다. leak.test 의 기본 마피아 경로는 `rulesetOf("basic")`. flakeGuard 의 허용 정규식은 `skipIf(!GAME_RULES.`.
- **지운 것**: `shared/game/ruleset.ts` 의 전역 상수 export 둘. 내보내는 이름은 `Ruleset`·`rulesetOf`·`modeOf`·`politicsOn` 뿐이다.

## Task 커밋

1. **Task 1 (서버 흐름)**: `93cc0ee8` (test) → `618787c9` (refactor)
2. **Task 2 (화면·basic 화면)**: `3b3a2bdd` (test) → `1b2cea12` (feat)
3. **Task 3 (시험 옮기기·상수 제거)**: `2e0bd8f5` (test) → `e2810871` (refactor)
4. **문서**: `ba3f5436` (docs — 계획에 없던 것, 아래 "계획과 달라진 점" 8)

## RED 증거

- **Task 1**: `npx vitest run test/unit/gameMode.test.ts --reporter=tap-flat` → 54 중 **not ok 3** · ok 51, 종료 1. `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(target_test_failed). 대상 시험 "결선을 켠 규칙을 넘기면 동점 둘은 runoff 로 가고 결선 상태(후보 둘)가 선다" 가 `expected 'night/0' to be 'runoff/2'` 로 실패. 의미 판단: 자리 함수(`hooksOf` 가 모듈 표를 그대로 돌려줌, `resolveNomination` 이 규칙 인자를 안 읽음)가 있어 불러오기·타입 오류가 아니고, 규칙이 인자로 들어가지 않는 것이 실패 이유다. 통과한 다섯은 이미 참인 단언(두 판 모두 동시 투표·결과 단계 같음)이다.
- **Task 2**: `npx vitest run test/client/gameMap.test.tsx test/unit/hostLine.test.ts --reporter=tap-flat` → 206 중 **not ok 2**, 종료 1. `RED_EVIDENCE_OK`(target_test_failed). 대상 시험 "LineSheet: whisper 속성이 없거나 false 면 밤 대화만, true 면 귓속말을 함께 말한다" 가 세 번째 값 `끝나면 밤 대화가 공개돼요`(기대 `끝나면 밤 대화와 귓속말이 공개돼요`)로 실패. 의미 판단: 문구가 전역 값으로 정해져 받은 값이 쓰이지 않는 것이 실패 이유다. basic 화면·사회자 줄 단언 12건은 RED 에서 이미 초록이었다 — 계획이 예고한 대로이고(서버가 키를 싣지 않으면 화면은 원래 그리지 않는다), extended 대조 시험([기록] 1개·증거 카드 1개·witness → discussion.evidence)이 같은 파일에서 통과해 빈 검사가 아니다.
- **Task 3**: `npx vitest run test/unit/ruleset.test.ts --reporter=tap-flat` → 9 중 **not ok 2** · ok 7, 종료 1. `RED_EVIDENCE_OK`(target_test_failed). 대상 시험 "src·shared·worker·test·scripts 의 소스 어디에도 옛 전역 상수 이름이 없다 (주석 포함)" 가 `shared/game/ruleset.ts` 와 시험·스크립트 37개 파일 경로를 받아 실패(기대: 빈 문자열). 다른 하나는 export 이름 목록에 상수 둘이 남아 있어 실패.

## 검증 결과

| 명령 | 결과 |
|------|------|
| Task 1 verify — `npx vitest run test/unit test/worker` | 192 파일 통과 · 6 파일 건너뜀 · 5232 통과 · 184 건너뜀 · 실패 0 |
| Task 1 — `git grep -q 'RULESET' -- shared worker ':!shared/game/ruleset.ts'` | 종료 코드 1 (19-01 뒤 기준: 8개 파일 33줄) |
| Task 2 verify — `npx vitest run test/client test/unit/hostLine.test.ts test/unit/whisperView.test.ts test/unit/badgeView.test.ts`(+ ruleset·e2eContract) | 94 파일 통과 · 3181 통과 · 100 건너뜀 · 실패 0 |
| Task 2 — `git grep -q 'RULESET' -- src` | 종료 코드 1 (기준: 4개 파일 12줄) |
| Task 3 verify — `npm test` | 281 파일 통과 · 6 파일 건너뜀 · **8182 통과 · 261 건너뜀** · 실패 0 |
| `npm run typecheck` | 종료 0 (Task 마다) |
| `node --test scripts/e2e/lib.test.mjs` | 427 통과 · 실패 0 |
| `git grep -q 'RULESET' -- src shared worker test scripts` | 종료 코드 1 (기준: test 35개 파일 221줄 · scripts 5줄 · src 12줄 · shared·worker 38줄) |
| 위생 git grep(바뀐 파일) | 0건 (커밋마다) |

- **건너뛴 수 전·후**: Task 3 치환 전 `npm test` = 8177 통과 · **261 건너뜀** · 6 파일 건너뜀 → 치환 뒤 8182 통과 · **261 건너뜀** · 6 파일 건너뜀. 건너뛴 수가 같다. 통과가 5 늘어난 것은 ruleset.test 가 4건에서 9건이 된 것이다.
- **basicOff·leak 건너뜀**: `npx vitest run test/worker/basicOff.test.ts test/worker/leak.test.ts` 는 Task 1 뒤·Task 3 뒤 모두 20 통과 · 4 건너뜀. 19-01 이 잰 같은 네 파일 묶음(modeBasic·modePick·basicOff·leak)도 36 통과 · 4 건너뜀으로 19-01 과 같다 — 기본판 꺼짐 describe 는 건너뛰지 않고 돈다.
- acceptance criteria: Task 1(`hooksOf` 4줄), Task 2(`modeOf(view)` 1줄, `basic` gameMap 9줄·hostLine 10줄), Task 3(flakeGuard `GAME_RULES` 2줄) 모두 통과.
- E2E 는 돌리지 않았다(스크립트는 주석만 바뀜 — `node --check` 통과). 두 판 완주는 19-08.
- spec-less probe fallback 건너뜀: 요구사항 ID 없음 — ROADMAP 성공 기준과 19-CONTEXT D-nn 으로 대신했다.

## 바뀐 시그니처

- `hooksOf(rules: Ruleset): PhaseHooks` · `interface PhaseHooks { enter; deadline }` · `type EnterHook` · `type DeadlineHook` — shared/game/tick.ts (모듈 안 `HOOKS: Record<GameMode, PhaseHooks>`)
- `resolveNomination(state, rules: Ruleset = rulesetOf(modeOf(state))): DeadlineResult` — shared/game/nomination.ts
- `PHASE_DEFS.nomination.durationMs` 는 늘 `NOMINATION_MS`(15초)
- `RESULT_PANEL_TEXT.preNotice: (whisper: boolean) => string` — src/game/resultText.ts
- `LineSheetProps.whisper?: boolean`(기본 false)
- 방 DO `private rulesNow(): Ruleset`
- 없어진 것: ruleset.ts 의 전역 상수 export 둘

## 계획과 달라진 점

**1. [Rule 3] ruleset.test 의 import 단언을 Task 1·2 커밋에서 먼저 고쳤다**
- 계획은 ruleset.test.ts 를 Task 3 에서만 고친다. 그런데 그 파일이 "방 DO·view·화면 모델이 전역 상수를 import 한다" 를 단언하고 있어 Task 1·2 의 verify(test/unit 초록)가 통과할 수 없었다. 해당 단언 한 건씩을 `rulesetOf` 로 고쳐 구현 커밋에 함께 넣었다(`618787c9`·`1b2cea12`). Task 3 이 파일 전체를 새 계약으로 다시 썼다.

**2. 0건 검사의 범위를 넓혔다**
- 계획: src·shared·worker 의 git 추적 .ts·.tsx 를 낱말 경계 정규식으로. 실제: 코드 폴더 다섯(test·scripts 포함)의 .ts·.tsx·.mjs·.js 를 부분 문자열로 훑는다(파일 시스템을 걷는다 — git 에 기대지 않는다, `scripts/e2e/out/` 제외). must_haves 의 git grep 과 같은 범위라 주석에 옛 이름을 다시 적어도 시험이 잡는다. 시험 파일 자신도 대상이라 옛 이름은 조각을 이어 만든다.

**3. ruleset.ts 내부 표 이름을 바꿨다**
- 모듈 안의 표 이름에 옛 상수 이름이 부분 문자열로 들어 있어 `git grep` 0줄을 막았다. `RULES_BY_MODE` 로 바꿨다(export 아님). `e2810871`.

**4. "분기 모듈 여섯이 rulesetOf 를 가져온다" 를 실제 모양으로 고정했다**
- phases.ts 는 규칙을 인자로 받는다(`nextPhaseOf(phase, rules)`, 19-01) — `rulesetOf` 를 가져오지 않고 타입만 import 한다. 시험은 tick·nomination·room·view·방 DO 다섯이 `rulesetOf` 를 가져오고 phases 는 타입만 가져옴을 단언한다.

**5. LineSheet 의 whisper 속성은 선택이다**
- 계획은 `whisper: boolean`. 예고 줄이 없는 한마디 시트(마지막 3인) 호출부까지 값을 넘기게 하지 않으려고 `whisper?: boolean`(기본 false = 꺼진 장치의 글이 없다)로 두고, 귓속말 시트 호출부만 `rules.whisper` 를 넘긴다.

**6. RED 커밋에 자리 함수를 넣었다**
- 타입 검사를 깨지 않고 단언으로 실패하게 하려고 Task 1 RED 에 `hooksOf`(모듈 표 그대로)·`resolveNomination(state, _rules?)` 를, Task 2 RED 에 `preNotice(_whisper)`·LineSheet 의 읽지 않는 `whisper` 속성을 먼저 두었다(19-01 과 같은 방식). 구현 커밋에서 모두 실제 구현으로 바뀌었다 — 남은 자리 값 없음.

**7. 작은 차이**
- 사회자 줄의 문장 단언: `errand.ghost` 의 문장("지켜봐 주세요")은 다른 단계의 유령 줄과 같은 문장이라 문장으로는 가를 수 없다. 그 키는 키 단언이 보고, 문장 단언은 꺼진 키에만 있는 문장 넷을 본다.
- test/client/resultScreen.test.tsx 는 옛 상수를 import 만 하고 쓰지 않았다 — 바꾸지 않고 import 줄을 지웠다.
- `const GAME_RULES` 는 import 바로 아래가 아니라 파일의 마지막 static import 아래에 둔다(import 사이에 끼지 않게).
- `HOOKS` 는 `Object.fromEntries(GAME_MODES.map(…))` 로 만든다 — 판 종류를 늘리면 표가 따라 생긴다.
- 계획에 없던 시험: 결선·순차 지목·결전을 켠 가짜 규칙의 훅 표, basic 낮 단계 넷의 DOM 0, 두 판 모두 귓속말·배지 진입점 없음, `hostLine.ts` 가 판 종류를 읽지 않음(새 분기 없음, P19-17).
- basic 화면 요소의 렌더 조건은 고치지 않았다 — 키가 없으면 이미 그리지 않는다.

**8. [Rule 2] 구조 문서의 전역 상수 설명을 고쳤다 (계획의 파일 목록 밖)**
- `docs/architecture.md` 네 문장과 `docs/screen-map.md` 한 문장이 지운 상수를 "규칙이 있는 곳" 으로 설명하고 있었다. 원천 문서가 없는 이름을 가리키지 않게 판 규칙(`rulesetOf(mode)`, 서버는 방 상태·화면은 view.mode) 설명으로 고쳤다. `ba3f5436`. 결정 기록(`docs/decisions/`)의 옛 이름은 그때의 기록이라 그대로 두었다.

**합계:** 계획의 의도를 지킨 조정 8건. 서버·화면 동작은 바뀌지 않았다.

## Threat 처리

| Threat | 처리 |
|--------|------|
| T-19-07 | ruleset.test 가 두 판의 여덟 값과 `politicsOn` 거짓을 고정. 방 DO 의 badge·whisper 문은 `rulesNow()`(방 규칙, 방이 없으면 기본 판 — 역시 꺼짐). basicOff·leak 의 기본판 꺼짐 describe 가 도는 것을 건너뜀 수(4 → 4)로 확인 |
| T-19-08 | 치환 전·후 `npm test` 건너뜀 261 → 261, flakeGuard 정규식을 함께 옮김. 치환 스크립트는 코드 조각과 글 조각(주석·문자열)을 나눠 바꾸고, 바뀐 줄이 모두 옛 이름이 있던 줄임을 diff 로 확인 |
| T-19-09 | gameMap.test 가 basic view 의 기록·흔적·증거 DOM 0 과 이름표 표시 0 을, hostLine.test 가 단계 여덟 × 역할 넷 × 산 사람·유령 × 화면 상태 넷(256가지)에서 심부름·목격·증거 키 0 을 단언 |
| T-19-SC | 패키지 설치 없음 |

계획의 threat_model 밖에 새로 생긴 표면은 없다.

## 다음 계획이 알아야 할 것

- **옛 전역 상수 이름을 코드 폴더(src·shared·worker·test·scripts) 어디에도 적지 않는다 — 주석·시험 이름도.** test/unit/ruleset.test.ts 가 부분 문자열로 잡는다. 규칙이 필요하면 서버는 `rulesetOf(modeOf(state))`(또는 마지막 선택 인자 `rules`), 화면은 `rulesetOf(modeOf(view))`, 시험은 `rulesetOf("extended")`·`rulesetOf("basic")`.
- GameMap 컴포넌트 머리에 `const rules = rulesetOf(modeOf(view))` 가 있다 — 판 종류에 따른 화면 분기가 필요하면 이 값을 쓴다. 다만 UI-SPEC E 의 원칙은 "키가 없으면 그리지 않는다" 이고 새 분기를 만들지 않는 것이다(basic 화면은 분기 없이 이미 비어 있다).
- ruleset.ts 가 내보내는 이름은 `Ruleset`·`rulesetOf`·`modeOf`·`politicsOn` 넷으로 시험에 고정돼 있다 — export 를 더하면 ruleset.test 의 이름 목록을 같이 고친다.
- flakeGuard 는 testTools·helpers·waitHelpers·bots 워커 시험에서 `skipIf(!GAME_RULES.` 만 허용한다.
- 시험에서 basic view 를 만드는 모양: test/client/gameMap.test.tsx 의 `modeView(mode, opts, { record, morning, evidence, endsInMs })`, test/unit/hostLine.test.ts 의 `Spec.mode`.
- 정치 장치를 켠 판을 시험하려면 가짜 규칙 객체(`{ ...rulesetOf("extended"), runoff: true }`)를 `hooksOf`·`resolveNomination` 에 넘긴다. tick 자체는 방의 판 종류로만 규칙을 고르므로 켜진 판을 tick 으로 돌리는 길은 없다(판 종류를 늘려야 한다).
- RED 증거 기록(.gsd/red/19-02-t*.json)은 gitignore 된 로컬 파일이다.
- push·배포·E2E 는 하지 않았다(19-08).

## Self-Check: PASSED

- 커밋 7개가 HEAD 의 조상임을 확인: 93cc0ee8 · 618787c9 · 3b3a2bdd · 1b2cea12 · 2e0bd8f5 · e2810871 · ba3f5436
- `git grep -q 'RULESET' -- src shared worker test scripts` 종료 코드 1, `grep -c hooksOf shared/game/tick.ts` 4
- 구현 파일에 자리 함수·TODO 가 남지 않음을 grep 으로 확인

---
*Phase: 19-game-modes · Plan 02*
*Completed: 2026-11-12*
