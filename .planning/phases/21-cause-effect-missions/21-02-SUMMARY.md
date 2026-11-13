---
phase: 21-cause-effect-missions
plan: "02"
subsystem: test-regression
tags: [tests, phase-flow, helpers, regression]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-01 의 확장판 하루 순서(roleReveal → errand → night → (morning) → discussion …)
provides:
  - 확장판 하루 순서 위에서 npm test 전체 초록(실패 0)
  - 판 종류를 아는 시험 도우미(startedGame 의 mode 인자, pickBasic, lobbyOf·startedAt·stateWithVerdict 의 판 종류 인자)
affects: [21-03, 21-04, 21-06, 21-08, 21-09]
requirements-completed: [D-01, D-17, D-18, D-29]
actuals:
  tokens: 63300
  tasks: 2
  commits: 2
plan_head_before: 7b061da231c8625c2820ab8c097f486fb4dc42b8
plan_head_after: 87ec82075b13c98f227e81fad75f8b2cfee440e1
commits: 2
tech-stack:
  added: []
  patterns:
    - "시험은 단계를 가진 판 종류로 연다: 낮 시작 발표·늘 있는 아침은 mode basic, 저녁·밤·현장 아침은 확장판"
    - "도우미 루프에는 반복 상한을 둔다 — 닿지 못하는 단계는 무한 루프가 아니라 실패로 끝난다"
key-files:
  created:
    - .planning/phases/21-cause-effect-missions/deferred-items.md
  modified:
    - test/helpers/voteState.ts
    - test/helpers/awardsState.ts
    - test/worker/helpers.ts
    - "test/unit/*.test.ts (26개)"
    - "test/worker/*.test.ts (33개)"
key-decisions:
  - "고친 시험은 갈래 가(확장판의 새 순서)·나(기본 마피아로 열기)·다(배치 반영)로 나눠 기대 값을 그대로 지켰다 — 삭제·skip·단언 약화 0"
  - "제품 코드는 고치지 않았다 — 시험이 드러낸 21-01 의 빈틈(밤 진입이 저녁 목록·목격 줄을 지움)은 21-04 의 몫이라 시험 쪽에서 옮겨 심어 보았다"
metrics:
  duration: 약 3시간(전체 시험 실행·멈춤 진단·간헐 실패 가르기 포함)
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 02: 순서 변경으로 깨진 기존 시험 회귀 정리 Summary

**21-01 이 바꾼 확장판 하루 순서(저녁 → 밤 → 아침 → 토론) 위에서 단위 177개·워커 313개의 깨진 시험을 갈래 가·나·다로 고쳐 `npm test` 전체를 초록(8614 통과·262 건너뜀·실패 0)으로 되돌렸다. 시험은 지우거나 건너뛰지 않았고 단언은 느슨하게 하지 않았다.**

## 한 일

### 가장 먼저: 무한 루프 도우미
`testTools`·`bots`·`night` 단위 시험의 `while (state.phase !== …)` 도우미가 확장판에 없는 단계(`dayAnnounce`·`morning`)를 기다려 영원히 돌았다. 세 파일의 모든 단계 걷기 루프에 반복 상한(80)을 두어 닿지 못하면 한 줄 오류로 끝나게 했다. 그 뒤 판 종류를 가진 도우미로 바꿨다.

### Task 1 — 단위 시험(`fb37376b`)
- `test/helpers/voteState.ts`: `lobbyOf(n, mode?)`·`startedAt(n, seed, phase, mode?)`·`stateWithVerdict(…, { mode })` — mode 를 주면 방에 판 종류가 박힌다. `threeAliveAt` 은 낮 시작 발표가 필요해 basic 이다. `awardsState.ts` 의 `EndedSpec.mode` 도 같다.
- 파일마다 지역 `lobbyOf`(view·testTools·bots·night·audience·gather·nyquist-03·03.1)에도 같은 인자를 더했다.

### Task 2 — 워커 도우미와 시험(`87ec8207`)
- `startedGame(phase, guests = 5, opts: { mode? } = {})`: 시작 전 `mode: "basic"` 이면 방장이 `modePick` 을 보내고, 시작 뒤 `advanceTo(roleReveal)` → 역할 읽기 → `advanceTo(목표)`. 확장판에서 `dayAnnounce` 를 목표로 받으면 "확장판에는 낮 시작 발표가 없다" 한 줄 오류. **계획에 더해 `morning` 도 같은 오류다**(확장판의 아침은 밤 선택이 있을 때만 와서 도우미가 기다리면 40번 돌고 실패한다).
- 새 도우미: `pickBasic(seated)`(직접 start 를 보내는 시험이 시작 앞에 부른다), `eveningRowsOf`·`regraftEvening`(아래 "21-04 에 넘기는 것"), `endedGame4(mode = "basic")`, `richEndedGame6`(basic), `threeAliveGame`(basic).
- `skipOnce`·`skipThrough`·`advanceTo`·`driveToEnded`·`townGame`·`toEndedByMafia` 는 저장된 단계를 보며 돌기 때문에 시그니처를 바꾸지 않고 확장판 순서를 그대로 걷는다.

