---
phase: 08-day-execution-ghost
plan: "07"
subsystem: room-durable-object
tags: [tdd, websocket, durable-object, nomination, verdict, end-discussion, bots, broadcast-discipline, leak-prevention]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-02 의 castPoint·castVerdict·toggleEnd·endReached·endCountOf·votedSeatsOf·pointLinesOf·verdictVotersOf, 08-04 의 canMove 등(이 계획은 직접 쓰지 않음)
provides:
  - ClientMessage·ClientMessageSchema 의 endDiscussion {on}·point {target 0..7}·verdict {agree} strictObject 세 메시지
  - worker/room.ts handlePoint·applyPoint(사람당 250ms 간격, 인메모리 pointAt)·handleVerdict·applyVerdict(첫 투표 전원 / 값 변경 본인만)·handleEndDiscussion·applyEndDiscussion(개수 전원 방송, 과반이면 마감을 지금으로 당겨 tick)
  - view.ts day.points·endCount·voted·verdict 와 me.endDiscussion·verdictVote, DAY_PHASES 에 nomination·verdict, verdict 단계 day.candidate
  - bots.ts BotAct endDiscussion·point·verdict 와 계획(토론 끝내기 30~60초·지목 2~8초·찬반 1~6초), testTools.ts skipPhase 가 nomination·verdict 를 넘기기 전 안 던진 봇이 먼저 던짐, actAsBot 세 case
  - test/worker/trial.test.ts(DO 시험 17개), 시험 도우미 toPhase·pointAs·verdictAs·endAs
affects: [08-09 DO 배선과 누설 스캔 개편, 08-11 흐름 전환(tick 표 훅·마감 시험 단언 이동), 08-13 화면, 08-21 옛 단계 삭제, 08-23 E2E 도우미 라벨]

actuals:
  tokens: 15600
  tasks: 3
  commits: 7
plan_head_before: 49b38032d85bac5d39f248b69cb48bf1354d3398
plan_head_after: 0cd659d298185061538ef8af2d3ba0806af8e87b

tech-stack:
  added: []
  patterns:
    - "값 변경은 본인만: 공개 값(day.voted)이 안 바뀌는 변경은 storage.put + sendViewTo([playerId]) — 전원 방송은 '누군가 마음을 바꿨다' 타이밍을 흘린다"
    - "검사는 규칙 함수가 먼저, 속도 제한은 그 다음: castPoint 가 거절·같은 값을 먼저 걸러 간격 기록은 받아들인 지목만 센다"
    - "봇 행동은 사람과 같은 apply* 본체만 부르고 특권 경로가 없다 — 규칙 거절을 봇 계획을 손으로 세운 DO 시험으로 고정"
    - "흐름 전환 전 시험은 toPhase(editRoom 래퍼)로 저장 상태를 새 단계로 옮겨 들어간다"

key-files:
  created:
    - test/worker/trial.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/view.ts
    - shared/game/bots.ts
    - shared/game/testTools.ts
    - worker/room.ts
    - src/components/TestTools.tsx
    - src/styles/testtools.css
    - test/worker/helpers.ts
    - test/unit/schemas.test.ts
    - test/unit/view.test.ts
    - test/unit/bots.test.ts
    - test/unit/testTools.test.ts
    - test/worker/bots.test.ts
    - test/client/testTools.test.tsx
    - test/unit/endgame.test.ts
    - test/unit/execution.test.ts
    - test/worker/leak.test.ts

key-decisions:
  - "applyPoint 는 castPoint 로 검증한 뒤 간격을 본다: 거절·같은 값은 기록하지 않고, 받아들일 값이 같은 사람의 마지막 수락 250ms 안이면 상태를 안 바꾸고 그 사람 소켓에만 view(오류 프레임 없음). 간격 기록은 DO 메모리 맵(가정 A1)"
  - "applyVerdict 방송 분기는 '이 사람이 이전에 던졌는가'로 가른다: 처음이면 persistAndBroadcast(day.voted 가 모두에게 바뀐다), 값 변경이면 저장 후 sendViewTo([playerId]). 마감은 건드리지 않는다"
  - "applyEndDiscussion 은 과반이면 { ...state, phaseEndsAt: now } 를 tick 에 넘겨 handleTestSkip 과 같은 정상 마감 경로를 탄다 — 새 마감 now + 다음 단계 길이, 알람은 reschedule 이 옮긴다. 다음 단계는 아직 표의 기본값(execVote, 가정 A2)이라 시험은 PHASE_DEFS.discussion.next 로 단언한다"
  - "me.verdictVote 는 verdictVotersOf(변론자를 뺀 산 사람)에 든 본인만, me.endDiscussion 은 산 본인만 — 유령·변론자의 남은 값은 키가 되지 않는다"
  - "봇 지목·찬반은 후보 선택·여부 투표의 결정 함수(botCandidateTarget·botExecAgree)를 재사용해 고정 규칙(testBotVote pick·exec)이 같은 뜻으로 간다. 와이어 {exec, pick} 은 그대로(A3)"

