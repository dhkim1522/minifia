---
phase: 06-world-skeleton
plan: 16
subsystem: ui
tags: [cleanup, dayTable, docs, screen-map, architecture]

requires:
  - phase: 06-world-skeleton
    provides: "06-15 맵 로비 교체(Lobby 가 DayTable·useSeatTransitions 를 더 이상 쓰지 않음), 06-01/06-08/06-13 월드 모듈"
provides:
  - "대기실 전용 v1.0 코드(DayTable slide·hostCrown·transition, 관련 CSS, 전용 테스트)가 없는 DayTable"
  - "docs/screen-map.md '대기실 (맵 로비)' 절: 층 표, 6개 폰 크기 스테이지 사각형, E2E 계약"
  - "docs/architecture.md '월드 (로비 맵)' 절과 배포 대상 단일 출처(deploy-target) 설명"
affects: [06-17-e2e, 06-18-deploy-e2e, 06-21-lobby-copy]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 1d2fae8413a5d3019637fd641aba45aff38f95e1
plan_head_after: f958024a3ecb8ba4f9e70423955ee3492ba6e150

tech-stack:
  added: []
  patterns:
    - "삭제 전 사용처 grep 으로 확인한 뒤, 기능과 그 기능만 보던 테스트를 함께 지운다(skip 금지)"

key-files:
  created: []
  modified:
    - src/components/DayTable.tsx
    - src/styles/daytable.css
    - src/styles/verdict.css
    - test/client/dayTable.test.tsx
    - docs/screen-map.md
    - docs/architecture.md
  deleted: []

key-decisions:
  - "자리 전이 훅 src/net/useSeatTransitions.ts 는 06-15 가 이미 지웠다 — 파일이 없음을 확인했고 다시 지울 것이 없다"
  - "가정 A1: Icon.tsx 의 crown 아이콘 정의는 남긴다. DayTable 왕관은 아이콘이 아니라 host_badge.svg 이미지를 썼고, crown 아이콘은 이 계획 전에도 어디서도 쓰이지 않던 별개 정의라 이번 삭제 범위가 아니다"
  - "DayTableSeat.onPress(방장이 끊긴 사람을 내보내던 눌림)는 계획의 삭제 목록에 없어 남겼다 — 지금은 사용처가 없지만 dayTable 테스트의 핸들러 우선순위 검사가 보고 있어 06-21 이후 정리 후보로 둔다"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "대기실 전용 DayTable 기능(slide·hostCrown·transition)과 그 CSS·전용 테스트 삭제, 나머지 단계의 DayTable 은 그대로 통과"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "npx vitest run (137 files, 3667 passed, 1 skipped = test/unit/camera.test.ts 의 기존 describe.runIf)"
        status: pass
      - kind: other
        ref: "npm run typecheck (rc 0)"
        status: pass
      - kind: other
        ref: "git grep -e useSeatTransitions -e hostCrown -e mf-dt--slide -e mf-dt__seat--enter -- src test (rc 1, 참조 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "screen-map 의 맵 로비 절과 architecture 의 월드 모듈·배포 대상 설명이 코드와 맞다"
    requirement: MAP-01
    verification:
      - kind: other
        ref: "grep -q data-world-stage / 402×874 (screen-map), deploy-target / emitWorld (architecture)"
        status: pass
    human_judgment: true
    rationale: "문서 문장이 코드 구조를 정확히 설명하는지는 사람이 읽어 판단한다(구간 {p,t0,v}·world 키·디바운스 값은 코드와 대조했다)"

duration: 12min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 16: 대기실 전용 v1.0 코드 삭제와 문서 갱신 Summary

**DayTable 에서 slide·hostCrown·입장/퇴장 transition 과 CSS·전용 테스트를 지우고, 화면 지도에 맵 로비 층·폰 크기·E2E 계약을, 구조 문서에 월드 모듈과 deploy-target 단일 출처를 적었다.**

## Performance

- **Duration:** 약 12분
- **Completed:** 2026-11-01T00:28Z
- **Tasks:** 2
- **Files modified:** 6 (코드·테스트 4, 문서 2)

## Accomplishments

- DayTable 이 로비 전용 코드 없이 역할 배정·낮·밤·투표·결과 경로만 남았다. client 1668개, 전체 3667개 테스트와 typecheck 통과.
- 화면 지도에 맵 로비 층 구조(캔버스·가림막·이름표 층·헤더·TopToast·[테스트]·재접속 띠·아래 패널·상태 카드)와 z, 폰 크기 6종 스테이지 사각형, 검사 계약(`data-world-stage`·`data-seat`·`data-me`·`data-away`·`data-ring`·`data-lobby-start`·`window.__mfWorld`)을 적었다.
- 구조 문서에 월드 절(서버 권위 이동, `routeFx` → `{p,t0,v}` → `emitWorld`, `world` 저장 키 2초 디바운스, `src/world` 런타임·렌더러·스토어, 성능 사다리)과 배포 절의 `scripts/deploy-target.mjs` 단일 출처·`npm run deploy` 순서를 더했다.

## 지운 것과 남긴 것

