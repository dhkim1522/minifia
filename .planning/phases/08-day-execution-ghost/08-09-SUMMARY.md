---
phase: 08-day-execution-ghost
plan: "09"
subsystem: room-durable-object
tags: [tdd, durable-object, world-frames, ghost-leak, audience, snapshot, layout-sync, metamorphic]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-04 의 canMove, audience(world mover), worldVisibleTo, layoutFor·layoutKey, forceSegment, WorldState.lay, STAGE_SPOT. 08-07 의 toPhase·pointAs·verdictAs 도우미와 trial.test.ts
provides:
  - worker/room.ts applyMove 의 canMove 게이트(MAP-04)와 목적지 정확히 STAGE_SPOT 거절
  - worker/room.ts emitWorld(frame, moverId?) — audience(room, {k:"world", mover}) 한 길
  - worker/room.ts handleHello 의 viewer 별 snap(worldVisibleTo), snapNewGhosts·ghostSnapped(새 유령에게만 전원 snap)
  - worker/room.ts syncLayout(now) — 멱등 배치(planMoveSegment + forceSegment + emitWorld(mover) + world.lay 저장)
  - test/worker/ghostLeak.test.ts — 유령 위치·움직임·채팅·입력 중 메타모픽 누설 시험(7개)
  - 도우미 ghostsOf·worldFramesOf·layOf
affects: [08-10, 08-11 흐름 전환(syncLayout 이 실제 흐름에서 도는지 다시 확인), 08-13 이후 화면(world 프레임이 지도 단계에서 나감), 08-21 옛 단계 삭제, 09 밤 배치(A4)]

actuals:
  tokens: 9300
  tasks: 3
  commits: 6
plan_head_before: 2fc017d9e85381874bed2e142b634512769175a4
plan_head_after: 76eafbc083c258dfa6f5ce28ca18f45c58bca13f

tech-stack:
  added: []
  patterns:
    - "위치 프레임은 mover 기준 audience 한 길, 접속 snap 은 viewer 기준 worldVisibleTo 한 길 — 받을 권리 없는 폰에는 네트워크로도 가지 않는다"
    - "배치는 단계 전환 이벤트가 아니라 '지금 단계가 요구하는 모습'을 맞추는 멱등 동기화(layoutKey 가 world.lay.key 와 같으면 할 일 없음)"
    - "서버 주도 이동은 forceSegment 로 lastMoveAt 을 건드리지 않고, 그 사람이 움직인 것으로 emitWorld 한다"
    - "메타모픽 누설 시험: 같은 방 같은 산 사람 대본을 유령 정지/활동 두 구간으로 돌려 휘발 필드를 지운 프레임 열을 비교하고, 직접 불변식을 함께 둔다"

key-files:
  created:
    - test/worker/ghostLeak.test.ts
  modified:
    - worker/room.ts
    - test/worker/helpers.ts
    - test/worker/world.test.ts
    - test/worker/leak.test.ts
    - test/worker/trial.test.ts
    - test/worker/chatReplay.test.ts

key-decisions:
  - "snapNewGhosts 는 advance 뿐 아니라 handleTestSkip·applyEndDiscussion 의 tick 뒤에도 부른다 — 탈락이 일어날 수 있는 tick 경로가 셋이라 한 곳만 걸면 테스트 도구로 아침을 넘길 때 새 유령 snap 이 빠진다. 보낼 좌석은 worldVisibleTo 가 정하고 비어 있으면(ended 등) 보내지도 기록하지도 않는다"
  - "advance 는 상태가 안 바뀌어도 syncLayout 을 부른다(계획대로). 비용은 layoutKey 비교 한 번이라 ping 마다 돌아도 싸다 — 키가 같으면 layoutFor 도 부르지 않는다"
  - "목적지가 정확히 STAGE_SPOT(0,0)인 클라이언트 move 는 applyMove 가 조용히 버린다(08-04 Threat Flag). 비켜 보내지 않는다: 옆 점은 막힌 칸이라 snapToWalkable 이 칸 중심(25 의 홀수 배)으로 보내 (0,0)이 되지 않는다"
  - "syncLayout 은 markWorldDirty(2초 디바운스)로 저장한다. 퇴거로 마지막 2초가 사라져도 lay 가 남아 있으면 다시 맞추고, lay 도 없으면 처음부터 맞춘다(멱등이라 안전)"
  - "누설 검사 허용 목록(키·문자열 값)은 넓히지 않았다. 바뀐 것은 '게임 중 world 프레임 없음' 한 줄을 '산 사람 소켓의 world 프레임 좌석 ⊆ 그 시점 산 좌석'으로 바꾼 것뿐"

