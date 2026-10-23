---
phase: 01-walking-skeleton
plan: 05
subsystem: ui
tags: [react, css, design-system, toast, assets, preload, vitest]

requires:
  - phase: 01-walking-skeleton
    provides: "01-02 createRoom API 와 임시 Home, 01-03 validateNickname"
provides:
  - "ds.css: 디자인 시스템 기본 부품(글자·버튼·입력칸·배경·토스트·입장 화면 틀) 이식"
  - "Button, TextField, Backdrop, Toast/useToast 부품"
  - "assets.ts: 그림 URL 단일 출처(%40, 밀도 기술자)와 프리로드 목록"
  - "copy.ts: 오류·퇴장 문구 매핑(messageForApiError, nicknameErrorText, exitReasonText)"
  - "S-01 첫 화면(방 만들기) 새 디자인"
affects: [01-06, 01-08, 01-10, 01-11, 01-12, 01-13]

actuals:
  tokens: 10400
  tasks: 3
  commits: 6
plan_head_before: f05be82611f7742219100f8b5d2b834543481d74
plan_head_after: 393d3ee3b3c81d8b7eecbefe7175285f65be2d48

tech-stack:
  added: []
  patterns:
    - "디자인 시스템 bundle.css 의 mf-* 클래스 이름을 그대로 옮긴 ds.css(토큰 변수만, hex 없음)"
    - "오류 문구와 위치를 한 곳(copy.ts)에서 닫힌 코드 집합으로 매핑"
    - "그림 URL 은 assets.ts 한 모듈에서만 만들고 import.meta.glob 테스트로 실제 파일 존재를 보장"
    - "토스트는 상태 한 칸 + id 로 타이머 재시작"

key-files:
  created:
    - src/styles/ds.css
    - src/components/Button.tsx
    - src/components/TextField.tsx
    - src/components/Backdrop.tsx
    - src/components/Toast.tsx
    - src/net/assets.ts
    - src/net/copy.ts
    - test/unit/assets.test.ts
    - test/unit/copy.test.ts
  modified:
    - src/main.tsx
    - src/screens/Home.tsx
    - test/client/screens.test.tsx
    - test/client/app.test.tsx

key-decisions:
  - "TextField 닉네임 maxLength 는 32: 9글자 이상도 입력되게 두고 오류 문장으로 알린다(8로 막으면 '9글자 이상 오류' 가 나올 수 없다)"
  - "방 만들기에서 나올 수 없는 코드(ROOM_FULL 등)와 맥락 밖 CODE_EXHAUSTED 는 서버 내부 정보 없이 '연결이 불안정해요' 토스트로 접는다(T-01-18)"
  - "제출은 정규화된 닉네임(validateNickname 결과)으로 보낸다"
  - "토스트는 fixed + margin auto + width fit-content 로 가운데 정렬(transform 은 들어오는 애니메이션 전용)"

patterns-established:
  - "Pattern: 화면 오류 상태는 서버 오류(serverNicknameError)와 입력 검사 오류(touched 뒤)를 분리하고, 칸을 고치면 서버 오류를 지운다"
  - "Pattern: 부품은 interfaces 의 props 그대로, 클래스 조합은 배열 filter·join"

requirements-completed: [ROOM-01]

