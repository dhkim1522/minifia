---
phase: 23-keyword-day-one
plan: "08"
subsystem: game-flow
tags: [early-advance, deadline, leak-test, metamorphic, server-authoritative]
requires: ["23-06"]
provides:
  - "shared/game/early.ts: EARLY_GRACE_MS 1500 · earlyReady(키워드 사람 전원 확정 / 찬반 산 사람 전원 / 밤 산 사람 전원 nightPick) · shrinkDeadline(순수, 한 번 줄이기 / 찬반 번복 연장, 원래 마감 상한, 봇 계획 키 갈아 끼움)"
  - "RoomState.earlyFrom(서버 전용 원래 마감)과 방 DO maybeAdvanceEarly — applyVerdict(연장)·applyPick·applyAnswer(한 번) 수락 직후 호출"
  - "test/worker/earlyAdvance.test.ts 와 nightLeak 메타모픽 (iii), earlyFrom 서버 전용 이름 감시선 세 곳"
affects: [23-09, 23-10, 23-11, 23-12, 23-13]
status: complete
actuals:
  tokens: 40000
  tasks: 3
  commits: 6
plan_head_before: a31dca3665a10ae193e47bafa501d4ae313bfceb
plan_head_after: d4a20c9adea2f4cd4dac3faf6766afe865ee3978
tech-stack:
  added: []
  patterns:
    - "줄어드는 순간에만 persistAndBroadcast + reschedule — 값(phaseEndsAt)은 역할과 무관해 전원에게 같다. 그 밖의 행동 방송 규율은 그대로"
    - "원래 마감은 earlyFrom { phase, day, endsAt } 에 보관, 키가 다르면 무시하므로 지우지 않는다(다시 하기·대기실 복귀는 허용 목록 방식이라 새 판에 넘어가지 않음)"
    - "시험은 1.5초를 기다리지 않는다: 서버가 프레임에 싣는 serverNow 와 phaseEndsAt 을 비교하고, 다음 단계는 forceDue + 알람으로 넘긴다"
key-files:
  created:
    - shared/game/early.ts
    - test/unit/early.test.ts
    - test/worker/earlyAdvance.test.ts
  modified:
    - shared/game/room.ts
    - shared/game/phases.ts
    - shared/game/verdict.ts
    - worker/room.ts
    - test/worker/nightLeak.test.ts
    - test/worker/leak.test.ts
    - test/unit/view.test.ts
    - scripts/smoke.mjs
key-decisions:
  - "연장은 찬반만(D-25): 찬반 번복은 now + 1.5초로 다시 정하되 earlyFrom.endsAt 을 넘지 않는다. 밤·키워드는 처음 한 번만 줄이고 이후 같은 객체"
  - "earlyReady 는 연결 여부를 보지 않는다 — 끊긴 사람은 고르지 않아 조건이 참이 되지 않으므로 그 판은 정해진 시간을 다 쓴다(D-12)"
  - "키워드 조건은 산 사람 중 사람(봇 제외) 전원이 answerSubmits 에 있음, 사람 0명이면 거짓"
requirements-completed: [SC8]
---

# Phase 23 Plan 08: 전원이 끝내면 일찍 넘어간다 Summary

**키워드(사람 전원 확정)·찬반(산 사람 전원 투표)·밤(산 사람 전원 선택)에서 조건이 처음 참이 되는 순간 마감을 min(원래 마감, 지금 + 1.5초)로 줄여 전원에게 같은 phaseEndsAt 을 방송하고 알람을 옮기며, 찬반만 유예 중 번복을 연장한다(원래 마감 이내). 밤 조기 마감이 역할을 흘리지 않음을 역할만 다른 두 판 메타모픽 시험으로 고정했다.**

## 해낸 것