requirements-completed: [DAY-03, DAY-04, DAY-05, DAY-06, GHOST-02]

coverage:
  - id: D1
    description: "세 메시지 스키마: 정상 모양과 덧붙은 키(seat·id·ch·count)·범위 밖 target(8, -1)·소수·null·불리언 아닌 값 거부"
    requirement: DAY-04
    verification:
      - kind: unit
        ref: "test/unit/schemas.test.ts 'ClientMessageSchema point·verdict·endDiscussion (08-07)'"
        status: pass
    human_judgment: false
  - id: D2
    description: "지목 DO 경로: 전원 view 의 day.points 가 같은 공개 목록, 250ms 안 두 번째는 본인 소켓에만 서버 값 view(오류 없음), 300ms 뒤는 새 목록, 같은 값 무전송, 자기 자신 BAD_MESSAGE, 단계 틀림 WRONG_PHASE, 스키마 거부"
    requirement: DAY-04
    verification:
      - kind: integration
        ref: "test/worker/trial.test.ts '지목 (DAY-04, 결정 0060-3)' (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "찬반 방송 규율: 첫 투표 전원, 값 변경 본인만(나머지 소켓 프레임 0), 같은 값 무전송, 어떤 소켓에도 남의 verdictVote·agree 키 없음, 변론자·유령 BAD_MESSAGE"
    requirement: DAY-06
    verification:
      - kind: integration
        ref: "test/worker/trial.test.ts '찬반 방송 규율 (DAY-06, 결정 0053, T-08-02)' (6 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "토론 끝내기: 개수 전원 방송·me.endDiscussion 본인만, 취소·같은 값, 과반(산 4 중 3)이면 다음 단계로 넘기고 마감 now + 다음 단계 길이와 알람이 따라 이동, 유령 BAD_MESSAGE"
    requirement: DAY-03
    verification:
      - kind: integration
        ref: "test/worker/trial.test.ts '토론 끝내기 (DAY-03, 결정 0060-2)' (4 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "view 단계별 필드: endCount=discussion, points=nomination, voted=verdict, verdict=execution(그날 voteLog 줄), me.endDiscussion·verdictVote 본인 한정, 처형 day 에 역할 키 없음"
    requirement: DAY-06
    verification:
      - kind: unit
        ref: "test/unit/view.test.ts 'buildView 낮 처형 필드 (08-07, DAY-03~06)' (5 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "봇: 계획(토론 끝내기·지목·찬반 시각 범위·난수 호출 순서·고정 규칙), skipPhase 선행 투표, 알람으로 세운 계획의 DO 수행, 과반 토론 끝내기, 사람과 같은 apply 본체에서의 거절"
    requirement: GHOST-02
    verification:
      - kind: unit
        ref: "test/unit/bots.test.ts·test/unit/testTools.test.ts (신규 describe 4개)"
        status: pass
      - kind: integration
        ref: "test/worker/bots.test.ts '봇 지목·찬반·토론 끝내기' (4 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "전체: 앱·워커 타입 검사와 vitest 전체(150 파일 4318 통과, 1 skipped 는 이전부터)"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run"
        status: pass
    human_judgment: false
  - id: D8
    description: "실제 낮 흐름에서 지목·찬반·토론 끝내기가 의도한 박자로 도는지"
    verification: []
    human_judgment: true
    rationale: "서버 입력 경로만 만들었고 흐름 전환(08-11)·화면(08-13 이후) 전이다. 박자·체감은 개발 뒤 실기기 확인에서 본다"

duration: 14min
completed: 2026-11-02
---

# Phase 8 Plan 7: 지목·찬반·토론 끝내기 DO 배선과 봇 Summary

