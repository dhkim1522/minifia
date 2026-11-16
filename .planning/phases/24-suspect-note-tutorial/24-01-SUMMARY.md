---
phase: 24-suspect-note-tutorial
plan: "01"
subsystem: game-rules
tags: [suspect-note, tracer, server-authority, view-public-values, selectors]
status: complete
requires: []
provides:
  - "shared/game/postit.ts — NOTE_PHASES·NOTE_FIRST_DAY(2)·NOTE_REACH_FX(240)·NOTE_REACH_ON_PCT(92)·NOTE_MAX_VISIBLE(3)·SUSPECT_MIN_GAP_MS(600)·noteAllowedNow·withinNoteReach·stickNote·NoteRow·StickResult"
  - "ClientMessage { t: 'suspect', target } + 스키마(strictObject, 0..7 정수) + 워커 handleSuspect/applySuspect"
  - "RoomState.notes(서버 전용) → view day.suspects(오늘)·day.suspectLog(판 내내)·me.suspectTo(본인)"
  - "src/game/suspectView.ts — suspectVisible·suspectUsed·suspectTargets·suspectStacks·suspectCountOf·suspectLogByDay"
affects: [24-02, 24-03, 24-04, 24-05]
actuals:
  tokens: 14000
  tasks: 3
  commits: 6
plan_head_before: f791a160a315fc73fef9b443ce13f745a7a1495e
plan_head_after: f9560e9b8395946f1f95668d1818a25b37ba1888
tech-stack:
  added: []
  patterns:
    - "서버 단독 판정: 순수 규칙 stickNote(state, world, actorId, toSeat, now) — 거리는 서버 구간(world.segs)과 positionAtFx 정수 제곱 비교"
    - "거절 균일성: 모든 거절이 BAD_MESSAGE + 본인 [error, state] 두 프레임, 다른 소켓 0프레임"
    - "화면·서버 한 함수: suspectVisible 은 noteAllowedNow, suspectTargets 는 withinNoteReach(켜는 문턱 92%·끄는 문턱 100% 히스테리시스)"
key-files:
  created:
    - shared/game/postit.ts
    - src/game/suspectView.ts
    - test/unit/postit.test.ts
    - test/unit/suspectView.test.ts
    - test/worker/suspect.test.ts
  modified:
    - shared/game/room.ts
    - shared/game/view.ts
    - shared/protocol.ts
    - shared/schemas.ts
    - worker/room.ts
    - test/unit/schemas.test.ts
    - test/unit/soundProtocol.test.ts
    - test/unit/rematch.test.ts
    - test/unit/testTools.test.ts
key-decisions:
  - "stickNote 에 world 인자를 더했다: stickNote(state, world, actorId, toSeat, now) — D-03 거리 판정에 두 사람의 서버 구간이 필요하다(계획에 명시된 선택)"
  - "옮기기는 그 줄을 빼고 끝에 새 줄(D-27 Q5 채택): 줄 수 그대로, 받는 좌석만 바뀌고 쌓기 맨 위"
  - "거절은 단계 어긋남까지 모두 BAD_MESSAGE 하나(D-26, 귓속말의 WRONG_PHASE 를 따라 하지 않음)"
  - "suspectTargets 는 서버 구간(segOf)만 읽는다 — UI-SPEC P24-6 의 '내 것은 예측 위치' 를 교정(D-25). 시그니처는 (view, segOf, serverNow, prev?)"
  - "suspectStacks 는 붙인 좌석의 전체 배열을 돌려준다(보이는 3장 자르기는 3D 쪽 NOTE_MAX_VISIBLE)"
metrics:
  completed: 2026-11-17
---

# Phase 24 Plan 01: 의심 포스트잇 서버 한 길과 선택기 Summary

둘째 날 토론에서 가까운 산 사람에게 `suspect {target}` 를 보내면 서버 순수 규칙 `stickNote` 가 `notes` 에 한 줄을 남기고 전원이 같은 `day.suspects` 를 받으며 보낸 사람만 `me.suspectTo` 를 받는 한 길(스키마 → 방 DO → 규칙 → 저장 → 방송 → view)과, 서버와 같은 상수·함수를 쓰는 화면 선택기 6개를 만들었다.

