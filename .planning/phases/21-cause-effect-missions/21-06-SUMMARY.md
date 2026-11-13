---
phase: 21-cause-effect-missions
plan: "06"
subsystem: morning-scene
tags: [scene, clues, inspect, smudge, server-only-keys, skip-denominator]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-05 의 lampsLitOf·markCut 본보기·저녁 값이 아침·토론까지 남는 수명, 21-03 의 마을 집·가로등 표
provides:
  - 아침 현장 — 피해자 집(미수면 마피아 확정 대상 집) 앞 단서 지점 셋, day.scene.house 모두 같은 값
  - inspect 메시지와 나만 보는 단서 me.clues(발자국 수·옷 조각·창문 목격·먼저 손댄 흔적)
  - 마피아가 만진 지점의 서버 전용 흐려짐(markSmudge), 응답은 역할과 무관하게 같은 모양
  - 건너뛰기 분모 = 산 사람 중 봇이 아니고 접속 중인 사람(사용자 결정)
affects: [21-07, 21-10, 21-12, 21-13]
requirements-completed: [D-12, D-13, D-14, D-15, D-16, D-21, D-22]
actuals:
  tokens: 36000
  tasks: 3
  commits: 6
plan_head_before: 8951ae8248d818cc4bf213bda3a51952ad56c104
plan_head_after: 4ca58ffd
commits: 6
tech-stack:
  added: []
  patterns:
    - "현장 판정은 역할을 읽지 않는 scene.ts, 역할을 읽는 흐리기는 mafiaTouch.ts 한 곳(markCut·markSmudge)"
    - "응답 동일성: 흐리기는 서버 전용 smudged 만 바꾸고 공개 값(day.scene.house)은 그대로라 inspect 는 늘 본인 한 프레임(방송 없음)"
key-files:
  created:
    - shared/game/scene.ts
    - test/unit/scene.test.ts
    - test/worker/scene.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/room.ts
    - shared/game/mafiaTouch.ts
    - shared/game/mapTown.ts
    - shared/game/night.ts
    - shared/game/tick.ts
    - shared/game/view.ts
    - shared/game/skip.ts
    - worker/room.ts
    - scripts/e2e/lib.mjs
    - test/unit/mapTown.test.ts
    - test/unit/skip.test.ts
    - test/worker/skipPhase.test.ts
    - test/unit/gameMode.test.ts
    - test/unit/night.test.ts
    - test/unit/trace.test.ts
    - test/unit/view.test.ts
    - test/unit/soundProtocol.test.ts
key-decisions:
  - "건너뛰기 분모는 산 사람 중 봇이 아니고 접속 중인 사람이다(사용자 결정, 추가 작업) — 봇·접속 끊긴 사람은 막지 않고 그런 사람이 하나 이상이어야 한다"
  - "좌석 0·7 집의 ③ 창문 지점은 정의식 점이 막힌 칸이라 광장 쪽으로 3칸(1.5) 옮겼다"
  - "닫힌 방 안 분필(0087 한계)은 암살이 집 앞(바깥)에서 일어나므로 생기지 않는다 — 결정 기록은 21-17"
metrics:
  duration: 약 1시간 30분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 06: 아침 현장 조사 Summary

**마피아가 고른 집(피해자 또는 의사가 막은 미수)에 아침 현장이 서고, 산 사람이 지점 앞에서 `inspect` 하면 본인만 단서(발자국 수·옷 조각·창문 목격)를 받으며, 마피아가 먼저 만진 지점은 서버 전용으로 흐려져 뒤 사람은 touched 만 받는다. 추가로 건너뛰기 분모를 접속 중인 사람(봇 제외)으로 바꿨다. `npm test` 8711 통과 · 262 건너뜀 · 알려진 간헐 실패 1(bots mafiaBot, 단독 3회 재실행 통과), `npm run typecheck` 초록, `node --test scripts/e2e/lib.test.mjs` 465 통과.**

## 와이어

