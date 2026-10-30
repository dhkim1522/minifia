---
phase: 04-execution-verdict
plan: 06
subsystem: game-server
tags: [win-check, ended, summary, result-view, night-log, tdd, pure-rules]

requires:
  - phase: 04-execution-verdict
    provides: "04-01 의 RoomState.winner·nightLog·expiresAt·GameResult·SummaryRow·RoomView.result 타입, 04-04 의 처형 진입 훅·voteLog 와 voteState 도우미"
provides:
  - "win.ts checkWinner(state): 'citizen' | 'mafia' | null — 생존자 기준(연결 무관), 역할 없으면 null"
  - "endgame.ts: routeAfterExecution·routeAfterMorning(마감 훅), enterEnded(winner 와이어 값·만료 min(기존, 진입+30분)), buildSummary, ENDED_ROOM_TTL_MS"
  - "tick 표 행: execution·morning 마감 훅, ended 진입 훅 (ended 는 마감 없는 종단 단계)"
  - "night.ts: ResolvedNight.target, enterMorning 이 서버 전용 nightLog 한 줄 추가"
  - "view.result: ended 단계에서만 {winner, seats, summary}, 모든 viewer 에게 같게"
affects: [04-07, 04-09, 04-10, 화면 계획(결과 화면)]

actuals:
  tokens: 10900
  tasks: 3
  commits: 9
plan_head_before: 632c523ee1ffb75444e441c4588edf41fb005b61
plan_head_after: 52c74d25858d741c6ec2bb32e8d0429ab8fa8b83
commits: 9

tech-stack:
  added: []
  patterns:
    - "승패 판정은 처형·아침 마감 훅에서만 — 진입 훅에서 부르면 암살 발표 5초가 끊긴다(D-10)"
    - "내부 팀 문자열(citizen·mafia)은 enterEnded 한 곳에서 와이어 GameWinner(citizenWin·mafiaWin)로 바꾼다"
    - "종료 방 정리는 새 타이머 없이 expiresAt 을 앞당겨 기존 만료 알람 하나로 한다"
    - "nightLog 를 읽는 곳은 buildSummary 하나이고 view 는 ended 에서만 부른다"

key-files:
  created:
    - shared/game/win.ts
    - shared/game/endgame.ts
    - test/unit/win.test.ts
    - test/unit/endgame.test.ts
  modified:
    - shared/game/night.ts
    - shared/game/tick.ts
    - shared/game/view.ts
    - test/unit/night.test.ts
    - test/unit/claim.test.ts
    - HANDOFF.md

key-decisions:
  - "마피아가 0 이면 citizen, 살아 있는 마피아 수가 나머지 생존자 수 이상이면 mafia (생존자는 연결과 무관)"
  - "ended 진입 때 만료를 min(기존 expiresAt, 진입 시각 + 30분)으로 앞당긴다 — 새 타이머 없음"
  - "view 의 result.seats 는 spectate.seats 루프를 재사용하지 않고 따로 만든다(관전자 전용 규칙을 그대로 둔다)"

