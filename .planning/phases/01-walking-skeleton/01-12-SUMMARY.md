---
phase: 01-walking-skeleton
plan: 12
subsystem: ui
tags: [react, dialog, bottom-sheet, web-share, clipboard, lobby, vitest]

requires:
  - phase: 01-walking-skeleton
    provides: "01-10 대기실(Lobby·Table onSeatPress/pressable·useSeatTransitions), 01-09 서버 leave·kick 처리기, 01-05 Button·Icon 부품, 01-03 shareRoom·buildRoomLink·buildShareText"
provides:
  - "Sheet: 네이티브 <dialog>.showModal() 기반 하단 시트 틀(C-01·C-03·확인 시트 공통)"
  - "ConfirmSheet: 파괴 동작 확인 시트([취소] 주 버튼·초기 포커스, 진홍 없음)"
  - "ShareSheet: C-03 친구 초대하기(방 코드·읽기 전용 링크·[공유하기]·[링크 복사])"
  - "share.ts 의 canWebShare·shareOnly·copyLink (shareRoom 은 이 둘을 엮어 동작 유지)"
  - "Lobby: [나가기]·[공유]·[링크 공유]·끊긴 사람 내보내기, onLeave prop"
  - "01-02 임시 스타일(screens.css)·.app-version 규칙 제거"
affects: [01-13, 01-14]

requirements-completed: [ROOM-01, ROOM-03]

actuals:
  tokens: 14000
  tasks: 3
  commits: 5
plan_head_before: c6e29c4ce9cc92cb19b5d5de34e7ee9bfde8c4b6
plan_head_after: 4d8123173229b802bf7568a05b928113d0a3c7d1

tech-stack:
  added: []
  patterns:
    - "열림 상태는 부모가 쥔다(마운트 = 열림, onClose 가 불리면 언마운트) — Sheet"
    - "닫기 애니메이션은 animationend 가 아니라 260ms 시간 폴백으로 끝낸다"
    - "공유·복사 호출은 클릭 처리기 첫 줄(첫 await 앞)에서 — iOS 사용자 제스처"
    - "children 이 (requestClose, closing) 함수면 시트가 닫히는 중 상태를 자식 버튼 비활성에 쓴다"

key-files:
  created:
    - src/components/Sheet.tsx
    - src/components/ConfirmSheet.tsx
    - src/components/ShareSheet.tsx
    - src/styles/sheet.css
    - test/client/sheet.test.tsx
  modified:
    - src/net/share.ts
    - src/screens/Lobby.tsx
    - src/styles/lobby.css
    - src/styles/base.css
    - src/main.tsx
    - src/components/Button.tsx
    - test/unit/share.test.ts
    - test/client/lobby.test.tsx
  deleted:
    - src/styles/screens.css

key-decisions:
  - "Sheet 의 children 함수 인자를 (requestClose) 에서 (requestClose, closing) 로 넓혔다 — Esc·막으로 닫히는 260ms 동안에도 ConfirmSheet 의 두 버튼이 꺼져야 그 사이 눌러도 onConfirm 이 가지 않는다(상위 호환)"
  - "내보내기 시트는 누른 시점의 {seat, nickname} 을 상태로 들고 있어 그사이 view 가 바뀌어도 제목이 흔들리지 않고, 확인 후 시트는 서버 판정과 무관하게 닫는다"
  - "아이콘 버튼 .mf-iconbtn(44×44)을 sheet.css 에 두고 Lobby 도 sheet.css 를 import 한다(ds.css 는 계획 범위 밖)"

duration: 15min
completed: 2026-10-23
status: complete