**새 세 메시지(endDiscussion·point·verdict)를 strictObject 스키마 → 규칙 함수 → 저장 → 방송 규율 → view 로 방 DO 에 이었다: 지목은 모두에게(사람당 250ms 간격), 찬반은 첫 표만 모두에게·값 변경은 본인에게만, 토론 끝내기는 개수만 공개하고 과반이면 마감을 당겨 tick 으로 넘기며, 봇도 같은 apply\* 본체로 세 행동을 한다.**

## Accomplishments

- **Task 1 (트레이서, DAY-04)** — `ClientMessage` 유니온과 `ClientMessageSchema` 에 세 strictObject(point 는 target 0..7·null 거부, 덧붙은 seat·id·ch 거부). `applyPoint` 가 `castPoint` 를 지나 `persistAndBroadcast` 하고, 같은 사람의 250ms 안 두 번째 지목은 `sendViewTo([playerId])` 만 한다. view 는 `DAY_PHASES` 에 nomination·verdict 를 더하고 nomination 에서 `day.points` 를 싣는다. 트레이서 게이트로 `<verify>` 를 다시 돌려 통과 확인 후 확장 작업으로 넘어갔다.
- **Task 2 (DAY-03·06, T-08-02)** — `applyVerdict`: 이전에 던진 적이 없으면 전원 방송, 있으면 `storage.put` + `sendViewTo([playerId])`. `applyEndDiscussion`: 개수가 바뀌면 전원 방송, `endReached` 면 `tick({ ...state, phaseEndsAt: now })` 로 넘기고 `reschedule`. view: `day.endCount`(discussion)·`day.voted`(verdict)·`day.verdict`(execution, 그날 voteLog 줄 세 키 복사)·verdict 단계 `day.candidate`, `me.endDiscussion`(산 본인)·`me.verdictVote`(산 유권자 본인).
- **Task 3 (결정 0024·0060-13)** — `BotAct` 에 세 종류, 상수 `END_DISCUSSION_*`·`POINT_*`·`VERDICT_*`, `botPlanKey` 에 nomination·verdict. 지목은 `botCandidateTarget`, 찬반은 `botExecAgree`(변론자 봇 제외)를 재사용해 고정 규칙이 같은 뜻으로 간다. `skipPhase` 가 두 단계 전에 `castPoint`·`castVerdict` 로 안 던진 봇을 먼저 던지게 한다. `actAsBot` 세 case 는 `applyEndDiscussion`·`applyPoint`·`applyVerdict`. 시트 칩 그룹 이름은 "봇 찬반"·"봇 지목".

## TDD Gate Compliance

세 작업 모두 RED(`test(08-07)`) → GREEN(`feat(08-07)`) 순서다. REFACTOR 커밋은 없다.

| 작업 | RED 커밋 | RED 증거(`gsd_run check tdd-red-evidence` = RED_EVIDENCE_OK) | GREEN 커밋 |
| --- | --- | --- | --- |
| 1 지목 트레이서 | `ec7f1da` | trial.test.ts "손님 A 의 지목은 네 소켓 모두에게…" 가 `[] [error:BAD_MESSAGE] [] []`(기대 `[state:nomination]` ×4)로 실패 | `aad798c` |
| 2 찬반·토론 끝내기·view | `0b550af` | trial.test.ts "처음 던지면 다섯 소켓 모두에게…" 가 `[] [state:verdict] [] [] []`(기대 전원)로 실패. view.test.ts "공개 필드는 자기 단계에서만 생긴다" 가 `discussion:`(기대 `discussion:endCount`)로 실패 | `ee72660` (+ 타입 정정 `3695b03`) |
| 3 봇·테스트 도구 | `09b2c20` | bots.test.ts "산 봇마다 point 한 번이…" 가 point 행 0개로, worker bots.test.ts "nomination: 봇 계획에…" 가 빈 계획(기대 `point,point,point`)으로, testTools.test.ts "nomination: 안 던진 봇이…" 가 `1>4,2>undefined,…`(기대 `1>4,2>0,3>0,4>0`)로 실패 | `0cd659d` |