## 고친 시험 표 (갈래 가·나·다)

갈래: **가** = 확장판의 새 순서를 가르치는 시험이라 새 순서로 기대를 고침 · **나** = 판 종류와 무관한 낮·밤 규칙이라 `mode: "basic"` 으로 열고 기대 값은 그대로 · **다** = 위치·길이·키 배치를 새 배치로 반영.

### 단위 시험 (처음 실패 177개 + 파일 로드 실패 2개)

| 파일 | 시험(대표) | 갈래 | 한 줄 이유 |
|---|---|---|---|
| errand.test (26) | enterErrand·errandLast·actErrand·가짜 장소·view·단계 표·tick 연쇄 | 가 | 저녁은 역할 확인 다음이다 — `barRoom` 이 roleReveal 에서 한 번 tick; 표(`errand.next = night`)·tick 시험은 새 순서로 |
| errandFake (4) · errandView (1) · errandNear · errandZone (파일 로드) | 가짜 장소·화면 거울·구간 자르기·구역 | 가 | `startedAt(…, "dayAnnounce")` 를 `"roleReveal"` 로(맵 고정 뒤 한 번 tick 하면 저녁) |
| gameMode (5) | nextPhaseOf·tick·hooksOf 동률 | 가 | 확장판 갈래 넷(roleReveal·execution→errand, morning·dayAnnounce→discussion)과 동률 날 다음 단계(errand) |
| movement (3) | canMove 표·canMoveIn 인자 수 | 가·나 | 기본 표는 basic, 확장판 아침 걷기·`canMoveIn.length 3` 은 확장판 새 시험 |
| trace (1) · viewRoles15 (1) · gather (2) | 아침 다음 단계 · 토론 record · layoutKey | 가·다·나 | 아침 다음이 곧 토론 / 토론 상태에 저녁 목록을 옮겨 심음 / 토론 키는 확장판 `N:talk`, 기본 마피아는 null(새 it 으로 둘 다) |
| awards (3) · audience (1) | 단계 목록·동점 정렬·읽기 키 | 가·나·다 | 두 판 종류를 모두 돌림, 같은 일차 탈락 순서는 확장판이 반대(새 it), 읽기 허용 경로에 공개 값 `mode` 를 더함 |
| discussion (1) · gameRoom (2) · tick (17) | 아침 길이·옛 방 정규화·시간 연쇄 | 나(+가) | 아침 가산·낮 시작→토론 길이는 basic, 확장판 아침 30초·저녁→밤은 새 it; `morningMsOf` 의 흔적 가산은 상태로 직접 보는 새 it |
| endgame (21) · win (15) · nyquist-03.1 (12) · nyquist-03 (5) · nyquist-04 (3) | 승패·아침으로 끝남·결과 view·여러 날 연쇄 | 나 | 기본 마피아 흐름(처형→밤→아침→낮 시작 발표)을 독립 모델과 견주는 시험 — 03.1 은 확장판(저녁→밤)도 같은 일지 모델로 더 돌림 |
| view (31) · testTools (11) · night (6) · bots (4) · showdown (1) · execution (1) | 모든 단계 전수·skip 도구·밤 판정·봇 계획 | 나(+가) | 지역 도우미 기본 basic, 단계 `errand` 와 흔적·목격(evidence)·튜토리얼은 확장판으로 |

### 워커 시험 (313개 중 192개는 도우미만 고쳐 풀렸고, 남은 121개를 이렇게 고쳤다)

