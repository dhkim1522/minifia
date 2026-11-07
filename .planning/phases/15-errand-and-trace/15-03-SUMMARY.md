---
phase: 15-errand-and-trace
plan: "03"
subsystem: server-night-unify-and-morning-trace
tags: [night, pick, trace, morning, minifia-v3, d-05, d-06, d-08, leak-safe]
status: complete

requires:
  - phase: 15-02
    provides: "errand 근처 snap·표본·me.record, audience/worldVisibleTo 의 errand 규칙"
provides:
  - "pickTarget: 역할을 읽지 않는 통일된 밤 고르기 — 산 사람 누구나 같은 메시지·같은 규칙·같은 응답(자기 포함), 거절은 단계·행위자·대상 세 가지뿐"
  - "shared/game/trace.ts: TRACE_OF_OUTFIT(의상→조각 id, 9개 서로 다름)·traceCandidates(밤 시작 때 피해자를 고른 산 사람, 본인 제외, seat 오름차순)·pickTracePiece(randInt 한 번)"
  - "protocol: TRACE_PIECE_IDS·TracePiece·MorningView.trace(탈락자가 있는 아침에만)"
  - "enterMorning(state, randInt?): 탈락자가 있을 때만 흔적을 정해 morning.trace 에 싣는다(구출·무효 밤은 키 없음, randInt 없으면 첫 후보)"
  - "morningMsOf +MORNING_TRACE_MS(3초, 상한 15초 안), buildDay 가 trace 를 필드별 복사"
  - "밤 world: canMoveIn 밤 산 사람 false(역할 무관), audience 밤 산 mover → 빈 집합, worldVisibleTo 밤 산 viewer → 본인 한 칸. 마피아 접근 걷기(BotAct approach·BOT_APPROACH_AFTER_MS·worker actAsBot 케이스) 삭제"
  - "봇: 시민 봇도 밤에 자기를 뺀 산 사람 한 명을 고른다(botNightTarget), botsPickNow 가 따라온다"
affects: [15-06, 15-07, 15-08, 15-09, 15-10]

requirements-completed: [TRACE-01, TRACE-02, TRACE-03]

actuals:
  tokens: 18000
  tasks: 2
  commits: 4

# commits 는 측정값: git log --grep='(15-03)' — 같은 시간대에 15-05 실행기가 같은 가지에 다른 커밋을 올려 rev-list 전체 개수와 다르다.
# plan_head_before 는 Task 1 구현이 끝난 뒤 첫 커밋 직전 HEAD(그 전에 15-03 커밋은 없다).
plan_head_before: 891454515e617fb0dfa7f09eeee49d2b2ca5b568
plan_head_after: f427774338c5dc602e09d8551c26723ef0c555f7

tech-stack:
  added: []
  patterns:
    - "입력 문은 넓히고 판정은 그대로: pickTarget 은 저장만 하고(역할 미참조) 효과는 resolveNight·confirmedTarget 이 역할로 가른다 — 응답으로 역할이 갈라지지 않는다"
    - "흔적은 의상의 함수: 풀(누가 피해자를 골랐나)은 enterMorning 안에서 nightPick 을 지우기 전 상태로 만들고 조각 id 하나만 morning 에 남긴다 — 풀·좌석·look 은 어디에도 싣지 않는다"
    - "tick 진입 훅에 난수를 넘기는 기존 경로 재사용: enterMorning(state, randInt) 가 ON_ENTER 표 그대로 걸린다"

key-files:
  created:
    - shared/game/trace.ts
    - test/unit/trace.test.ts
    - test/worker/trace.test.ts
  modified:
    - shared/protocol.ts
    - shared/game/night.ts
    - shared/game/discussion.ts
    - shared/game/view.ts
    - shared/game/audience.ts
    - shared/game/movement.ts
    - shared/game/bots.ts
    - shared/game/testTools.ts
    - worker/room.ts
    - test/unit/night.test.ts
    - test/unit/audience.test.ts
    - test/unit/movement.test.ts
    - test/unit/bots.test.ts
    - test/unit/view.test.ts
    - test/unit/tick.test.ts
    - test/unit/testTools.test.ts
    - test/unit/dayStaticGuard.test.ts
    - test/unit/emotePhases.test.ts
    - test/unit/nyquist-03-night-chain.test.ts
    - test/worker/night.test.ts
    - test/worker/nightLeak.test.ts
    - test/worker/bots.test.ts
    - test/worker/leak.test.ts
    - test/worker/world.test.ts
    - test/client/nightMap.test.tsx

