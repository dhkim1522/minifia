---
phase: 21-cause-effect-missions
plan: "05"
subsystem: evening-lamps
tags: [errand, lamps, wick-cut, skip-phase, server-only-keys, leak]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-03 의 가로등 장소 id(lamp0~7)·마을 TOWN_LAMPS, 21-04 의 모든 역할 같은 처리 규칙·저녁 값이 밤·아침까지 남는 수명
provides:
  - errand 메시지의 선택 필드 hold — 산 마피아의 hold 처리만 서버 전용 lampCut 에 오른다(켜기와 응답 같음)
  - 가로등 공개 값 day.lamps — 저녁은 처리된 것(자른 것 포함), 밤·아침은 켜진 것(자른 것 제외)
  - 저녁·아침 [건너뛰기] — skipPhase 메시지, 산 사람 모두가 누르면 단계가 바로 끝남
affects: [21-06, 21-07, 21-10, 21-12]
requirements-completed: [D-05, D-06, D-07, D-08, D-21, D-22, D-23]
actuals:
  tokens: 17500
  tasks: 2
  commits: 4
plan_head_before: 4b8dcdb6bfceb78915c902734ea88ace8ce84d04
plan_head_after: 85451ffb4c5c9a3e4c24dae192e79ed9c2472e37
commits: 4
tech-stack:
  added: []
  patterns:
    - "방송 여부는 역할을 모르는 공개 값(lampsShownOf)의 변화로만 정한다 — 자른 것도 shown 에 들어 켜기와 자르기가 같은 받는 사람·같은 프레임 수"
    - "역할을 읽는 곳은 mafiaTouch.ts 한 파일 — lamps.ts·skip.ts·errand.ts 는 역할을 읽지 않는다"
    - "건너뛰기는 토론 끝내기와 같은 마감 당기기(tick({...state, phaseEndsAt: now}) → afterTransition)"
key-files:
  created:
    - shared/game/lamps.ts
    - shared/game/mafiaTouch.ts
    - shared/game/skip.ts
    - test/unit/lamps.test.ts
    - test/unit/skip.test.ts
    - test/worker/lamp.test.ts
    - test/worker/skipPhase.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/room.ts
    - shared/game/errand.ts
    - shared/game/view.ts
    - shared/game/tick.ts
    - shared/game/bots.ts
    - worker/room.ts
    - scripts/e2e/lib.mjs
    - test/unit/errand.test.ts
    - test/unit/view.test.ts
    - test/unit/soundProtocol.test.ts
key-decisions:
  - "건너뛰기는 심부름이 있는 판(확장판)에서만 받는다 — 기본 마피아 판의 아침은 WRONG_PHASE(view 에 키가 없는 판에서 눌림이 단계를 끝내지 않게)"
  - "마피아 봇은 첫 장소 처리 한 번만 hold 로 보낸다(호출자 이월 지시, 난수 없음) — 계획 본문의 '봇은 hold 없이'를 따르지 않았다"
metrics:
  duration: 약 1시간 20분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 05: 심지 자르기 · 가로등 공개 값 · 건너뛰기 Summary

**마피아가 같은 [켜기] 단추에 hold 를 실어 심지를 자르고(서버 전용 `lampCut`, 응답·방송은 켜기와 같음), 가로등의 공개 값(`day.lamps`: 저녁 = 처리된 것, 밤·아침 = 켜진 것)을 모두에게 같게 싣고, 저녁·아침 `skipPhase` 를 서버에 두었다. `npm test` 297 파일 통과 · 6 건너뜀, 시험 8680 통과 · 262 건너뜀 · 실패 0. `npm run typecheck` 초록.**

## 와이어