coverage:
  - id: D1
    description: "S-01 첫 화면: 입장 배경 위 소개·미니피아·닉네임 입력 카드·[방 만들기]·버전, 방 만들기 결과로 대기실 진입"
    requirement: "ROOM-01"
    verification:
      - kind: unit
        ref: "test/client/screens.test.tsx#Home 첫 화면 구성 / 방 만들기"
        status: pass
      - kind: unit
        ref: "test/client/app.test.tsx#서비스 이름 제목과 빌드 버전을 보여 준다"
        status: pass
    human_judgment: true
    rationale: "배경 그림 위 레이아웃·글자 대비가 화면설계서 S-01 과 같아 보이는지는 자동 테스트가 단언하지 않는다(실기기 폭 360px 확인은 01-10)"
  - id: D2
    description: "닉네임 검사(처음엔 오류 없음, 9글자·쓸 수 없는 글자), 요청 중 잠금, 네트워크·한도·서버 거부 문구와 위치, 토스트 2초"
    requirement: "ROOM-01"
    verification:
      - kind: unit
        ref: "test/client/screens.test.tsx#Home (오류 문구·토스트·중복 제출 케이스)"
        status: pass
      - kind: unit
        ref: "test/unit/copy.test.ts#messageForApiError (Error state 표)"
        status: pass
    human_judgment: false
  - id: D3
    description: "그림 URL 단일 출처(%40, 밀도 기술자, 프리로드 목록)가 public/ 실제 파일과 일치"
    requirement: "ROOM-01"
    verification:
      - kind: unit
        ref: "test/unit/assets.test.ts#실제 파일과의 일치"
        status: pass
    human_judgment: false
  - id: D4
    description: "ds.css 규칙: hex 없음, 글자 크기 14/16/24/36, 진홍은 crimson-300(입력 오류)만"
    verification:
      - kind: other
        ref: "grep 인수 기준 3개(Task 1 acceptance_criteria)"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 05: 새 첫 화면(S-01)과 기본 부품 Summary

**디자인 시스템 기본 부품(Button·TextField·Backdrop·Toast + ds.css)으로 화면설계서 S-01 첫 화면을 다시 만들고, 오류 문구 매핑(copy.ts)과 그림 URL 단일 출처(assets.ts, %40·srcSet·프리로드)를 고정했다.**

## Performance

- **Duration:** 약 15분
- **Completed:** 2026-10-23
- **Tasks:** 3
- **Files modified:** 13 (생성 9, 수정 4)

## Accomplishments

- 주소를 열면 달이 큰 입장 배경 위에 소개 "친구들과 한 판, 점심시간 마피아", "미니피아", 반투명 남색 입력 카드(닉네임 입력칸, [방 만들기]), 카드 아래 `v{버전}` 이 보이고, 방 만들기 결과의 코드·토큰으로 대기실에 들어간다(ROOM-01).
- 닉네임 검사: 처음엔 오류 문장 없이 버튼만 꺼지고, 한 번 입력한 뒤부터 칸 아래에 `role="alert"` 문장과 `aria-invalid`·2px `--crimson-300` 테두리. 요청 중 버튼이 꺼져 두 번 전송되지 않는다.
- 네트워크 오류·방 만들기 한도는 아래 토스트(알약, `role="status"`, 2초, 한 번에 하나), 서버의 닉네임 거부는 칸 아래. 입력값은 지우지 않는다.
- copy.ts 가 UI-SPEC Error state 표의 모든 행을 같은 문구·위치로 돌려주고 it.each 로 전부 검증한다.
- assets.ts 가 모든 그림 URL 을 만들고(`@` → `%40`, 인물 `2x/4x`, 직업 `1x/2x`), `import.meta.glob` 테스트가 모든 URL 이 `public/` 의 실제 파일인지 확인한다. 첫 화면 마운트 때 입장 화면 목록을 `preload` 한다.

## Task Commits

TDD(`tdd=true`)로 Task 마다 RED(test) → GREEN(feat) 커밋.

1. **Task 1: 트레이서 — 새 첫 화면** - `13cc216` (test) → `dcd64dc` (feat)
2. **Task 2: 닉네임 검사·잠금·오류 문구·토스트** - `216a6a5` (test) → `7d44b96` (feat)
3. **Task 3: 그림 URL 헬퍼·srcSet·프리로드** - `98930be` (test) → `393d3ee` (feat)

**Plan metadata:** 이 SUMMARY 를 담은 `docs(01-05)` 커밋.