## 수행한 일

| 작업 | 커밋 | 내용 |
|------|------|------|
| T1 RED | b0b6bf7c | postit 단위·suspect 워커 트레이서·schemas·soundProtocol 종류 목록 시험 |
| T1 GREEN | d2fa8cd5 | postit.ts, RoomState.notes, 프로토콜·스키마·view, 워커 처리기 |
| T2 RED | c1ae5ce2 | 거절 여섯 사유·연타 간격·같은 대상·봇·rematch/resetToLobby/beginGame 비움 시험 |
| T2 GREEN | 33698e25 | applySuspect 에 600ms 요청 간격 |
| T3 RED | 003b7bb3 | suspectView 시험(19건, 성질 시험 200쌍 포함) |
| T3 GREEN | f9560e9b | src/game/suspectView.ts |

- **트레이서 게이트:** 트레이서 직후 verify(단위 + worker 시험 + typecheck)를 다시 돌려 초록을 확인한 뒤 확장했다.
- **RED 증거:**
  - Task 1: 단위 3개 파일 모두 실패(postit 은 모듈 없음으로 로드 실패, schemas·soundProtocol 은 `suspect` 불일치 — 3 files failed, 3 tests failed) + 워커 suspect 2건 실패.
  - Task 2: 워커 suspect 12건 중 1건 실패(연타 간격). 나머지 11건과 rematch·testTools·beginGame 시험은 처음부터 초록이었다 — 허용 목록 복사와 Task 1 의 beginGame 구조 분해가 이미 비움을 보장하므로 이 시험들은 회귀 방지용이다(계획 `RESEARCH P1 244행`과 일치).
  - Task 3: suspectView 시험이 모듈 없음으로 로드 실패.
- **typecheck 결합 설명(한 커밋으로 낸 사유):** ClientMessage 유니온에 `suspect` 를 더하면 worker/room.ts 의 `const unhandled: never` 와 soundProtocol 의 종류 목록이 타입·시험으로 함께 묶여 스키마·워커 처리기·시험 갱신을 한 커밋(d2fa8cd5)으로 낼 수밖에 없었다. 시험 사본 정리는 RED 커밋에 분리했다.

## 확정 상수·시그니처 (다음 계획이 쓴다)

- `NOTE_REACH_FX = 240`, `NOTE_REACH_ON_PCT = 92`, `NOTE_FIRST_DAY = 2`, `NOTE_MAX_VISIBLE = 3`, `SUSPECT_MIN_GAP_MS = 600`, `NOTE_PHASES = {discussion}`.
- `stickNote(state, world: Pick<WorldState,"segs">, actorId, toSeat, now): { ok: true; state } | { ok: false; error: "BAD_MESSAGE" }` — 같은 대상 다시 보내기는 `ok: true` 에 들어온 state 와 같은 객체.
- `withinNoteReach(a?, b?, now, pct = 100)`, `noteAllowedNow(phase, day)`.
- view: `day.suspects?: {to, from}[]`(오늘, 배열 순서 = 쌓는 순서), `day.suspectLog?: {n, from, to}[]`, `me.suspectTo?: number`(토론·산 본인만). 줄이 없으면 키 자체가 없다.
- 선택기: `suspectVisible(view)`, `suspectUsed(view)`, `suspectTargets(view, segOf, serverNow, prev?) → ReadonlySet<number>`, `suspectStacks(view) → ReadonlyMap<number, readonly number[]>`, `suspectCountOf(view, seat)`, `suspectLogByDay(view) → {n, rows}[]`.
- 워커: `applySuspect` 는 받아들임·거절 모두 `writeAt` 키 `suspect:${playerId}` 에 시각을 기록하고 600ms 안 요청은 오류 없이 버린다. 같은 대상 재요청은 저장·방송이 없다.

## 검증 (실제로 돌린 것)