| 파일 | 시험(대표) | 갈래 | 한 줄 이유 |
|---|---|---|---|
| alarm (2) | roleReveal 마감 → dayAnnounce · 낮 한 바퀴 | 나+가 | 두 판 종류를 따로: 기본 마피아 한 바퀴, 확장판 한 바퀴(저녁→밤→토론→지목→저녁), 확장판 저녁 진입 새 it |
| chat (22) · chatLeak · chatReplay (2) · emoteLeak (2) · emotePhases · day (2) · endgame (3) · ballots (2) · trial (6) · world (3) · rematch (2) · resultLog · bench (3) · botTyping · bots (2) · testTools (7) · waitHelpers · basicDay (4) · morningCards (2) · nightCatchup (3) · nightLeak (10) · night (1) · trace (2) | 채널·누출·지목·처형·아침·다시 하기·skip 도구 | 나 | 낮 시작 발표·늘 있는 아침이 필요한 규칙 시험 — `startedGame(…, { mode: "basic" })` 또는 시작 앞 `pickBasic` |
| modeBasic (1) · modePick (1) | 고르지 않은 판의 단계 열 | 가 | `assigning>roleReveal>errand`(낮 시작 발표 없음) |
| trace (2) · night (1) · nightLeak (1) | 아침 길이·흔적 키·암살 밤 | 가 | 확장판 아침은 길이 하나(30초)·흔적이 있는 아침은 확장판으로 열고, 아침 다음은 토론 |
| leak (1) | 6명 한 판 전수 누출(두 밤·두 아침) | 가 | 확장판 순서로 대본을 다시 짬(저녁→밤→아침→토론→저녁→밤→아침) — 비인증 응답 19개·채널별 줄 번호·증거 같은 기대 값은 그대로 |
| leak (3) · errand (1) · dress (4) | 맵 선택·다시 하기 키·의상·처리 목록 | 나·다 | 낮 시작 발표는 basic, 다시 하기 뒤 저장 방에 남는 `mode` 키 반영, 죽은 처리 목록 키 없음은 "처리한 곳 없음"으로 |
| errandLeak (8) · errandNear (2) · townErrand (3) | 저녁 snap·토론 me.record·마지막 목격·구역 기억 | 가·다 | 새 순서의 snap 열(밤 본인만·토론 전체), 저녁 목록을 토론 상태에 옮겨 심고 me.record 를 봄(다); 밤·아침 순간이동은 집 앞(가) |
| townLeak (8) | 마을 한 판 누설 전수 | 가 | 저녁 → 밤(집 앞) → 토론 → 지목 모이기로 대본을 다시 짬 — 판정 함수·구역 기대는 그대로, 구역 궤적만 `W=post>plaza>post>plaza` 로 |
| town (1) | 다시 하기로 시작한 확장판도 마을 | 가 | `endedGame4("extended")` |

## `npm test` 수치 / 검증

| 명령 | 결과 |
|---|---|
| `npm test` 전체(unit·client·worker) | **Test Files 293 passed · 6 skipped / Tests 8614 passed · 262 skipped · 실패 0** (종료 코드 0, 112초) |
| `npm run typecheck` | 통과(tokens·placeart·wrangler types·tsc app·worker, error 0) |
| `git grep -n '\.skip(' -- test` · `'\.todo('` | 각 0줄(기준선 0줄), `git diff 7b061da2..HEAD` 에 skip·todo·only 추가 0 |
| 건너뜀 262 | 기존 `describe.skipIf(!GAME_RULES.…)` 등 — 이번 계획이 더하지 않았다 |
| 위생 `git grep -nIiE "torder|티오더|조직|회사|~/project" -- test` | 결과 0 |
| `grep -c "mode" test/worker/helpers.ts` | 기준선 0 → 15 (startedGame 의 mode 인자 등) |

## 간헐 실패로 가른 것
- `test/worker/bots.test.ts` 「봇 chat: 밤에는 마피아 봇의 줄이…」: 6명 판에서 마피아 둘 중 하나가 사람 손님이면 `mafiaBot` 이 없어 실패한다(약 20%). 판 종류와 무관한 역할 배정 문제로 20페이즈 `deferred-items.md` 의 후보와도 다르다 → `deferred-items.md`(21페이즈)에 적고 고치지 않았다. 재실행하면 통과한다.
- 전체 실행 한 번은 이 간헐 실패 없이 초록이었다. 20페이즈 `deferred-items.md` 의 간헐 후보와 겹친 실패는 보지 못했다.