트레이서 피드백 게이트: 모드 `end-of-phase`, 대화형, `<verify>` 가 자동 명령뿐이라 `vitest`·`typecheck`·`build` 를 다시 돌려 통과를 확인하고 확장 Task 로 넘어갔다(`⚡ Tracer verified end-to-end — expanding`).

## Files Created/Modified

- `src/styles/ds.css` - bundle.css 에서 옮긴 글자·버튼·입력칸·배경 규칙, 입장 화면 틀(`.mf-entry*`, `.mf-version`), 토스트
- `src/components/Button.tsx` / `TextField.tsx` / `Backdrop.tsx` / `Toast.tsx` - 기본 부품(Toast 는 `useToast` 포함)
- `src/net/assets.ts` - 그림 URL 단일 출처와 프리로드
- `src/net/copy.ts` - 오류·퇴장 문구 매핑
- `src/screens/Home.tsx` - S-01 새 첫 화면
- `src/main.tsx` - `ds.css` 전역 import(base.css 다음)
- `test/unit/assets.test.ts`, `test/unit/copy.test.ts`, `test/client/screens.test.tsx`, `test/client/app.test.tsx`

## TDD Gate Compliance

세 Task 모두 `test(01-05)` RED 커밋이 `feat(01-05)` GREEN 커밋보다 앞선다. REFACTOR 커밋은 없다(정리할 변경이 없었다).

- **RED 평가(의미 검사):** 이 계획은 `type: execute` 라 형식 판정기(`check tdd-red-evidence`)용 TAP 기록은 만들지 않고, 실행 결과를 직접 읽어 판정했다.
  - Task 1: App 스모크가 `heading "미니피아"` 를 찾지 못하고(기존 제목은 "minifia"), Home 구성 테스트가 같은 이유로 실패했다. 계획한 단언에서 실패했다.
  - Task 2: 화면 케이스 7개가 계획한 단언(`role="alert"` 없음, 문구 불일치, `role="status"` 없음)에서 실패했다. `copy.test.ts` 는 처음에 모듈이 없어 로드 실패(INVALID_RED 에 해당)였으므로, 빈 문구를 돌려주는 뼈대 `copy.ts` 를 RED 커밋에 넣어 24개가 모두 단언(`expected '' to be …`)에서 실패하도록 고쳤다.
  - Task 3: 같은 이유로 빈 값 뼈대 `assets.ts` 를 RED 커밋에 넣었고, 처음 우연히 통과하던 3개(자리 번호 mod, 프리로드 호출 횟수, `@` 없음)는 비어 있는 값에서도 통과하지 못하게 단언을 강화한 뒤 8개 실패를 확인했다.

## Decisions Made

- 닉네임 `maxLength` 를 32 로 둔다. 8로 막으면 9글자 입력이 불가능해 "9글자 이상 → 칸 아래 오류" 동작을 보여 줄 수 없다. 극단적 붙여넣기만 막는다.
- 방 만들기 맥락에서 나올 수 없는 코드와 맥락 밖 CODE_EXHAUSTED 는 "연결이 불안정해요" 토스트로 접는다(T-01-18, 서버 내부 정보 비노출).
- 제출 본문은 입력 원문이 아니라 `validateNickname` 이 정규화한 닉네임이다(서버도 같은 규칙으로 다시 정규화).
- 토스트 가운데 정렬은 `fixed` + `margin: 0 auto` + `width: fit-content` 로 한다. `transform` 을 가운데 정렬에 쓰면 들어오는 애니메이션(translateY)과 겹친다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 개행 닉네임 테스트를 탭 문자로 대체**
- **Found during:** Task 2 (RED 작성)
- **Issue:** 계획의 "줄바꿈 들어간 닉네임" 케이스는 `<input type="text">` 가 값에서 개행을 자동 제거해(브라우저 값 정화) 쓸 수 없는 글자 경로에 닿지 못한다.
- **Fix:** 같은 제어 문자(Cc) 계열인 탭(`"민\t수"`)으로 "쓸 수 없는 글자가 있어요" 를 검증했다. 서버·공유 규칙은 `shared/nickname.ts` 의 기존 단위 테스트가 줄바꿈까지 맡는다.
- **Files modified:** test/client/screens.test.tsx
- **Committed in:** 216a6a5

