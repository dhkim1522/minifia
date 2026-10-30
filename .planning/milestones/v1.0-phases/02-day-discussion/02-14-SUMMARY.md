---
phase: 02-day-discussion
plan: 14
subsystem: day-table-ui
tags: [day-table, seat-layout, name-tag, tdd, gap-closure, design-v3]
gap_closure: true
gap_ids: [G-02-1]
status: complete

requires:
  - phase: 02-day-discussion
    provides: Figure·Icon 부품, ROLE_TEXT, 결정 0017 승인 시안 design/screens/day-v3
provides:
  - src/game/dayTable.ts — dayTableGeometry(sceneW, sceneH)·daySeatLayout(seats, mySeat, sceneW, sceneH)·px 와 상수(고정 테이블 280×108, rx 132/124, ry 100, cy 177~210, 이름표 폭 상한 100)
  - src/components/DayTable.tsx — 낮 화면 고정 테이블 부품(테이블 면·72×96 캐릭터·2줄 이름표·↺·왕관·링·동료 표시·머리 위 이모티콘)과 타입 DayTable·DayTableSeat·DayTagRow·DayTableProps
  - src/styles/daytable.css — 시안 f3·f4·f5.css 값을 토큰으로 옮긴 스타일
  - claimName 의 단일 출처 src/game/roleText.ts (ClaimTag 는 다시 내보냄)
  - Icon changed·crown·chevronUp
affects: [02-16, 02-17, 02-18]

requirements-completed: [DAY-01, DAY-02, COMM-02]

actuals:
  tokens: 13270
  tasks: 3
  commits: 6
plan_head_before: ca83fb0bdf10766c584177fdae40c8fc202b0d5d
plan_head_after: 80c6e75bc5ed69336cdf77806544a2791e848bca

tech-stack:
  added: []
  patterns:
    - "좌석·이름표·이모티콘 좌표는 daySeatLayout 한 번의 결과(장면 픽셀)에서만 나온다 — 떠 있는 층을 따로 가두는(clamp) 계산이 없다"
    - "장면 높이가 짧으면 테이블 면과 좌석 원을 같은 만큼 올린다(cy = max(177, min(210, H − 149))) — 글자·캐릭터는 줄이지 않는다"
    - "장면 폭·높이는 부품이 루트를 ResizeObserver 로 재고, 재지 못하면 시안 기준 366×407 을 쓴다(width·height prop 이 있으면 재지 않는다)"
    - "CSS 값 테스트는 정규식 .test() 결과(true/false)만 단언한다 — toMatch 는 실패 때 CSS 전체를 보고서에 쏟아 TAP 을 깨뜨린다"

key-files:
  created:
    - src/game/dayTable.ts
    - src/components/DayTable.tsx
    - src/styles/daytable.css
    - test/unit/dayTable.test.ts
    - test/client/dayTable.test.tsx
  modified:
    - src/game/roleText.ts
    - src/components/ClaimTag.tsx
    - src/components/Icon.tsx
    - src/components/ClaimPanel.tsx

key-decisions:
  - "낮 화면 전용 부품을 새로 만들고 대기실·배정의 공용 Table 은 건드리지 않았다 (1페이즈 승인 화면 보호)"
  - "둘러앉은 순서는 자리 번호 오름차순에서 내 순위를 0 으로 돌린 순위 — 자리 번호에 빈칸이 있어도 모든 폰의 시계 방향 순서가 같다"
  - "세로는 장면 높이에 맞춰 테이블 전체를 올린다. 높이 326 미만은 cy 177 에서 멈추고 맨 앞 이름표가 하단 패널과 조금 겹치는 것을 받아들인다(글자를 줄이지 않는다는 결정 0017-1 우선)"
  - "Icon 으로 그린 ✓·↺·왕관은 시안의 stroke 굵기(3·3·2.2)를 daytable.css 가 덮어써 맞춘다 — 공용 Icon 의 stroke 2 는 바꾸지 않는다"

duration: 약 7분
completed: 2026-10-24
---

# Phase 2 Plan 14: 고정 테이블 배치와 DayTable 부품 Summary

**승인 시안 9차의 고정 테이블(280×108, rx 132/124, ry 100)을 장면 폭·높이의 순수 배치 함수와 DayTable 부품으로 만들어, 캐릭터·2줄 이름표·↺/왕관 배지·머리 위 이모티콘이 같은 픽셀 좌표에서 나오고 4~8명·폭 352~406·높이 300~460 자동 검사를 통과한다.**