- **순수 규칙 (Task 1, D-11·D-12·D-25, Pitfall 5)**: `shared/game/early.ts` 의 `EARLY_GRACE_MS = 1_500`, `earlyReady`(keyword: 산 사람 중 봇이 아닌 사람 전원이 `answerSubmits` 에 있고 사람이 0명이면 거짓 / verdict: 산 사람 전원 `verdictVote` / night: 산 사람 전원 `nightPick` / 그 밖 단계 늘 거짓), `shrinkDeadline(state, now, { extend })`. 이미 같은 phase·day 의 `earlyFrom` 이 있고 `extend: false` 면 같은 객체, `now + 1500 ≥ 원래 마감` 이면 같은 객체, `extend: true` 는 `min(earlyFrom.endsAt, now + 1500)` 로 다시 정한다. 줄이면서 `botPlan.key` 를 `botPlanKey(결과)` 로 같이 갈아 끼워 `syncBotPlan` 이 계획을 다시 세우지 않는다. `RoomState.earlyFrom` 추가(서버 전용).
- **방 DO 배선 (Task 2)**: `maybeAdvanceEarly(now, { extend })` — `shrinkDeadline` 이 다른 객체를 주면 저장 상태를 바꾸고 `persistAndBroadcast()` + `reschedule()` 후 true. `applyVerdict`(castVerdict 수락 직후, `extend: true`, true 면 끝 / 아니면 기존 `persistAndBroadcast`), `applyPick`(`extend: false`, 아니면 기존 저장 + `sendViewTo(pickRecipientIds)`), `applyAnswer`(final 수락 직후 `extend: false`, 아니면 기존 본인 전송). 봇도 같은 apply* 본체를 지나므로 봇의 마지막 표·선택도 자동 처리된다. 0060-4 "조기 종료 없음 · 10초를 다 채운다" 문장을 인용하던 주석 셋(`applyVerdict` 위, `phases.ts` VERDICT_MS 줄, `verdict.ts` 머리)을 0089-26 조기 진행 설명으로 바꿨다(순수 castVerdict 는 마감을 건드리지 않는다는 사실은 남김). `applyAnswer` 위 주석의 "조기 진행 호출은 23-08 이 붙인다" 도 현재형으로 고쳤다.
- **누설 시험·감시선 (Task 3, D-13, T-23-28·31)**: `nightLeak.test.ts` 메타모픽 (iii) — 같은 4명·같은 좌석 순서(방장 좌석 0 이 마지막으로 고름)에서 방장 역할만 마피아/시민으로 바꾼 두 판의 마지막 선택 직후 프레임 열(소켓마다 정확히 `[state:night]` 한 장)·me 밖 키 집합·(phaseEndsAt − serverNow)가 같음, 줄어든 뒤 방장의 선택 변경은 마감 불변이고 마피아가 아닌 다른 소켓엔 프레임이 없음. `SERVER_ONLY_KEYS` 세 곳(leak.test·view.test·smoke)에 `earlyFrom` 을 더하고 view 단위 시험 하나(`earlyFrom` 이 있는 상태의 모든 viewer view 에 이름·값이 없음)를 추가했다. earlyAdvance 시험은 마감 단축 뒤 어느 소켓 프레임에도 `earlyFrom` 이 없음을 단언한다.

## 커밋

| 순서 | 해시 | 내용 |
| ---- | ---- | ---- |
| 1 (RED) | c25f4643 | `test(23-08): 조기 진행 순수 규칙 실패 시험` — early.ts 가 없어 파일 전체 실패 |
| 2 (GREEN) | 1a770b44 | `feat(23-08): 조기 진행 순수 규칙` |
| 3 (RED) | e9ca0dbc | `test(23-08): 조기 진행 방 DO 실패 시험` — 단축 3건 실패(키워드·찬반·밤), 끊김·연출 단계 불변·확정 뒤 연장 없음 6건은 이미 통과하는 방어 시험 |
| 4 (GREEN) | 0b147c2c | `feat(23-08): 전원이 끝내면 일찍 넘어간다 — 찬반·밤·키워드` |
| 5 (시험) | 3dfd71dd | `test(23-08): 밤 조기 마감 누설 시험` — 서버가 이미 맞아서 첫 실행에서 초록(아래 변이 확인) |
| 6 (GREEN) | d4a20c9a | `feat(23-08): 밤 조기 마감 누설 감시 — earlyFrom 서버 전용 이름` |

- **Task 3 RED 대신 변이 확인(계획 허용)**: 누설 시험이 처음부터 초록이라, 임시로 `applyPick` 을 "산 마피아가 고른 경우에만 `maybeAdvanceEarly`" 로 바꿔 돌렸다 — 메타모픽 (iii) 두 시험 모두 실패(시민이 마지막인 판에서 마감이 줄지 않아 프레임 열이 `[]` 가 되어 갈라짐). `git checkout -- worker/room.ts` 로 원복했고 `git status` 에서 worker/room.ts 가 HEAD 와 같음을 확인했다(커밋하지 않음).

## 검증 결과

| 확인 | 결과 |
| ---- | ---- |
| Task 1 automated: `early.test`·`bots.test` + typecheck | 통과(early.test 신규 포함, rematch 도 함께 140 통과), `error TS` 0 |
| Task 2 automated: `earlyAdvance`·`trial`·`night`·`keyword`(worker)·`verdictRule`(unit) + typecheck | 5 files · 102 tests 통과(1 skipped), `error TS` 0 |
| Task 3 automated: `nightLeak`·`leak`·`view` + `node --test scripts/smoke.test.mjs` + typecheck | 3 files · 157 tests 통과(13 skipped), smoke node 15/15, `error TS` 0 |
| `npx vitest run --project worker`(마지막 실행) | 48 files · 536 tests 통과(62 skipped) |
| `npx vitest run --project unit --project client` | 203 files · 6879 tests 통과(176 skipped) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 636/636 통과 |
| 승인 기준 grep | `export function shrinkDeadline` 1 · `EARLY_GRACE_MS = 1_500` 1 · `earlyFrom` room.ts 1·leak/view/smoke 각 1 이상 · `maybeAdvanceEarly(` worker/room.ts 4(정의 1 + 호출 3) · `10초를 다 채운다` 0 · `조기 종료 없이 마감까지` 0 · nightLeak `EARLY_GRACE_MS` 4 |

## 이 계획 때문에 바뀐 기존 시험