**2. [Rule 3 - Blocking] RED 가 유효하도록 뼈대 모듈을 RED 커밋에 포함**
- **Found during:** Task 2, Task 3
- **Issue:** 새 모듈(`copy.ts`, `assets.ts` 확장)이 없으면 테스트가 import 실패로 끝나 INVALID_RED 가 된다.
- **Fix:** 빈 값을 돌려주는 뼈대를 RED 커밋에 넣고 GREEN 에서 채웠다.
- **Files modified:** src/net/copy.ts, src/net/assets.ts
- **Committed in:** 216a6a5, 98930be

**3. [Rule 3 - Blocking] `node_modules` 가 없어 `npm ci` 로 설치**
- **Found during:** Task 1 (시작 전 환경 확인)
- **Issue:** 새 워크트리에 의존성이 없어 vitest·tsc 를 돌릴 수 없었다.
- **Fix:** `package-lock.json` 그대로 `npm ci`. 새 패키지는 추가하지 않았다(T-01-SC 유지).

---

**Total deviations:** 3 (모두 Rule 3, 범위 확대 없음)
**Impact on plan:** 계획한 동작과 산출물은 그대로이고 검증 방식만 보강했다.

## Issues Encountered

- 토스트 소멸 테스트에서 `vi.useFakeTimers()` 를 그대로 쓰면 Testing Library 의 `findBy*` 가 내부 `setTimeout` 에 막힐 수 있어 `shouldAdvanceTime: true` 로 가짜 타이머를 켜고 `act` 안에서 2000ms 를 진행했다.

## Known Stubs

없음. 빈 뼈대(`copy.ts`, `assets.ts`)는 RED 커밋에만 있었고 GREEN 에서 모두 채웠다.

## Threat Flags

없음. 새 네트워크 엔드포인트·인증 경로는 없고, 닉네임은 React 값·텍스트로만 그린다(T-01-17, `<b>` 입력이 요소가 되지 않는 테스트 포함).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 01-06(코드 참가 줄) 은 `TextField` 의 `trailing`·`kind="code"`, `.mf-field__row`, `.mf-entry__divider`, `messageForApiError(…, "home-code")` 를 그대로 쓸 수 있다.
- `exitReasonText`, `rolePreloadList`/`preloadRoleAssets`, `figureSrc`/`roleArtSrc` 는 이후 오류 화면·대기실·역할 화면 계획이 쓴다.
- `src/styles/screens.css` 는 `Lobby` 가 아직 쓰므로 그대로 두었다(01-12 가 지울 때까지 유지, 계획 지시). `base.css` 의 `.app-version`(11px·`--gray-500`)은 Home 이 더는 쓰지 않지만 다른 화면이 쓸 수 있어 손대지 않았다. 후속 계획이 확인 후 정리한다.
- 실기기 폭 360px·키보드 스크롤·대비 확인은 01-10 의 몫이다(이 계획은 jsdom 계열 테스트와 빌드까지 확인).

웨이브 3 push 미룸 — 병합 뒤 main 에서 HANDOFF 한 줄 갱신과 git push origin main 필요

## Self-Check: PASSED

- 생성 파일 9개와 수정 파일 4개 모두 존재.
- 커밋 6개(`13cc216`, `dcd64dc`, `216a6a5`, `7d44b96`, `98930be`, `393d3ee`) 모두 HEAD 의 조상.
- 전체 스위트 `npx vitest run` 164개 통과, `npm run typecheck` 와 `npm run build` 성공.
- 인수 기준(grep 8개)과 ds.css 규칙(hex 없음, 글자 크기 4종, 진홍 300 만) 통과.

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
