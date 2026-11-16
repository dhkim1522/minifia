---
phase: 24-suspect-note-tutorial
plan: "02"
subsystem: leak-guard
tags: [suspect-note, leak-test, view-keys, d1, note-count]
status: complete
requires: ["24-01"]
provides:
  - "view.test·leak.test 서버 전용 키 목록에 notes, view 허용 키에 suspectTo·suspects·suspectLog"
  - "test/worker/suspectLeak.test.ts — 마피아·시민 프레임·거절 동일, notes 키 부재"
  - "scripts/e2e/lib.mjs VIEW_ME_KEYS·VIEW_DAY_KEYS 사본 정렬"
  - "buildGameRow note_count = notes 길이"
affects: [24-03, 24-12]
actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: 0ba622a5
plan_head_after: 9122922c9167512391666b46c6f812875164c61c
tech-stack:
  added: []
  patterns:
    - "마피아·시민 대조: 보낸 사람·지켜본 사람 프레임 열(summary)과 view 모양(top·me·day·players 키 경로, 역할 의존 me 키 제외) 비교"
key-files:
  created:
    - test/worker/suspectLeak.test.ts
  modified:
    - test/unit/view.test.ts
    - test/worker/leak.test.ts
    - scripts/e2e/lib.mjs
    - shared/game/gameLog.ts
    - test/unit/gameLog.test.ts
    - test/worker/gameLog.test.ts
key-decisions:
  - "leak.test 의 ALLOWED_WIRE_PATHS 에는 세 공개 경로를 넣지 않았다 — day.suspects·day.suspectLog·me.suspectTo 는 SERVER_ONLY_KEYS 이름과 겹치지 않아 예외가 필요 없다(주석으로 남김)"
  - "e2eContract.test.ts 는 고치지 않았다 — lib.mjs 사본이 view.test 집합과 자동 정렬 비교된다"
metrics:
  completed: 2026-11-17
---

# Phase 24 Plan 02: 의심 누설 감시선과 D1 포스트잇 수 Summary

24-01 이 연 공개 값(`day.suspects`·`day.suspectLog`·`me.suspectTo`)과 서버 전용 이름 `notes` 에 단위·워커 누설 감시선을 세우고, E2E 의 view 키 사본을 맞추고, D1 `note_count` 를 `state.notes?.length ?? 0` 으로 채웠다.

## 수행한 일

| 작업 | 커밋 | 내용 |
|------|------|------|
| T1 RED | c0a309d1 | view.test 키 목록·새 describe 4건, leak.test 에 notes, 새 suspectLeak.test |
| T1 GREEN | 28563628 | scripts/e2e/lib.mjs 사본에 suspectTo·suspects·suspectLog |
| T2 RED | 3e1b3682 | gameLog unit 시험 교체·추가, worker D1 시험 추가 |
| T2 GREEN | 9122922c | gameLog.ts note_count 계산 + 주석 |

## RED 증거 (정직하게)

- **Task 1:** 앱 코드는 24-01 에서 이미 맞아 view·leak·suspectLeak 시험은 처음부터 초록이었다(회귀 방지 시험). 의미 있는 RED 는 `e2eContract.test.ts` 의 사본 정렬 대조 하나였다 — view.test 의 `ME_KEYS` 에 `suspectTo` 를 더하자 `lib.mjs` 의 `VIEW_ME_KEYS` 에 없어서 실패(`-"suspectTo"` 차이, 1 failed / 210 passed).
- **Task 2:** unit 1건(`note_count` 3 기대, 0 받음)과 worker 1건(둘째 날 붙이고 옮긴 판 D1 행 `note_count` 1 기대, 0 받음) 실패 확인 후 GREEN.

## 시험 내용

