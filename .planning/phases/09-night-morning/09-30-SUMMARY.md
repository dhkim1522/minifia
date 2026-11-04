---
phase: 09-night-morning
plan: "30"
subsystem: docs-verification
tags: [gap-closure, decision-record, e2e, handoff]
requires: ["09-24", "09-25", "09-26", "09-27", "09-28", "09-29"]
provides:
  - "결정 기록 0062 (묶음 A 12건 + 리뷰 처리)"
  - "0051-4·0052-3·0054 개정 표시"
  - "로컬 E2E 다섯 흐름·전체 시험 검증"
affects: [docs/screen-map.md, docs/architecture.md, HANDOFF.md, scripts/e2e/lib.mjs]
key-files:
  created: [docs/decisions/0062-v2-play-feedback-a.md]
  modified:
    - docs/decisions/0051-v2-text-minimal-interaction-ui.md
    - docs/decisions/0052-v2-nickname-8.md
    - docs/decisions/0054-v2-ending-flow.md
    - .planning/phases/09-night-morning/09-UI-SPEC.md
    - docs/screen-map.md
    - docs/architecture.md
    - HANDOFF.md
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs
    - test/unit/e2eContract.test.ts
decisions:
  - "0062-1~12: 깃펜 입력줄 오른쪽 끝, 현재/최대 숫자, [시작] 활성 기준, 타이머 한 규칙, 역할 확인 3D 무대, 종료 버튼 아래 고정, 시트 내용 높이, 봇 이름 길이, 봇 입력 중, 알람 되돌림, 좌석 색 한 곳, 쓰기 시트 대기 콜백"
status: complete
commits: 3
plan_head_before: d6784f227b3e437edcc9fd0bfb6393ce9cc95127
plan_head_after: 0214c25
actuals:
  tokens: 14000
  tasks: 3
  commits: 3
metrics:
  completed: 2026-11-04
---

# Phase 9 Plan 30: 묶음 A 보완 문서화·전체 검증 Summary

결정 기록 0062 한 장으로 사용자 테스트 묶음 A 12건과 리뷰 처리를 번호로 고정하고, 로컬 E2E 다섯 흐름과 전체 시험으로 보완 묶음(09-24~09-29) 전체를 확인했다.

## 한 일

- **Task 1**: `docs/decisions/0062-v2-play-feedback-a.md` 신규(0062-1~12). 0051(4번)·0052(3번)·0054 깃펜 줄에 "(개정: 0062-N)" 표시, `09-UI-SPEC.md` 에 깃펜 위치·DotProgress 개정 메모. 사람용 디자인 시스템 아티팩트 갱신 필요(사용자)를 영향 절에 적었다. 커밋 `59264c4`.
- **Task 2**: `docs/screen-map.md`(깃펜 위치·`.mv-count`·`RS-FIT`·3D 무대), `docs/architecture.md`(`relayTyping`·알람 되돌림·`setBotCount` 난수), `HANDOFF.md`(묶음 A 완료로 줄임, 6041바이트). 커밋 `d33c19f`.
- **Task 3**: 검증과 아래 결함 수정. 커밋 `0214c25`. 배포(`npm run deploy`)와 push 는 하지 않았다(push 는 오케스트레이터 몫이라 건너뜀).

## 검증 결과

- `npm run typecheck`: 통과(TS 오류 0).
- `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`: 203 통과, 0 실패(수정 뒤 `lib.test.mjs` 155 통과).
- 로컬 E2E(`npm run dev` + `--url http://localhost:5173`, 끝난 뒤 서버 종료): lobby E2E OK(28초) · day E2E OK(수정 뒤 44초) · night E2E OK(171초) · result E2E OK(38초, RS-FIT 포함) · chat-game E2E OK(13초). 판정 문턱은 낮추지 않았고 night 재시도도 필요 없었다.
- 전체 `npm test`: 149 파일 통과, 4149 통과 · 1 건너뜀, 실패 0(알려진 불안정 시험도 이번에는 실패 없음).
- 위생 검사: 이 묶음이 더한 줄과 커밋 메시지에서 걸리는 것 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 찬반 패널 높이 기대값이 숫자 표식 도입 뒤 15px 어긋남**
- **Found during:** Task 3, 첫 `day` E2E(24개 실패, 전부 `VD1`: 실제 222 ≠ 기대 207 등)
- **Issue:** 09-27 이 점(9px)을 "현재 / 최대" 숫자 한 줄(16px 글자, 줄 높이 24px)로 바꿔 찬반 투표자·보기 패널이 15px 높아졌는데 E2E 기대(+203/+111)와 UI-SPEC 표 값이 점 기준 그대로였다. 앱 쪽은 내용 높이로 그려져 화면 동작은 정상이고 계약 값만 낡았다.
- **Fix:** `GAME_PANEL_EXTRA` 를 +218/+126 으로 올리고(`lib.mjs`), 시험(`lib.test.mjs`·`e2eContract.test.ts`)·`flows.mjs` 주석·`screen-map.md` 의 높이 표와 스테이지 높이 표를 같은 값으로 맞췄다. 문턱 완화가 아니라 의도된 레이아웃 변경(0062-2)의 반영이다.
- **Files modified:** scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs, scripts/e2e/flows.mjs, test/unit/e2eContract.test.ts, docs/screen-map.md
- **Commit:** `0214c25`
- **영향:** 360×560 폰의 찬반 투표자 스테이지가 199 → 184 로 줄었다(이미 "알려진 한계 — 고치지 않는다" 항목, 표에 반영).

### 계획 대비 변경

- Task 3 의 push 는 지시에 따라 건너뛰었다. `git rev-list --count origin/v2..HEAD` 인수 기준은 오케스트레이터가 push 한 뒤에 충족된다.
- 08-UI-SPEC.md 의 찬반 패널 표(+203/+111)는 8페이즈 기록이라 고치지 않았다. 현재 값의 원천은 `docs/screen-map.md` 와 `scripts/e2e/lib.mjs` 이다.

## 실기기·육안 이월 (999.6)

- 역할 배정·확인 3D 무대 위 어두운 막 가독, 역할 카드 시트 높이, 놋쇠·진홍 타이머 링·막대 색, 결과 화면 8인판 스크롤 느낌.
- PreGame 무대가 pointer-events none 이라 맵을 못 열 때 나오는 카드의 [새로 고침] 이 두 화면에서 눌리지 않음(09-26 이월).
- 묶음 B(피드백 5·8·9·12)는 시안 뒤 별도 페이즈, 사람용 디자인 시스템 아티팩트 갱신은 사용자.

## Known Stubs

없음.

## Self-Check: PASSED

- 0062 문서·SUMMARY 파일 존재, 커밋 `59264c4`·`d33c19f`·`0214c25` 확인, HANDOFF 6041바이트(≤6144), `handoff.test.ts` 통과.
