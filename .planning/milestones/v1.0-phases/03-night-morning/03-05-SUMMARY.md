---
phase: 03-night-morning
plan: 05
subsystem: game-core
tags: [tdd, tracer, view, leak-test, night, morning, spectate, alive]
status: complete

requires:
  - phase: 03-night-morning/03-01
    provides: PublicPlayer.alive·MyInfo.pick·allyPicks·records·DayView.morning·SpectateView 와이어 타입, night·morning 단계
  - phase: 03-night-morning/03-03
    provides: Player.nightPick·investigations, RoomState.morning, pickTarget, enterMorning
provides:
  - "모든 view 의 players[] 가 alive 를 포함한 다섯 키 리터럴 (공개 정보, ELIM-01)"
  - "night·morning 에도 day(n·roles·그날 낮 claims). 아침에는 day.morning({eliminated, phrase} 또는 {}), 모든 viewer 같은 값"
  - "me.pick(밤·생존 본인만), me.allyPicks(밤·생존 마피아만, 대상 seat 집합), me.records(경찰 본인, 역할 공개 단계 전체·탈락 뒤에도)"
  - "탈락한 본인 view 에만 spectate.seats({seat, job})와 밤의 spectate.picks({mafia, police, doctor}), 살아 있는 viewer 에는 키 자체가 없다"
  - "아홉 단계 × 4~8명 × 모든 viewer × 시드 3 전수 누출 검사(3 * 9 * 30 views)와 2일차 밤 탈락자 전수 검사"
affects: [03-07, 03-08, 03-09, 03-10, 03-11, 03-12]

tech-stack:
  added: []
  patterns:
    - "view 필드는 조건을 채울 때만 키를 만드는 리터럴이다(undefined 를 남기지 않는다). 본인 선택·동료 선택·기록·관전 모두 같은 방식"
    - "전수 누출 검사가 받을 권리를 규칙 함수(spectateViolations 등)로 한 곳에 모아, 단계·viewer 조합마다 키 유무와 값을 서버 상태에서 다시 계산해 대조한다"
    - "테스트 실패 출력은 한 줄·비어 있지 않은 문자열로 만든다. 배열 toEqual 의 여러 줄 diff 는 join 문자열 비교로 바꾼다"

key-files:
  created: []
  modified:
    - shared/game/view.ts
    - test/unit/view.test.ts
    - test/unit/gameRoom.test.ts
    - test/worker/http.test.ts
    - test/worker/leak.test.ts
    - test/worker/join.test.ts

key-decisions:
  - "alive 는 서버가 항상 싣는다(A7). 키를 정확히 비교하던 곳 네 군데(gameRoom·http·leak·join 테스트)를 같은 계획에서 고쳤다. scripts/smoke.mjs 23행은 계획대로 03-12 가 고친다"
  - "탈락한 마피아는 allies 를 계속 받고 allyPicks·pick 은 받지 않는다(A3). 살아 있는 마피아의 allyPicks 에는 탈락한 동료의 남은 값이 들지 않는다"
  - "records 는 경찰이면 빈 배열이라도 싣는다(roleReveal 부터). 화면(03-11)이 '아직 조사한 사람이 없어요' 를 그릴 근거"
  - "spectate 의 직업 키는 role 이 아니라 job 이다. 누출 검사는 role 키를 me 밖에서 금지하고, 역할 값 허용 경로는 탈락한 viewer 에게만 spectate.seats[].job 이 더해진다. 와이어 계약이라 결정 0020(03-09)에 기록"

requirements-completed: []

duration: 약 45분
completed: 2026-10-25