| 항목 | 위치 | 모양 | 받는 사람·조건 |
|---|---|---|---|
| `hold` | ClientMessage `errand` | `{ t: "errand"; hold?: true }` (스키마 `z.literal(true).optional()`) | 모든 역할이 보낼 수 있다. false·1·다른 키는 거절 |
| `skipPhase` | ClientMessage | `{ t: "skipPhase"; on: boolean }` | errand·morning 단계(확장판)의 산 사람. 거절은 지금 규칙(`sendRejection`) 그대로 |
| `day.lamps` | DayView | `number[]` 가로등 번호 오름차순 | 확장판 errand = 처리된 가로등(자른 것 포함), night·morning = 처리됐고 잘리지 않은 가로등. 모두에게 같은 값. 다른 단계·기본 마피아엔 키 없음 |
| `day.skipCount` | DayView | `number` | 확장판 errand·morning 의 모든 view. 누른 산 사람 수뿐 |
| `me.skipPhase` | MyInfo | `true` | 누른 산 본인에게만(거짓은 키 없음) |

## 서버 전용 키 (21-07 누설 목록에 더할 것)

- `RoomState.lampCut?: PlaceId[]` — 산 마피아가 hold 로 처리한 장소. `markCut` 만 쓰고 `enterErrand` 가 키째 지운다(새 저녁). 어떤 view·프레임에도 없다(단위 시험이 view JSON 에 `lampCut` 없음을 4개 단계로 단언, 워커 시험이 모든 소켓의 모든 프레임에 `lampCut`·`"cut"` 없음을 단언).
- `Player.skipVote?: true` — `toggleSkip` 만 쓰고 errand·morning 진입 훅(`clearSkip`)이 지운다. view JSON 에 없음(단위 시험).
- 두 이름은 화면 코드(src)에 나타나지 않는다.

## 방송 규칙

- 처리가 받아들여지면 `markCut` 을 적용하고 저장한다. `lampsShownOf` 가 처리 전과 다르면 `persistAndBroadcast`(모든 소켓이 각자 view 한 프레임), 같으면(이미 켜진 가로등) 보낸 사람에게만 한 프레임. 거절·간격 안 요청은 지금처럼 본인에게만 자기 state 한 프레임.
- 자른 것도 shown 에 들어가므로 켜기와 자르기는 같은 받는 사람·같은 프레임 수다. 이미 시민이 켠 가로등을 마피아가 자르는 경우도 응답은 "보낸 사람만 한 프레임"으로 같다(밤에 다른 값이 보이는 것이 유일한 차이).
- `skipPhase`: 값이 바뀔 때마다 모든 소켓이 각자 view(공개 값 `skipCount` 가 바뀌므로), 같은 값은 저장·전송 없음. 산 사람 모두가 누르면 `tick({ ...state, phaseEndsAt: now })` → `afterTransition`(토론 끝내기와 같은 경로), 새 마감은 now + 다음 단계 길이.

## RED 증거 (단일 줄)

- `lampsShownOf/lampsLitOf 자리 함수: expected '[] []' to be '[1,4] [1]'`
- `워커 lamp: expected '0,0,1,0,0,0 1,0,0,0,0,0' to be '1,1,1,1,1,1 1,1,1,1,1,1'` (처리 응답이 본인에게만 간다 — 방송 규칙 없음)
- `워커 night 가로등: expected '[null,null,null,null,null,null]' to be '[[1,5],[1,5],…]'`
- `스키마 hold: expected '[true,false,false,false,false]' to be '[true,true,false,false,false]'`
- `toggleSkip 자리 함수: expected '["ok","ok","ok","ok","ok"]' to be '["WRONG_PHASE",…]'`
- `skipReached: expected '[false,false,false]' to be '[false,true,false]'`
- `워커 skipPhase: expected '[null,null,null,null] ["errand","erra…' to be '[3,3,3,3] ["errand","errand",…'`
- `워커 아침 건너뛰기: expected '["morning","morning","morning"]' to be '["discussion","discussion",…'`

## 시험