requirements-completed: []
requirements-server-rules-done: [END-01, END-02, CONN-02]  # 서버 규칙·view 만. 결과 화면·[처음으로]는 화면 계획 몫이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "승패 판정: 4~8명 경계표(마피아 1·2), 끊긴 생존자도 센다, 역할이 한 명에게도 없으면 null, 실제 배정 직후는 null 이고 마피아 전멸은 citizen"
    requirement: "END-01"
    verification:
      - kind: unit
        ref: "test/unit/win.test.ts#checkWinner — 인원별 경계표 (END-01, D-05)"
        status: pass
      - kind: unit
        ref: "test/unit/win.test.ts#checkWinner — 연결 여부는 보지 않는다 (D-05, CONN-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "처형·아침 마감에서만 승패가 나 ended 로 가고, 아침으로 끝나는 판도 아침 5초를 다 거친 뒤 끝나며, 승패가 아니면 처형 뒤 밤·아침 뒤 낮 시작으로 그대로 간다"
    requirement: "END-01"
    verification:
      - kind: unit
        ref: "test/unit/endgame.test.ts#tick 연쇄 — 처형으로 끝 / 아침으로 끝 / 승패가 아니면 그대로"
        status: pass
    human_judgment: false
  - id: D3
    description: "ended 는 마감이 없는 종단 단계: 10시간 뒤 tick 도 같은 객체, winner 는 와이어 값, 만료 = 진입 + 30분(기존이 더 이르면 그대로), nextWakeAt(ended) === expiresAt, 전원 연결 끊김에서도 같다"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "test/unit/endgame.test.ts#enterEnded (END-02, D-28) + CONN-02 — 연결과 무관"
        status: pass
    human_judgment: false
  - id: D4
    description: "밤마다 nightLog 한 줄({n, target?, died}): 지목 없음은 target 키 없음, 의사 구출은 target 과 died false, 난수 호출 순서(동률 한 번·문구 한 번)는 그대로"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "test/unit/night.test.ts#밤 기록 nightLog (04-06, D-27)"
        status: pass
    human_judgment: false
  - id: D5
    description: "ended view 에만 모든 viewer(생존·탈락·방장)에게 같은 result {winner, seats(seat·job), summary} 가 있고, 요약은 날짜별 {n, exec?, night?} 이며 의사 구출 밤도 target·died false 로 보인다; ended 전 어떤 단계 view 에도 result·nightLog·verdict·lastExecPhrase·winner 키가 없다"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "test/unit/endgame.test.ts#buildSummary / ended 전용 result view / ended 전에는 결과·밤 기록이 어떤 view 에도 없다"
        status: pass
    human_judgment: false

duration: 약 25분
completed: 2026-10-28
status: complete
---

# Phase 4 Plan 06: 승패 판정·종료 단계·결과 view Summary

**처형·아침 마감에서만 승패(생존 기준, 연결 무관)를 판정해 마감 없는 종단 단계 ended 로 보내고, 진입 때 winner 를 와이어 값으로 기록하며 방 만료를 진입 + 30분으로 앞당기고, 밤마다 서버 전용 nightLog 를 쌓아 ended 단계 view 에만 모두에게 같은 결과(승리 팀·모든 직업·날짜별 요약)를 싣는 순수 규칙을 만들었다.**

## 진행 기록

Task 1 — RED c99bee0 / GREEN 42f6b75 / win.test.ts 32 통과(RED 때 32 실패), tsc app·worker 0 / 체크포인트 f91d524.
Task 2 — RED 71ca457 / GREEN 7e85fc9 / unit 전체·worker 151 통과, tsc app·worker 0 / 체크포인트 914e0ed.
Task 3 — RED 9613cfd / GREEN 2c1cd9c / `npm test` 86 파일 2093 통과, tsc app·worker 0 / 남은 태스크 없음. HANDOFF 진행 줄 52c74d2.

## Accomplishments

- `win.ts`(신규): `checkWinner` — 역할이 한 명에게도 없으면 null, 생존 마피아 0 이면 citizen, 마피아 수 ≥ 나머지 생존자 수면 mafia. 연결 상태를 읽지 않는다(주석 밖 코드에 `connected` 0회).
- `endgame.ts`(신규): `routeAfterExecution`·`routeAfterMorning`(승패면 `next: "ended"`, 아니면 `next` 없음 → 표의 기본 단계), `enterEnded`(`winner` 를 "citizenWin"/"mafiaWin" 으로, `expiresAt = min(기존, at + ENDED_ROOM_TTL_MS)`, 난수 안 부름, 승패 없으면 winner 키 없음), `buildSummary`(voteLog·nightLog 를 일차 오름차순으로 필드별 합성).
- `tick.ts`: ON_DEADLINE 에 `execution`·`morning`, ON_ENTER 에 `ended` 행과 머리 주석. (04-04 가 남긴 "execution 마감 행" 필요를 이 계획이 채웠다.)
- `night.ts`: `ResolvedNight.target`(최종 지목, 의사가 막아도 남음)과 `enterMorning` 의 nightLog 한 줄. 판정 규칙표에 "밤 기록(서버 전용, 판 요약 재료)" 행을 더했다. 난수 호출 순서는 그대로.
- `view.ts`: `state.phase === "ended"` 이고 `state.winner` 가 있을 때만 `view.result`. `seats` 는 spectate 루프와 따로 `{seat, job}` 로 만든다.

