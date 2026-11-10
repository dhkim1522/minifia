---
phase: 18-quick-fixes
plan: "05"
subsystem: dress-sheet
tags: [dress, lock, icon, lobby, result, tracer, tdd, sc-1]

requires:
  - phase: 18-quick-fixes
    provides: "18-01 lockedOutfits(shared/game/look.ts) — 서버 잠금과 같은 함수"
  - phase: 18-quick-fixes
    provides: "18-04 V2Icon 유니온 확장 방식(eyeOff)"
provides:
  - V2Icon lock 선 아이콘(몸 + 고리)
  - DressSheetProps.taken?: ReadonlySet<OutfitId> — 잠긴 카드(data-taken·aria-disabled·자물쇠 16·접근성 이름)
  - DRESS_TEXT.taken 과 outfitCardName(id, selected, locked) 셋째 인자
  - Lobby·ResultScreen 의 서버 view.players 기반 taken useMemo
  - .mv-dress-card__lock (체크와 같은 자리, gray-300)
affects: [18-09]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4

plan_head_before: ccf398b186cc07dbb10c813ce952c6217e0550ee
plan_head_after: 134aefa05bd1e4061e25ff4eb0ae5ac86dead308
commits: 4

tech-stack:
  added: []
  patterns:
    - "잠금은 호출 쪽이 서버 view.players 에서 나를 빼고 lockedOutfits 로 매 렌더 계산하고, 시트는 locked = taken.has(id) && id !== value 로 내 옷을 항상 풀어 둔다"
    - "잠긴 카드는 기존 aria-disabled 규칙(불투명도 .45, 누름 무시, 화살표키 초점은 받음)을 그대로 쓴다"

key-files:
  created: []
  modified:
    - src/components/v2/DressSheet.tsx
    - src/components/v2/V2Icon.tsx
    - src/game/dressText.ts
    - src/screens/Lobby.tsx
    - src/screens/ResultScreen.tsx
    - src/styles/v2.css
    - test/client/dressSheet.test.tsx
    - test/client/lobby.test.tsx
    - test/client/icon.test.tsx
    - test/client/resultScreen.test.tsx

key-decisions:
  - "잠금 판정은 useDress 의 미리 보기 view 가 아니라 서버 view.players 에서 나를 뺀 lockedOutfits 로 한다 — 서버 잠금(18-01)과 같은 함수라 두 판정이 어긋나지 않는다"
  - "내가 입은 옷은 남이 같은 옷을 가진 순간에도 잠그지 않는다(선택 표시 우선)"
  - "잠긴 카드 접근성 이름은 '{옷 이름}, 다른 참가자가 입고 있음'(잠금이 선택됨보다 우선), 항상 '참가자' 표기"

requirements-completed: [SC-1]

