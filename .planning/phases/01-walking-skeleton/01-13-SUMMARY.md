---
phase: 01-walking-skeleton
plan: 13
subsystem: ui
tags: [react, phase-screens, role-card, bottom-sheet, aria-live, tdd]

requires:
  - phase: 01-walking-skeleton
    provides: "01-08 Timer·RoleCard·cardFace, 01-10 Table·Lobby, 01-11 useRoomConnection·RoomScreen 틀, 01-12 Sheet·ConfirmSheet"
provides:
  - "RoomScreen 단계 분기(배정 S-04·역할 확인 S-05·낮 S-06)와 key=단계 phase-enter 전환"
  - "Assigning: 테이블 위 night-950 90% 막 + 맥박 링 3겹, 역할을 읽지 않는 같은 마크업"
  - "RoleReveal: 서버 마감 시각 하나로 15초 Timer, 카드 면 전이(누르기·시작 5초 자동·재접속은 앞면부터), onSeenFront"
  - "Day: 아침빛 800ms + '1일차' + '낮이 되었습니다', 타이머·테이블 없음(1페이즈의 끝)"
  - "MyRoleSheet(C-01): 단계가 바뀌어도 열린 채, 앞면을 본 적 없으면 뒷면만"
  - "PhaseBar, 단계 안내 aria-live, 대기실에 canSend·epoch·onLeave 전달, 대기실·배정 동안 preloadRoleAssets"
affects: [01-14 배포 검증·UAT 준비, 2페이즈 낮 직업 공개, 3페이즈 조사 기록]

actuals:
  tokens: 14000
  tasks: 3
  commits: 6
plan_head_before: 8a5b59060cbf305a6b64f6cf51e292873bc53b4b
plan_head_after: 5d2d2d95185187abf7c121c8bcb14d4140fb2c0f

tech-stack:
  added: []
  patterns:
    - "단계 화면 루트는 key=view.phase 인 .mf-phase-enter 로 감싸 단계가 바뀔 때만 나타난다"
    - "화면 안 상태(시트 열림·seenFront)는 단계 switch 밖 RoomScreen 이 쥐어 단계 전환에도 살아 있다"
    - "자식이 알릴 일은 값에 걸린 effect 하나로(onSeenFront) — 전이 처리기 안에서만 부르면 마운트 시 초기값을 놓친다"
    - "TAP 보고서용 테스트 단언은 한 줄 메시지(queryBy + expect)로 쓴다 — getBy* 의 여러 줄 DOM 덤프는 보고서를 깨뜨린다"

key-files:
  created:
    - src/screens/Assigning.tsx
    - src/screens/RoleReveal.tsx
    - src/screens/Day.tsx
    - src/components/MyRoleSheet.tsx
    - src/components/PhaseBar.tsx
    - test/client/phaseScreens.test.tsx
  modified:
    - src/screens/RoomScreen.tsx
    - src/styles/phase.css
    - src/components/RoleCard.tsx
    - src/game/roleText.ts

key-decisions:
  - "[내 역할] 시트 뒷면 판정 showBack = (view.phase === 'roleReveal' && !seenFront). 낮부터는 항상 앞면(리서치 Open Question 1 해소)"
  - "'1일차' 는 1페이즈 고정 문구(Open Question 2 해소) — 일차 번호는 낮이 반복되는 페이즈가 view 에 더한다"
  - "aria-live 영역은 role=status 를 쓰지 않는다 — 토스트(role=status)와 겹치지 않게 plain <p aria-live='polite'>"
  - "역할이 5초 지난 뒤에야 view 에 들어오는 경우(드문 순서)도 자동 앞면이 즉시 적용되도록 effect 가 delay<=0 이면 onAutoTimer 를 바로 적용"

requirements-completed: [GAME-01, ROLE-02, CONN-01]