## TDD 기록

**Task 1 RED** (`test(04-06)`, c99bee0): `npx vitest run test/unit/win.test.ts --reporter=tap-flat`, 종료 코드 1. 32개 전부 실패 — 이유는 `checkWinner` 껍데기가 던지는 "not implemented"(import 가 되도록 던지는 껍데기를 RED 커밋에 함께 둠, 04-01·04-04 와 같은 방식). 모듈 로드·픽스처 실패 아님. 의미 점검: 각 테스트는 반환 문자열 단언 앞에서 껍데기 예외로 멈춘다.
**Task 1 GREEN** (42f6b75): 32/32 통과.

**Task 2 RED** (`test(04-06)`, 71ca457): `npx vitest run test/unit/endgame.test.ts test/unit/night.test.ts --reporter=tap-flat`, 종료 코드 1, 21개 실패(endgame 껍데기 예외 + tick 이 ended 로 가지 않음 + nightLog 키 없음), 기존 night 테스트는 모두 통과. 난수 호출 순서 새 단언([2, MORNING_PHRASE_COUNT])은 계약이 바뀌지 않아 RED 때도 통과(부정 가드).
**Task 2 GREEN** (7e85fc9): 대상 4파일 133 통과, unit 전체·worker 151 통과.

**Task 3 RED** (`test(04-06)`, 9613cfd): `npx vitest run --project unit test/unit/endgame.test.ts --reporter=tap-flat`, 종료 코드 1, 13개 실패(`buildSummary` 껍데기 예외, `view.result` 없음). ended 전 누출 검사 4개는 지금 훅이 없어도 키가 없는 것이 맞는 부정 가드라 통과.
**Task 3 GREEN** (2c1cd9c): 첫 실행에서 5개 실패 — 요약 night 객체의 키 순서가 `{died, target}` 이라 JSON 비교가 `{target, died}` 와 어긋났다. 구현을 target 먼저로 고쳐 통과(테스트를 느슨하게 하지 않음).

**REFACTOR**: 없음.

## Verification

| 명령 | 결과 |
|---|---|
| `npx vitest run test/unit/endgame.test.ts test/unit/night.test.ts test/unit/win.test.ts test/unit/tick.test.ts` | 4 파일 133 passed |
| `npx vitest run --project unit` | 통과 (987 ok) |
| `npx vitest run --project worker` | 종료 코드 0, 151 ok |
| `npm test` | 86 파일 2093 passed, 실패 0 |
| `npx tsc -p tsconfig.app.json --noEmit` | 종료 코드 0 |
| `npx tsc -p tsconfig.worker.json --noEmit` | 종료 코드 0 |
| `npx vitest run test/unit/handoff.test.ts` | 2 passed, HANDOFF 2727바이트 |

수용 기준 그렙: `export function checkWinner` win.ts 1, 주석 밖 `connected` 0, endgame.ts 의 `routeAfterExecution|routeAfterMorning|enterEnded|ENDED_ROOM_TTL_MS` 내보내기 4, tick.ts `execution|morning: routeAfter` 2, night.ts `nightLog` ≥ 1, `export function buildSummary` 1, view.ts `buildSummary`·`view.result` 각 ≥ 1, HANDOFF `04-06 까지 완료` 1. `test(04-06)` 커밋이 각 `feat(04-06)` 커밋보다 먼저다.

## 추가로 고친 파일 (04-07·04-08 이 읽는다)