semanticAssessment: 세 RED 모두 계획한 단언(없는 길 때문에 받는 프레임·계획이 틀림)에서 실패했고 스키마 거부(BAD_MESSAGE)가 이미 맞는 일부 시험(덧붙은 키·범위 밖)은 RED 에서도 통과했다. Task 1 은 찬반·토론 끝내기 껍데기(규칙 함수에 잇고 본인에게만 view)를 함께 만들어 `never` 검사를 만족시켰고, Task 2 RED 가 그 껍데기의 방송 범위 부족(첫 표·개수가 본인에게만)을 실패시켰다.

트레이서 게이트: 작업 1 의 `<verify>` 를 다시 돌려 통과를 확인했고(`⚡ Tracer verified end-to-end — expanding`) 확장 작업으로 넘어갔다.

## Task Commits

1. Task 1 RED `ec7f1da` → GREEN `aad798c`
2. Task 2 RED `0b550af` → GREEN `ee72660` (+ `3695b03` 시험 타입 정정)
3. Task 3 RED `09b2c20` → GREEN `0cd659d`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 처형 단계 `day.verdict` 가 서버 전용 `verdict` 키 검사에 걸림**
- **Found during:** Task 2 GREEN (전체 시험 6건 실패)
- **Issue:** 계획이 정한 공개 와이어 필드 `day.verdict {yes,no,passed}` 와 서버 전용 `RoomState.verdict` 는 이름이 같다. 기존 누설 검사 다섯 곳(`view.test.ts` 허용 키 표, `endgame.test.ts`, `execution.test.ts` 두 곳, `leak.test.ts` 두 곳)이 마지막 키 이름만 보고 `verdict` 를 금지한다. `discussion` 의 새 `day.endCount` 도 두 view 시험의 day 키 목록을 어긋나게 했다.
- **Fix:** 서버 전용 검사에서 정확한 경로 `day.verdict`(`.view.day.verdict`)만 예외로 두고, 허용 키 표에 `points·endCount·voted·verdict`·`endDiscussion·verdictVote` 를 더했으며, discussion/execution 의 day 키 기대값에 새 키를 반영했다. 금지 이름 자체는 지우지 않았다. 전체 누설 스캔 개편은 계획대로 08-09 몫이다.
- **Files modified:** test/unit/view.test.ts, test/unit/endgame.test.ts, test/unit/execution.test.ts, test/worker/leak.test.ts
- **Commit:** 0b550af(허용 표), ee72660(나머지)

**2. [Rule 3 - Blocking] 칩 그룹 이름 시험과 주석**
- **Found during:** Task 3
- **Issue:** `test/client/testTools.test.tsx` 가 그룹 이름 "봇 처형 투표"·"봇 후보 선택"을 직접 단언한다(계획 files_modified 에 없음).
- **Fix:** "봇 찬반"·"봇 지목"으로 갱신(RED 에서 실패 확인). `src/styles/testtools.css` 주석도 맞췄다.
- **Commit:** 09b2c20, 0cd659d

**3. [Rule 3 - 도우미] `startedGame(phase, guests = 5)` 손님 수 인자**
- 계획이 4명 방(DAO 시험 "4명 방 시작")을 요구하는데 기존 도우미가 6명 고정이라 기본값을 유지한 채 인자를 더했다. 기존 호출은 그대로다.
- **Commit:** ec7f1da

**4. [처리 메모] ee72660 시점 `tsconfig.worker.json` 타입 검사가 빨갛다**
- `trial.test.ts` 의 `PHASE_DEFS.discussion.next` 가 `PhaseId | null` 이라 인덱스 오류(TS2538)가 났고, 시험만 고친 `3695b03` 에서 통과한다. 최종 HEAD 는 `npm run typecheck` 통과.

**5. [처리 메모] 계획 순서 편차** — Task 1 은 찬반·토론 끝내기를 "규칙 함수 연결까지 껍데기"로 먼저 두었고(계획 지시), 본인에게만 view 를 보내는 안전한 기본값으로 만들었다. Task 2 가 방송 범위를 채웠다.

**Total deviations:** 3 auto-fixed(Rule 3) + 처리 메모 2. **Impact:** 범위 확장 없음. 누설 검사의 금지 키 이름은 유지하고 정확한 와이어 경로 하나만 예외로 열었다.

## Verification

