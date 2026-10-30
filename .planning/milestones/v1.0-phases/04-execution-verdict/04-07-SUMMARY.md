---
phase: 04-execution-verdict
plan: 07
subsystem: game-server
tags: [candidate-vote, websocket, durable-object, endgame, alarm, workerd-integration, tdd]

requires:
  - phase: 04-execution-verdict
    provides: "04-01 execVote 배선·스키마, 04-04 castCandidateVote·공개/처형 진입 훅·view, 04-05 변론 템플릿·say 후보 검사, 04-06 승패 판정·enterEnded(만료 + 30분)·view.result"
provides:
  - "ClientMessage { t: 'candidateVote', target } 와 strictObject 스키마, DO handleCandidateVote(껍데기)/applyCandidateVote(본체) — 받아들여진 후보 선택은 투표자 소켓 한 개에만 state"
  - "test/worker/helpers.ts 소켓 도우미: mark, settle, summary, lastViewOf, actorsOf, closePhase, voteExec, voteCandidate (+ StoredRoom 선택 필드)"
  - "vote.test.ts 후보 선택·공개·변론·처형·처형 무효 이유(noExecution) workerd 증명, endgame.test.ts 두 종료 경로·결과 방송·30분 알람·만료 닫힘·종료 중 재접속·끊긴 생존자 계산"
affects: [04-08, 04-09, 04-10, 화면 계획(후보 선택·결과 화면)]

actuals:
  tokens: 8500
  tasks: 2
  commits: 6
plan_head_before: a3c7f9bd668903fe2cd13f352d3d43b5ee9d1e89
plan_head_after: b6f378c31b8ee70c6b645809b122cad8a717a6e7
commits: 6

tech-stack:
  added: []
  patterns:
    - "받는 사람을 가장 좁게: 후보 선택 진행은 sendViewTo([playerId]) 한 명 — 관전자도 제외(전원 방송은 타이밍을 흘린다, Pitfall 7)"
    - "투표로 단계를 넘기는 소켓 도우미(voteExec·voteCandidate)는 보낸 뒤 각자 flush → 마감 당김 + 알람 → 모두가 다음 단계 state 를 받을 때까지 기다리고 당긴 마감 시각을 돌려준다"
    - "종료 방 정리는 DO 변경 없이 tick → enterEnded(expiresAt 앞당김) → reschedule 로 알람이 옮겨지고, 만료는 기존 advance 가 닫는다"

key-files:
  created:
    - test/worker/endgame.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - worker/room.ts
    - test/worker/helpers.ts
    - test/worker/vote.test.ts
    - HANDOFF.md

key-decisions:
  - "후보 선택 수신자는 투표자 본인 한 명(관전자 제외). 바꾸려면 applyCandidateVote 한 곳 (A7, 결정 0036 기본값)"
  - "변론 say·이모티콘 경로와 종료·알람 경로는 DO 변경 없이 소켓 테스트로 확인했다"

requirements-completed: []
requirements-server-rules-done: [VOTE-02, VOTE-03, VOTE-04, COMM-03, END-01, END-02, CONN-02]  # 서버·소켓 증명만. 후보 선택·변론·결과 화면은 화면 계획 몫이라 REQUIREMENTS 체크박스는 열어 둔다