coverage:
  - id: D1
    description: "로비 옷장 시트에서 다른 참가자가 직접 고른 옷만 잠긴다(data-taken·aria-disabled·자물쇠·접근성 이름), 눌러도 onPick 이 불리지 않고 내 옷·기본 coat 는 잠기지 않는다"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "test/client/dressSheet.test.tsx#잠긴 옷 (P18-2·3, D-02)"
        status: pass
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 옷장 잠금 (18-05, D-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "결과 화면 [꾸미기] 시트도 같은 규칙으로 잠긴다(연결이 끊긴 사람의 옷 포함). 자물쇠 CSS 는 체크와 같은 자리 4·4, gray-300, hex 없음. lock 아이콘 모양"
    requirement: "SC-1"
    verification:
      - kind: unit
        ref: "test/client/resultScreen.test.tsx#다른 사람(연결이 끊긴 사람 포함)이 직접 고른 옷은 시트에서 data-taken"
        status: pass
      - kind: unit
        ref: "test/client/icon.test.tsx#V2Icon lock (18-05)"
        status: pass
      - kind: unit
        ref: "test/client/icon.test.tsx#옷장 자물쇠 CSS 자리 (18-05, v2.css)"
        status: pass
    human_judgment: false
  - id: D3
    description: "자물쇠의 보이는 모양·옷장 안에서의 시각 균형(16px, gray-300, 불투명도 .45)과 실제 동시 선택 경쟁은 눈과 배포본 E2E 로 본다"
    requirement: "SC-1"
    verification: []
    human_judgment: true
    rationale: "시각 판정은 자동 시험이 단언하지 않는다. E2E(avatar-dress 잠금)는 18-09 가 더한다"

duration: 약 15분
completed: 2026-11-11
status: complete
---

# Phase 18 Plan 05: 옷장 잠긴 옷 표시 Summary

**로비·결과 화면 옷장이 서버 view.players 에서 나를 뺀 lockedOutfits 로 다른 참가자가 직접 고른 옷을 자물쇠 16(gray-300)과 불투명도 .45 로 잠그고, 눌러도 소리·알림·글 없이 아무 일도 일어나지 않는다(내 옷·기본 coat 는 잠기지 않음).**

## Performance

- **Duration:** 약 15분
- **Tasks:** 2 (각각 RED·GREEN 커밋 한 쌍)
- **Files modified:** 10 (계획 선언과 같다)

## Accomplishments

- `V2Icon` 에 `lock` 선 아이콘(몸 `M6 11h12v9H6z` + 고리 `M8.5 11V8a3.5 3.5 0 0 1 7 0v3`)을 더했다.
- `DressSheet` 에 `taken` prop 을 더했다. 카드마다 `locked = taken?.has(id) === true && id !== value`; 잠기면 `data-taken`, `aria-disabled`, 접근성 이름 '{옷 이름}, 다른 참가자가 입고 있음', 체크 자리에 자물쇠, onClick 가드. 연결 끊김 `disabled` 는 그대로 우선한다.
- `Lobby`·`ResultScreen` 이 `lockedOutfits(view.players.filter((p) => p.seat !== view.me.seat))` 를 `useMemo` 로 계산해 `taken` 으로 넘긴다. 서버 setLook 잠금(18-01)과 같은 함수를 import 하므로 화면 판정과 서버 판정이 어긋나지 않는다. 연결이 끊긴 사람의 옷은 좌석이 있는 동안 잠긴다.
- `.mv-dress-card__lock { position: absolute; top: 4px; right: 4px; color: var(--gray-300); }` — 새 토큰·hex 없음.

## Task Commits

1. **Task 1 (tracer, tdd): 로비 잠긴 옷 카드**
   - RED `6496b239` test(18-05): 옷장 잠긴 카드 실패 시험
   - GREEN `d78c1752` feat(18-05): 로비 옷장 잠긴 옷 카드
2. **Task 2 (auto, tdd): 결과 화면 잠금과 자물쇠 자리**
   - RED `967a4867` test(18-05): 결과 화면 옷장 잠금 실패 시험
   - GREEN `134aefa0` feat(18-05): 결과 화면 옷장 잠금·자물쇠 자리

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP 갱신은 별도 `docs(18-05)` 커밋.

## TDD RED 증거

**Task 1** — 명령 `npx vitest run test/client/dressSheet.test.tsx test/client/lobby.test.tsx --reporter=tap-flat`, 실패 6개.
- 대상(단언 실패): `dressSheet.test.tsx > 잠긴 옷 > taken 카드만 data-taken…`(기대 `[hood,noir]` / 실제 `[]`), `잠긴 카드를 누르면 onPick 이 불리지 않고…`(onPick 이 2번 불림), `내 옷이 들어 있어도…`·`disabled 와 taken 이 함께면…`(data-taken 개수 0), `lobby.test.tsx > Lobby — 옷장 잠금 > hood 만 잠기고…`(기대 `[hood]` / 실제 `[]`), `남이 옷을 바꾸면…`.
- 특성 시험(RED 에서도 통과, 정상): taken 없음 → 잠긴 카드 0개, 로비 "내 look 이 남과 같아도 내 카드는 잠기지 않는다"(잠금이 아직 없어 0개).
- 의미 판단: V2IconName 에 lock 을 빈 배열로 먼저 둬 타입·불러오기 오류가 아니라 `data-taken` 단언 실패다(계획한 이유의 실패).

**Task 2** — 명령 `npx vitest run test/client/icon.test.tsx test/client/resultScreen.test.tsx --reporter=tap-flat`, 실패 2개.
- 대상: `resultScreen.test.tsx > 결과 단계 꾸미기 > 다른 사람(연결이 끊긴 사람 포함)이 직접 고른 옷은 시트에서 data-taken…`(기대 `[noir]` / 실제 `[]`), `icon.test.tsx > 옷장 자물쇠 CSS 자리`(규칙 없음 → `''`).
- 특성 시험(Task 1 구현으로 이미 통과): `V2Icon lock (18-05)` 아이콘 모양.

REFACTOR 커밋은 없다.

## Files Created/Modified

위 key-files 참조. 새 파일 없음.

## Decisions Made

- 위 key-decisions 와 같다. 접근성 이름에서 잠금이 선택됨보다 앞선다(잠긴 카드는 선택될 수 없으므로 겹치는 일이 없다).

## Deviations from Plan

- **Task 1 acceptance 정리(경미):** `dressText.ts` 의 새 JSDoc 이 문구를 되풀이해 `grep -c "다른 참가자가 입고 있음"` 이 2가 되어, JSDoc 을 "taken 조각" 으로 줄여 1 로 맞췄다(`d78c1752` 에 amend, push 전).
- 계획 밖 변경 없음. 로비 시험 중 시트 통합 시험은 계획대로 `lobby.test.tsx` 에 두었다.

**Total deviations:** 0 (기능), 1 (문구 정리). **Impact:** 없음.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None — 새 네트워크 경로 없음. T-18-11(화면 잠금은 편의, 서버 18-01 이 최종 거절, 같은 lockedOutfits)과 T-18-12(접근성 이름에 닉네임·좌석·역할 없음)를 시험(`dressSheet.test.tsx`)이 고정한다.

## Issues Encountered

- 없음. `npm test` 전체 통과(279 파일 통과·6 건너뜀, 7991 통과), `npm run typecheck` 통과. 알려진 간헐 실패 bots.test.ts 는 이번 실행에서 나타나지 않았다.

## Next Phase Readiness

18-09 가 E2E 로 avatar-dress 잠금(남이 고른 옷 카드가 data-taken 이고 눌러도 look 이 바뀌지 않음)과 시작 뒤 흔적 같은 옷 ≤ 1 을 판정하면 된다.

## Self-Check: PASSED

- 파일: DressSheet.tsx·V2Icon.tsx·dressText.ts·Lobby.tsx·ResultScreen.tsx·v2.css 및 시험 4개 존재 확인
- 커밋: 6496b239·d78c1752·967a4867·134aefa0 모두 HEAD 의 조상
- 수락 기준: `data-taken` 1(DressSheet), `lockedOutfits(view.players.filter` 1(Lobby), `다른 참가자가 입고 있음` 1(dressText), `lockedOutfits` 2(ResultScreen), `mv-dress-card__lock` 1(v2.css) — 모두 기준 충족
- 검증: `npx vitest run`(관련 4개 335 통과)·`npm run typecheck`·`npm test` 통과, 위생 git grep 0