- `npm run typecheck` 통과(앱·워커). `npx vitest run` 150 files / 4318 passed (1 skipped 는 이전부터 있던 것).
- 인수 기준: `case "point"`·`castPoint(`·`z.literal("point")`, `votedSeatsOf(`·`endCountOf(`·`phaseEndsAt: now`, `sendViewTo([playerId])` 3건(기준선 1 + 2), `"endDiscussion"`(bots.ts)·`case "verdict"`(room.ts)·`"봇 찬반"`(TestTools.tsx), 시험에 `.skip(`·`.todo(` 없음(rc 1), `test(08-07)` 커밋 4건 — 모두 통과.
- 위생: `git grep -nIiE "저장소 위생 패턴"` 이 이 계획이 건드린 파일에서 0건.

## Seed-pin changes (난수 호출 순서 변경)

- `discussion` 계획 고정값(시드 42, 봇 5, 시드 8 상태) `131523613` → `856098986`. `night` `997718148` 은 그대로.
- `discussion` 난수 호출 수 20 → 25(봇당 +1: 토론 끝내기 폭). `execVote` 8번은 그대로.

## Issues Encountered

- 전체 시험 한 번에서 `test/worker/bots.test.ts` "봇 chat: 밤에는 마피아 봇의 줄이…" 가 1회 실패했다. 이 계획의 봇 변경(Task 3) 이전, Task 2 GREEN 직후의 실행이었고 이후 단독 3회·전체 2회 통과했다. 시험이 마피아 봇을 `find` 로 고르는데 6명 판에서 두 번째 마피아가 사람 손님일 수 있어 생기는 이전부터의 확률적 불안정으로 보인다(조사하지 않음, 이 계획 범위 밖).
- 봇 토론 끝내기(30~60초)는 현재 토론 40초 안에서는 마감 − 500ms 에 잘려 일부만 남는다. 90초 토론(DAY-07, 08-11)에서 전부 남는다. 토론 중 `forceBotsDue` 를 부르는 기존 시험은 이론상 봇 셋이 모두 남을 때(약 3%) 단계가 먼저 넘어갈 수 있으나 채팅 단언에는 영향이 없다.

## Known Stubs

None. (Task 1 의 찬반·토론 끝내기 껍데기는 Task 2 GREEN 이 전부 채웠다.)

## Threat Flags

None. (T-08-02 찬반 값 변경은 본인에게만·남의 값 키 없음을 소켓 프레임 시험으로, T-08-03 처형 view 의 day.verdict 는 수만이고 day 에 역할 키 없음을 view 시험으로, T-08-07·T-08-08 개수만 공개·같은 값 무전송·지목 250ms 간격, T-08-24 strictObject 거부를 스키마·소켓 시험으로 고정했다.)

## Next Phase Readiness

- **08-11 (흐름 전환):** tick 표에 `enterDiscussion`·`resolveNomination`·`resolveVerdict` 를 걸면 `testTools.test.ts` "skipPhase: 지목·찬반에서 안 던진 봇이 먼저 던진다" 의 넘긴 뒤 `nominate`/`verdictVote` 단언은 마감 훅이 개인 키를 지우므로 그날 voteLog 줄(지목 votes·찬반 exec)로 옮겨야 한다. `trial.test.ts` 는 `PHASE_DEFS.discussion.next` 를 쓰므로 nomination 으로 좁힐 때 값만 바뀐다.
- **08-09:** 누설 스캔(`leak.test.ts`) 개편 때 이번에 연 `.view.day.verdict` 경로 예외를 구조에 맞게 정리한다. 클라이언트 (0,0) 목적지 차단(08-04 Threat Flag)도 같은 곳이다.
- **08-23:** E2E 도우미(`scripts/e2e/browser.mjs`)의 `press("봇 처형 투표")`·`press("봇 후보 선택")` 이 새 칩 그룹 이름("봇 찬반"·"봇 지목")에 맞게 고쳐져야 한다. `scripts/uat-test-bots.mjs` 라벨도 같다.
- **08-21:** 옛 `execVote`·`candidateVote` 메시지·봇 행동·계획 행을 지운다.

## Self-Check: PASSED

- FOUND: test/worker/trial.test.ts, shared/game/bots.ts(`"endDiscussion"`), worker/room.ts(`case "verdict"`, `applyVerdict`), shared/schemas.ts(`z.literal("point")`)
- FOUND commits: ec7f1da, aad798c, 0b550af, ee72660, 3695b03, 09b2c20, 0cd659d
- 커밋 수 측정: `git rev-list --count 49b3803..HEAD` = 7