| 항목 | 위치 | 모양 | 받는 사람·조건 |
|---|---|---|---|
| `inspect` | ClientMessage | `{ t: "inspect" }` (strictObject, 필드 없음) | 위치·지점은 서버가 정한다. 못 받는 모든 이유에 응답이 같다 |
| `ClueLine` | 공용 타입 | `{ spot: 1\|2\|3; kind: footprint\|cloth\|window\|touched\|dark; n?: number; piece?: TracePiece }` | n 은 footprint 만, piece 는 cloth·window 만(없는 값은 키 없음) |
| `day.scene` | DayView | `{ house: number }` | 확장판 morning 에 현장이 있을 때만, 모두에게 같은 값 |
| `me.clues` | MyInfo | `ClueLine[]` 살핀 차례 순 | 확장판 morning~execution(CLUE_PHASES) 의 산 본인에게만, 필드별 복사 |

## 서버 전용 키 (21-07 누설 목록에 더할 것)

- `RoomState.scene = { house, steps, cloth, window, eyes, smudged }` — house 만 `day.scene` 으로 나가고 steps(발자국 수)·cloth·window(옷 조각 둘)·eyes(창에서 본 좌석)·smudged(흐려진 지점)는 어떤 view·프레임에도 없다. `enterMorning`(확장판)이 세우고 새 저녁의 `clearScene` 이 지운다.
- `Player.clues` — 본인 view 의 `me.clues` 로만 복사된다. `clearScene` 이 지운다.
- 워커 시험이 모든 소켓의 모든 프레임에 `smudged`·`lampCut`·`steps` 문자열이 없음을 단언한다.

## 난수 호출 순서

`enterMorning`(확장판): 기존 흔적 난수 `pickTracePiece`(탈락자가 있을 때만, 1번) → 현장 난수: 첫 `randInt(풀 크기)` = i(옷 조각 cloth), 풀이 둘 이상이면 둘째 `randInt(풀 크기 − 1)` 으로 j = (i + 1 + r) % 풀 크기(창문 window), 풀이 하나면 난수는 한 번뿐이고 window = cloth. 풀이 비면 현장도 난수도 없다. 의사가 막은 밤(미수)은 흔적이 없고 현장 난수만 든다. **21-07 이 기존 흔적 난수를 지우면 현장 난수가 첫 호출이 된다** — `night.test.ts`·`trace.test.ts`·`gameMode.test.ts` 의 호출 수 단언(탈락 3 = 흔적 1 + 현장 2, 미수 2)을 21-07 이 2·2 로 고친다.

## 단서 지점 좌표 (`TOWN_CLUE_SPOTS`, 월드 단위, 좌석 n 집 앞)

| 좌석 | ① 발자국 | ② 옷 조각 | ③ 창문 |
|---|---|---|---|
| 0 | (−3.75, −6.75) | (−2.25, −6.25) | (−2.25, −4.75) ※ |
| 1 | (4.75, −6.25) | (6.25, −6.25) | (3.25, −6.25) |
| 2 | (6.25, −5.25) | (6.25, −3.75) | (6.25, −6.75) |
| 3 | (6.25, 4.75) | (6.25, 6.25) | (6.25, 3.25) |
| 4 | (4.75, 6.25) | (6.25, 6.25) | (3.25, 6.25) |
| 5 | (−5.25, 6.25) | (−3.75, 6.25) | (−6.75, 6.25) |
| 6 | (−6.25, 4.75) | (−6.25, 6.25) | (−6.25, 3.25) |
| 7 | (−6.75, −3.75) | (−6.25, −2.25) | (−4.75, −2.25) ※ |

※ 좌석 0·7: 문 앞이 시계탑 뒤 모서리 칸이라 −1.6 점이 막힌 칸이어서 ③ 을 광장 쪽(문이 바라보는 쪽)으로 0.5 씩 3칸 옮겼다(계획의 "문에서 멀어지는 쪽 걷는 칸" 이탈이 아니라 그 조항의 적용). 나머지 여섯은 정의식 점 그대로. 8집 24지점 모두 걷는 칸 중심·plaza·서로 ≥ 1.3·입장 지점에서 길이가 닿는다(시험). 0 집 ③ 은 가로등 lamp0(−2.25, −5.25)과 0.5 떨어져 있다(별개 장소라 문제없음). 재생성: `MAP_PRINT=1 npx vitest run test/unit/mapTown.test.ts -t 단서`.

## RED 증거 (단일 줄)