requirements-completed: [MAP-04, GHOST-01, GHOST-02, DAY-04, DAY-05]

coverage:
  - id: D1
    description: "MAP-04: 단계 × 신분 이동 표를 서버가 막는다. 산 사람은 nomination·defense·verdict·execution·night·morning·assigning·roleReveal 에서 move 가 조용히 버려지고(프레임·오류 0) 같은 단계 채팅은 전원에게 간다; dayAnnounce·discussion 은 전원에게 world.move"
    requirement: MAP-04
    verification:
      - kind: integration
        ref: "test/worker/world.test.ts describe '단계별 이동 — 산 사람은 막히고 유령은 걷는다' (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GHOST-01: 유령의 move 는 유령 소켓에만, 산 사람의 move 는 방 전원에게. 산 사람 소켓의 world 프레임에 유령 좌석 0건, typing·chat 에 유령 좌석·ghost 채널 0건"
    requirement: GHOST-01
    verification:
      - kind: integration
        ref: "test/worker/ghostLeak.test.ts 트레이서 2 + 메타모픽 2 (유령 정지/활동 두 구간 프레임 열 비교 + 직접 불변식). 뮤테이션 확인: emitWorld 를 방 전원 전송으로 바꾸면 ghostLeak 3개·world.test 6개가 실패"
        status: pass
    human_judgment: false
  - id: D3
    description: "T-08-11: hello 직후 snap 을 보는 사람별로 거른다 — 토론 중 산 사람 재접속 snap 에 유령 좌석 없음, 유령 재접속은 전원, roleReveal 은 전원, ended 는 snap 없음"
    requirement: GHOST-01
    verification:
      - kind: integration
        ref: "test/worker/ghostLeak.test.ts describe 'hello 직후 snap 은 보는 사람별로 거른다'; test/worker/chatReplay.test.ts '게임이 시작된 뒤 … [state, world.snap, chatLog]'"
        status: pass
    human_judgment: false
  - id: D4
    description: "탈락 순간: 아침에 탈락한 사람의 소켓에만 좌석 6개 snap, 나머지 다섯 소켓 world 프레임 0"
    requirement: GHOST-01
    verification:
      - kind: integration
        ref: "test/worker/ghostLeak.test.ts '밤에 마피아가 시민 V 를 지목해 아침이 오면 …'"
        status: pass
    human_judgment: false
  - id: D5
    description: "DAY-04·05: 지목 진입 후 아무 메시지에 산 사람이 둘레 자리(ringSlots)로 걷고 전원이 같은 걸음을 본다; 멱등; 변론자만 무대 [0,0]; 알람 따라잡기; 부결 복귀/통과 유지; lastMoveAt 불변; 저장값 lay"
    requirement: DAY-04
    verification:
      - kind: integration
        ref: "test/worker/trial.test.ts describe '모이기·무대 배치(결정 0060-7)' (7 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "무대 자리 (0,0) 입력 차단(08-04 Threat Flag)"
    requirement: MAP-04
    verification:
      - kind: integration
        ref: "test/worker/world.test.ts '로비에서 목적지가 정확히 무대 자리(0,0)인 move 는 조용히 버려지고, 옆 점은 받아들여진다'"
        status: pass
    human_judgment: false
  - id: D7
    description: "전체: 타입 검사와 vitest 전체 (152 파일 4453 통과, 1 skipped 는 이전부터), chatStaticGuard 정적 가드 그대로 통과"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run"
        status: pass
    human_judgment: false
  - id: D8
    description: "실제 낮 흐름(08-11 이후)에서 지목 모이기·변론 무대가 도는지, 걷는 모습의 체감"
    verification: []
    human_judgment: true
    rationale: "흐름 전환(08-11) 전이라 시험은 저장 상태 편집(toPhase)과 마감 당기기로 단계에 들어갔다(가정 A3). 08-11 이 실제 흐름에서 다시 확인하고 체감은 개발 뒤 실기기에서 본다"