key-decisions:
  - "UI-SPEC U-11 의 '자기를 뺀 산 사람' 을 '자기 포함 산 사람 전원' 으로 고친다 — 의사 자기 보호가 서버 규칙이라 의사만 자기 칸을 가지면 칸 수가 역할마다 갈라진다. 의사 규칙은 바꾸지 않는다(결정 0074 에 적을 것)"
  - "canMoveIn 의 세 번째 인자(isMafia)는 받되 무시하는 선택 인자로 남긴다(`_isMafia`) — GameMap 호출은 15-08 이 바꾼 뒤 지운다. world.ts 의 approachPoint·APPROACH_DIST_FX 도 클라이언트 사용처가 사라지는 15-08 이 지운다"
  - "마피아 밤 채팅 서버 채널(channelOf)·집계(me.nightTally·nightSure·allyPicks)·쪽지·spectate.picks 는 그대로 — 동료를 고른 값도 nightPick 에 저장되지만 집계는 마피아를 세지 않고 confirmedTarget 이 걸러낸다"
  - "pickRecipientIds 는 그대로: 마피아의 pick 은 산 마피아 전원에게 state 가 가고(동료 집계 갱신) 비마피아의 pick 은 본인+유령뿐이다 — '같은 응답' 은 보낸 소켓이 받는 프레임 열이 같다는 뜻이다"
  - "tick 을 난수 없이 부르면 탈락자가 있는 밤→아침 전환이 NO_RANDOM 으로 던진다 — 흔적을 정하는 난수 한 번 때문이고 서버는 항상 cryptoRandInt 를 넘긴다"

metrics:
  duration: 약 1시간 10분
  completed: 2026-11-07
---

# Phase 15 Plan 03: 밤 고르기 통일 · 밤 world · 아침 흔적 Summary

**밤에 산 사람 모두(마피아·경찰·의사·시민)가 같은 `{t:'pick', target}` 으로 자기 포함 산 사람 한 명을 고르고 서버가 역할을 보지 않은 채 같은 응답을 주며, 밤에는 아무도 걷지 않고 위치 전송도 본인 한 칸뿐이다. 피해자가 나온 아침에는 서버가 그 밤 피해자를 고른 사람 중 한 명의 의상에서 조각 id 하나를 정해 모든 view(유령 포함)에 같은 값으로 싣는다(아침 +3초).**

## 한 일

- **Task 1 (순수 규칙)**
  - `pickTarget` 에서 역할 분기 둘(마피아·경찰·의사 외 거절, 마피아가 마피아를 고르면 거절)을 지웠다. 검사 순서: 단계 → 행위자 → 대상(정수·앉은 산 사람) → 같은 값 → 저장.
  - `trace.ts`·`TRACE_PIECE_IDS`·`MorningView.trace`, `enterMorning(state, randInt = () => 0)` 가 탈락자가 있을 때만 `pickTracePiece` 를 불러 `morning = { eliminated, trace }` 를 만든다. `morningMsOf` 에 `MORNING_TRACE_MS`(최대 5+2+2+2+3 = 14초), `buildDay` 필드별 복사.
  - 밤 world: `canMoveIn` 밤 산 사람 false, `audience(world)` 밤 산 mover → 빈 집합, `worldVisibleTo` 밤 산 viewer → 본인. 마피아 접근 걷기 삭제(`BotAct.approach`·`BOT_APPROACH_AFTER_MS`·worker `actAsBot` 케이스와 `approachPoint`·`APPROACH_DIST_FX` import).
  - 봇: `botNightTarget` 이 시민에도 자기를 뺀 산 사람을 돌려준다. `planFor` 밤 분기는 산 봇 모두 pick 한 번. 난수 순서(파일 머리 주석 갱신): 마피아 = pick 지연 → randInt(10) → …, 마피아 아닌 봇 = randInt(후보 수) → pick 지연. `botsPickNow` 는 코드 변경 없이 시민 봇을 채운다.
- **Task 2 (워커 통합)** — 워커 코드 변경은 approach 케이스 정리뿐이라 구현 커밋(`feat`)에 들어갔고, 이 태스크는 시험으로 닫았다: `test/worker/trace.test.ts` 13건.

