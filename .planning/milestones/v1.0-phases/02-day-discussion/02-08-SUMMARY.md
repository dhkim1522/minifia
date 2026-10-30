---
phase: 02-day-discussion
plan: 08
subsystem: client-ui
tags: [claim-panel, day-scene, claim-reveal, optimistic-ui, tdd, client]

requires:
  - phase: 02-day-discussion
    provides: 02-01 의 DayView·SeatClaim·claim 메시지, 02-06 의 RoomConnection(send·canSend), 02-07 의 Table(done·claim·reveal float)·Chip·ClaimTag
provides:
  - ClaimPanel — 직업 공개(claim)·공개 연출(claimReveal) 하단 패널(칩 줄, 낙관적 선택)
  - DayScene 배선 — 완료 알약(claimDone), 공개 연출 말풍선(claim → claimReveal 에서만), 주장 알약(claimReveal·discussion)
  - day.css 직업 공개 패널 배치와 낮은 폰 여백 축소 규칙
affects: [02-09, 02-10, 02-11]

tech-stack:
  added: []
  patterns:
    - "낙관적 선택은 {view, claim} 으로 기억해 view 객체가 바뀌면 버린다 — 효과·ref 없이 서버 값이 우선한다"
    - "이전 단계 기억은 렌더 중 상태 조정(useState 이전 phase 비교)으로 한다 — 효과 없이 첫 커밋부터 말풍선이 보이고, 재접속(이전 단계가 claim 이 아님)이면 켜지지 않는다"
    - "공개 연출 상태는 CLAIM_REVEAL_MS setTimeout 으로 끄고 언마운트·재실행 때 clearTimeout 으로 정리한다"

key-files:
  created:
    - src/components/ClaimPanel.tsx
    - test/client/claimPanel.test.tsx
    - test/client/dayScene.test.tsx
  modified:
    - src/screens/DayScene.tsx
    - src/styles/day.css

key-decisions:
  - "칩 목록은 view.day.roles(서버가 ROLE_IDS 순서로 준 이번 판 구성) 뒤에 '말 안 함' 만 붙인다 — 클라이언트에 직업 목록을 따로 두지 않는다(D-07)"
  - "낙관적 선택 상태는 view 객체 동일성으로 만료시킨다 — 새 서버 state 가 오면(수락·거절 모두) 서버 값(me.claim)을 따른다(T-02-26)"
  - "공개 연출 시작 판단은 prevPhase 를 ref 대신 렌더 중 상태 조정으로 쥔다(RESEARCH Pattern 7 의 prevPhaseRef 와 같은 효과, 효과 한 박자 늦음 없음)"
  - "claimReveal 패널은 같은 칩 줄(이번 판 구성)을 그대로 그리고 모두 꺼 높이를 유지하며, 선택 표시는 claims 의 내 자리 값이다"

patterns-established:
  - "단계 화면 패널은 view.phase 로만 분기하고 내 역할(me.role)을 읽지 않는다 — 마피아·시민 패널 HTML 동일 테스트로 지킨다"

requirements-completed: [DAY-02]

actuals:
  tokens: 6759
  tasks: 2
  commits: 4
plan_head_before: 463bfc0b92c7fa82c9c6551434eed767ea1c2c1b
plan_head_after: abcb041a46e4829bffd662c7b882cb796aee2a5e
commits: 4