duration: 13min
completed: 2026-11-02
---

# Phase 8 Plan 9: 위치 전송을 로비 밖으로 — 단계별 이동·유령 위치·viewer 별 snap·모이기 배치 Summary

**방 DO 가 `canMove` 로 단계 × 신분 이동을 막고, 위치 프레임은 움직인 사람(mover)·접속 snap 은 보는 사람(viewer) 기준 audience 한 길로만 보내며(유령 위치는 유령 폰에만), 새 유령에게만 전원 snap 을 주고, `syncLayout` 이 지목 둘레 자리·변론 무대·부결 복귀를 멱등하게 걷게 한다 — 메타모픽 두 구간 비교로 유령 행동이 산 사람 프레임에 흔적을 남기지 않음을 증명했다.**

## Accomplishments

- **Task 1 (트레이서, GHOST-01·MAP-04)** — `applyMove` 가 `canMove(room, me)` 가 거짓이면 조용히 버린다(오류·state·world 프레임 없음). `emitWorld(frame, moverId?)` 가 `audience(room, {k:"world", mover})` 로만 deliver: 산 사람의 이동은 방 전원에게, 유령의 이동은 유령 소켓에만. 로비 호출부(join 입장·testReset snap·testBots)는 mover 없이 부른다(로비는 전원). 봇 배회 조건은 로비 전용 그대로.
- **Task 2 (GHOST-01, T-08-11)** — `handleHello` 의 snap 을 `worldVisibleTo(room, player.id)` 로 거른 좌석만 담는다(로비·assigning·roleReveal·지도 단계, 보낼 좌석이 없는 ended 등은 snap 없음). `ghostSnapped`(DO 메모리 집합) + `snapNewGhosts`: 처형·아침으로 막 탈락한 사람의 소켓에만 전원 snap. `applyMove` 가 목적지가 정확히 STAGE_SPOT(0,0)이면 버린다. 시험: 단계별 이동 표, 접속 snap 4가지, 탈락 순간, 메타모픽 두 구간, 누설 스캔의 world 규칙 개편.
- **Task 3 (DAY-04·05)** — `syncLayout(now)`: `layoutKey` 가 `world.lay.key` 와 같으면 즉시 return(멱등), 다르면 `layoutFor` 의 이동마다 `planMoveSegment` → `forceSegment` → `emitWorld(moveFrame, 그 사람)` 후 `world.lay` 저장·`markWorldDirty`. advance(상태 변화 여부와 무관)·handleTestSkip·applyEndDiscussion 뒤에 부른다.

## TDD Gate Compliance

세 작업 모두 RED(`test(08-09)`) → GREEN(`feat(08-09)`) 순서다. REFACTOR 커밋은 없다.

| 작업 | RED 커밋 | RED 증거(`gsd_run check tdd-red-evidence` = RED_EVIDENCE_OK) | GREEN 커밋 |
| --- | --- | --- | --- |
| 1 유령 한 걸음 | `07be577` | ghostLeak.test.ts "유령 X 의 move 는 …" 가 `''`(기대 `move:0`)로 실패 — 옛 로비 전용 게이트가 모든 이동을 버렸다 | `2a5744a` |
| 2 viewer 별 snap·새 유령 snap | `d1c1c39` | ghostLeak.test.ts "토론 중 산 사람이 재접속하면 …" 가 `none`(기대 `2,3,4`)로 실패 | `b324529` |
| 3 syncLayout | `e862ca6` | trial.test.ts "지목이 끝나 변론이 되면 변론자만 무대 …" 가 `''`(기대 `3:0,0`)로 실패 | `76eafbc` |