coverage:
  - id: D1
    description: "후보 선택은 투표자 소켓에만 state(me.voteTarget)가 가고 다른 다섯 소켓과 대상 소켓은 프레임이 없다. 같은 값 재전송은 투표자도 프레임이 없다. 자기 자신은 투표자만 BAD_MESSAGE+state, 범위 밖·문자열·덧붙은 키는 BAD_MESSAGE 뿐, execVote 단계는 WRONG_PHASE+state"
    requirement: "VOTE-02"
    verification:
      - kind: integration
        ref: "test/worker/vote.test.ts#후보 선택은 투표자에게만 (VOTE-02, D-03, D-19, A7)"
        status: pass
    human_judgment: false
  - id: D2
    description: "공개 구간에 여섯 소켓이 같은 순서의 cand.votes·같은 day.candidate 를 받고 phaseDurationMs 4000, 공개 중 say·이모티콘은 보낸 소켓에만 거부"
    requirement: "VOTE-02"
    verification:
      - kind: integration
        ref: "test/worker/vote.test.ts#선택 공개 (VOTE-02, D-20, D-21)"
        status: pass
    human_judgment: false
  - id: D3
    description: "최후 변론: 후보 say 는 전원 chat, 비후보 say 는 그 소켓만 WRONG_PHASE+state, 비후보 이모티콘은 전원, 후보의 낮 템플릿은 BAD_MESSAGE"
    requirement: "COMM-03"
    verification:
      - kind: integration
        ref: "test/worker/vote.test.ts#최후 변론 (COMM-03, VOTE-03, D-13)"
        status: pass
    human_judgment: false
  - id: D4
    description: "처형: 여섯 소켓 모두 후보 alive false·day.execution{seat, phrase 1..4}, 살아 있는 소켓 프레임 전체에 역할 단어가 허용 경로 밖에 없고 spectate 도 없으며 처형된 소켓만 관전(seats 6), 처형 중 say·이모티콘 거부"
    requirement: "VOTE-04"
    verification:
      - kind: integration
        ref: "test/worker/vote.test.ts#처형 발표 (VOTE-04, D-09, D-34)"
        status: pass
    human_judgment: false
  - id: D5
    description: "처형 무효 이유: 동률 tie·0표 noVotes·여부 미통과 notMajority 가 night 의 모든 소켓에 같게 가고, 아침 state 와 처형이 이뤄진 날의 night 에는 noExecution 키가 없다"
    requirement: "VOTE-02"
    verification:
      - kind: integration
        ref: "test/worker/vote.test.ts#처형이 성립하지 않은 밤 (D-34)"
        status: pass
    human_judgment: false
  - id: D6
    description: "처형으로 끝나는 판과 아침으로 끝나는 판 모두 네 소켓이 같은 ended result(winner·직업 4개·날짜별 요약)를 받고, 저장 만료와 알람이 종료 진입 + 30분이다"
    requirement: "END-01"
    verification:
      - kind: integration
        ref: "test/worker/endgame.test.ts#처형으로 끝나는 판 / 아침으로 끝나는 판"
        status: pass
    human_judgment: false
  - id: D7
    description: "종료 중 say·emoji·execVote 는 보낸 소켓에만 WRONG_PHASE, 일반 방 testSkip 은 BAD_MESSAGE 뿐, 같은 토큰 재접속은 같은 result, 만료 알람은 모든 소켓을 4003 room_closed 로 닫고 미리보기 404"
    requirement: "END-02"
    verification:
      - kind: integration
        ref: "test/worker/endgame.test.ts#종료 중 (D-28)"
        status: pass
    human_judgment: false
  - id: D8
    description: "끊긴 생존자도 센다: 끊긴 시민이 있어도 처형으로 끝나는 판은 citizenWin, 끊긴 경찰을 센 덕에 시민 처형 뒤 1 vs 2 로 끝나지 않고 밤으로 간다"
    requirement: "CONN-02"
    verification:
      - kind: integration
        ref: "test/worker/endgame.test.ts#끊긴 생존자도 센다 (CONN-02, D-05)"
        status: pass
    human_judgment: false

duration: 약 6분
completed: 2026-10-28
status: complete
---

# Phase 4 Plan 07: 후보 선택 배선·공개·변론·처형·종료 소켓 증명 Summary

**후보 선택 메시지(`candidateVote`)를 와이어·스키마·DO 에 배선해 받아들여진 진행을 투표자 소켓 한 개에만 보내고, 공개·변론·처형·처형 무효 이유와 처형·아침 두 종료 경로(결과 방송·진입 + 30분 알람·만료 4003 닫힘·재접속·끊긴 생존자 계산)를 실제 workerd 방에서 증명했다.**

## 진행 기록

Task 1 — RED 7a73d81 / GREEN 51c5f5f / worker 164 통과(vote.test.ts 23: 신규 13), unit 987 통과, tsc app·worker 0 / 체크포인트 10f7934.
Task 2 — RED 8d15bb3 / GREEN 7e4ddb2 / worker 171 통과, `npm test` 87 파일 2113 통과, tsc app·worker 0 / DO 변경 없음 / 남은 태스크 없음. HANDOFF 진행 줄 b6f378c.