coverage:
  - id: D1
    description: "대기실 [나가기] → '방에서 나갈까요?' 확인 시트 → leave 전송 + 첫 화면 이동(onLeave)"
    requirement: ROOM-03
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — [뒤로] 로 방 나가기 (D-17, R17)"
        status: pass
    human_judgment: false
  - id: D2
    description: "방장이 끊긴 사람 자리를 눌러 '{닉네임}님을 내보낼까요?' 확인 후 kick 전송, 그 밖의 자리·참가자·연결 끊김 중에는 누를 버튼 없음"
    requirement: ROOM-03
    verification:
      - kind: unit
        ref: "test/client/lobby.test.tsx#Lobby — 공유 시트와 끊긴 사람 내보내기 (ROOM-01, D-16, R10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sheet 틀: showModal 열림·Esc(cancel) 가로채기·막/[닫기]/끌기 닫기·260ms 시간 폴백·StrictMode 가드, ConfirmSheet 위계·초기 포커스·닫히는 중 비활성"
    verification:
      - kind: unit
        ref: "test/client/sheet.test.tsx#Sheet — <dialog> 하단 시트 틀"
        status: pass
      - kind: unit
        ref: "test/client/sheet.test.tsx#ConfirmSheet — 파괴 동작 확인 시트 (R17)"
        status: pass
    human_judgment: true
    rationale: "포커스 가두기·닫은 뒤 포커스 복귀·손가락 끌기 감각·iOS Safari 의 <dialog> 동작은 happy-dom 이 재현하지 못한다 — 01-14 실기기 UAT(리서치 가정 A12)"
  - id: D4
    description: "C-03 공유 시트: 코드·읽기 전용 링크({origin}/r/{코드}, 토큰 없음)·[공유하기](share 없으면 숨김)·[링크 복사](2초 '복사했어요', 실패 시 전체 선택+'길게 눌러 복사하세요')·가득 참 안내"
    requirement: ROOM-01
    verification:
      - kind: unit
        ref: "test/client/sheet.test.tsx#ShareSheet — C-03 친구 초대하기 (ROOM-01, R10)"
        status: pass
      - kind: unit
        ref: "test/unit/share.test.ts#shareOnly"
        status: pass
    human_judgment: true
    rationale: "카카오톡 등 실제 공유 시트 호출·iOS 사용자 제스처 유지·링크 칸 길게 눌러 복사는 실기기에서만 확인된다(01-14 UAT, 리서치 가정 A14)"
  - id: D5
    description: "01-02 임시 스타일(screens.css, .app-version) 제거와 진홍 미사용(sheet.css·ConfirmSheet·ShareSheet 소스에 crimson·hex 없음)"
    verification:
      - kind: unit
        ref: "test/client/sheet.test.tsx#진홍 금지 (파괴 동작·공유 시트)"
        status: pass
      - kind: other
        ref: "npm run typecheck && npm run build && npx vitest run --project unit --project client"
        status: pass
    human_judgment: false
---

# Phase 1 Plan 12: 시트 틀·확인 시트·공유 시트와 대기실 나가기·내보내기 Summary

**네이티브 `<dialog>.showModal()` 하단 시트 틀 위에 확인 시트와 C-03 공유 시트를 얹어 대기실의 나가기·끊긴 사람 내보내기·친구 초대(공유하기/링크 복사 분리)를 완성하고, 01-02 임시 스타일 파일을 걷어냈다.**

## Performance

- **Duration:** 약 15분
- **Tasks:** 3 (tracer 1 + auto 2, 앞의 둘은 TDD)
- **Files modified:** 14 (생성 5, 수정 8, 삭제 1)
- **Commits:** 5 (작업 커밋) + 이 SUMMARY 커밋

## Accomplishments