coverage:
  - id: D1
    description: "방장이 시작하면 모든 폰이 같은 S-04 배정 화면(막·맥박 링·문구, 입력·[내 역할] 없음)으로 바뀌고 마크업이 역할과 무관하다"
    requirement: GAME-01
    verification:
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#배정 화면: 문구 둘·테이블 위 막·맥박 링 3개가 있고 [내 역할] 은 없다"
        status: pass
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#배정 화면 마크업은 역할을 읽지 않는다"
        status: pass
    human_judgment: false
  - id: D2
    description: "역할 확인(S-05): 제목·안내·15초 Timer·카드 뒷면/앞면·동료 줄(0/1/2)·5초 자동 앞면·재접속은 앞면부터·역할 없는 뷰는 뒷면만"
    requirement: ROLE-02
    verification:
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#S-05 역할 확인 (8 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "낮 시작(S-06): 1일차·낮이 되었습니다·[내 역할] 뿐, 타이머·테이블 없음, 서버 day 전에는 낮으로 넘어가지 않음"
    requirement: GAME-01
    verification:
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#S-06 낮 시작 · 단계 전환은 서버 view 만 따른다 (T-01-46)"
        status: pass
    human_judgment: false
  - id: D4
    description: "[내 역할] 시트(C-01): 같은 버튼 마크업, 단계가 바뀌어도 열린 채, 앞면을 본 적 없으면 뒷면, 새로고침·5초 자동 앞면 반영, 역할 없음 문구, 닫기"
    requirement: ROLE-02
    verification:
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#C-01 [내 역할] 시트 (9 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "대기실이 canSend·epoch·onLeave 를 받아 끊긴 동안 입력이 꺼지고 재접속 직후 토스트가 없고 나가기 뒤 첫 화면, 대기실·배정 동안 직업 그림 미리 받기, 단계 안내 aria-live"
    requirement: CONN-01
    verification:
      - kind: unit
        ref: "test/client/phaseScreens.test.tsx#대기실 연결 · 미리 받기 / 단계 안내 aria-live"
        status: pass
    human_judgment: false
  - id: D6
    description: "360×640 iOS Safari 에서 위쪽 바·카드·안내 두 줄·낮 화면이 세로 스크롤 없이 들어가고 연출(막·링·아침빛·카드 뒤집기)이 설계서대로 보인다"
    requirement: GAME-01
    verification: []
    human_judgment: true
    rationale: "레이아웃 맞춤과 모션 질감은 실기기에서만 확인된다(plan 이 01-14 실기기 backstop 으로 지정)"

duration: 8min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 13: 역할 배정·역할 확인·낮 시작 단계 화면과 [내 역할] 시트 Summary

**서버 단계(view.phase)만 따라 배정 연출 → 15초 역할 카드(누르기·5초 자동 뒤집기) → "낮이 되었습니다" 로 바뀌고, 단계가 바뀌어도 열려 있는 [내 역할] 시트가 앞면을 본 적 없으면 뒷면만 보여 주는 1페이즈 마지막 화면 조각**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-23T06:31:20Z
- **Completed:** 2026-10-23T06:39Z
- **Tasks:** 3 (모두 RED→GREEN 커밋 쌍)
- **Files modified:** 10 (신규 6, 수정 4)

## Accomplishments

- RoomScreen 단계 switch 를 완성했다. 각 단계 화면은 `key=view.phase` 의 `.mf-phase-enter` 로 감싸 300ms 로 나타나고, 보이지 않는 `aria-live="polite"` 영역이 단계가 바뀔 때만 읽는다.
- 역할 확인(S-05)은 서버 마감 시각 하나로 Timer 와 카드 자동 뒤집기를 함께 돌린다. 5초 뒤 입장·새로고침은 카드가 마운트 때부터 앞면이고, 이 경우도 `onSeenFront` 가 첫 effect 에서 한 번 불려 시트가 앞면을 따른다.
- 배정(S-04)과 낮(S-06)은 역할을 읽지 않는 같은 마크업이다. 테스트가 마피아로 채운 view 와 역할 없는 view 의 innerHTML 동일을 확인한다(T-01-44).
- [내 역할] 시트는 RoomScreen 이 열림·seenFront 를 쥐어 단계가 바뀌어도 같은 dialog 요소로 열린 채다. 뒷면 상태에는 역할 글자·그림을 그리지 않는다(T-01-45).
- 대기실이 `canSend`·`epoch`·`onLeave` 를 받고, 대기실·배정 동안 직업 그림 4종과 낮 배경을 같은 요청 패턴으로 미리 받는다.

## RED / GREEN / REFACTOR

| Task | RED 커밋 | GREEN 커밋 | RED 증거 |
| --- | --- | --- | --- |
| 1 (tracer) | `9650d4e` | `529c003` | `gsd check tdd-red-evidence` → `RED_EVIDENCE_OK`(target_test_failed). 대상 "역할 확인 뒷면…" 이 heading "역할 확인" 존재 단언에서 실패, 로드·파서·픽스처 오류 없음 |
| 2 | `40fe81e` | `0e3f619` | `RED_EVIDENCE_OK`. 대상 "배정 화면: 문구…" 가 배정 문구 존재 단언에서 실패 |
| 3 | `a1f8c03` | `5d2d2d9` | `RED_EVIDENCE_OK`. 대상 "카드를 뒤집지 않고 [내 역할]…" 이 시트(dialog) 존재 단언에서 실패 |