semanticAssessment: 세 RED 모두 계획한 단언(받아야 할 프레임이 없음·snap 이 없음·배치 이동이 없음)에서 실패했고 불러오기·픽스처 오류가 아니다. 다만 Task 2 RED 커밋의 단계별 이동 표 시험과 메타모픽 두 개, Task 3 의 멱등 시험은 Task 1 GREEN 이후라 RED 에서 이미 통과했다(회귀 고정용). 이것이 허공을 치는 시험이 아님은 뮤테이션으로 확인했다 — `emitWorld` 를 방 전원 전송으로 바꾸면 ghostLeak 3개·world.test 6개가 실패하고 되돌리면 통과한다.

트레이서 게이트: `AUTO_CFG` 꺼짐, `human_verify_mode` end-of-phase, `<verify>` 가 automated 뿐이라 Task 1 의 `<verify>` 를 다시 돌려 통과를 확인했고(`⚡ Tracer verified end-to-end — expanding`) 확장 작업으로 넘어갔다.

## Task Commits

1. Task 1 RED `07be577` → GREEN `2a5744a`
2. Task 2 RED `d1c1c39` → GREEN `b324529`
3. Task 3 RED `e862ca6` → GREEN `76eafbc`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 옛 규칙을 단언하던 시험 갱신 3곳**
- **Found during:** Task 2 GREEN(전체 시험 1건 실패), Task 3 GREEN(08-07 시험 6건 실패), Task 2 GREEN(world 시험 1건)
- **Issue:** (a) `chatReplay.test.ts` "게임 중에 다시 hello 하면 [state, chatLog] 이고 world snap 은 없다" 는 계획이 바꾸는 규칙(역할 확인 중에도 snap)과 정면으로 충돌한다. (b) `world.test.ts` "걸을 수 없는 무대 중심을 누르면 보정된다" 는 (0,0) 목적지를 쓴다 — 계획이 (0,0) 입력을 버리라 했다. (c) 08-07 의 `trial.test.ts` 가 `toPhase` 로 지목·찬반에 들어간 뒤 첫 메시지(지목·찬반)의 관찰 구간에 이제 서버가 보내는 배치 world 프레임이 끼어 "한 프레임" 단언이 어긋났다.
- **Fix:** (a) 기대를 `state,world.snap,chatLog` 로. (b) 막힌 이웃 점 (10,0) 으로 옮기고 정확히 (0,0) 은 새 시험이 버림을 단언(08-04 가 같은 방식으로 한 선례). (c) `nominationRoom`·`verdictRoom` 과 한 시험이 단계 진입 뒤 모든 소켓을 flush(`settleAllSocks`)해 배치 프레임을 관찰 구간 앞에 놓았다. 단언의 강도는 그대로다.
- **Files modified:** test/worker/chatReplay.test.ts, test/worker/world.test.ts, test/worker/trial.test.ts
- **Commit:** b324529(a·b), 76eafbc(c)

**2. [Rule 2 - Missing critical] 클라이언트 (0,0) 목적지 차단 (08-04 Threat Flag, carry-forward)**
- **Issue:** 무대 단일 예외가 공용 `lineWalkable`/`routeFx` 에 있어 클라이언트가 정확히 (0,0) 을 보내면 `requestMove` 가 받아들였다.
- **Fix:** `applyMove` 가 목적지가 `STAGE_SPOT` 이면 조용히 버린다(비켜 보내지 않음 — 옆 점은 snapToWalkable 이 칸 중심으로 보정해 무대 자리가 되지 않는다). 시험 추가.
- **Commit:** b324529

**3. [Rule 3 - 범위 보강] 새 유령 snap 을 testSkip·토론 끝내기 경로에도 건다**
- 계획은 advance 끝만 말했지만 `tick` 은 handleTestSkip·applyEndDiscussion 에서도 직접 불리고 탈락(아침 진입)이 거기서도 일어날 수 있다. 세 곳에 같은 `snapNewGhosts` 를 걸었다. `syncLayout` 은 계획대로 이 세 곳이다.
- **Commit:** b324529, 76eafbc