- **Sheet 틀**: `<dialog className="mf-dialog">` 를 화면 전체로 두고 안의 막 div(`--scrim`)와 시트 div(최대 430px, 높이 내용만큼·80dvh 초과 시 안 스크롤)를 둔다. Esc(`cancel`)는 `preventDefault` 후 직접 닫고, 막·[닫기]·손잡이 끌기(96px 초과 또는 0.5px/ms 초과)도 같은 `requestClose` 로 간다. 닫기는 `animationend` 가 아니라 260ms 시간 폴백이라 숨겨진 탭에서도 닫힌다. StrictMode 이중 effect 는 `if (!dlg.open)` 가드로 흡수.
- **ConfirmSheet**: 제목 heading, 위 [취소](주 버튼)·아래 파괴 동작(보조 `--gray-800` 면), 열리면 포커스 [취소], 닫히는 중(Esc·막 포함) 두 버튼 비활성. 진홍 없음.
- **대기실**: 위쪽 바 왼쪽 [나가기](back, 44×44) → `send({t:"leave"})` + `onLeave?.()`; 오른쪽 [공유]; 참가자 하단 "친구가 더 오면 링크를 다시 보낼 수 있어요" + [링크 공유]; 방장이 끊긴 다른 사람 자리를 누르면 "{닉네임}님을 내보낼까요?" → `send({t:"kick", seat})`. 연결된 사람·내 자리·참가자 화면·`canSend` 거짓일 때는 누를 버튼이 없다. 내보내기 확인 뒤 시트는 서버 판정과 무관하게 닫히고 화면은 다음 view 대로 그린다.
- **ShareSheet(C-03)**: 방 코드(36px, 글자 사이 띄움), 읽기 전용 링크 칸(`{origin}/r/{코드}`, 포커스 시 `select()` + `setSelectionRange`), [공유하기](`navigator.share` 가 없으면 숨김), [링크 복사](성공 2초 "복사했어요"·시트 유지, 실패 시 링크 칸 선택 + "길게 눌러 복사하세요"), 8자리 다 차면 "방이 가득 찼어요". 공유·복사 호출은 클릭 처리기 첫 줄(첫 await 앞).
- **share.ts**: `canWebShare`·`shareOnly`(shared/cancelled/failed)·`copyLink`(copied/failed) 추가, 기존 `shareRoom` 3단 체인은 이 둘로 다시 엮어 01-03 테스트 전부 그대로 통과. 공유 데이터는 title·text·url 뿐.
- **정리**: `src/styles/screens.css` 삭제와 `main.tsx` import 제거, `base.css` 의 `--gray-500` 글자 `.app-version` 규칙 제거(옛 클래스 사용처 없음 확인).

## Task Commits

1. **Task 1 (tracer): [뒤로] 로 확인 시트를 열어 방을 나간다**
   - RED `89ab486` (test) — RED_EVIDENCE_OK
   - GREEN `1e2c6d4` (feat)
2. **Task 2: 내보내기와 공유 시트**
   - RED `ec63803` (test) — RED_EVIDENCE_OK
   - GREEN `892e3cd` (feat)
3. **Task 3: 01-02 임시 스타일 정리** — `4d81231` (chore)

**Plan metadata:** 이 SUMMARY 를 담는 `docs(01-12)` 커밋.

트레이서 피드백 게이트: 대화형·`end-of-phase`·`<verify>` 가 `<automated>` 뿐이라 확장 전에 `npx vitest run test/client/sheet.test.tsx test/client/lobby.test.tsx` 를 다시 돌려 통과(49 tests) 확인 → "Tracer verified end-to-end — expanding" 후 Task 2 진행.

## TDD Gate Compliance

| 작업 | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| Task 1 | `89ab486` test(01-12) | `1e2c6d4` feat(01-12) | 없음 |
| Task 2 | `ec63803` test(01-12) | `892e3cd` feat(01-12) | 없음 |

**RED 증거 (1)**: 명령 `npx vitest run test/client/lobby.test.tsx --reporter=tap` (exit 1). 대상 테스트 "[나가기] → '방에서 나갈까요?' → 시트의 [나가기] → send leave 와 onLeave 가 각각 한 번". `gsd check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`, 35개 중 5개 실패). 실제 실패: `Unable to find an accessible element with the role "button" and name "나가기"`. **semanticAssessment**: Lobby 에 [나가기] 아이콘 버튼이 아직 없어 대상 테스트가 계획한 단언(버튼 찾기)에서 실패했다. 문법·로드·픽스처 오류 아님. (같은 커밋의 `sheet.test.tsx` 는 `Sheet`·`ConfirmSheet` 모듈이 아직 없어 import 단계에서 실패하는 것이 정상이며, 신규 부품 파일의 RED 는 원래 이 모양이라 증거 명령에는 넣지 않았다.)