## 계획과 달라진 점
1. **무한 루프 도우미를 먼저 고쳤다**(carry-over 가 요구): `testTools`·`bots`·`night` 의 루프에 반복 상한.
2. **`startedGame` 은 `morning` 도 확장판에서 한 줄 오류**다(계획은 `dayAnnounce` 만). 이유는 위.
3. **도우미 전부를 고치지는 않았다**: `skipOnce`·`skipThrough`·`advanceTo`·`driveToEnded`·`townGame`·`toEndedByMafia` 는 저장된 단계를 보며 돌아 판 종류의 순서를 이미 따른다. 실패는 목표 단계를 `dayAnnounce`·`morning` 으로 못 박은 호출 쪽에 있어서 도우미는 `startedGame` 과 `endedGame4`·`richEndedGame6`·`threeAliveGame` 만 고쳤다.
4. **토론 view 의 `me.record`를 보는 시험은 저녁 값을 토론 상태에 옮겨 심었다**(errandLeak ③·errandNear·townErrand·viewRoles15): 21-01 의 `enterNight` 가 `errandPlaces·errandDone·errandSeen` 을 지워 확장판 토론에는 record 가 생길 수 없다. 21-04 의 몫이라 제품은 고치지 않았다(Rule 4 아님 — 이미 계획된 변경).
5. **일부 시험은 두 판 종류를 모두 돌리게 늘렸다**(alarm 한 바퀴·nyquist-03.1·audience·gameRoom·awards): 기본 마피아 기대는 그대로 두고 확장판 기대를 새 it/반복으로 더했다.
6. **기대 값이 바뀐 것은 모두 새 규칙을 뜻하는 것이다**(약화 아님): 확장판 아침 길이 30초, 동률 날의 다음이 저녁, 단계 표의 `errand.next = night`, 같은 일차 탈락 순서, 마을 밤·아침이 집 앞, 다시 하기 뒤에도 남는 방 키 `mode`.
7. 간헐 실패 후보로 알람 시험의 저녁 알람 시각은 "따라잡기로 늦게 닿으면 지금 + 1초"(worker/room.ts)라 새 한 바퀴 시험의 두 번째 저녁은 범위(`forced + 1초 ≤ 알람 < 마감`)로 단언했다 — 첫 저녁(정확한 값)은 그대로 정확히 본다.

## 21-03(가로등 8곳)과 이후가 알아야 할 것
- **도우미**: `startedGame(phase, guests, { mode })` 는 기본 확장판이다. 확장판에서 밤 이후는 `advanceTo("night")` → 선택 → `advanceTo("morning")` 만 가능하고, 선택이 없으면 아침 없이 토론이 온다.
- **21-04 가 지울 임시 옮겨 심기**: `eveningRowsOf`·`regraftEvening`(test/worker/helpers.ts), errandLeak `recordGame`, errandNear 「목격 기록」, townErrand 「벽 너머」, `test/unit/viewRoles15.test.ts` 의 `stateOf("discussion")`. `enterNight` 가 저녁 목록·진행·목격 줄을 토론까지 남기면 이 옮겨 심기는 필요 없고 시험은 실제 흐름으로 바꾸면 된다. 그때 `errandLeak` ⑦(`day.evidence` 가 저녁에도 이어지는지 — 지금은 `morning·discussion·nomination·errand`)도 같이 본다.
- **확장판 `captureHome`**: 한 일차에 한 번 기록되는데 확장판은 밤이 토론보다 먼저라 그 일차의 home 이 밤 진입 자리다(`test/worker/world.test.ts` 「home 기억」은 basic 으로 열었다). 마을 판은 밤마다 집 앞이라 영향이 없고 재즈 바·광장은 확장판 맵이 아니라 문제 없다 — 이 의미를 쓰는 곳이 생기면 다시 본다.
- **확장판 `day.evidence`**: `state.morning` 이 다음 `enterNight` 까지 남아 다음 저녁(errand)에도 지난 아침의 증거가 실린다(errandLeak ⑦ 가 현재 동작을 고정한다). 21-06 현장·21-13 의심 보드가 이 수명을 다르게 정하면 그 시험을 같이 고친다.
- 새 시험을 쓸 때 워커의 맵 잠금(test/worker/setup.ts)은 재즈 바다. 마을은 `townGame`/`openTown()`.

## 알려진 스텁
없음.

## Threat Flags
없음. 누설 시험(leak·errandLeak·nightLeak·chatLeak·emoteLeak·townLeak 등)은 갈래 가(새 순서에서 같은 불변식)·나(기본 마피아로 같은 기대)·다(같은 구조 검사)만 썼고 단언은 약화하지 않았다. T-21-04 완화 확인: 건너뛰기·미완 표시 추가 0.

## Self-Check: PASSED
- 만든 파일: `.planning/phases/21-cause-effect-missions/deferred-items.md`
- 커밋: fb37376b(단위) · 87ec8207(워커)가 HEAD 의 조상
- `npm test` 실패 0, `npm run typecheck` 오류 0, 위생 grep 0