계획이 예상한 `test/unit/testTools.test.ts`·`test/unit/bots.test.ts`·`test/worker/{night,bots,testTools}.test.ts` 는 승패 판정 때문에 실패하지 않아 **고치지 않았다**(그 테스트들은 지목 없이 밤을 넘기거나 사람 수가 부족해 승패가 나지 않는다). 대신 목록 밖 파일 하나가 실제로 영향을 받았다.

- `test/unit/claim.test.ts` (**frontmatter files_modified 밖**): "탈락자는 그날 기록 줄이 없다 (2일차부터)" 가 seat 3 을 탈락시키는데 시드 1 에서 seat 3 이 마피아라, 아침 마감에 citizenWin 으로 ended 가 되어 `nextClaimDay` 의 `while` 이 무한 루프(`tick` 이 마감 없는 ended 를 못 넘김)를 돌았다. 단언은 그대로 두고 마피아가 seat 2 인 시드 2(`claimState(5, 2)`)로 옮겼다. 04-07·04-08 이 "마감 없는 ended 에서 `while (phase !== X) tick(...)` 루프" 를 쓰는 테스트를 만들 때 같은 함정이 있다 — 상태에 사람을 임의로 탈락시키는 테스트는 마피아 seat 를 확인해야 한다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 의도된 변경 반영] claim.test.ts 의 탈락 시나리오**
- **Found during:** Task 2 GREEN 회귀 실행(unit 전체가 타임아웃)
- **Issue:** 위 "추가로 고친 파일" 참조 — 파일 목록 밖이지만 승패 판정으로 ended 에 닿는 테스트.
- **Fix:** 시드를 2 로 옮김(단언 불변).
- **Files modified:** test/unit/claim.test.ts
- **Commit:** 7e85fc9

**2. [계획 대비 축소] 예상 수정 대상 5개 파일 미수정**
- 계획은 "실패할 때만 고친다" 로 정했고 실패하지 않아 건드리지 않았다. 계획 이탈이 아니라 조건부 항목의 미발동이다.

**Total deviations:** 1 (Rule 1 ×1). **Impact:** 범위 변화 없음.

## Known Stubs

없음. `view.result` 를 소비하는 결과 화면과 [처음으로] 처리, 방 만료 시 `room_closed` 소켓 닫힘 처리는 계획이 명시한 대로 화면 계획(시안 승인 → `/gsd-ui-phase 4` 뒤) 몫이다.

## Threat Flags

없음. T-04-18(결과·nightLog 선공개)은 view 가 ended 에서만 `result` 를 만들고 nightLog 를 읽는 곳이 `buildSummary` 하나라는 구조와 단계별 키 검사(ended 전 로비~처형·밤 기록이 쌓인 아침·다음 날 낮 시작)로 닫았다. T-04-19(거짓 승리)는 역할 없으면 null 과 마감 훅 한정 호출로, T-04-20(종료 방 정리)은 `nextWakeAt(ended) === expiresAt` 테스트로, T-04-21(요약 불일치)은 voteLog·nightLog 합성과 키 집합 테스트로 닫았다. 소켓 수준 전수 검사는 04-09 몫. 새 패키지 설치 없음(T-04-SC).

## Next Phase Readiness

Ready for 04-07. 서버 규칙·view 의 승패·종료·결과가 끝났다. 소켓 수준(메시지 수신·ended 에서의 DO 알람/room_closed)과 전수 누출 검사는 04-07·04-09 몫이다. `RoomState.winner` 는 와이어 값("citizenWin"|"mafiaWin")이라 DO 가 그대로 view 로 넘기면 된다. 이 웨이브의 push 는 메인 작업 트리에서 계획대로 올렸다. 배포는 하지 않았다(D-26).

## Self-Check: PASSED

- 파일 존재: `shared/game/win.ts`, `shared/game/endgame.ts`, `test/unit/win.test.ts`, `test/unit/endgame.test.ts` 확인.
- 커밋 존재: c99bee0, 42f6b75, f91d524, 71ca457, 7e85fc9, 914e0ed, 9613cfd, 2c1cd9c, 52c74d2 모두 HEAD 의 조상.