coverage:
  - id: G1
    description: "직업 공개 패널이 제목·1일차/2일차 안내·칩 줄(이번 판 구성 + 말 안 함, 4명판 4칩)을 그리고, 칩을 누르면 확인 없이 {t: claim, claim} 을 보내 즉시 선택되며 같은 칩 재누름은 보내지 않고, 서버 view 가 오면 서버 값(거절 시 이전 값)을 따르고, 2일차는 me.claim 이 미리 선택되며, 끊기면 칩이 꺼진다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/client/claimPanel.test.tsx#ClaimPanel 직업 공개"
        status: pass
    human_judgment: false
  - id: G2
    description: "완료 알약은 서버가 보낸 claimDone 의 자리에만 뜨고 2일차 미리 선택만으로는 뜨지 않으며, 패널 마크업은 내 역할(마피아/시민)에 따라 달라지지 않는다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/client/dayScene.test.tsx#DayScene 직업 공개"
        status: pass
    human_judgment: false
  - id: G3
    description: "claim → claimReveal 에서 모든 자리에 동시에 팝+흔들림 말풍선(말 안 함은 흐림)이 뜨고 CLAIM_REVEAL_MS 뒤 사라지며, 주장 알약(말 바꿈 포함)은 낮 토론까지 남고, 재접속은 알약만 보이며, 공개 패널은 높이를 유지한 채 꺼져 있다"
    requirement: "DAY-02"
    verification:
      - kind: unit
        ref: "test/client/dayScene.test.tsx#DayScene 공개 연출"
        status: pass
      - kind: command
        ref: "npm run typecheck && npx vitest run --project client"
        status: pass
    human_judgment: false
  - id: G4
    description: "폭 360px·높이 640px 실기기에서 칩 2줄 패널 + 8자리 테이블이 세로 스크롤 없이 들어가는지와 공개 순간 팝·흔들림 동시 연출의 체감은 단위 테스트로 볼 수 없다"
    requirement: "DAY-02"
    verification: []
    human_judgment: true
    rationale: "실기기 높이·주소창 변화와 CSS 키프레임 체감은 happy-dom 이 계산하지 않는다. 02-11 배포 뒤 UAT(backstop, 플랜 human-check)가 확인한다."

duration: 6min
completed: 2026-10-24
status: complete
---

# Phase 2 Plan 08: 직업 공개 패널과 공개 연출 Summary

**ClaimPanel(이번 판 구성 칩 + 말 안 함, 낙관적 선택)과 DayScene 배선으로, 칩을 누르면 고른 사람 머리 위에만 완료 알약이 뜨고 마감 순간 모든 말풍선이 동시에 팝으로 공개된 뒤 주장 알약이 토론까지 남는다.**

## Performance

- **Duration:** 약 6분 (벽시계 기준)
- **Tasks:** 2 (트레이서 1 + 자동 1, 모두 TDD)
- **Files:** 신규 3, 수정 2
- **Commits:** 4 (test 2 + feat 2), 측정값 `git rev-list --count 463bfc0..HEAD`

## Accomplishments

- **트레이서(Task 1):** `ClaimPanel` 이 제목 "주장할 직업을 고르세요", 안내(1일차/2일차 이후 문구, 첫 문장 뒤 마침표만), `role="group"` `aria-label="주장할 직업"` 칩 줄을 그린다. 칩은 `view.day.roles` 뒤에 "말 안 함" 이고 4명판은 의사 칩이 없어 4개다. 누르면 확인 없이 `{t: "claim", claim}` 을 보내고 즉시 선택 상태가 된다(낙관적). 같은 칩 재누름은 아무것도 보내지 않으며(선택 해제 없음), 새 서버 view 가 오면 pending 을 버려 서버 값(`me.claim`)을 따른다 — 거절돼 이전 값이 오면 되돌아간다. DayScene 은 `claimDone` 에 든 자리에만 `done` 을 줘 완료 알약이 뜨고, 2일차에 어제 선택이 미리 선택돼도 직접 누르기 전에는 알약이 없다. 트레이서 검증을 확장 전에 다시 돌려 통과를 확인했다.
- **공개 연출(Task 2):** DayScene 이 이전 단계를 상태로 쥐고, `claim → claimReveal` 로 바뀐 렌더에서만 공개 연출을 켠다. 그 동안 자리마다 `float = {kind: "reveal", key: reveal-{n}-{seat}, text: 직업 이름 또는 "말 안 함", dim: none 이면 true, animate: true}` 이고 `CLAIM_REVEAL_MS` 뒤 `setTimeout` 으로 꺼진다(정리 포함). `claimReveal`·`discussion` 에서는 `view.day.claims` 의 자리 값으로 주장 알약(말 바꿈 포함)이 남고 완료 알약은 사라진다. 재접속으로 `claimReveal` 에 바로 들어오면 연출을 켜지 않아 알약만 보인다. 같은 패널은 `claimReveal` 에서 제목 "주장이 공개됐어요"·안내 "곧 토론이 시작돼요"로 바뀌고 칩은 내 공개 값(claims 의 내 자리)이 선택된 채 모두 꺼져 높이가 유지되며 보내기 버튼이 없다.
- **CSS:** `day.css` 에 패널 배치(제목 `--gray-50`, 안내 `--gray-300`, 구역 간격 `--space-md`)와, 높이 기준 미디어 쿼리(`max-height: 680px` 에서 패널 아래 안쪽 여백 `--space-lg → --space-md`, `600px` 이하에서 구역 간격 `--space-sm`)를 더했다. 패널 아래에 `env(safe-area-inset-bottom)` 을 더했다.