- `건너뛰기 분모: expected '[false,false,false,true,false,false]' to be '[true,true,true,false,false,false]'`
- `neighborsOf 자리 함수: expected '0,0 0,0 0,0' to be '7,1 6,0 1,3'`
- `buildScene 자리 함수: expected 'undefined []' to be '{"house":2,"steps":3,"cloth":"blackCloth","window":"button","eyes":[1],"smudged":[]} [3,2]'`
- `단서 지점 표: expected '0/false/true/true/false/true' to be '8/true/true/true/true/true'`
- `워커 day.scene: expected '["undefined/2","undefined/2",…' to be '["{\"house\":2}/2",…'`
- `워커 미수 현장: expected '{"saved":true} undefined' to be '{"saved":true} {"house":0}'`

## 시험

- 단위: `test/unit/scene.test.ts`(neighborsOf·CLUE_PHASES·buildScene 난수 호출 수[3,2]/[1]/0·actInspect 세 지점·같은 지점 두 번·반경 밖 등 여섯 거절의 같은 모양·ERRAND_ACT_R 경계·markSmudge 마피아 선후·키 구조 동일·clearScene·소스 규약), `test/unit/mapTown.test.ts` 단서 지점 두 건(정의식 대조 포함), `test/unit/skip.test.ts`·`test/worker/skipPhase.test.ts` 분모 시험.
- 워커(`test/worker/scene.test.ts`, 마을 판): 마피아 둘이 시민의 집을 고른 아침 모든 산 소켓 `day.scene {house}` · 의사가 지킨 밤 미수 현장 · 마피아가 갈린 밤은 morning 없이 토론이고 키 없음 · 시민 ① 살피기(본인 한 프레임·발자국 수 2·남의 clues 없음) · 마피아 선/후 흐림(touched)과 마피아·시민 응답의 프레임 수·view 키 구조 동일, 프레임에 `smudged`·`lampCut`·`steps` 없음 · 창문(켜진 이웃 window·옷 조각이 ② 와 다름, 꺼진 이웃 dark) · 유령 거절 · 토론·지목 view 에 본인 clues 유지·다음 저녁 뒤 전부 없음 · morning 밖 거절.
- `npm test`: 8711 통과 · 262 건너뜀 · 간헐 실패 1(bots mafiaBot, 단독 3회 재실행 통과 — deferred-items.md 기록 항목). `npm run typecheck` 초록.

## 위협 대응

- T-21-14: `me.clues` 필드별 복사·본인만, `day.scene` 은 house 하나. 다른 소켓 view 에 남의 clues 없음을 워커 시험이 단언(전수는 21-07).
- T-21-15: `applyInspect` 는 받든 거절하든 본인 한 프레임, 마피아의 흐리기는 서버 전용 `smudged` 만 바꾸고 공개 값은 그대로라 방송이 없다. 마피아·시민의 프레임 수·키 구조 동일을 시험이 단언.
- T-21-16: 메시지에 좌표·지점이 없고 서버 구간(`positionAtFx`)과 ERRAND_ACT_R 안만 받는다.
- T-21-17: `inspect:{id}` 간격 ERRAND_MIN_GAP_MS + 기존 연결당 한도.

## Deviations from Plan

### 사용자 결정으로 더한 작업

**1. [추가 작업 — 호출자 지시] 건너뛰기 분모를 접속 중인 사람(봇 제외)으로**
- **Issue:** 21-05 이월 메모: 봇은 누르지 않고 접속이 끊긴 사람도 누를 수 없어 모두-눌림 조건이 영영 채워지지 않는다.
- **Fix:** `skipReached` 가 산 사람 중 `isBot !== true` 이고 `connected` 인 사람이 하나 이상이고 모두 `skipVote` 일 때 true. 공개 값 `skipCount` 는 그대로(산 사람 전체 눌림 수). 단위 시험 + 워커 시험(봇이 낀 판·접속 끊긴 사람이 낀 판), 첫 RED/GREEN 한 쌍.
- **Files modified:** shared/game/skip.ts, test/unit/skip.test.ts, test/worker/skipPhase.test.ts
- **Commit:** 4de30794(RED)·ccadf0ab(GREEN)

### Auto-fixed Issues