| 대상 | 처리 | 근거 |
|---|---|---|
| `src/net/useSeatTransitions.ts` | 이미 없음(06-15 삭제) | `ls` 로 확인, 참조 grep 0 |
| `DayTable` prop `slide`, rAF `slideOn` 상태, `mf-dt--slide` 클래스 | 삭제 | 사용처 grep: 테스트 외 0 |
| `DayTable` prop `hostCrown`, `.mf-dt__crown` 왕관 그리기 | 삭제 | 사용처 grep: 테스트 외 0 |
| `DayTableSeat.transition`, `mf-dt__seat--enter/--leave`, `mf-dt__tag--enter/--leave` | 삭제 | DayTable 밖에서 `transition:` 을 넘기는 곳 0 |
| CSS `.mf-dt__crown`, `--mf-seat-leave-ms`, enter/leave·slide 규칙, `mf-dt-seat-enter/-leave`·`mf-dt-fade-out` 키프레임, 모션 줄이기 해당 줄 | 삭제 | `mf-dt-fade`(다른 곳에서 씀)는 남김 |
| `dayTable.test` 왕관 2개 + 22px, transition 1개, slide 3개(rAF 2 + CSS 1), 입장/퇴장 CSS 1개 | 삭제(skip 아님) | 지운 기능만 검사 |
| `dayTable.test` onPress 2개, `# 색 값 없음` | 남김 | 남은 기능 |
| `Icon.tsx` crown 아이콘 · 아이콘 표 `crown` | 남김(가정 A1) | 별개 정의, 이번 삭제 범위 밖 |
| `public/characters/host/host_badge.svg` | 남김 | 이 계획이 건드릴 에셋 아님. 현재 src 참조 0 이라 정리 후보 |
| `DayTableSeat.onPress` | 남김 | 계획 삭제 목록에 없음. 정리 후보 |

## Task Commits

1. **Task 1: 대기실 전용 v1.0 코드 삭제** - `6171dfc` (refactor)
2. **Task 2: 화면 지도·구조 문서 갱신** - `f958024` (docs)

**Plan metadata:** 이 SUMMARY 와 함께 `docs(06-16)` 커밋

## Files Created/Modified

- `src/components/DayTable.tsx` - slide·hostCrown·transition 코드와 머리 주석 정리
- `src/styles/daytable.css` - 왕관·enter/leave·slide 규칙, 키프레임, 지역 상수 제거
- `src/styles/verdict.css` - 지워진 `mf-dt--slide` 를 가리키던 주석 한 구절 정리(동작 변화 없음)
- `test/client/dayTable.test.tsx` - 지운 기능 전용 테스트 삭제, 남은 describe 이름·머리 주석 정정
- `docs/screen-map.md` - '대기실 (맵 로비)' 절 추가, 세 영역 문장과 L 묶음 설명 정정
- `docs/architecture.md` - '월드 (로비 맵)' 절, 테스트 배포 절에 deploy-target

## Decisions Made

위 key-decisions 와 같다. 새 결정 기록이 필요한 변경은 없다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] verdict.css 주석이 지운 클래스를 가리킴**
- **Found during:** Task 1 검증 grep
- **Issue:** 검증 grep(`mf-dt--slide`)이 `src/styles/verdict.css:98` 의 주석에서 걸림. 동작 코드가 아니라 설명 주석이었다.
- **Fix:** 주석의 "(대기실 mf-dt--slide 와 같은 방식)" 구절만 제거
- **Files modified:** `src/styles/verdict.css`
- **Verification:** `git grep` rc 1(참조 0), 전체 vitest 통과
- **Committed in:** `6171dfc`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 주석 한 구절. 범위 확장 없음.

## Issues Encountered

- `scripts/e2e/browser.mjs:768`(`.mf-dt__crown` 수)·`scripts/e2e/lib.mjs`(`crownChecks`)·`scripts/e2e/flows.mjs:176`(로비 `crownChecks expect:1`)은 이번 삭제 뒤 로비에서 계속 어긋난다. 계획과 오케스트레이터 지시대로 `scripts/e2e` 는 건드리지 않았고 정리는 06-17·06-18 몫이다.
- 전체 vitest 의 skipped 1개는 `test/unit/camera.test.ts` 의 `describe.runIf(CAMERA_PRINT === "1")` 로 이 계획 이전부터 있던 조건부 실행이다(`.skip`·`.todo` 추가 없음).

## Known Stubs

None.

## Threat Flags

None - 새 입력·전송 경로 없음(T-06-35 회귀는 client 전체·typecheck 통과로 확인).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-17 은 `scripts/e2e` 의 `crownChecks`·`lobbyShapeChecks`·옛 로비 선택자(`flows.mjs:232`, `browser.mjs:428`)를 맵 로비 계약(screen-map 의 검사 계약 표)으로 바꾸면 된다.
- 06-21 은 `src/net/roomDiff.ts`·토스트 문구·Home/JoinByLink 를 다룬다(이 계획은 건드리지 않음).

## Self-Check: PASSED

- 파일: `src/components/DayTable.tsx`·`src/styles/daytable.css`·`test/client/dayTable.test.tsx`·`docs/screen-map.md`·`docs/architecture.md` 존재, `src/net/useSeatTransitions.ts` 없음
- 커밋: `6171dfc`, `f958024` 가 HEAD 의 조상
- acceptance: `test ! -e src/net/useSeatTransitions.ts` 통과, `hostCrown` 개수 0, `data-world-stage`·`deploy-target` grep 통과
- plan `<verification>`: `npx vitest run` 3667 통과 / `npm run typecheck` rc 0 / 지운 기능 참조 0

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*
