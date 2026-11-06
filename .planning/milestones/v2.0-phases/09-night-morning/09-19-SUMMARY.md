---
phase: 09-night-morning
plan: "19"
subsystem: smoke-script
tags: [smoke, websocket, night, morning, will, tracer, leak-check]
status: complete

requires:
  - phase: 09-night-morning
    provides: 전원 일치 확정 (09-07), 아침 길이 morningMsOf (09-07), 밤 진입 world snap (09-09), will 메시지 (09-12), 아침 카드 chat 프레임 (09-14), 서버가 phrase 를 안 채움 (09-07·09-18)
provides:
  - scripts/smoke.mjs — 새 밤·아침 규칙의 실제 WebSocket 한 판 검사 (v1.0 아침 문구 번호 검사 삭제, 아침 대기 15초 + 여유, nightNote 서버 전용 키)
  - 시민 편 밤 무프레임·밤 진입 snap 본인 한 칸·유언 사전 누설 없음·유언 카드·아침 길이 9000 검사
affects: [09-23]

actuals:
  tokens: 2330
  tasks: 2
  commits: 2
plan_head_before: 29fa21e01a894adc75af6151c3677c599c5956ef
plan_head_after: f29aa69d0d6b6831005352aa077cb00c3a79c2d9

tech-stack:
  added: []
  patterns:
    - "서버가 만든 사망 카드 줄(k:\"will\")만 chat·chatLog 줄 키 집합에 k 를 더 싣는다(lineKeys 도우미). 일반 줄에 k 가 있으면 실패"
    - "ch all 의 seq 는 일반 줄과 카드가 공유한다: 일반 줄 1..4 다음 유언 카드 5번"

key-files:
  created: []
  modified:
    - scripts/smoke.mjs

key-decisions:
  - "smoke 의 첫 밤 피해자(targetX)는 처형 대상을 뺀 가장 작은 seat 의 시민이며, 유언 저장자와 같은지 스크립트가 단언한다(가정 A2)"
  - "밤 진입 snap 은 execution 단계 state 이후 아침 state 이전에 받은 마지막 world snap 으로 잡는다(전송 순서에 기대지 않음)"

patterns-established:
  - "스크립트는 TS 를 import 하지 않으므로 서버 상수(MORNING_MAX_MS 15000)는 사본을 주석과 함께 둔다"

requirements-completed: []

coverage:
  - id: D1
    description: "smoke full 이 새 규칙(아침 문구 없음·전원 일치·아침 15초 대기)으로 ended 까지 돈다"
    requirement: "NIGHT-08"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs http://localhost:5173 --stage full --players 5 (6 도 통과)"
        status: pass
  - id: D2
    description: "시민 편 밤 진입 snap 본인 한 칸, snap 뒤 아침 전 world·typing·mafia chat 0프레임"
    requirement: "NIGHT-07"
    verification:
      - kind: e2e
        ref: "scripts/smoke.mjs (15a)"
        status: pass
  - id: D3
    description: "유언 사전 누설 없음, 아침 전원 k will 카드, 아침 길이 9000, day.morning 키 eliminated 하나"
    requirement: "WILL-01"
    verification:
      - kind: e2e
        ref: "scripts/smoke.mjs (유언·아침 검사)"
        status: pass
---

# Phase 9 Plan 19: smoke 를 새 밤·아침 규칙에 맞춤 Summary

실제 WebSocket 한 판(smoke full)이 새 밤·아침 규칙으로 ended 까지 돌고, 시민 편 밤 무프레임과 유언 카드·아침 길이 9000 을 프로토콜 수준에서 확인한다. 배포본 smoke(09-23)의 근거다.

## 수행한 일

- **Task 1 (tracer, 2d92f39)**: 아침 문구 번호 상수·단언 삭제(결정 0061-17), `MORNING_WAIT_MS = 15_000 + STATE_LIMIT_MS`(`MORNING_MAX_MS` 사본 주석), `SERVER_ONLY_KEYS` 에 `nightNote` 추가, 첫 밤 마피아 전원 일치 선택에 결정 0061-6 표시. 문구가 없어진 아침 길이 단언은 7000(기본 5 + 피해자 2)으로 임시 개정.
- **Task 2 (f29aa69)**: 첫 토론에 피해자가 될 시민이 `{t:"will"}` 저장 → 본인 `me.will` 확인, 다른 클라이언트 프레임에 본문 없음. 밤 진입 snap 본인 한 칸 + 그 뒤 아침 전 world·typing·mafia chat 0프레임. 아침 `day.morning` 키 `eliminated` 하나, `phaseDurationMs` 9000(피해자 + 유언), 모든 클라이언트(탈락자 포함)가 `k:"will"`·피해자 seat·본문 카드 수신. 카드 줄이 생겨서 chat·chatLog 키 집합 검사(`lineKeys`)·ch all 일반 줄 검사·산 시민 편 재접속 chatLog 기대값(낮 줄 4 + 유언 카드)을 함께 고쳤다.

## 검증

- `node scripts/smoke.mjs http://localhost:5173 --stage full --players 5` 통과(Task 1·2 후 각 1회), `--players 6`(마피아 2명 전원 일치) 통과.
- `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 195건 통과.
- `grep -c PHRASE scripts/smoke.mjs` 0, `"nightNote"`·`15_000 + STATE_LIMIT_MS`·`스모크 유언`·`9_000` 존재.

## Deviations from Plan

None - 계획대로 실행. (카드 줄 때문에 필요한 chat·chatLog 키/기대값 개정은 계획의 "유언 카드 확인"에 딸린 같은 파일 변경이다.)

## 이월

- `scripts/uat-night.mjs` 가 아직 아침 `phrase` 를 단언한다(이 계획 범위 밖, 09-22 에서 고칠 것).
- 요구사항 완료 처리 없음: 이 계획은 확인 스크립트라 NIGHT-07·08·MORN-02·04 는 앞선 계획에서 이미 완료, WILL-01 은 공유 ID 게이트로 마지막 계획(09-23) 뒤 오케스트레이터가 처리.

## Known Stubs

없음.

## Threat Flags

없음 (T-09-42 완화: 서버 전용 키 목록은 늘리기만 했고 시민 편 밤 무프레임·유언 사전 누설 검사를 더함).

## Self-Check: PASSED

- scripts/smoke.mjs 존재, 커밋 2d92f39·f29aa69 HEAD 조상 확인.