## 수행 내용

- **Task 1 (트레이서, 결정 0017-1)**: `src/game/dayTable.ts` 의 `dayTableGeometry`·`daySeatLayout` 이 시안 공식(θ = π/2 + i/n·2π, 깊이 d, 배율 0.8~1, z = round(d·10))을 그대로 낸다. 폭 366 미만은 rx 124·면 264, 장면이 짧으면 cy 를 177~210 으로 내려 면과 좌석을 함께 올린다. `DayTable` 이 루트를 ResizeObserver 로 재서 테이블 면·캐릭터·이름표 윗줄(자리 색깔점 + 닉네임)을 그린다. 자동 배치 검사: 폭 352~406 전부에서 이름표 상자(폭 상한 100)가 장면 가로 안, 4명은 폭 352·366 에서 겹침 0, 높이 300~460 전부에서 머리 위 ≥ 0, 높이 326 이상에서 모든 이름표 아래 끝 ≤ 장면 높이, 326 미만은 맨 앞 이름표만 넘는다(받아들인 겹침).
- **Task 2 (결정 0017-3·0017-6)**: 이름표 아랫줄 — 고르는 중 `…`, `✓ 완료`(반전), 주장 직업(말줄임 없음), 말 안 함 `-`, 공개 연출 `--pop`(밝은 테두리·빛 + 팝 360ms·흔들림 400ms, 축소 모션에서 끔). 자리 접근성 이름에 `, 선택 완료`·`, 직업 주장 X`. `claimName` 을 `src/game/roleText.ts` 로 옮기고 `ClaimTag.tsx` 는 다시 내보낸다(02-16 이 지움).
- **Task 3 (결정 0017-2·0017-3·0017-5)**: 주장 알약 오른쪽 위 18px ↺ 배지(`role=img`, 말 바꿈), 캐릭터 왼쪽 위 22px 왕관 배지(방장), 나 링·동료 링과 마름모(동료가 우선), 방금 말한 사람 윗줄 반전(`--spoke`), 머리 위 32px 이모티콘(z 60, 5px 꼬리, key 로 재시작, 가로로 가두지 않음). Icon 에 `changed`·`crown`·`chevronUp` 추가(시안 경로 그대로). `ClaimPanel` 의 claimName import 를 roleText 로 바꿈.

## TDD 게이트

세 태스크 모두 RED(`test(02-14)`) 커밋이 GREEN(`feat(02-14)`) 보다 먼저다. RED 증거는 `gsd check tdd-red-evidence` 로 검증해 모두 `RED_EVIDENCE_OK`.

| Task | RED | GREEN | RED 의미 평가 |
| --- | --- | --- | --- |
| 1 | 49adf6c | 5c95ee1 | 대상 `4명·폭 366: 아래 → 왼쪽 → 위 → 오른쪽` 이 좌표 문자열 단언(기대 `183,310 51,210 183,110 315,210`, 실제 빈 문자열)에서 실패. 빈 자리 표시자 소스 두 개를 RED 커밋에 함께 넣어 import 오류가 아니라 값 단언에서 실패하게 했다. 일부 테스트(겹침 없음·타입 테스트)는 자리 표시자가 빈 배열이라 우연히 통과했으나 GREEN 에서 실제 값으로 다시 검증되고, "n개를 돌려준다" 테스트가 이를 막는다 |
| 2 | 94c2fc8 | edaa1e0 | 대상 `row wait 은 아랫줄 '…'` 이 아랫줄 textContent 단언(`expected undefined to be '…'`)에서 실패. `claimName` 이 아직 roleText 에 없어 마지막 테스트는 TypeError 로 실패했으나 대상 테스트는 단언 실패 |
| 3 | 1a99a0d | 80c6e75 | 대상 `.mf-dt__chg` 개수 단언(1 대 0)에서 실패. Icon 세 개는 렌더 단계 TypeError(이름 없음)라 대상으로 쓰지 않았다. `끊긴 자리` 테스트는 기존 Figure 동작이라 RED 에서도 통과 |

REFACTOR 커밋은 없다(변경할 만한 중복이 없었다).

## 커밋