## 시험 결과

- 단위(Task 1 verify 묶음 9파일): 606 통과. 전체 단위 4202 통과·0 실패.
- 워커(Task 2 verify 묶음 7파일): 100 통과(8 skip, 기존). 전체 워커 522 통과, 실패 2건은 아래 "알려진 기존 실패·불안정"(15-03 변경과 무관, 두 번째 실행에서는 시간 민감 시험이 번갈아 한 건씩 실패).
- 클라이언트 전체 2538 통과(`nightMap.test.tsx` 한 건을 새 계약으로 고친 뒤).
- `npm run typecheck` 종료 코드 0.
- 인수 기준: `trace.ts` 존재, `TRACE_PIECE_IDS` in protocol.ts 2, bots.ts `approach`(대소문자 무시) 0, room.ts `approach` 0, trace.ts 주석 뺀 `.role` 0, pickTarget 본문 `role` 0(주석 뺀 본문).
- 판정 불변: `resolveNight`·`confirmedTarget` 본문은 수정하지 않았다(diff 는 `pickTarget`·`enterMorning`·머리 주석뿐). 단위 시험 "시민의 선택을 넣고 뺀 resolveNight 가 같다" 가 고정.
- 위생: 위생 검사로 새 적중 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] worker/room.ts 의 approach 정리를 Task 1 구현 커밋에 포함**
- `BotAct` 에서 `approach` 를 지우면 `actAsBot` 의 `never` 전수 검사가 컴파일을 깨므로 같은 커밋에 넣었다(계획은 Task 2). Task 2 의 `feat` 커밋은 따로 없다.

**2. [Rule 3 - Blocking] 계획 파일 목록 밖의 시험 갱신**
- `test/unit/tick.test.ts`·`testTools.test.ts`·`dayStaticGuard.test.ts`·`emotePhases.test.ts`·`nyquist-03-night-chain.test.ts`, `test/worker/world.test.ts`, `test/client/nightMap.test.tsx` — 새 계약(trace 키·밤 world·시민 봇 pick·밤 걷기 없음)에 맞춰 고쳤다. 기대를 느슨하게 하지 않았다: 옛 "마피아만 걷는다/전원 snap" 단언은 "아무도 걷지 않는다/본인 한 칸" 단언으로 바꾸고, `eliminated` 단독 키 단언은 `eliminated,trace` 로 바꿨다.

**3. [Rule 1 - 시험 값] 시드 고정 값 재고정**
- `bots.test.ts` night 계획 고정값 `554531902` → `553784266`: 시민 봇이 밤에 `randInt(후보 수) → randInt(pick 지연)` 을 부르고 접근 걷기(난수 없음)가 사라졌다. 이유를 시험 주석·제목에 적었다. discussion 값 `34804349` 는 그대로(난수 순서 불변 증명).

### 계획 대비 메모

- RED 를 눈으로 확인하는 단계는 15-01·15-02 선례를 따라 구현 초안을 먼저 만들고 옛 시험의 실패(26건)를 확인한 뒤 시험 커밋 → 구현 커밋 순으로 나눠 커밋했다(시험 커밋 시점에는 구현이 커밋되지 않은 상태라 그 커밋만으로는 실패한다). 새 시험(trace.test.ts)은 구현 뒤에 썼다.
- 계획의 `<behavior>` 중 "봇 방: 봇만의 밤을 skip 하면 시민 봇의 nightPick 도 채워진다"는 `testTools.test.ts`(skipPhase 난수 순서 `5,5,6`)와 `test/worker/bots.test.ts`(모든 봇의 `nightPick` 이 number, 마피아 봇 위치 불변)로 닫았다.

## 알려진 기존 실패·불안정 (15-03 무관)

- `test/worker/continuity.test.ts` "옛 방장이 같은 토큰으로 돌아오면…" — 15-02 에서 이미 `deferred-items.md` 에 적은 5초 시간 초과.
- `test/worker/errand.test.ts` "거절 이유가 여섯 가지여도, 마피아든 시민이든 응답은 같다" — 병렬 전체 실행·다른 실행기와 부하가 겹칠 때 한 번씩 실패(set 크기 2)하고, 단독 연속 실행(5회)·15-03 이전 커밋의 임시 워크트리(2회)에서는 통과한다. 15-02 이월 메모의 "알람 빈도가 시간 민감 시험에 영향" 가능성과 같은 종류다. 15-06 전체 회귀에서 다시 볼 것.