**RED 증거 (2)**: 명령 `npx vitest run test/unit/share.test.ts test/client/lobby.test.tsx --reporter=tap` (exit 1). 대상 테스트 "방장이 끊긴 서준 자리를 누르면 '서준님을 내보낼까요?' → [내보내기] → send kick seat 1". `RED_EVIDENCE_OK`. 실제 실패: `Unable to find an accessible element with the role "button" and name "서준, 연결 끊김"`. **semanticAssessment**: Lobby 가 끊긴 자리를 누를 수 있게(pressable) 하지 않아 대상 테스트가 버튼 찾기 단언에서 실패했다. 같은 실행의 share.test 실패는 아직 없는 함수(canWebShare·shareOnly·copyLink) 호출이다.

RED 기록 파일(`.red-*.json`, TAP 원문)은 작업 폴더에만 두고 커밋하지 않았다.

## Files Created/Modified

- `src/components/Sheet.tsx` — `<dialog>` 하단 시트 틀(닫기 폴백·끌기·StrictMode 가드)
- `src/components/ConfirmSheet.tsx` — 파괴 동작 확인 시트
- `src/components/ShareSheet.tsx` — C-03 공유 시트
- `src/styles/sheet.css` — `.mf-dialog`·`.mf-sheet*`·`.mf-iconbtn`·`.mf-share*` (진홍·hex 없음, 240ms 는 지역 상수)
- `src/net/share.ts` — `canWebShare`·`shareOnly`·`copyLink` 추가, `shareRoom` 재조립
- `src/screens/Lobby.tsx` — 나가기·공유·링크 공유·내보내기 연결, `onLeave` prop
- `src/styles/lobby.css` — 위쪽 바 좌우 아이콘 버튼 배치, 참가자 하단 재공유 줄
- `src/components/Button.tsx` — `ref` prop 전달
- `src/main.tsx`, `src/styles/base.css` — 임시 스타일 import·`.app-version` 제거
- `src/styles/screens.css` — 삭제
- `test/client/sheet.test.tsx`(신규), `test/client/lobby.test.tsx`, `test/unit/share.test.ts` — 테스트

## Decisions Made

key-decisions 참조. 그 밖에 "시트 열림 상태는 Lobby 가 쥔다"(계획 그대로)와 "내보내기 시트는 누른 시점의 닉네임을 들고 있는다"를 따랐다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Button 이 ref 를 받지 못해 ConfirmSheet 의 첫 포커스 대상을 지정할 수 없었다**
- **Found during:** Task 1
- **Issue:** `Sheet.initialFocusRef` 가 [취소] 버튼을 가리켜야 하는데 01-05 의 `Button` 이 `ref` 를 `<button>` 으로 넘기지 않았다. 계획 files_modified 에 Button.tsx 가 없다.
- **Fix:** `ButtonProps` 에 `ref?: Ref<HTMLButtonElement>` 를 더하고 `<button ref={ref}>` 로 전달(React 19 는 함수 부품이 `ref` 를 prop 으로 받는다). 동작 변화 없음.
- **Files modified:** `src/components/Button.tsx`
- **Verification:** sheet.test "열리면 포커스가 [취소] 에 있다", 전체 client 스위트 통과
- **Committed in:** `1e2c6d4`

**2. [Rule 2 - Missing Critical] 닫히는 중 상태를 자식에게 전달**
- **Found during:** Task 1
- **Issue:** 계획의 `children: (requestClose) => ...` 만으로는 Esc·막 누르기로 닫히는 260ms 동안 ConfirmSheet 버튼이 켜져 있어, 그 사이 [나가기]·[내보내기]를 누르면 닫는 중에도 `onConfirm`(leave·kick 전송)이 갈 수 있다. 계획 must_haves "누른 뒤 닫히는 동안 두 버튼이 꺼진다" 위반 가능.
- **Fix:** render-prop 시그니처를 `(requestClose, closing)` 으로 넓혔다(기존 한 인자 사용처와 호환).
- **Files modified:** `src/components/Sheet.tsx`, `src/components/ConfirmSheet.tsx`
- **Verification:** sheet.test "Esc 로 닫히는 동안에도 두 버튼이 꺼진다"
- **Committed in:** `1e2c6d4`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** 둘 다 계획의 완료 기준을 지키기 위한 최소 변경이다. 범위 확대 없음.

## Issues Encountered