## Accomplishments

- `shared/protocol.ts`·`shared/schemas.ts`: `{ t: "candidateVote"; target: number }` 와 `z.strictObject({ t, target: int 0..7 })`. 덧붙은 키·문자열 대상은 스키마가 거부한다(T-04-23).
- `worker/room.ts`: `case "candidateVote"`(never 검사 통과), 껍데기 `handleCandidateVote`(오류는 `sendRejection`), 본체 `applyCandidateVote` — `castCandidateVote` → 같은 객체면 저장·전송 없음 → 저장 → `sendViewTo([playerId])`. 관전자에게도 보내지 않는 이유(A7·Pitfall 7)를 주석에 적었다. 마감이 바뀌지 않아 `reschedule` 은 부르지 않는다.
- `test/worker/helpers.ts`: `mark`·`settle`·`summary`·`lastViewOf`·`actorsOf`·`closePhase`·`voteExec`·`voteCandidate`·`Actor`, `StoredRoom` 에 `voteLog?`·`winner?`·`verdict?` 와 플레이어 `execVote?`·`candidateVote?`·`alive?`. `night.test.ts` 는 건드리지 않았다.
- `test/worker/vote.test.ts`: 04-01 의 지역 `summary`·`settle`·`mark` 를 helpers 로 옮기고 후보 선택·공개·변론·처형·처형 무효 이유 13개를 더했다.
- `test/worker/endgame.test.ts`(신규): 4명 방(마피아 1·경찰 1·시민 2)에서 처형으로 끝(citizenWin)·아침으로 끝(mafiaWin) 두 경로를 끝까지 돌리고 종료 중 거부·재접속·만료 닫힘·끊긴 생존자(두 시나리오)를 확인한다.

## TDD 기록

**Task 1 RED** (`test(04-07)`, 7a73d81): `npx vitest run --project worker test/worker/vote.test.ts --reporter=tap-flat`, 종료 코드 1, 23개 중 신규 13개 가운데 10개 실패(`candidateVote` 가 스키마에 없어 BAD_MESSAGE 가 되거나, 후보가 없어 변론 단계에 닿지 못해 `expected 'claim' to be 'defense'` 등). 기존 10개와 신규 3개(공개 중 say·이모티콘 거부, 후보 0표 noVotes, 여부 미통과 notMajority — 배선 없이도 맞는 부정 가드)는 통과. 의미 점검: 실패 이유는 모듈 로드·픽스처 오류가 아니라 배선 부재다.
**Task 1 GREEN** (`feat(04-07)`, 51c5f5f): 23/23 통과. 첫 실행은 `castCandidateVote` import 누락(`ReferenceError`)으로 전부 실패 — import 한 줄 추가 후 통과(테스트 변경 없음).

**Task 2 RED** (`test(04-07)`, 8d15bb3): `npx vitest run --project worker test/worker/endgame.test.ts --reporter=tap-flat` 첫 실행에서 7/7 통과 — 순수 규칙(04-06)이 이미 있고 DO 가 그대로 돌기 때문이다. 테스트가 실패할 수 있음을 보이려고 의도적 변이 두 개를 로컬로 넣었다가 되돌렸다(커밋 안 함):
- `ENDED_ROOM_TTL_MS` 를 0 으로: 5개 실패 — 예 `actual: "1793165145644 null"` / `expected: "1793166945644 1793166945644"`(만료·알람이 E + 30분이 아님).
- `checkWinner` 가 연결된 생존자만 세도록: 끊긴 경찰 테스트가 실패(밤으로 가야 할 판이 ended 로 감).
**Task 2 GREEN** (`test(04-07)`, 7e4ddb2): DO 변경 없음. 아침 단언을 `morning.eliminated` 로 단순화하고 30분 상수에 이름을 붙이는 테스트 정리만 했다. worker 171 통과.

**REFACTOR**: 없음.

## Verification

