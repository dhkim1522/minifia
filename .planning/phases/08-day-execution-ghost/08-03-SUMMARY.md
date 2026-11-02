---
phase: 08-day-execution-ghost
plan: "03"
subsystem: ui-parts
tags: [tdd, v2-parts, vote-badge, sure-stamp, role-chip, verdict-picker, icons, react19]
status: complete

requires:
  - phase: 06-v2-world-parts
    provides: HeadStack 이식 규약, V2Icon 경로 표, v2.css 구역
provides:
  - VoteBadge(count·lead) — 득표 배지, 1표 미만이면 그리지 않음
  - SureStamp — "유력" 도장
  - RoleChip(role) — 28 원형 직업 칩, 접근성 이름 ROLE_TEXT
  - VerdictPicker(value·onChange·disabled) — 찬성·반대 두 버튼
  - V2IconName 에 skip·thumbUp·thumbDown·rolePolice·roleDoctor
  - v2.css 의 .mv-badge·.mv-stamp·.mv-rolechip·.mv-verdict 규칙과 mv-pop·mv-pulse·mv-stamp 키프레임, 모션 줄이기 규칙
affects: [08-05 HeadStack 확장·토큰, 08-15~17 게임 화면, 08-17 유령 화면 분기, 08-20 정적 가드]

actuals:
  tokens: 7300
  tasks: 3
  commits: 6
plan_head_before: 8f6854aea55dfd1cbd80c7b2ead35d1db9b6b9d1
plan_head_after: 568792c

tech-stack:
  added: []
  patterns:
    - "RED 커밋에 시험 + null 반환 뼈대를 함께 둔다(불러오기 실패가 아니라 단언 실패로 RED), GREEN 에서 채움"
    - "CSS 계약 시험은 빈 규칙 비교 대신 bodyOf 로 규칙 개수를 먼저 단언한다(빈 문자열 actual 이 TAP 을 깨뜨림)"
    - "TAP RED 증거에는 여러 줄 diff 가 나오는 toEqual 배열 비교를 쓰지 않는다 — 스칼라 단언으로 쪼갠다"

key-files:
  created:
    - src/components/v2/VoteBadge.tsx
    - src/components/v2/SureStamp.tsx
    - src/components/v2/RoleChip.tsx
    - src/components/v2/VerdictPicker.tsx
    - test/client/voteParts.test.tsx
  modified:
    - src/components/v2/V2Icon.tsx
    - src/styles/v2.css
    - test/client/v2parts.test.tsx

key-decisions:
  - "찬반 버튼·득표 배지는 진홍/역할 색을 쓰지 않는다 — 찬반 규칙 구역에 crimson·brass 없음을 시험으로 고정"
  - "RoleChip 은 신분을 판단하지 않는다(부르는 쪽 유령 분기가 만든다) — A2"
  - "명조는 var(--font-serif, serif) 대체값으로 그린다, 토큰은 08-05 가 더한다 — A1"

requirements-completed: [DAY-04, DAY-06, GHOST-02]

metrics:
  duration: 약 6분
  completed: 2026-11-02
---

# Phase 8 Plan 03: 득표·도장·직업 칩·찬반 부품 Summary

승인 v2.0 디자인 시스템의 VoteBadge·SureStamp·RoleChip·VerdictPicker 와 아이콘 다섯 개를 React 19 로 옮기고 화면 시험 38건(신규 파일 1개)으로 고정했다. 쓰는 곳(HeadStack 확장·게임 화면)은 08-05·08-15~17 이다.

## 한 일

| 태스크 | 내용 | 커밋 |
| --- | --- | --- |
| 1 (tracer) | VoteBadge + 배지 CSS·키프레임·모션 줄이기. 득표 3 은 "3표", 0·음수·NaN·undefined 는 요소 없음, 재렌더 시 같은 노드에서 숫자만 바뀜 | 407e910 test, 57bd34e feat |
| 2 | SureStamp, RoleChip(네 역할), 아이콘 rolePolice·roleDoctor, 도장·칩 CSS | 64f7d1e test, d1c9b5c feat |
| 3 | VerdictPicker, 아이콘 skip·thumbUp·thumbDown, 찬반 CSS | 5dd8d27 test, 568792c feat |

트레이서 게이트: 자동 모드가 아닌 기본(end-of-phase) 모드이고 `<verify>` 가 자동 명령뿐이라 Task 1 직후 `npx vitest run test/client/voteParts.test.tsx` 를 다시 돌려 11건 통과를 확인하고 확장(Task 2·3)으로 갔다.

## TDD 기록

### RED (세 번, 모두 `gsd_run check tdd-red-evidence` = RED_EVIDENCE_OK)