- 단위: `test/unit/lamps.test.ts`(13)·`test/unit/skip.test.ts`(12) — shown·lit(자르는 순서 무관), `markCut` 역할 판정(시민 hold·hold 없음·죽은 마피아·방에 없음은 같은 객체, 입력 불변), `actErrand` 의 `place`, `enterErrand` 의 `lampCut` 청소, day.lamps 단계별 키, `toggleSkip` 검사 순서, 진입 훅 뒤 `skipVote` 없음, 스키마. `test/unit/errand.test.ts` 에 마피아 봇 hold 시험 한 건.
- 워커: `test/worker/lamp.test.ts`(4)·`test/worker/skipPhase.test.ts`(4) — 마을 판에서 시민 C·마피아 M 이 hold 로 처리해도 여섯 소켓이 프레임 한 장씩, 본인 view 의 키 구조 변화·`me.errand.done` 길이 같음, 이미 켜진 가로등은 보낸 사람만, 밤의 `day.lamps` 에 자른 번호 없음 / 넷 중 셋이 누르면 수 3·단계 그대로 → 넷째가 누르면 night(새 마감 ≈ 지금 + 밤 길이) / 취소·같은 값은 프레임 없음 / 유령은 `error`+`state` 한 쌍 / 아침도 모두 누르면 토론.
- `npm test`: **297 파일 통과 · 6 건너뜀, 8680 통과 · 262 건너뜀 · 실패 0**(첫 전체 실행에서 4건 실패 → 아래 이탈 1 로 고친 뒤 재실행 초록). `npm run typecheck` 초록. `node --test scripts/e2e/lib.test.mjs` 465 통과.

## 위협 대응

- T-21-10(응답 오라클): 방송 여부를 `lampsShownOf` 변화로만 정한다. lamp 워커 시험이 켜기·자르기의 받는 소켓·프레임 수·본인 view 키 구조 변화가 같음을 단언한다.
- T-21-11(day.lamps 누설): errand 는 자른 것을 포함한 shown, 밤·아침은 lit, `lampCut` 은 어떤 view 에도 없다(JSON 문자열 검사).
- T-21-12(skipPhase 행위자): 신원은 소켓 첨부 playerId 뿐, 산 사람만, 공개 값은 수뿐.
- T-21-13(연타): errand 는 `ERRAND_MIN_GAP_MS`·연결당 한도 그대로, 같은 값의 skipPhase 는 저장·방송이 없다(워커 시험).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 새 규칙에 맞춘 시험·사본] 새 키를 허용 목록에 더함**
- **Found during:** Task 2 전체 `npm test`
- **Issue:** `day.lamps`·`day.skipCount`·`me.skipPhase`·`skipPhase` 메시지가 허용 목록 시험을 넘었다 — view.test 의 DAY_KEYS·ME_KEYS·확장판 아침 day 키 문자열, E2E 키 사본(`scripts/e2e/lib.mjs` VIEW_DAY_KEYS·VIEW_ME_KEYS, e2eContract 가 view.test 와의 일치를 고정), soundProtocol 의 클라이언트 메시지 종류 목록.
- **Fix:** 각 목록에 새 키를 한 줄씩 더했다(약화 아님 — 키가 단계·본인 조건으로만 실린다는 단언은 lamps·skip 시험이 맡는다).
- **Files modified:** test/unit/view.test.ts, test/unit/soundProtocol.test.ts, scripts/e2e/lib.mjs
- **Commit:** 4ae76884(lamps 부분), 85451ffb(skip 부분과 사본)

**2. [Rule 2 - 응답 안전] 건너뛰기는 심부름이 있는 판에서만**
- **Found during:** Task 2 설계
- **Issue:** 계획은 단계(errand·morning)만 검사한다. 기본 마피아의 아침은 view 에 `skipCount` 가 없는데 눌림이 모이면 단계가 끝나 버린다.
- **Fix:** `toggleSkip` 이 `rulesetOf(modeOf(state)).errand` 가 꺼진 판을 `WRONG_PHASE` 로 거절한다(단위 시험이 단언).
- **Commit:** 85451ffb