- 새 워크트리에 `node_modules` 가 없어 `npm ci`(잠금 파일 그대로, 새 패키지 없음)로 설치했다. T-01-SC 와 무관.
- 워크트리 격리 샌드박스가 `.git/worktrees/...` 아래 파일 쓰기와 복합 git 명령을 막아, 계획 커밋 장부(`gsd-plan-head-before-01-12`) 파일은 만들지 못했다. `plan_head_before` 는 디스패치 때 받은 기준 커밋 `c6e29c4` 를 그대로 쓰고 `git rev-list --count c6e29c4..HEAD` 로 측정했다(5).
- 계획 acceptance 의 `grep "export function shareOnly"` 를 맞추려고 `shareOnly`·`copyLink` 를 `export function` 이 안쪽 `async` 함수를 감싸는 모양으로 썼다. 동작은 같고 `nav.share`·`writeText` 는 호출 즉시(첫 await 앞) 불린다.

## Known Stubs

없음.

## Threat Flags

없음. T-01-42(공유 데이터에 토큰·세션 값 없음)는 share.test(`title·text·url` 만)·sheet.test(링크 값·share 인자)가, T-01-43(내보내기 버튼 노출은 표시용·판정은 서버)은 Lobby 의 `pressable` 조건이 맡고 서버 kickPlayer 가 다시 판정한다. 새 패키지 설치 없음(T-01-SC).

## User Setup Required

None - no external service configuration required.

## 미룬 일 (오케스트레이터)

- **웨이브 6 push 미룸 — 병합 뒤 main 에서 HANDOFF 한 줄 갱신과 git push origin main 필요** (다음 웨이브 끝 push 나 01-14 가 함께 올린다). 이 실행은 병렬 워크트리(`worktree-agent-…` 브랜치)라 계획 "실행 메모" 1번 조건(본 작업 트리의 main)에 맞지 않아 HANDOFF.md 를 고치지도 push 하지도 않았다. 제안 문구: `- **1페이즈 실행 중 — 웨이브 6 까지 완료** (2026-10-23): 01-01~01-12 완료, 다음 웨이브 7(01-13). 상세는 각 SUMMARY`, "다음 할 일" 첫 항목은 `/gsd-execute-phase 1` 로 웨이브 7(01-13) 부터.
- STATE.md·ROADMAP.md 는 지시대로 건드리지 않았다. 배포(`npm run deploy`)도 하지 않았다.

## Next Phase Readiness

- 01-13 은 `Sheet`(showClose, `initialFocusRef`, `(requestClose, closing)` render-prop)를 그대로 써서 내 역할 시트(C-01)를 만들고, `RoomScreen` 이 `<Lobby onLeave={() => onExit("left")} />` 를 넘기면 된다(지금 `RoomScreen` 은 `onLeave` 를 아직 넘기지 않으므로 나가기 확인 뒤 `leave` 전송만 일어나고 서버가 닫는 소켓의 `removed` 로 첫 화면에 간다 — 01-13 에서 연결).
- 실기기에서만 확인되는 것(01-14 UAT): `<dialog>` 포커스 가두기·닫은 뒤 포커스 복귀·끌어서 닫기 감각(A12), 카카오톡 실제 공유·iOS 제스처 유지·링크 칸 길게 눌러 복사(A14), 360×640 에서 참가자 하단 시트가 늘어난 만큼 장면이 줄어도 세로 스크롤이 없는지(A15).
- 시트·토스트·확인 시트의 새 모양은 디자인 시스템 아티팩트에 아직 없다(R18) — 앱은 UI-SPEC 을 따르고 아티팩트는 계획 밖에서 맞춘다.

## Self-Check: PASSED

- 생성 파일 존재 확인: Sheet.tsx·ConfirmSheet.tsx·ShareSheet.tsx·sheet.css·sheet.test.tsx FOUND, screens.css 삭제 확인
- 커밋 존재 확인: 89ab486·1e2c6d4·ec63803·892e3cd·4d81231 모두 HEAD 의 조상
- 전체 검증: `npm run typecheck && npm run build && npx vitest run --project unit --project client` 통과(29 파일, 502 테스트)
- acceptance_criteria 전부 통과(Task 1: 3/3, Task 2: 4/4, Task 3: 4/4)

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