- 세 RED 모두 `--reporter=tap-flat` 보고서로 분류기를 통과시킨 뒤 GREEN 으로 갔다. semanticAssessment 는 증거 JSON 에 적었다(스크래치 파일이라 커밋하지 않고 삭제).
- REFACTOR 커밋은 없다(GREEN 에서 `allyNicknames` 로 동료 계산을 한 곳에 모았다).
- 트레이서 게이트: Task 1 의 `<verify>` 가 자동 검증만이라(`end-of-phase`) 확장 전에 phaseScreens 테스트 + typecheck 를 다시 돌려 통과를 확인하고 이어갔다.

## Task Commits

1. **Task 1: 트레이서 — 역할 확인 카드·15초 타이머·뒤집기** — `9650d4e` (test), `529c003` (feat)
2. **Task 2: 배정 연출·낮 발표·단계 안내·대기실 연결** — `40fe81e` (test), `0e3f619` (feat)
3. **Task 3: [내 역할] 시트** — `a1f8c03` (test), `5d2d2d9` (feat)

**Plan metadata:** 이 SUMMARY 커밋(docs 01-13)

## Files Created/Modified

- `src/screens/RoomScreen.tsx` — 단계 switch·myRoleOpen/seenFront·aria-live·대기실 연결·preloadRoleAssets
- `src/screens/Assigning.tsx` — S-04 배정 연출
- `src/screens/RoleReveal.tsx` — S-05 역할 확인(cardFace 상태, setTimeout 하나, onSeenFront)
- `src/screens/Day.tsx` — S-06 낮 시작 발표
- `src/components/MyRoleSheet.tsx` — C-01 내 역할 시트
- `src/components/PhaseBar.tsx` — 제목·안내·오른쪽 슬롯·타이머 배치
- `src/styles/phase.css` — `.mf-phasebar*`, `.mf-reveal*`, `.mf-assign*`, `.mf-day*`, `.mf-phase-enter`, `.mf-sr-only`, `.mf-myrole-sheet*`
- `src/components/RoleCard.tsx` — 뒷면 `Diamond` 내보냄(시트의 정적 뒷면이 같은 그림을 쓰도록)
- `src/game/roleText.ts` — `allyNicknames(view)` 추가(카드와 시트가 같은 동료 계산을 씀)
- `test/client/phaseScreens.test.tsx` — 29개 화면 테스트

## Decisions Made

- 시트 뒷면 판정은 `view.phase === "roleReveal" && !seenFront`, seenFront 는 대기실·배정으로 돌아가면 거짓으로 되돌린다.
- aria-live 영역은 `role="status"` 를 쓰지 않는다(토스트의 `role="status"` 테스트와 섞이지 않게).
- 진홍은 phase.css 에서 300·400·500 만 쓴다(새 사용 없음). 동료 줄 crimson-300 은 기존 예약 4번을 시트에서 재사용.
- 참고 자료(`design/screens/05_B5_Role.png` 등)와 다르게 한 곳: 설계서 S-06 의 "토론 전에 먼저 직업을 공개해요"·직업 공개 화면은 2페이즈 몫이라 넣지 않았고, C-01 의 조사 기록·소리 켜기도 범위 밖이다(plan 의 명시 사항).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED 커밋에 RoleReveal 껍데기(null 렌더) 포함**
- **Found during:** Task 1 RED
- **Issue:** 테스트가 `RoleReveal` 을 직접 불러오므로 모듈이 없으면 RED 가 단언 실패가 아니라 로드 실패(INVALID_RED)가 된다.
- **Fix:** `src/screens/RoleReveal.tsx` 에 props 모양만 있고 `null` 을 그리는 껍데기를 RED 커밋(`9650d4e`)에 같이 넣고 GREEN 에서 구현으로 교체했다.
- **Files modified:** src/screens/RoleReveal.tsx
- **Verification:** `check tdd-red-evidence` → RED_EVIDENCE_OK
- **Committed in:** `9650d4e`

**2. [Rule 3 - Blocking] 테스트 단언을 한 줄 메시지로**
- **Found during:** Task 1 RED
- **Issue:** `getBy*` 실패 메시지가 DOM 전체를 여러 줄로 찍어 TAP 보고서가 `Non-TAP data`/`Malformed TAP` 으로 분류기에서 거부됐다.
- **Fix:** 테스트에 `byRole`/`byText`/`card` 도우미(queryBy + expect + 사용자 메시지)를 두고, 여러 줄이 되는 matcher(`toHaveBeenCalledWith` 등)는 불리언·숫자 비교로 썼다.
- **Files modified:** test/client/phaseScreens.test.tsx
- **Committed in:** `9650d4e`, `40fe81e`