**3. [호출자 이월 지시 — 계획 본문과 다름] 마피아 봇의 심지 자르기**
- **Issue:** 계획 본문은 "봇 errandAct 는 hold 없이", 21-04 이월 메모·호출자 지시는 "봇 심지 자르기 행동은 21-05".
- **Fix:** `BotAct.errandAct` 에 선택 필드 `hold`, 마피아 봇이 첫 장소(k=0)의 처리 한 번만 hold 로 보낸다(재시도·다른 장소·시민 봇은 없음, 난수 없음, 사람과 같은 `applyErrand` 본체). `test/unit/errand.test.ts` 에 시험 한 건. 기존 봇 계획 수·시각 시험은 그대로 초록.
- **Files modified:** shared/game/bots.ts, worker/room.ts, test/unit/errand.test.ts
- **Commit:** 4ae76884

**4. [Rule 1 - 시험 설계 수정] lamp 워커 시험의 키 구조 비교**
- **Issue:** RED 에서 "시민 view 와 마피아 view 의 키 구조가 같다" 로 썼으나 두 역할의 view 는 원래 키가 다르다(`allies` 등).
- **Fix:** 누르기 전 view 와 누른 뒤 프레임의 키 경로 차이(+/-)를 비교하도록 GREEN 커밋에서 고쳤다 — 더 엄격한 단언(누름이 바꾼 구조가 같아야 함).
- **Commit:** 4ae76884

## 21-06 에 넘기는 것

- `shared/game/mafiaTouch.ts` 에 단서 흐리기를 더한다(역할을 읽는 유일한 저녁·아침 모듈 — 머리 주석에 적었고 `markCut` 이 시그니처 본보기).
- `lampsLitOf(state)` 가 창문 단서의 재료다(번호 n = 좌석 n 의 집, `TOWN_LAMPS`). 밤 진입 때 `lampCut`·`errandDone` 은 아침·토론까지 남는다.
- 공개 값은 밤·아침에도 `errandDone` 에서 파생하므로 아침 현장 단서가 가로등을 읽으려면 `lampsLitOf` 를 쓰면 된다. `lampCut` 을 view 에 싣는 일은 없다.

## 21-10·21-12 에 넘기는 것 (화면)

- 보낼 메시지: 켜기 `{ t: "errand" }`, 길게 눌러 심지 자르기 `{ t: "errand", hold: true }`(마피아만 의미가 있고 서버는 누구의 hold 든 받는다 — 화면이 역할로 단추를 달리 그리면 안 된다), 건너뛰기 `{ t: "skipPhase", on: boolean }`.
- 읽을 키: `view.day.lamps`(errand = 켜진 것처럼 보임, night·morning = 실제 켜진 것 → 공개 표식은 21-12), `view.day.skipCount`(숫자, 산 사람 수와 견주어 진행 표시), `view.me.skipPhase`(눌렀는지). 키가 없는 판(기본 마피아)은 건너뛰기 단추를 그리지 않는다.
- 건너뛰기는 산 사람 모두(방에 접속하지 않은 사람·봇 포함)가 눌러야 단계가 끝난다. 봇은 건너뛰기를 누르지 않으므로 봇이 낀 방에서는 모두-눌림 조건이 채워지지 않는다 — 봇 자동 누름(또는 접속 끊긴 사람·봇을 분모에서 빼는 규칙)이 필요한지는 21-10·21-12 의 화면 검토 때 정한다(미결정으로 남김).

## Known Stubs

None.

## Threat Flags

None — 새 네트워크 경로·권한 경계 없음. 서버 상태 키(`lampCut`·`skipVote`)는 view 허용 목록 밖이다.

## Self-Check: PASSED

- 파일: `shared/game/lamps.ts`·`shared/game/mafiaTouch.ts`·`shared/game/skip.ts` 있음, `grep -c "export function markCut" shared/game/mafiaTouch.ts` = 1, `grep -c "export function toggleSkip" shared/game/skip.ts` = 1, `grep -c "clearSkip" shared/game/tick.ts` ≥ 1, `grep -c "markCut" worker/room.ts` ≥ 1, `grep -c "skipPhase" worker/room.ts` ≥ 1.
- 커밋: d108dfb8·4ae76884·0aba1fe0·85451ffb 모두 HEAD 의 조상.
