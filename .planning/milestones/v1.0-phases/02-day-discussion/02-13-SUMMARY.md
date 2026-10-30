---
phase: 02-day-discussion
plan: 13
subsystem: nickname-rules
tags: [nickname, validation, copy, tdd, gap-closure]
gap_closure: true
gap_ids: [G-02-1]
status: complete

requires:
  - phase: 01-walking-skeleton
    provides: shared/nickname.ts validateNickname (서버·클라이언트 공용), 방 만들기·참가 API 의 NICKNAME_INVALID 거부
provides:
  - NICKNAME_MAX_GRAPHEMES 5 (결정 0017-4) — 6글자부터 TOO_LONG, 서버 API 400 NICKNAME_INVALID
  - 닉네임 길이 안내 문구 "1~5자로 입력해 주세요", 링크 참가 입력칸 힌트 "1~5자로 입력"
affects: [02-14, 02-16, 02-17, 02-18]

requirements-completed: [DAY-02, COMM-01]

actuals:
  tokens: 3500
  tasks: 2
  commits: 4
plan_head_before: a5a79c561b545553f2cb0dfce15f9948e09de553
plan_head_after: 5f2608a20205c63b802d9b106ec1c23b904105e8

tech-stack:
  added: []
  patterns:
    - "닉네임 규칙은 shared/nickname.ts 한 곳만 바꾼다 — 서버(방 만들기·참가)와 클라이언트 입력 검사가 같은 함수를 쓴다"

key-files:
  created: []
  modified:
    - shared/nickname.ts
    - src/net/copy.ts
    - src/screens/JoinByLink.tsx
    - test/unit/nickname.test.ts
    - test/unit/gameRoom.test.ts
    - test/unit/copy.test.ts
    - test/worker/join.test.ts
    - test/client/joinByLink.test.tsx
    - test/client/screens.test.tsx

key-decisions:
  - "닉네임 최대 길이 8 → 5 그래핌 (결정 0017-4). 그래핌 세기·NFC·공백 압축·숨은 글자 거부 규칙은 그대로, 최대 개수 하나만 바꿨다"

duration: 약 10분
completed: 2026-10-24
---

# Phase 2 Plan 13: 닉네임 5자 제한 Summary

**공용 `NICKNAME_MAX_GRAPHEMES` 를 8에서 5로 줄여 서버 참가 API 가 6글자 이상을 400 NICKNAME_INVALID 로 거부하고, 안내 문구·입력 힌트를 "1~5자"로 맞췄다.**

## 수행 내용

- **Task 1 (트레이서)**: `shared/nickname.ts` 상수 5 와 결정 0017-4 주석. 단위 테스트(5글자 통과, 6글자 TOO_LONG, 가족 이모지 5개 통과·6개 TOO_LONG)와 워커 통합 테스트(6글자 참가 400 NICKNAME_INVALID, 5글자 통과)로 고정. 화면 검사를 건너뛴 직접 요청도 서버가 같은 규칙으로 막는다 (T-02-39).
- **Task 2**: `src/net/copy.ts` 의 `NICKNAME_RANGE_TEXT` 와 `JoinByLink.tsx` 의 placeholder 를 1~5자로. `copy.test.ts`, `joinByLink.test.tsx`(placeholder 단언 추가), `screens.test.tsx`(9글자 케이스를 6글자 `가나다라마바` 로) 갱신.

## 커밋

| 커밋 | 내용 |
| --- | --- |
| 660a7c0 | test(02-13): 닉네임 5자 제한 실패 테스트 (RED) |
| d5fe14f | feat(02-13): NICKNAME_MAX_GRAPHEMES 5 (GREEN) |
| 54d8de0 | test(02-13): 문구 1~5자 실패 테스트 (RED) |
| 5f2608a | feat(02-13): 문구·입력 힌트 1~5자 (GREEN) |

## RED 의미 평가

- Task 1: `5글자는 받는다`(상수 5 단언), `가족 이모지 5개/6개`, `6글자는 TOO_LONG`, 워커 `6글자 … 400` 이 상수 8 때문에 단언에서 실패했다. 파싱·import 오류가 아니라 동작 단언 실패다.
- Task 2: 문구 비교(`1~5자로 입력해 주세요`)와 placeholder 단언에서 실패했다. 6글자 입력은 이미 거부되지만 문구가 옛 안내라 실패했다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 8 그래핌을 전제한 기존 단위 테스트 두 곳 갱신**
- **Found during:** Task 1 / Task 2 전체 테스트 실행
- **Issue:** `test/unit/nickname.test.ts` "CR-01: 가족 이모지 8개는 글자 8개로 받는다"와 `test/unit/gameRoom.test.ts` "글자 수는 grapheme 으로 센다 (… 8개 통과)" 는 계획의 files_modified 에 없었지만 상수 변경으로 깨졌다.
- **Fix:** 픽스처를 5개로 맞춤 (규칙 자체는 불변, 최대 개수만 반영). 앞의 것은 Task 1 GREEN 커밋, 뒤의 것은 Task 2 GREEN 커밋에 포함.
- **Files modified:** test/unit/nickname.test.ts, test/unit/gameRoom.test.ts
- **Commit:** d5fe14f, 5f2608a

`src/components/TextField.tsx` 17행 주석의 "9글자 이상도"는 낡은 문구이지만 불변 조건(`src/components` 무변경)을 지키려고 고치지 않았다. 동작에는 영향이 없다.

## Known Stubs

없음.

## Threat Flags

없음. 새 엔드포인트·신뢰 경계 변화 없음 (T-02-39 는 워커 통합 테스트로 완화).

## 검증

- `npx vitest run` — 54 파일 987 테스트 통과
- `npm run typecheck` — 통과
- `grep -rc '1~8자' src/` 일치 0건, `git diff --quiet a5a79c5 -- shared/protocol.ts shared/game worker src/components src/styles` exit 0
- test(02-13) 커밋이 각 feat(02-13) 보다 먼저

## Self-Check: PASSED

- FOUND: 660a7c0, d5fe14f, 54d8de0, 5f2608a (HEAD 의 조상)
- FOUND: shared/nickname.ts, src/net/copy.ts, src/screens/JoinByLink.tsx