**2. [Rule 1 - 새 규칙에 맞춘 시험] 난수 호출 수·키 허용 목록**
- **Found during:** Task 2 전체 `npm test`
- **Issue:** 확장판 아침이 현장 난수를 더 불러 night·trace·gameMode 시험의 호출 수(1)가 달라졌다. `day.scene`·`me.clues`·`inspect` 가 view 키 허용 목록·E2E 사본(`scripts/e2e/lib.mjs`)·클라이언트 메시지 목록을 넘었다.
- **Fix:** 호출 수 단언을 정확한 새 값(탈락 3, 미수 2)으로 고치고(약화 아님) 키 목록에 한 줄씩 더했다.
- **Files modified:** test/unit/night.test.ts, trace.test.ts, gameMode.test.ts, view.test.ts, soundProtocol.test.ts, scripts/e2e/lib.mjs
- **Commit:** 4ca58ffd

**3. [참고] 두 번째 RED 커밋(472ab0d9)은 `worker/room.ts` switch 의 `never` 검사 때문에 worker typecheck 가 한 줄 실패한다**(와이어 타입만 먼저 넣은 자리 값 단계). 다음 GREEN 단계들에서 해소됐다.

## 21-07 에 넘기는 것

- `enterMorning` 의 확장판 갈래에 공개 흔적(`morning.trace`·`seen`·`day.evidence`)이 아직 그대로 있다 — 걷는다. 걷으면 현장 난수가 첫 호출이 되고 호출 수 단언 세 곳(night·trace·gameMode 시험)을 3→2·미수 2→2 로 고친다(위 난수 절).
- 누설 전수에 더할 서버 전용 키: `RoomState.scene` 의 steps·cloth·window·eyes·smudged, `Player.clues`(본인 view 의 `me.clues` 로만), 앞 계획의 `lampCut`·`skipVote`.
- 건너뛰기: 접속이 끊기는 순간 남은 사람이 모두 눌러 둔 상태가 되어도 지금은 다음 누름·취소가 있어야 단계가 끝난다(`applySkipPhase` 만 `skipReached` 를 본다). 연결이 끊길 때 한 번 더 판정할지는 21-10·21-12 화면 검토에서 정한다(미결정).
- 봇은 `inspect` 를 보내지 않는다(계획에 없음). 봇이 현장을 살피게 할지는 21-07 이후 필요하면.

## 21-12·21-13 에 넘기는 것 (화면)

- 보낼 메시지: `{ t: "inspect" }` 하나 — 지점 앞(ERRAND_ACT_R 1.2)에서 누르면 서버가 가장 가까운 안 살핀 지점을 처리한다. 응답은 항상 본인 state 한 프레임이라 화면이 성공·거절을 응답 모양으로 구별할 수 없고 `me.clues` 길이 변화로만 안다.
- 읽을 키: `view.day.scene.house`(현장 집 좌석, 문패로 보이는 것이 의도, 지점 위치는 `TOWN_CLUE_SPOTS` 와 같은 표를 화면이 가진다), `view.me.clues`(살핀 차례 순 `{spot, kind, n?, piece?}`): kind 뜻 — footprint = 발자국 `n` 쌍 수사, cloth = 옷 조각 `piece`(TRACE_TEXT), window = 창에서 본 옷 조각 `piece`, dark = "어두워서 못 봤어요", touched = "먼저 손댄 흔적". 지점 세 상태(안 살핀·살핀·먼저 손댄)는 `me.clues` 의 spot 과 kind 로 만든다.
- `me.clues` 는 아침~처형(morning·discussion·nomination·defense·verdict·execution) 동안 남는다(결정 0079 의 이름표 옷 표시·의심 보드 재료). 다음 저녁에 사라진다.

## Known Stubs

None.

## Threat Flags

None — 새 네트워크 경로는 `inspect` 하나이고 위협 대응 표가 다룬다.

## Self-Check: PASSED

- 파일: `shared/game/scene.ts`·`test/unit/scene.test.ts`·`test/worker/scene.test.ts` 있음, `grep -c "export function actInspect" shared/game/scene.ts` = 1, `grep -c "TOWN_CLUE_SPOTS" shared/game/mapTown.ts` ≥ 1, `grep -c "export function markSmudge" shared/game/mafiaTouch.ts` = 1, `grep -c "applyInspect" worker/room.ts` ≥ 1, `grep -c "buildScene" shared/game/night.ts` ≥ 1, `grep -c "clearScene" shared/game/tick.ts` ≥ 1.
- 커밋: 4de30794·ccadf0ab·472ab0d9·1e3d1c95·90851a8e·4ca58ffd 모두 HEAD 의 조상.