| 명령 | 결과 |
|---|---|
| `npx vitest run --project worker test/worker/vote.test.ts` | 23 passed |
| `npx vitest run --project worker test/worker/endgame.test.ts` | 7 passed |
| `npx vitest run --project worker` | 16 파일 171 passed |
| `npx vitest run --project unit` | 987 passed |
| `npm test` | 87 파일 2113 passed, 실패 0 |
| `npx tsc -p tsconfig.worker.json --noEmit` | 종료 코드 0 |
| `npx tsc -p tsconfig.app.json --noEmit` | 종료 코드 0 |
| `npx vitest run test/unit/handoff.test.ts` | 2 passed, HANDOFF 2727바이트 |

수용 기준 그렙: `case "candidateVote"` room.ts 1, `sendViewTo([playerId])` room.ts 1(기준선 0), `t: z.literal("candidateVote")` schemas.ts 1, `1_800_000` endgame.test.ts 1, `citizenWin|mafiaWin` endgame.test.ts ≥ 2, `04-07 까지 완료` HANDOFF 1. `test(04-07): candidate vote` 커밋(7a73d81)이 `feat(04-07): wire candidate vote`(51c5f5f)보다 먼저다.

## 계획과 달라진 점·알아 둘 것

- **`voteExec`/`voteCandidate` 가 단계까지 넘긴다.** 계획 문구는 "보낸 뒤 각자 flush" 만 있었으나 아티팩트 설명("투표로 단계를 넘기는 도우미")에 맞춰 flush 뒤 마감 당김 + 알람 + 다음 단계 state 대기까지 하고 당긴 마감 시각을 돌려준다. 계획에 없던 `closePhase(code)` 를 함께 내보냈다(처형 마감 시각 E 가 필요해서).
- **종료 경로는 DO 변경이 필요 없었다.** 계획 예상대로 `tick → enterEnded → reschedule` 이 알람을 옮기고 종료 중 메시지는 기존 규칙(WRONG_PHASE)이 막는다. 변론 say·이모티콘 경로도 그대로다.
- **이모티콘 거부는 error 만, say 거부는 error + state** 다(기존 `handleEmoji`/`handleSay` 규칙 그대로). 테스트가 그 차이를 단언한다.
- 후보 선택 `applyCandidateVote` 는 봇이 아직 쓰지 않는다(`actAsBot` 은 BotAct 에 `candidateVote` 가 없다). 봇 투표는 04-08.

## Deviations from Plan

### Auto-fixed Issues

없음 - 계획대로 실행했다. 위 "계획과 달라진 점" 은 도우미 범위의 해석이며 규칙·범위 변화가 아니다.

## Known Stubs

없음. 후보 선택 화면·결과 화면은 화면 계획(시안 승인 → `/gsd-ui-phase 4` 뒤) 몫이다.

## Threat Flags

없음. T-04-22(후보 선택 진행 누출)는 `sendViewTo([playerId])` 와 다섯 소켓 `[]` 단언으로, T-04-23(남의 이름)은 메시지에 seat·id 가 없고 strictObject 인 것으로, T-04-24(비후보 변론)는 순수 규칙 + 소켓 `[]` 단언으로, T-04-25(처형 프레임 직업)는 살아 있는 소켓의 전체 프레임 역할 단어 경로 검사로, T-04-26(종료 방 점유)은 E + 30분 알람·만료 4003 닫힘 테스트로 닫았다. 전수 누출 검사는 04-09 몫. 새 패키지 설치 없음(T-04-SC).

## Next Phase Readiness

Ready for 04-08(봇·테스트 도구). 서버 와이어(여부 투표·후보 선택)와 공개·변론·처형·종료가 실제 소켓에서 결정 0036 의 받는 사람 규칙대로 돈다. 봇이 `candidateVote`/`execVote` 를 하려면 `BotAct` 에 행동을 더하고 `actAsBot` 에서 `applyCandidateVote`/`applyExecVote` 를 부르면 된다(never 검사가 빠뜨림을 잡는다). 배포는 하지 않았다(D-26). 이 웨이브의 push 는 메인 작업 트리 main 에서 계획대로 올린다.

## Self-Check: PASSED

- 파일 존재: `test/worker/endgame.test.ts`, `test/worker/helpers.ts`, `test/worker/vote.test.ts`, `worker/room.ts`, `shared/protocol.ts`, `shared/schemas.ts` 확인.
- 커밋 존재: 7a73d81, 51c5f5f, 10f7934, 8d15bb3, 7e4ddb2, b6f378c 모두 HEAD 의 조상.