coverage:
  - id: C1
    description: "모든 view 의 players[] 는 alive 포함 다섯 키이고, 밤·아침 view 에도 그날 낮 claims 가 있다. 탈락자는 모든 viewer 의 players[] 에서 alive false 다"
    requirement: "ELIM-01"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 밤 — 생존·본인 선택 (ELIM-01, D-06)"
        status: pass
      - kind: unit
        ref: "test/unit/gameRoom.test.ts#buildView"
        status: pass
    human_judgment: false
  - id: C2
    description: "me.pick 은 밤에 살아 있는 본인에게만, me.allyPicks 는 밤에 살아 있는 마피아에게만(동료가 고른 대상 seat 오름차순·중복 없음, 비마피아·탈락 마피아에는 키 없음), 남의 선택은 어떤 키로도 없다"
    requirement: "NIGHT-01, NIGHT-04"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 밤 — 동료 선택 (D-07)"
        status: pass
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 전수 누출 검사 (T-01-23)"
        status: pass
    human_judgment: false
  - id: C3
    description: "me.records 는 경찰 본인 view 에만 있고(roleReveal 부터, 탈락 뒤에도) 세 키 {n, target, isMafia} 씩이며 그 밤의 결과는 아침부터 보인다"
    requirement: "NIGHT-02"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 수사 기록 (D-09·D-11)"
        status: pass
    human_judgment: false
  - id: C4
    description: "day.morning 은 morning 단계에서만, 모든 viewer 에게 같은 값({eliminated, phrase} 또는 의사 구출·지목 없음의 {})이다"
    requirement: "NIGHT-06"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 아침 결과 (NIGHT-06·D-13)"
        status: pass
    human_judgment: false
  - id: C5
    description: "탈락한 본인 view 에만 spectate(모든 사람의 실제 직업, 밤에는 살아 있는 각 역할의 현재 선택)가 있고 살아 있는 viewer·탈락 전 view 에는 키가 없다. 아홉 단계 전수 누출 검사에서 서버 전용 키·최상위 키 허용 목록·역할 값 허용 경로를 지킨다"
    requirement: "ELIM-01, NIGHT-04"
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 관전 (결정 0021)"
        status: pass
      - kind: unit
        ref: "test/unit/view.test.ts#buildView 전수 누출 검사 (T-01-23)"
        status: pass
    human_judgment: false
  - id: C6
    description: "이 view 가 실제 방 소켓으로 누구에게 언제 가는지(03-07)와 화면(03-08·10·11), 배포본 확인(03-12)은 이 계획 범위 밖이다"
    requirement: "NIGHT-01, NIGHT-02, NIGHT-04, NIGHT-06, ELIM-01"
    human_judgment: true
    rationale: "이 계획은 buildView 순수 함수까지다. 폰까지 오가는 경로와 화면은 뒤 계획이 만든다"

actuals:
  tokens: 11000
  tasks: 3
  commits: 6
plan_head_before: c8606896ed971711aa910a666710f1293b710baa
plan_head_after: d3197c8c005789680fe31e5b0ae7033287ea9d25
---

# Phase 3 Plan 05: 밤·아침 view Summary

**buildView 가 밤·아침 단계에 day 를 만들고, 공개 생존 여부·본인 선택·마피아 동료 선택·경찰 수사 기록·아침 결과를 받을 사람에게만 허용 목록 리터럴로 싣는다. 탈락한 본인에게만 모든 실제 직업과 그 밤의 행동 대상(spectate)을 더하고, 아홉 단계 전수 누출 검사로 고정했다.**

## Performance

- **Duration:** 약 45분 (2026-10-25)
- **Tasks:** 3 (Task 1 트레이서 TDD, Task 2 TDD, Task 3 TDD)
- **Files:** 소스 1개(view.ts), 테스트 5개(view·gameRoom·http·leak·join)

## Accomplishments

- `shared/game/view.ts`: `DAY_PHASES` 에 night·morning 을 더하고 night·morning 에서도 그날 낮 `claims` 를 싣는다(dayAnnounce·claim 은 그대로 싣지 않는다). players[] 는 `alive: isAlive(p)` 포함 다섯 키 리터럴이다.
- 내 정보: `pick`(밤·생존·고른 값 있음) / `allyPicks`(밤·생존 마피아, 살아 있는 다른 마피아의 nightPick 을 Set 으로 중복 제거해 오름차순, 없으면 `[]`) / `records`(경찰이고 역할 공개 단계면 빈 배열이라도, 세 키 복사). 남의 값은 어떤 키로도 싣지 않는다.
- `day.morning`: morning 단계에서만, `state.morning.eliminated` 가 있으면 `{eliminated, phrase}`, 없으면 `{}` — 의사 구출과 지목 없음이 구별되지 않는다(D-13).
- `spectate`: 본인이 탈락했고 역할을 싣는 단계일 때만 `{ seats: [{seat, job}…] }`(seat 오름차순), 밤이면 `picks: {mafia, police, doctor}`(살아 있는 그 역할 사람의 현재 선택, 중복 없음·오름차순). 살아 있으면 키를 만들지도 않는다.
- 전수 누출 검사(`3 * 9 * 30` views): 서버 전용 키 `nightPick·investigations·lastPhrase·nextNightSeq` 금지, 최상위 키 허용 목록, 밤 필드(`pick·allyPicks·records`)는 `me.` 아래에만, pick·allyPicks·records·morning·spectate 유무를 서버 상태에서 다시 계산해 viewer 별로 대조, 역할 값 허용 경로는 그대로이고 탈락한 viewer 에게만 `spectate.seats[].job` 이 더해진다. 2일차 밤(1일차 밤에 한 명 탈락) 전수 검사 `3 * 30` views 를 따로 더했다.
- 전체 회귀: `npx vitest run` 57 파일·1186 테스트 통과, `npm run typecheck` 통과.