**4. [처리 메모] 계획 문구와 다른 시험 진입법**
- 계획의 "nomination 마감(forceDue, 4:1 지목) → defense" 는 08-11 전이라 지목 해소 훅이 없어(nomination 의 next 가 단순 defense) 저장 상태에 `verdict.candidate` 를 넣고(toPhase patch) 마감을 당겨 들어갔다(가정 A3). 알람 따라잡기 시험은 마감을 5초 전으로 둔다 — tick 이 이전 마감 + 다음 단계 길이로 연쇄하므로 20초 전이면 변론(10초)·처형(5초)까지 지나쳐 night 에 닿는다.
- 변론 시험은 `toPhase` 가 DO 를 퇴거시키므로 그 앞에서 `flushWorld` 로 디바운스 중인 위치·lay 를 저장했다(퇴거로 잃는 마지막 2초는 설계된 허용 손실).

**Total deviations:** 3 auto-fixed(Rule 3 둘·Rule 2 하나) + 처리 메모 1. **Impact:** 범위 확장 없음. 누설 검사의 허용 키·문자열 목록은 넓히지 않았다.

## 08-07 이월 항목

- `.view.day.verdict` 예외 경로 정리(누설 스캔 구조 개편)는 이 계획 범위 밖(world 규칙 변경만 요구)이라 하지 않았다. `leak.test.ts` 의 서버 전용 키 `verdict` 금지와 정확한 경로 예외는 그대로 둔다.

## Verification

- `npm run typecheck` 통과(앱·워커). `npx vitest run` 152 files / 4453 passed (1 skipped 는 이전부터 있던 것). `test/unit/chatStaticGuard.test.ts` 그대로 통과(무차별 방송 이름 0건).
- 인수 기준: `canMove(room`·`k: "world", mover` 존재; `room.phase !== "lobby") return;` 줄 0건(rc 1); `test(08-09)` 커밋 3건; `worldVisibleTo(`·`ghostSnapped` 존재; `FORBIDDEN_KEYS`·`ROLE_WORDS` 존재; ghostLeak.test.ts `it(` 7개; `private syncLayout(`·`forceSegment(`·`layoutFor(` 존재; `this.syncLayout(` 3건; 시험에 `.skip(`·`.todo(` 없음(rc 1) — 모두 통과.
- 위생: 저장소 위생 규칙의 금지 표현 검사(저장소 위생 검사)가 이 계획이 건드린 파일에서 0건.

## Known Stubs

None.

## Threat Flags

None. (T-08-01 mover/viewer 한 길 + 메타모픽·직접 불변식, T-08-05 canMove 단계표 시험, T-08-06 채널·위치 범위가 서버 상태로만 정해짐, T-08-11 snap viewer 별 시험으로 고정했다. 08-04 의 client-reachable-stage-spot 플래그는 이 계획에서 닫았다.)

## Next Phase Readiness

- **08-11 (흐름 전환):** 지목·변론 단계에 실제 흐름으로 들어가면 `syncLayout` 이 advance 끝에서 같은 방식으로 돈다. `trial.test.ts` 의 `toPhase` 진입 시험과 `nomination.next` 가 바뀌면 "모이기·무대 배치" 시험의 마감 당기기 부분을 실제 훅 결과(후보 확정)로 맞춘다.
- **화면 계획(08-13 이후):** 클라이언트는 이제 지도 단계에서도 world.move·snap 을 받는다(산 사람 + 서버 배치 이동, 유령은 유령에게만). 유령 시점 snap 은 탈락 직후 state 다음에 온다.
- **9페이즈:** 밤에는 `layoutKey` 가 null 이라 배치를 바꾸지 않는다(가정 A4).

## Self-Check: PASSED

- FOUND: test/worker/ghostLeak.test.ts, worker/room.ts(`private syncLayout(`, `ghostSnapped`, `worldVisibleTo(`), test/worker/trial.test.ts
- FOUND commits: 07be577, 2a5744a, d1c1c39, b324529, e862ca6, 76eafbc
- 커밋 수 측정: `git rev-list --count 2fc017d..76eafbc` = 6