- `npm run typecheck`: 종료 0 (커밋마다).
- `npx vitest run --project unit`: 132 파일 통과 / 1 건너뜀, 4400 통과.
- `npx vitest run --project worker`(전체): 4건 실패 — `alarm`·`basicDay`·`pickTurn`·`waitHelpers`. 네 파일 모두 **단독 재실행에서 전부 통과**(11·6·3·6건)라 알려진 부하 간헐 실패로 본다(이 계획의 파일과 무관, 회귀 아님). 이 계획이 더한 `suspect.test.ts` 12건은 전체 실행에서도 통과했다.
- 계획 acceptance grep 전부 충족: `NOTE_REACH_FX = 240` 1, `case "suspect"` 1, `z.literal("suspect")` 1, `suspectLog`(view.ts) 2, `notes`(room.ts) 3, postit.ts 금지 토큰 0, `SUSPECT_MIN_GAP_MS`(worker) 3, suspectView 의 export function 6·`noteAllowedNow` 3·`Date.now`/`Math.random` 0.
- 커밋 전 위생 grep 을 바뀐 파일 전부에 돌렸고 결과가 없었다.

## 계획과 다르게 한 것 / 편차

없음 — 계획대로 실행했다(Rule 1~4 해당 없음). 다만 다음은 알아 둔다.

- Task 2 의 rematch·testTools·beginGame 시험은 RED 가 아니라 회귀 방지 시험으로 처음부터 초록이다(위 RED 증거 참고).
- `view.test.ts` 의 허용 키 목록(`SERVER_ONLY_KEYS`·`ME_KEYS`·`DAY_KEYS`), `leak.test.ts`, `suspectLeak.test.ts`, `scripts/e2e/lib.mjs` 의 `VIEW_*_KEYS`, D1 `note_count` 는 이 계획의 파일 목록에 없고 24-02 계획에 있다. 이 계획에서는 건드리지 않았고 현재 시험은 모두 초록이다(포스트잇이 나오지 않는 판이라).

## 돌리지 못한 것

- 로컬 E2E(브라우저)와 배포본 확인은 이 계획 범위가 아니다(화면 없음).
- 워커 전체 한 번 실행에서 간헐 4건이 났고 단독 재실행으로 구분했다. 같은 부하에서 재현 여부는 웨이브 끝 회귀에서 다시 본다.

## 다음 계획으로 넘기는 것

- 24-02: view 허용 키 목록·누설 시험·e2e 사본 키·D1 `note_count`(`state.notes?.length ?? 0`)를 이 view 모양에 맞춘다.
- 화면 계획: `src/net/useSendGuard.ts` 의 `SendKind` 에 `"suspect"` 를 더하고, `suspectTargets` 에는 `WorldStore.segOf` 와 `Date.now() + offset`(서버 시각)을 넘긴다. 켠 대상이 서버에서 거절될 수 있는 틈은 시계 오차·구간 도착 지연뿐이다(92% 문턱이 흡수).
- 3D 쪽: `suspectStacks` 의 전체 배열에서 마지막 `NOTE_MAX_VISIBLE` 장만 그리고 나머지는 숫자 칩.
- 봇 계획은 바뀌지 않았다(D-05). 사람이 봇에게 붙이는 것은 워커 시험으로 고정했다.

## Known Stubs

없음.

## Threat Flags

없음 — 계획의 위협 모델(T-24-01~05)이 이 계획이 더한 표면(메시지 하나·공개 view 값 세 개)을 모두 덮는다. T-24-01(240/241 경계 시험), T-24-02(여섯 사유 균일 프레임 시험), T-24-03(600ms 간격 + 같은 대상 무변화), T-24-04(strictObject·소켓 첨부 id), T-24-05(rematch·resetToLobby·beginGame 시험)를 모두 시험으로 고정했다.

## Self-Check: PASSED

- 파일 존재: shared/game/postit.ts, src/game/suspectView.ts, test/unit/postit.test.ts, test/unit/suspectView.test.ts, test/worker/suspect.test.ts 확인.
- 커밋 존재: b0b6bf7c, d2fa8cd5, c1ae5ce2, 33698e25, 003b7bb3, f9560e9b 가 HEAD 의 조상임을 확인.