## Task Commits

| Task | 커밋 | 내용 |
|------|------|------|
| 1 RED | `3a3239e` test(03-05) | 밤 view 의 day·alive·경찰 me.pick, 키 단언 세 곳을 다섯 키로 |
| 1 GREEN | `ec61e6f` feat(03-05) | DAY_PHASES 에 밤·아침, alive 공개, me.pick |
| 2 RED | `e2df1aa` test(03-05) | 동료 선택·수사 기록·아침 결과·주장 줄, 전수 누출 검사 아홉 단계 |
| 2 GREEN | `3943361` feat(03-05) | allyPicks·records·day.morning |
| 3 RED | `a75837f` test(03-05) | 관전 view 테스트와 전수 검사의 spectate 규칙 |
| 3 GREEN | `d3197c8` feat(03-05) | spectate.seats·picks (탈락한 본인만) |

`commits: 6` 은 `git rev-list --count ${plan_head_before}..HEAD` 로 측정한 값이다(HANDOFF 커밋 전).

## TDD Gate Compliance

| Task | RED | GREEN | 증거 |
|------|-----|-------|------|
| 1 | `3a3239e` test(03-05) | `ec61e6f` feat(03-05) | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK`(tap-flat, 대상 "5명 판 경찰이 seat X 를 고른 뒤 …", 82건 중 5건 실패) |
| 2 | `e2df1aa` test(03-05) | `3943361` feat(03-05) | `RED_EVIDENCE_OK`(대상 "마피아 A 가 X 를 고르면 A: pick X·allyPicks [], B: …", 36건 중 10건 실패) |
| 3 | `a75837f` test(03-05) | `d3197c8` feat(03-05) | `RED_EVIDENCE_OK`(대상 "1일차 밤 뒤 X 가 탈락한 morning: X 의 spectate.seats …", 8건 실패) |

semanticAssessment (Task 1): night·morning 에 day 가 없고 players[] 에 alive 가 없으며 me.pick 이 없어서 계획된 단언에서 실패했다(경찰 view 의 `0:- 1:- 2:- 3:- 4:-` ≠ `0:- 1:- 2:0 3:- 4:-`, `alive` 가 `undefined`, 키 목록에 alive 없음). 첫 시도는 gameRoom 의 배열 `toEqual` 이 여러 줄 diff 를 내 TAP 에 비TAP 줄이 섞여 `INVALID_RED(invalid_record)` 였다. 구현을 건드리기 전에 `join(",")` 문자열 비교로 바꿔 `RED_EVIDENCE_OK` 를 받았다.

semanticAssessment (Task 2): allyPicks·records·day.morning 이 없어서 실패했다(`pick=0 ally=undefined` ≠ `pick=0 ally=[]`, records `undefined`, morning `undefined`, 전수 검사의 `me.records presence false`). 밤 day·claims 는 Task 1 GREEN 에서 이미 생겨 해당 단언은 RED 에서 통과했다(회귀 고정 용도). 대상 테스트는 실패 출력이 비어 있지 않은 것으로 골랐다(전수 검사는 `expected: ` 가 비어 대상으로 쓸 수 없었다).

semanticAssessment (Task 3): spectate 키가 없어서 실패했다(`undefined` ≠ `[{seat:0,job:citizen},…]`, `[…] ` ≠ `[…] seats`, 전수 검사의 `spectate presence false want true`). 살아 있는 viewer·탈락 전 view 에 키가 없다는 단언은 RED 에서 통과했고, 이는 GREEN 뒤에도 키가 생기지 않음을 고정한다.

트레이서 게이트: auto 모드가 아니고 `human_verify_mode` 가 end-of-phase 이며 Task 1 의 `<verify>` 가 자동 검사뿐이라 `npx vitest run`(1164건)·`npm run typecheck` 를 다시 돌려 통과를 확인하고 Task 2 로 넘어갔다 — Tracer verified end-to-end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 계획에 없던 키 단언 하나: test/worker/join.test.ts**
- **Found during:** Task 1 GREEN 전체 회귀
- **Issue:** join.test.ts 39-40행이 players[] 를 네 키 객체로 `toEqual` 비교해 alive 가 실리자 실패했다(계획은 gameRoom·http·leak 세 곳만 적었다).
- **Fix:** 두 항목에 `alive: true` 를 더했다. 같은 이유로 view.test.ts 전수 누출 검사의 players 키 문자열도 Task 1 GREEN 에서 다섯 키로 바꿨다(계획은 Task 2 의 일로 적었지만 Task 1 의 `<verify>` 가 파일 전체 통과를 요구한다).
- **Files modified:** test/worker/join.test.ts, test/unit/view.test.ts
- **Commit:** ec61e6f

**2. [Rule 1 - Bug] RED 에 쓴 2일차 records 테스트의 단계 전진 오류**
- **Found during:** Task 2 GREEN
- **Issue:** `advanceTo(s, "night")` 를 이미 night 인 상태에서 불러 아무것도 전진하지 않아, 테스트가 1일차 밤을 두 번 센 상태였다. RED 에서는 records 가 없어서 실패해 눈에 띄지 않았다.
- **Fix:** 아침 → 2일차 낮 → 2일차 밤 순서로 전진하도록 고쳤다. 이 수정은 GREEN 커밋에 들어 있다.
- **Files modified:** test/unit/view.test.ts
- **Commit:** 3943361

세부 선택(편차 아님): (1) 전수 검사용 `richStateAt` 의 밤 행동을 `nightActions` 로 묶었다 — 의사는 지목된 사람이면 마피아를 지켜, 아침 상태에서 한 명이 반드시 탈락하게 해 spectate 를 아홉 단계 전수 검사에 넣었다. (2) `requirements mark-complete` 는 부르지 않았다. 이 계획은 서버 view 까지라 사용자 경로(소켓 전송·화면)가 끝나지 않았고 NIGHT-04·ELIM-01 은 지시대로 보류한다.

## Issues Encountered

없음. RED 증거 기록의 형식 문제 한 건과 BSD sed 의 `-i` 인자 오류 한 번(Python 으로 대체)을 Task 1 에서 겪었고, 구현 코드에는 영향이 없었다.

## Known Stubs

없음. 이 계획이 만든 코드에는 빈 값·자리표시자가 화면으로 흐르는 곳이 없다. view 필드를 화면이 읽는 일은 03-08·10·11, 소켓으로 보내는 일은 03-07 이다.

## Threat Flags

없음. 새 네트워크 입구·인증 경로가 없고, 계획의 T-03-14(allyPicks: 밤·생존 마피아만, 누가 골랐는지 없음)·T-03-15(records: 경찰 본인만, 세 키 복사)·T-03-16(아홉 단계 전수 검사: 서버 전용 키·최상위 키·역할 값 허용 경로)·T-03-17(me.pick: 밤·생존 본인만)·T-03-37(spectate: 탈락한 본인만, 살아 있는 viewer 전수 검사에서 키 0)이 모두 테스트로 고정됐다. 새 패키지 설치 없음(T-03-SC).

## Self-Check: PASSED

- `shared/game/view.ts` 및 수정한 테스트 5개 존재 확인, 커밋 6개(`3a3239e`, `ec61e6f`, `e2df1aa`, `3943361`, `a75837f`, `d3197c8`) 모두 HEAD 의 조상임을 확인
- 계획 인수 기준 통과: `alive: isAlive(p)` 1, `"night"|"morning"` 5, 다섯 키 문자열 세 파일 3 / 옛 네 키 문자열 0, `allyPicks|records|morning` 11, `3 * 9 * ` 1, Player 펼침 복사 0, `spectate` 2, `spectate.seats` 4, `role: p.role` 0, 각 `test(03-05)` 커밋이 해당 `feat(03-05)` 커밋보다 앞
- 전체 검증: `npx vitest run` 1186 통과, `npm run typecheck` 통과

## Next Phase Readiness

03-07(워커)은 `buildView` 를 그대로 쓰되 밤 행동 뒤 state 를 `pickRecipientIds`(행위자 쪽+탈락자)에게만 보내면 되고, 화면(03-08·10·11)은 `players[].alive`·`me.pick·allyPicks·records`·`day.morning`·`spectate` 를 읽는다. 필드 이름과 spectate 모양은 와이어 계약이라 03-09 가 결정 0020 에 기록한다. `scripts/smoke.mjs` 23행의 players 키 단언은 03-12 가 고친다.