## Task Commits

| 작업 | RED | GREEN |
|------|-----|-------|
| 1 트레이서 칩·완료 알약 | `f960faa` test | `8923d92` feat |
| 2 공개 연출·주장 알약·꺼진 패널 | `ee7b609` test | `abcb041` feat |

## TDD Gate Compliance

플랜 유형은 `execute` 이고 작업 단위로 `tdd="true"` 다. 두 작업 모두 `test(02-08)` → `feat(02-08)` 순서의 커밋이 있다. REFACTOR 커밋은 없다. 플랜이 `type: tdd` 가 아니라 구조화된 RED 증거 분류기는 돌리지 않고 단언 실패를 직접 확인했다.

- **Task 1:** 신규 12개 중 11개가 단언 실패(예: 패널이 비어 `expected '<section …></section>' to contain 'mf-chip'`), 1개(2일차 미리 선택만으로는 알약 없음)는 이미 성립하는 회귀 보호로 통과. 모듈이 없으면 import 오류라 RED 가 아니므로 `ClaimPanel`(null 반환) 자리표시자를 test 커밋에 함께 담았다(02-07 과 같은 방식).
- **Task 2:** 신규 8개 중 7개가 단언 실패, 1개(공개 화면도 역할 차이 없음 — 패널이 둘 다 비어 있어 같음)는 이미 성립하는 회귀 보호로 통과.

## Decisions Made

key-decisions 참고. 계획의 두 가정(낙관적 선택은 다음 서버 state 에서 버림, 공개 연출 시작은 이전 단계로 판단)은 그대로 구현했다.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written. 다만 RESEARCH 가 권한 `prevPhaseRef` 대신 렌더 중 상태 조정(useState 로 이전 phase 기억)을 썼다. 효과나 ref 변경 없이 첫 커밋부터 말풍선이 나오고 재접속 판단이 같다(계획 가정의 취지는 동일).

**Total deviations:** 0 auto-fixed. **Impact:** 없음.

## Authentication Gates

없음.

## Issues Encountered

없음. 아래 사람 확인 항목은 02-11 배포 뒤로 미뤄져 있다(`human_verify_mode: end-of-phase`).

## Pending Human Check (02-11 배포 뒤)

폭 360px·높이 640px 폰(또는 같은 크기 브라우저)에서 8명 방의 직업 공개 화면을 열어, 칩 2줄 패널과 8자리 테이블이 세로 스크롤 없이 한 화면에 보이는지, 공개 순간 모든 말풍선이 동시에 팝·흔들림으로 뜬 뒤 2초쯤 사라지고 주장 알약이 남는지 확인한다.

## Known Stubs

없음. 이 계획에서 만든 파일에 하드코딩 빈 값이나 자리표시 문구가 남아 있지 않다(RED 의 `ClaimPanel` 자리표시자는 GREEN 에서 구현으로 교체됨).

## Threat Flags

없음. 새 네트워크 엔드포인트나 신뢰 경계 변화가 없다. T-02-25(칩·패널 마크업이 역할로 달라지지 않음)는 마피아·시민 패널 HTML 동일 테스트로, T-02-26(낙관적 선택 불신)은 새 view 가 오면 pending 을 버리는 테스트로 완화했다. T-02-SC: 새 패키지 설치 없음.

## Self-Check: PASSED

- 파일: `src/components/ClaimPanel.tsx`, `test/client/claimPanel.test.tsx`, `test/client/dayScene.test.tsx` 존재, `DayScene.tsx`·`day.css` 수정됨
- 커밋: `f960faa`, `8923d92`, `ee7b609`, `abcb041` 모두 HEAD 의 조상
- 검증: `npx vitest run test/client/claimPanel.test.tsx test/client/dayScene.test.tsx` 20개 통과, `npm run typecheck` 통과, `npx vitest run --project client` 395개 통과
- 인수 기준 grep 4개(주장할 직업을 고르세요·<ClaimPanel·안내 두 문구·claimDone·test(02-08) 커밋·주장이 공개됐어요·곧 토론이 시작돼요·"reveal"·CLAIM_REVEAL_MS) 모두 성공