없음. 봇이 낀 기존 판 시험(bots·basicDay)의 마감 기대를 고칠 일이 없었다.

## Deviations from Plan

### Auto-fixed Issues

없음 — 계획대로 실행했다. 다음은 시험 설계상의 작은 선택이다.

**1. [시험 설계] 찬반 상한(원래 마감) 시험은 저장된 earlyFrom 을 손으로 낮춰 확인**
- 원래 마감이 10초 뒤라 실시간으로는 상한에 닿을 수 없어, 줄어든 뒤 `editRoom` 으로 `earlyFrom.endsAt` 을 현재 마감 + 5ms 로 바꾸고 번복해 마감이 정확히 그 값에서 멈춤을 확인했다. 순수 상한은 early.test 에서도 직접 검증한다.

**2. [시험 범위] 키워드 시험만 봇 1 포함(사람 3 + 봇 1), 찬반·밤은 사람 4명**
- 봇의 찬반·밤 계획은 실시간 난수 지연이라 worker 시험에서 결정적이지 않다. 봇의 마지막 표·선택이 조건을 채우는 경우는 같은 apply* 본체를 지나는 구조(코드 경로)와 early.test 의 봇 포함 `earlyReady`·봇 계획 키 단언으로만 지킨다.

## 이월 · 확인하지 못한 것

- **23-13**: `docs/decisions/0090-v3-single-flow-day-vote-will.md` 의 0090-4 줄에 "모두가 일찍 던져도 10초를 채운다" 가 남아 있다. 이 계획이 그 동작을 바꿨으므로 결정 표시(개정)는 23-13 이 한다(계획대로 코드 주석만 고침).
- **23-11**: 화면 막대(`data-early`·`calm`)와 틱 소리는 이 계획 범위 밖이다. 서버는 `phaseDurationMs` 를 단계 표 길이 그대로 두므로 막대는 0~1 로 미끄러진다(시험이 `phaseDurationMs` 불변을 단언함).
- **23-12 E2E**: 실시간 1.5초 확인은 이 계획에서 하지 않았다(시험은 serverNow 기준 + forceDue). E2E 스크립트(`scripts/e2e`)의 "전원 투표 뒤 10초 대기" 가정은 점검하지 않았고 브라우저 E2E·로컬 dev 서버·실기기·배포도 하지 않았다(사용자 지시: 배포 없음, 실기기는 끝에).
- **`execution` 단계 worker 수준 불변 시험 없음**: 계획이 적은 dayAnnounce·morning·answerReveal 은 실제 방 DO 에서 어떤 개인 행동 메시지(verdict·pick·answer)로도 마감이 안 줄음을 확인했다. execution 은 `earlyReady` 단위 시험(7개 단계 거짓)만 있다.
- **알려진 부하 간헐**: `basicDay.test` "토론 끝내기 과반 → 찬반 … 밤" 이 첫 전체 worker 실행에서 한 번, 단독 3회 중 1회 `expected 'ended' to be 'night'` 로 실패했다. 무작위 역할 배정에서 처형자가 마지막 마피아라 판이 끝나는 경우이며(23-06 요약에 적힌 같은 간헐), 조기 진행과 무관하다 — 같은 파일 단독 재실행에서 통과했고 마지막 전체 worker 실행은 전부 통과했다. 이 파일을 베이스라인(이 계획 이전 HEAD)에서 따로 돌려 대조하지는 않았다.
- **계획 커밋 장부(0c)**: `gsd-plan-head-before` 장부 파일은 만들지 않고, 첫 커밋 전 HEAD(`a31dca36`)를 frontmatter `plan_head_before` 로 직접 적었다. `commits: 6` 은 `git rev-list --count c25f4643^..d4a20c9a` 로 센 값이다(이 SUMMARY 커밋은 제외).
- `.planning/state.json`·`Claude outputs/` 는 이 계획의 변경이 아니라서 스테이징하지 않았다. STATE.md·ROADMAP.md 도 건드리지 않았다(오케스트레이터 소유).

## Known Stubs

없음.

## Threat Flags

없음. 새 표면은 계획의 위협 모델이 다룬 "개인 행동 → 공개 마감 시각" 한 곳뿐이다: T-23-28 종료 = 마지막 행동 + 1.5초·전원 방송·밤 연장 없음·nightLeak 메타모픽(변이로 빨개짐 확인), T-23-29 연장 상한 = `earlyFrom.endsAt`(early.test·earlyAdvance), T-23-30 봇 계획 키 같이 갈기(early.test), T-23-31 earlyFrom 서버 전용 이름 감시선 세 곳, T-23-SC 패키지 설치 없음.

## Self-Check: PASSED

- 파일 존재: shared/game/early.ts · shared/game/room.ts · worker/room.ts · test/unit/early.test.ts · test/worker/earlyAdvance.test.ts · test/worker/nightLeak.test.ts · test/worker/leak.test.ts · test/unit/view.test.ts · scripts/smoke.mjs
- 커밋 존재: c25f4643 · 1a770b44 · e9ca0dbc · 0b147c2c · 3dfd71dd · d4a20c9a