- `test/worker/bots.test.ts` "봇 chat: 밤에는 마피아 봇의 줄이…" — 전체 병렬 실행에서 한 번 실패, 단독 실행 연속 2회 통과(15-02 가 적은 봇 시험의 부하 민감성과 같은 종류. 이 시험은 밤 chat 이라 15-03 의 pick 계획 변경과 무관해 보이나 15-06 회귀에서 한 번 더 볼 것).

## 이월 메모 (다음 계획용)

- **15-07 (흔적 카드·클라이언트)**: `view.day.morning.trace` 는 `TRACE_PIECE_IDS`(button·pin·whiteCloth·blackCloth·brownCloth·pencil·grayThread·navyThread·redCloth) 중 하나이고 탈락자가 있는 아침에만 있다(구출·무효 아침은 키 없음). 서버는 id 만 보낸다 — 이름·아이콘은 15-07 표(UI-SPEC "흔적 조각 이름 초안"). 아침이 흔적이 있으면 `phaseDurationMs` 가 +3000(`MORNING_TRACE_MS`)이다. 카드는 "확정 증거 아님" 고정 문구를 쓴다(T-15-12).
- **15-08 (밤 화면)**: 밤 후보 목록은 "나를 포함한 산 사람 전원"이다(U-11 개정). `GameMap.tsx:331` 의 `canMoveIn(view.phase, meAlive, view.me.role === "mafia")` 세 번째 인자를 지우고 `canMoveIn` 의 `_isMafia` 인자도 지운다. `world.ts` 의 `approachPoint`·`APPROACH_DIST_FX` 와 그 시험은 클라이언트 사용처가 없으니 15-08 이 지운다(지금은 worker 사용도 없다). 밤에는 산 마피아에게도 `world` 프레임이 가지 않으니(본인 snap 하나만) 마피아 걷기·다른 마피아 위치 표시 코드가 있으면 지운다. `test/client/nightMap.test.tsx` 의 "마피아 밤 선택 효과"(09.1-q2) 블록은 동료를 후보에서 빼고 있다 — 서버는 이제 동료·자기 고르기를 효과 없이 받는다.
- **15-09 (E2E)**: `scripts/e2e/politics.mjs`·`sound.mjs` 에 밤 걷기·접근(approach)·"시민 pick 거절" 가정이 남아 있을 수 있다 — 15-03 은 e2e 스크립트 본문을 건드리지 않았다. 아침이 흔적 3초만큼 길어졌다(대기 시간).
- **15-06 (누설 검사·smoke)**: 새 누설 표면 점검 대상 — ① `morning.trace`(조각 id 하나, 풀·좌석·look 없음) ② 밤 pick 응답(역할 무관) ③ 밤 snap(산 사람 모두 본인 한 칸). 워커 누설 시험(`leak.test.ts`·`nightLeak.test.ts`)은 이미 새 모양을 단언한다.
- **15-10 (결정 0074)**: U-11 개정(나 포함 전원, 의사 규칙 불변), 거절은 단계·행위자·대상 세 가지뿐, 마피아 접근 걷기·밤 마피아 world 삭제, 흔적 풀 = 피해자를 고른 산 사람(본인 제외) 중 난수 한 명·조각 표(의상 9 → 조각 9), 아침 +3초(최대 14초), 흔적은 확정 증거 아님(T-15-13 accept), `tick` 은 탈락 아침에 난수가 필요하다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 표면은 없다(기존 `pick` 메시지의 검사만 줄고 `morning.trace` 필드 하나가 더해졌다). T-15-10(pickTarget 응답: 역할 분기 삭제 grep 기준·네 역할 같은 응답 단위/워커 시험), T-15-11(밤 world: 마피아 포함 본인 한 칸·move 에 world 프레임 0 시험), T-15-12(trace 키 구조·필드별 복사 시험), T-15-14(판정 불변 시험)를 시험이 고정한다. T-15-13 은 accept(계획대로).

## Self-Check: PASSED

- 파일: shared/game/trace.ts, test/unit/trace.test.ts, test/worker/trace.test.ts FOUND
- 커밋: 9c93b6d1, 36443193, 99346375, f4277743 FOUND