| 커밋 | 내용 |
| --- | --- |
| 49adf6c | test(02-14): 고정 테이블 배치 함수와 DayTable 실패 테스트 (RED) |
| 5c95ee1 | feat(02-14): 배치 함수·DayTable 윗줄 이름표·daytable.css (GREEN) |
| 94c2fc8 | test(02-14): 이름표 아랫줄·공개 연출·claimName 출처 실패 테스트 (RED) |
| edaa1e0 | feat(02-14): 이름표 아랫줄·claimName 단일 출처 (GREEN) |
| 1a99a0d | test(02-14): 배지·링·동료·반전·이모티콘 실패 테스트 (RED) |
| 80c6e75 | feat(02-14): 배지·링·동료·반전·이모티콘·Icon 3개 (GREEN) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED 보고서가 TAP 으로 읽히지 않아 CSS 테스트 단언 방식 변경**
- **Found during:** Task 2 RED
- **Issue:** CSS 값 테스트를 `expect(css).toMatch(/…/)` 로 쓰자 실패 메시지가 CSS 파일 전체(여러 줄)를 보고서에 쏟아 `tdd-red-evidence` 가 `Non-TAP data in report` 로 `INVALID_RED` 를 냈다.
- **Fix:** 정규식 `.test()` 결과를 `expect(...).toBe(true)` 로 단언하는 `cssHas` 도우미로 바꿨다. 검사 내용(정규식)은 그대로이고 단언만 한 줄 보고서가 된다.
- **Files modified:** test/client/dayTable.test.tsx
- **Commit:** 94c2fc8 (RED 커밋 이전에 고침)

**2. [Rule 1 - Bug] 축소 모션 규칙을 선택자 하나로 묶어 CSS 검사 실패**
- **Found during:** Task 3 GREEN
- **Issue:** `.mf-dt__claim--pop, .mf-dt__emoji { animation: none }` 한 규칙으로 쓰자 Task 2 의 "축소 모션이 --pop 애니메이션을 끈다" 테스트가 실패했다.
- **Fix:** 두 규칙으로 나눠 쓰고 테스트는 그대로 뒀다.
- **Files modified:** src/styles/daytable.css
- **Commit:** 80c6e75

**Total deviations:** 2 auto-fixed (Rule 3 1건, Rule 1 1건). **Impact:** 동작·범위 변화 없음.

## Known Stubs

없음. `DayTableSeat` 의 `row`·`spoke`·`emoji` 는 부품이 받아 그리는 입력이고, 서버 값 연결은 02-16 의 범위다(계획의 의도된 분리).

## Threat Flags

없음. 새 네트워크 경로·신뢰 경계 변화 없음. 계획의 완화 항목은 모두 테스트로 고정했다.

- T-02-40: `DayTableSeat` 에 역할 키를 넣을 수 없음을 `@ts-expect-error` 타입 테스트로 고정(DOM 에 역할 필드 없음).
- T-02-41: 닉네임 `<img src=x>` 가 이름표 안에서 요소가 되지 않고 글자로만 그려짐을 테스트.
- T-02-SC: 새 패키지 설치 없음.

## 검증

- `npx vitest run` — 56 파일 1059 테스트 통과 (이 계획의 테스트 unit 31 + client 41)
- `npm run typecheck` — 통과
- 수락 기준 grep: `NAME_TAG_MAX_W` 5, `352|366` 32, `TABLE_FIT_MIN_H` 5, `sceneH` 4, `daySeatLayout(` 1, 코드의 `clamp(` 0, daytable.css hex 0, `export function claimName` roleText 1 / ClaimTag 0, `mf-dt-shake` 2, `prefers-reduced-motion` 1, Icon 3개, `aria-label="말 바꿈"`·`"방장"` 각 1, ClaimPanel roleText import 1 모두 통과
- 불변: `git diff --quiet ca83fb0 -- src/screens src/components/Table.tsx src/styles/lobby.css src/styles/seat.css shared worker` exit 0 (어떤 화면에도 부품을 끼우지 않음)
- 브라우저·실기기로는 열어 보지 않았다(이 계획은 부품만 만들고 화면 연결은 02-16). 8명·폭 360 실기기에서 이름표 잘림 여부(must_haves backstop)는 02-18 의 배포본 확인 몫이다.

## Self-Check: PASSED

- FOUND: src/game/dayTable.ts, src/components/DayTable.tsx, src/styles/daytable.css, test/unit/dayTable.test.ts, test/client/dayTable.test.tsx
- FOUND: 49adf6c, 5c95ee1, 94c2fc8, edaa1e0, 1a99a0d, 80c6e75 (HEAD 의 조상)
- test(02-14) 커밋이 각 feat(02-14) 보다 먼저