- Task 1: 대상 "count 3 은 span.mv-badge 안에 숫자 3 과 단위 표…" — null 반환 뼈대라 "expected null not to be null" 로 계획된 단언에서 실패. 의미 평가: 뼈대가 컴파일되고 대상 시험이 실행되어 요소 존재 단언에서 실패했다.
- Task 2: 대상 "span.mv-stamp 에 글자 유력 한 단어를 그린다". 아이콘 시험은 미등록 이름 TypeError 로 실패(의도된 미구현). 첫 증거는 INVALID_RED(invalid_record, Malformed TAP) 였다 — 원인은 CSS 시험의 빈 문자열 `actual:` 줄. 시험을 고쳐(bodyOf) RED 커밋에 합치고(amend, 미 push) 다시 검증해 RED_EVIDENCE_OK 를 받은 뒤에야 GREEN 을 썼다.
- Task 3: 대상 "div.mv-verdict(role=group, …) 찬성·반대 버튼 두 개". 첫 증거는 INVALID_RED 였다(여러 줄 diff 가 나온 toEqual 배열 비교). 스칼라 단언으로 쪼갠 뒤 RED_EVIDENCE_OK 를 받고 RED 커밋.

### GREEN / REFACTOR

세 GREEN 커밋(57bd34e, d1c9b5c, 568792c). REFACTOR 커밋 없음(정리할 중복 없음).

## 계획 대비 변경 (Deviations)

### Auto-fixed

**1. [Rule 1 - Bug] 7페이즈 v2.css 놋쇠·진홍 금지 검사가 8페이즈 부품에서 깨짐**
- **Found during:** Task 2 (Task 1 의 brass-400 도입으로 이미 깨져 있었고, Task 2 에서 전체 두 파일을 돌릴 때 발견)
- **Issue:** `test/client/v2parts.test.tsx` 의 "hex 색이 없고 놋쇠 토큰을 쓰지 않으며…" 가 v2.css 전체에서 `--brass-` 와 `--crimson-400` 을 금지한다. 이 계획이 승인 디자인대로 배지·도장(놋쇠)과 마피아 칩(진홍 테두리)을 같은 파일에 더한다.
- **Fix:** 그 세 부품(`.mv-badge`·`.mv-stamp`·`.mv-rolechip`) 규칙만 뺀 본문으로 놋쇠·진홍 검사를 하게 바꾸고, 뺀 본문이 비어 있지 않음을 확인하는 시험을 더했다. v2.css 머리 주석도 같게 고쳤다. 나머지 규칙(이름표·채팅·시간 링)은 7페이즈 규칙 그대로다.
- **Files modified:** test/client/v2parts.test.tsx, src/styles/v2.css
- **Commit:** d1c9b5c
- 참고: Task 1 의 feat 커밋(57bd34e) 시점에는 이 기존 시험이 일시적으로 빨갛다. Task 2 커밋에서 초록으로 돌아온다(전체 client 시험은 마지막에 55파일 1772건 통과).

그 밖에는 계획대로 실행했다. 인증 게이트 없음, 새 의존성 없음.

## 검증

- `npx vitest run test/client/voteParts.test.tsx` 38건 통과
- `npm run typecheck` 종료 0
- `npx vitest run --project client` 55 파일 1772건 통과
- 수락 기준: `mv-badge__unit`·`export function VoteBadge`·`rolePolice`·`roleDoctor`·`data-role-chip`·`data-verdict`·`thumbUp`·`skip` grep 성공, VoteBadge hex 없음, 찬반 규칙 구역에 crimson·brass 없음, `test(08-03)` 커밋 3개
- 저장소 위생 규칙 검사(금지 표현 grep) 변경 파일 결과 없음

## Known Stubs

없음. 부품은 모두 속성에 따라 실제로 그리고, 사용처 배선은 후속 계획(08-05·08-15~17)의 몫이다(계획 명시). 명조 변수 `--font-serif` 는 08-05 가 토큰으로 더하기 전까지 CSS 대체값 `serif` 로 그린다(계획 A1, 배포 전 중간 상태).

## Threat Flags

없음. T-08-09 는 모든 문자열을 React 텍스트 노드·속성으로만 그려 완화(innerHTML 계열 없음), T-08-16 은 RoleChip 이 신분을 판단하지 않아 완화(산 사람 DOM 0건 검사는 08-17), T-08-SC 는 새 의존성 없음.

## Self-Check: PASSED

- 파일 존재: VoteBadge.tsx, SureStamp.tsx, RoleChip.tsx, VerdictPicker.tsx, voteParts.test.tsx — 확인
- 커밋 존재: 407e910, 57bd34e, 64f7d1e, d1c9b5c, 5dd8d27, 568792c — 확인