**3. [Rule 2 - Missing critical] 동료 닉네임 계산을 한 곳으로(`allyNicknames`)와 `Diamond` 내보내기**
- **Found during:** Task 3
- **Issue:** 카드(RoleReveal)와 시트(MyRoleSheet)가 같은 "me.allies → 닉네임" 계산을 각자 두면 갈라질 수 있고, 시트의 정적 뒷면은 카드와 같은 마름모여야 한다(plan files_modified 밖의 RoleCard.tsx·roleText.ts 를 최소 수정).
- **Fix:** `roleText.ts` 에 `allyNicknames(view)` 추가, `RoleCard.tsx` 의 `Diamond` 를 export. 동작 변화 없음.
- **Files modified:** src/game/roleText.ts, src/components/RoleCard.tsx, src/screens/RoleReveal.tsx
- **Verification:** 전체 vitest 588개 통과(roleCard.test 포함)
- **Committed in:** `5d2d2d9`

**4. [Rule 3 - Blocking] 워크트리에 node_modules 가 없어 `npm ci` 실행**
- **Found during:** 시작
- **Issue:** 새 워크트리에 의존성이 없어 vitest·tsc 를 돌릴 수 없었다.
- **Fix:** `npm ci --prefer-offline`(잠금 파일 그대로, 새 패키지 없음). `node_modules` 는 gitignore 대상이라 커밋에 없다.

---

**Total deviations:** 4 auto-fixed (Rule 3 ×3, Rule 2 ×1)
**Impact on plan:** 모두 TDD RED 유효성·중복 제거·실행 환경을 위한 것이고 범위 확장은 없다.

## Issues Encountered

- 하네스가 워크트리 안 `git` 과 `.git/worktrees/...` 경로를 섞은 복합 Bash 명령을 막아, 0c 커밋 원장(`gsd-plan-head-before-01-13`) 파일을 디스크에 남기지 못했다. `commits` 는 프롬프트의 기준 SHA(`8a5b590`)로 `git rev-list --count 8a5b590..HEAD` 를 직접 재서 `6` 으로 적었다(plan_head_before 도 같은 SHA).
- 검증 명령의 `<automated>` 에는 절대 경로가 없어 step 0c 경로 가드는 해당 없음.

## Known Stubs

없음. 하드코딩 빈 값·TODO·플레이스홀더가 화면으로 흐르지 않는다. "1일차" 는 plan 이 정한 1페이즈 고정 문구(의도된 것, 일차 번호는 낮이 반복되는 페이즈가 view 에 더한다).

## Threat Flags

없음. 새 네트워크 입구·인증 경로·스키마 변경 없이 기존 view(me.role·me.allies)를 화면에 그릴 뿐이다. 위협 등록부 T-01-44(같은 마크업 + 4종 프리로드), T-01-45(뒷면 상태에서 역할 글자·그림 미렌더), T-01-46(0:00 이후에도 서버 day 전까지 역할 확인 유지)은 모두 테스트로 확인했다. T-01-SC: 새 패키지 설치 없음.

## Verification Results

- `npx vitest run test/client/phaseScreens.test.tsx test/client/roomScreen.test.tsx test/client/lobby.test.tsx` — 통과
- `npm run typecheck` — 통과
- `npm run build` — 통과
- `npx vitest run`(전체) — 40 파일 588 테스트 통과
- 수락 기준 grep(Task 1~3 전부)과 phase.css 진홍 300·400·500 만 — 통과

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 1페이즈 사용자 이야기의 화면 조각이 모두 붙었다. 01-14 에서 배포본으로 6명 실기기 UAT(360×640 세로 스크롤 없음, 막·링·아침빛·카드 뒤집기 질감, 시트 열린 채 단계 변경)를 진행한다. 이 항목들은 coverage D6 에 `human_judgment: true` 로 남겼다.
- 오케스트레이터에게 넘기는 일(이 실행은 워크트리라 하지 않았다):
  - 웨이브 7 push 미룸 — 워크트리 병합 뒤 main 에서 HANDOFF 한 줄 갱신과 git push origin main 필요
  - 배포(`npm run deploy`)는 이 plan 에 호출이 없고 실행하지 않았다.
  - STATE.md·ROADMAP.md·HANDOFF.md 는 건드리지 않았다.

## Self-Check: PASSED

- 생성 파일 6개(Assigning·RoleReveal·Day·MyRoleSheet·PhaseBar·phaseScreens.test) 존재 확인
- 커밋 6개(`9650d4e` `529c003` `40fe81e` `0e3f619` `a1f8c03` `5d2d2d9`) 현재 브랜치 조상 확인
- 모든 Task 수락 기준 통과

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