- **view.test(새 describe 4건):** 1일차 한 줄·2일차 두 줄 상태에서 `day.suspects` 는 오늘 두 줄만 `{to, from}`, `day.suspectLog` 는 세 줄 `{n, from, to}`, 마피아·시민 값 동일. `me.suspectTo` 는 오늘 붙인 산 본인 discussion 에만(탈락자·어제만 붙인 좌석·남에게는 키 없음). verdict 에는 suspectTo 없고 suspects 남음. 밤·아침에도 그날 `day.suspects` 가 남는 것을 의도로 단언(RESEARCH P1 285행), 다음 일차(`day` 3)에서는 `suspects` 키가 사라지고 기록만 남음. 여섯 단계 모든 view 의 키 경로에 `notes` 없음.
- **suspectLeak.test(워커 6건):**
  - 마피아 M·시민 C 가 각자 붙였을 때 보낸 사람 프레임 열(`[state:discussion]`)과 view 모양(역할 의존 me 키 `role·allies·records·allyPicks` 제외)이 같고, 지켜본 마피아 동료·시민도 같은 프레임이며 `day.suspects`·`suspectLog` 동일.
  - 붙이기·옮기기·찬반 단계까지 판 전체에서 모든 소켓 프레임에 `"notes"` 문자열·키 없음(공개 값이 실제로 왔음도 확인).
  - 거절 사유 넷(멀리·죽은 대상·자기 자신·찬반 단계)마다 M·C 응답이 `[error:BAD_MESSAGE,state:…]` 로 같고 오류 프레임 JSON 까지 같으며 다른 소켓은 0프레임. 거절된 판에도 notes 키 없음.
- **gameLog:** unit(notes 세 줄 → 3, `[]`·없음 → 0, tutorial 0, 행에 `from` 문자열 없음), worker(둘째 날 한 명이 붙이고 옮긴 뒤 판 끝 → D1 `note_count` 1, `tutorial` 0).

## 검증 (실제로 돌린 것)

- `npx vitest run test/unit/view.test.ts test/unit/e2eContract.test.ts`: 211 통과.
- `npx vitest run --project unit`(전체): 132 파일 통과 / 1 건너뜀, 4405 통과.
- `npx vitest run --project worker test/worker/leak.test.ts test/worker/suspectLeak.test.ts`: 통과. 함께 `suspect.test.ts`·`keywordLeak.test.ts` 4파일 42 통과 / 2 건너뜀.
- `npx vitest run test/unit/gameLog.test.ts`: 16 통과. `--project worker test/worker/gameLog.test.ts test/worker/d1.test.ts`: 10 통과.
- `node --test scripts/e2e/lib.test.mjs`: 388 통과.
- `npm run typecheck`: 종료 0(커밋마다).
- `git status --porcelain -- migrations`: 빈 출력(마이그레이션 불변). `grep -c '"notes"'` view.test·leak.test, `suspectLog`(lib.mjs), `notes?.length`(gameLog.ts) 모두 1 이상.
- 커밋 전 위생 grep(바뀐 파일 전부) 결과 없음.
- 워커 전체 실행은 하지 않았다(이 계획 파일과 인접 누설 시험만). 알려진 간헐 실패 파일은 이 실행에서 나오지 않았다.

## 계획과 다르게 한 것 / 편차

- 모든 `[Rule N]` 해당 없음 — 계획대로 실행했다.
- 계획 문구의 "leak.test 허용 와이어 경로에 세 경로를 이유와 함께 더한다" 는 필요 없었다(세 경로는 서버 전용 이름과 겹치지 않음). 대신 SERVER_ONLY_KEYS 주석에 그 사실을 적었다.
- 계획 순서 메모: `plan_head_before` 원장 파일을 만들지 않아 `commits` 는 시작 HEAD(0ba622a5)에서 `git rev-list --count` 로 직접 측정했다(4).

## 돌리지 못한 것 / 다음 계획으로

- 브라우저 E2E·배포본 확인은 이 계획 범위가 아니다(화면 없음).
- `lib.mjs` 사본이 맞아 24-03 이후 E2E 가 `suspects`·`suspectLog`·`suspectTo` 를 정상 키로 본다.

## Known Stubs

없음.

## Threat Flags

없음 — T-24-06·T-24-07·T-24-08 을 시험·한 줄 코드로 덮었고 새 표면은 없다.

## Self-Check: PASSED

- 파일 존재: test/worker/suspectLeak.test.ts, shared/game/gameLog.ts, scripts/e2e/lib.mjs 확인.
- 커밋 존재: c0a309d1, 28563628, 3e1b3682, 9122922c 가 HEAD 의 조상임을 확인.
