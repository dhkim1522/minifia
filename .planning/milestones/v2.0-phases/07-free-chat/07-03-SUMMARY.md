---
phase: 07-free-chat
plan: "03"
subsystem: chat-ui
tags: [ChatPanel, HeadStack, V2Icon, chatUi, chatText, IME, composition, react19, happy-dom, tdd, vitest]

requires:
  - phase: 06-world-skeleton
    provides: "src/components/v2 이식 규약(HeadStack·V2Icon·TopToast)과 v2.css, 이름표 층"
  - phase: 07-free-chat
    plan: "02"
    provides: "shared/game/chatRules.ts 의 CHAT_MAX_GRAPHEMES(입력칸 maxlength 100)"
provides:
  - "src/components/v2/ChatPanel.tsx: ChatPanel·ChatPanelMessage·ChatPanelProps — 기록 칸 + 입력줄 + 막힘 알림 + 새 메시지 점, form onSubmit 한 길 IME 안전 제출"
  - "src/components/v2/HeadStack.tsx: typing 속성 — 이름표 위 mv-typing 알약(점 세 개)과 data-typing"
  - "src/components/v2/V2Icon.tsx: send·ghost·roleMafia 세 아이콘(bundle.js 경로 그대로)"
  - "src/game/chatUi.ts: 패널 치수(LOG_H·로비 +154·테이블 +92·키보드 150)와 클라이언트 시각 상수 한 곳"
  - "src/game/chatText.ts: CHAT_TEXT — 접근성 이름·placeholder·막힘·시스템 줄 문구 한 곳"
affects: [07-05, 07-13, 07-15, 07-18, 07-19, 07-21, 08-vote-screens, 09-night-screens, 10-emotes, 11-result]

actuals:
  tokens: 18200
  tasks: 3
  commits: 8
plan_head_before: b1795c0ad95d4cb0df18608e90091778fef7c2a3
plan_head_after: 7dfa4a189a3fea8f3a0082e5e88a9ba43ce29d7c
commits: 8

tech-stack:
  added: []
  patterns:
    - "승인 v2.0 부품 이식: 첫 줄 import v2.css, 머리 주석에 승인 출처·속성 범위, 같은 mv-* 클래스, 본문은 React 텍스트 노드만"
    - "제출은 form onSubmit 한 길, 값은 보낼 때 DOM 입력칸에서 읽고 onChange 에서 가공하지 않음"
    - "역할 단어 문구는 channelUi 분기 안에서만 읽어 시민 편(channel all) DOM 에 0건"
    - "최신 속성 ref(latest) + 타이머·ref 로 조합 대기·중복 제출·꼬리 글자 판정"
    - "TAP 보고서가 한 줄 메시지로 남도록 RED 단언은 스칼라(join/boolean)로 비교"

key-files:
  created:
    - src/components/v2/ChatPanel.tsx
    - src/game/chatUi.ts
    - src/game/chatText.ts
    - test/client/chatPanel.test.tsx
    - test/unit/chatUi.test.ts
  modified:
    - src/components/v2/HeadStack.tsx
    - src/components/v2/V2Icon.tsx
    - src/styles/v2.css
    - test/client/v2parts.test.tsx

key-decisions:
  - "기록 칸 아래 붙이기는 justify-content: flex-end 대신 첫 줄 margin-top: auto — flex-end 는 넘친 윗부분이 스크롤로 닿지 않는 알려진 문제가 있다"
  - "새 메시지 점이 줄과 함께 스크롤되지 않게 기록 칸을 div.mv-chat__logbox(relative)로 감싸고 점은 그 바깥 형제로 둔다"
  - "줄 이름은 승인 b 대신 span.mv-chat__name(굵기 400) — UI-SPEC 이 굵기를 올리지 않기로 했고 본문 HTML 시험이 b 요소 0건을 요구한다"
  - "꼬리 글자 판정은 보낸 지 500ms 안에 끝난 조합의 입력칸 값이 보낸 문장의 끝부분일 때만 비운다(가정 A2), 창은 TAIL_WINDOW_MS"
  - "입력칸 maxlength 는 shared/game/chatRules 의 CHAT_MAX_GRAPHEMES(100)를 써서 서버 상수와 한 곳을 본다"

patterns-established:
  - "채널 아이콘: 입력칸 안은 span.mv-chat__chan(20px, 장식), 기록 줄 앞은 span.mv-chat__mark(14px, 보는 사람이 유령일 때만)"
  - "막힘 알림은 기록 칸 마지막 자식 p[data-chat-notice][role=status], 뜰 때 바닥으로 스크롤"
  - "자동 스크롤은 직전 렌더의 바닥 24px 이내 여부(atBottomRef)와 마지막 줄 key 변화로 판정"

requirements-completed: [CHAT-01, CHAT-04, CHAT-05]

coverage:
  - id: D1
    description: "ChatPanel — 입력 → form 제출 → onSend 한 번 → 칸 비움·포커스 유지 → 받은 줄 그리기, 낙관적 표시 없음"
    requirement: CHAT-01
    verification:
      - kind: unit
        ref: "test/client/chatPanel.test.tsx#ChatPanel 입력줄 제출 한 길 (CHAT-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "한글 조합 중 제출은 compositionend 를 최대 100ms 기다려 한 번, 300ms 중복 무시, 보낸 직후 꼬리 글자 비우기 (이벤트 순서)"
    requirement: CHAT-05
    verification:
      - kind: unit
        ref: "test/client/chatPanel.test.tsx#ChatPanel 한글 조합 중 제출 (UI-SPEC 한글 입력, 합격 검사 4)"
        status: pass
    human_judgment: true
    rationale: "happy-dom 은 실제 IME 를 재현하지 못한다. 실제 조합 중 Enter 는 07-19 Chromium CDP imeSetComposition 과 07-21 iPhone 실기기 확인이 닫는다(합격 검사 4)"
  - id: D3
    description: "HeadStack 입력 중 알약(점 세 개, 글자 없음, data-typing)과 mv-typing 치수, 모션 줄이기 정지"
    requirement: CHAT-04
    verification:
      - kind: unit
        ref: "test/client/v2parts.test.tsx#HeadStack 입력 중 칸 (CHAT-04, 07-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "채널 모양(마피아·유령 입력칸 이름·placeholder·앞 아이콘, 시민 편 DOM 에 역할 단어 0건)과 막힘 알림·새 메시지 점"
    requirement: CHAT-05
    verification:
      - kind: unit
        ref: "test/client/chatPanel.test.tsx#ChatPanel 채널 모양 (UI-SPEC 채널별 모양, T-07-08)"
        status: pass
      - kind: unit
        ref: "test/client/chatPanel.test.tsx#ChatPanel 막힘 알림 (UI-SPEC 막힘 알림)"
        status: pass
      - kind: unit
        ref: "test/client/chatPanel.test.tsx#ChatPanel 자동 스크롤과 새 메시지 점 (UI-SPEC 기록 칸 동작)"
        status: pass
    human_judgment: true
    rationale: "실제 폭에서 가장 긴 안내('유령 채팅 · 산 사람에게 안 보여요')가 304 폭에 잘리지 않는지, 새 메시지 점 위치·44x44 누르기는 레이아웃이 있는 폰에서만 잴 수 있다(happy-dom 은 레이아웃 없음, 가정 A1)"
  - id: D5
    description: "chatUi 치수·시각 상수 한 곳(logHeightFor 경계 780, 패널 높이 식, UI-SPEC 폰 표 여섯 크기)과 V2Icon send·ghost·roleMafia"
    requirement: CHAT-01
    verification:
      - kind: unit
        ref: "test/unit/chatUi.test.ts"
        status: pass
      - kind: unit
        ref: "test/client/v2parts.test.tsx#V2Icon — 채팅 아이콘 send·ghost·roleMafia (07-03)"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 03: ChatPanel·입력 중 알약·채팅 치수 상수 Summary

**승인 v2.0 ChatPanel 을 React 19 로 옮겨 form onSubmit 한 길의 한글 IME 안전 제출(조합 대기 100ms·중복 300ms·꼬리 글자 비우기)과 채널별 입력줄·막힘 알림·새 메시지 점을 갖춘 부품으로 만들고, HeadStack 입력 중 알약·세 아이콘·패널 치수 상수를 한 곳에 고정했다**

## Performance

- **Duration:** 9min
- **Started:** 2026-11-01T12:31:22Z
- **Completed:** 2026-11-01T12:40:36Z
- **Tasks:** 3 (TDD 사이클 4회: 트레이서 · chatUi+아이콘 · ChatPanel 마무리 · HeadStack)
- **Files modified:** 9 (신규 5 + 변경 4)

## Accomplishments

- `ChatPanel` 이 화면 틀과 분리된 부품으로 완성되었다: 기록 칸(role log, aria-live polite, 높이 `logHeight` 고정)과 입력줄(입력칸 + 48x48 보내기). `onSend` 가 없으면 입력줄이 없다. 본문·닉네임은 텍스트 노드로만 그려 `<b>x</b>` 가 글자 그대로 보인다.
- 한글 조합 안전 제출: 조합 중 보내면 `compositionend` 를 최대 100ms 기다려 DOM 의 확정 값을 한 번 보낸다. 같은 문장 300ms 안 재제출은 무시하고, 보낸 직후 500ms 안에 끝난 조합이 보낸 문장의 꼬리 글자면 `onChange("")` 로 한 번 더 비운다. 보낸 뒤 포커스는 입력칸에 유지된다. Enter 는 keydown 에서 가로채지 않는다.
- 채널 모양: 마피아·유령이면 입력칸 안 왼쪽 20px 아이콘, 왼쪽 안쪽 여백 40, 접근성 이름·placeholder 가 채널 말로 바뀐다. 채널 `all` 이면 DOM 에 "마피아"·"유령"이 0건이다(T-07-08).
- 막힘 알림(기록 칸 맨 아래 한 줄, crimson-300 14px, 아이콘·nowrap 없음), 위로 읽는 중 새 줄이 오면 44x44 새 메시지 점(quiet 면 없음), 쿨다운 흐림(is-dim)·연결 끊김(aria-disabled)·키보드 열림(is-compact) 속성이 들어갔다.
- `HeadStack typing` 이 이름표 위 맨 위 칸에 `mv-typing` 알약(글자 없음, 점 세 개)과 `data-typing="true"` 를 그린다. `V2Icon` 에 send·ghost·roleMafia, `chatUi.ts` 에 패널 치수와 시각 상수, `chatText.ts` 에 채팅 문구가 한 곳에 모였다.

## TDD Gate Compliance

세 사이클 모두 RED(test) → GREEN(feat) 커밋 순서를 지켰고 REFACTOR 커밋은 없다(변경할 군더더기 없음). RED 증거는 `gsd_run check tdd-red-evidence` 로 `RED_EVIDENCE_OK`(reason `target_test_failed`)를 받은 뒤 GREEN 을 시작했다(TAP 는 `--reporter=tap-flat`, 단언 메시지는 한 줄이 되도록 스칼라 비교).

| 사이클 | RED 커밋 | 대상 시험 | RED 의미 평가(semanticAssessment) | GREEN 커밋 |
|--------|----------|-----------|-----------------------------------|------------|
| 1 트레이서 | `8b53da1` | 입력 → 보내기 활성 → 클릭 → onSend 정확히 한 번 → onChange('') → 포커스 유지 | 시험이 실제로 돌았고 뼈대 ChatPanel 이 아무것도 그리지 않아 `input[data-chat-input]` 단언에서 실패. 구문·로드 오류 아님, 의도한 이유 | `2647dfb` |
| 3a chatUi·아이콘 | `2c5b96b` | `logHeightFor(779)=96, (780)=152` 경계 | 값이 0 인 뼈대 상수·함수라 기대 96/152 단언에서 실패. 같은 시험 파일 내 DOM 비참조 시험은 통과(정상) | `f74c140` |
| 2 ChatPanel 마무리 | `58ddece` | 조합 중 제출은 compositionend 를 기다려 한 번 | 즉시 onSend 를 호출하는 Task 1 구현이라 "called +0 times, but got 1 times" 단언에서 실패. 의도한 이유 | `4c46a4f` |
| 3b HeadStack 입력 중 | `fd1d3be` | typing 이면 data-typing 과 맨 위 알약 | typing 속성이 무시되어 `data-typing` 이 없음에서 실패 | `7dfa4a1` |

## Task Commits

1. **Task 1: 트레이서 — 한 줄 보내기 한 길 (CHAT-01)** — `8b53da1` (test) → `2647dfb` (feat). 트레이서 게이트(`human_verify_mode=end-of-phase`, 자동 검증만): `<verify>` 재실행 통과 → "Tracer verified end-to-end — expanding".
2. **Task 3 앞부분: chatUi 상수 + 아이콘 (CHAT-04)** — `2c5b96b` (test) → `f74c140` (feat). Task 2 가 chatUi 상수를 import 하므로 plan 의 read_first 지시대로 먼저 실행했다.
3. **Task 2: ChatPanel 마무리 (CHAT-05)** — `58ddece` (test) → `4c46a4f` (feat)
4. **Task 3 뒷부분: HeadStack 입력 중 칸 (CHAT-04)** — `fd1d3be` (test) → `7dfa4a1` (feat)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 갱신 커밋(docs)이 따른다.

## Files Created/Modified

- `src/components/v2/ChatPanel.tsx` — 채팅 패널(기록 칸·입력줄·막힘 알림·새 메시지 점·IME 제출)
- `src/components/v2/HeadStack.tsx` — `typing` 속성과 입력 중 알약
- `src/components/v2/V2Icon.tsx` — send·ghost·roleMafia (bundle.js 경로 그대로)
- `src/styles/v2.css` — `.mv-chat*`·`.mv-typing`·`@keyframes mv-typing-dots`·`mv-chat-pulse`·모션 줄이기
- `src/game/chatUi.ts` — 패널 치수·시각 상수·`logHeightFor`·`lobbyPanelHeight`·`tablePanelHeight`
- `src/game/chatText.ts` — `CHAT_TEXT`
- `test/client/chatPanel.test.tsx` — ChatPanel 53개 시험
- `test/client/v2parts.test.tsx` — HeadStack typing·아이콘 시험 추가, 진홍 금지 시험 조정
- `test/unit/chatUi.test.ts` — 치수·상수 시험

## Decisions Made

- 기록 칸 아래 붙이기는 `justify-content: flex-end` 대신 첫 줄 `margin-top: auto` (넘친 윗부분 스크롤 문제 회피, 위 key-decisions).
- 새 메시지 점은 기록 칸 밖 형제(`div.mv-chat__logbox`)에 두어 줄과 같이 스크롤되지 않게 했다.
- `onSend` 에는 trim 하지 않은 DOM 값을 그대로 넘긴다. 공백 정리는 서버 몫(UI-SPEC 줄 종류와 모양) — 화면은 공백만인지 판정에만 trim 을 쓴다.
- 입력칸 `maxlength` 는 서버 상수와 같은 `CHAT_MAX_GRAPHEMES` 를 쓴다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 6페이즈 v2parts "진홍 토큰 금지" 시험이 이 계획의 CSS 로 깨짐**
- **Found during:** Task 3 앞부분 RED 준비(Task 1 GREEN 이후 v2parts 를 돌렸을 때)
- **Issue:** `v2parts.test.tsx` 의 "hex 색이 없고 진홍·놋쇠 토큰을 쓰지 않는다" 가 v2.css 의 `--crimson-300`(마피아 이름·막힘 알림, UI-SPEC Color 진홍 글자 예약)에 걸렸다. Task 1 GREEN 커밋(`2647dfb`) 시점에는 이 파일을 돌리지 않아 놓쳤다.
- **Fix:** 시험을 "hex 없음·놋쇠 없음·진홍은 `--crimson-300` 하나뿐이며 background/border 에 쓰지 않음" 으로 좁혀 UI-SPEC 의 규칙(진홍 면·큰 글자 금지)을 더 정확히 지키게 했다.
- **Files modified:** `test/client/v2parts.test.tsx`
- **Verification:** `npx vitest run --project client --project unit` 126 파일 통과
- **Committed in:** `2c5b96b`

**2. [Rule 1 - Bug] 기록 칸 `justify-content: flex-end` 는 넘친 윗부분이 스크롤로 닿지 않는다**
- **Found during:** Task 1 GREEN CSS 작성
- **Issue:** UI-SPEC·truths 는 "아래에서 위로 쌓이고(flex-end)" 라고 적었지만, flex-end 컬럼 컨테이너의 `overflow-y: auto` 는 위쪽으로 넘친 줄에 스크롤이 닿지 못하는 알려진 동작이 있다. 100자 6줄이 쌓이는 칸에서 오래된 줄을 읽을 수 없게 된다.
- **Fix:** `.mv-chat__log > :first-child { margin-top: auto }` 로 같은 모양(아래 붙임)을 내고 넘치면 정상 스크롤. 시험은 `overflow-y: auto` 와 min/max-height 없음을 고정.
- **Files modified:** `src/styles/v2.css`
- **Verification:** CSS 계약 시험 통과. 실제 스크롤 도달은 실기기(07-13/07-21)에서 확인할 몫
- **Committed in:** `2647dfb`

**3. [Rule 3 - Blocking] 실행 순서 조정(plan 지시 이행)**
- **Found during:** Task 2 시작 전
- **Issue:** Task 2 의 ChatPanel 이 `chatUi.ts` 의 `IME_WAIT_MS` 등을 import 해야 하는데 plan 상 chatUi 는 Task 3 몫. Task 2 read_first 가 "Task 3 의 상수부터 만든다" 고 지시.
- **Fix:** Task 3 을 chatUi·아이콘(3a)과 HeadStack(3b)으로 나눠 3a 를 Task 2 앞에서 TDD 사이클로 돌렸다(커밋 순서: Task 1 → 3a → 2 → 3b). 아이콘 `send` 는 Task 1 트레이서(보내기 버튼 아이콘)가 필요로 해서 Task 1 GREEN 에 먼저 들어갔다.
- **Files modified:** `src/game/chatUi.ts`, `src/components/v2/V2Icon.tsx`
- **Verification:** 모든 시험 통과
- **Committed in:** `2647dfb`, `f74c140`

---

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 3). 이 밖에 plan 이 열어 둔 구조 세부(아래)가 있다.
**Impact on plan:** 모두 정확성·순서 문제이며 범위 확장은 없다.

### 구조 세부 (plan 이 정하지 않은 부분)

- 기록 칸을 `div.mv-chat__logbox` 로 감쌌다(점이 스크롤되지 않게). 입력칸을 `div.mv-chat__field`(relative, flex 1)로 감쌌다(채널 아이콘 절대 위치).
- 줄 이름은 승인 `b` 대신 `span` (굵기 400).
- 채널 아이콘 래퍼 `span.mv-chat__chan`/`span.mv-chat__mark` 안에 `V2Icon`(래퍼가 색·크기 규칙을 가진다).
- RED 커밋의 뼈대: `ChatPanel.tsx`(타입만, null 렌더)와 `chatUi.ts`(값 0)를 07-02 의 선례대로 두었다. 이렇게 해야 시험이 로드되어 단언으로 실패한다(INVALID_RED 회피).
- `chatUi.ts` 에 plan 목록에 없는 `TAIL_WINDOW_MS`(500, 가정 A2)를 더했다.

## Issues Encountered

- `vitest --reporter=tap` 는 중첩 TAP 라 `check tdd-red-evidence` 가 Non-TAP 으로 거부했다. `tap-flat` 로 바꾸고, 단언 실패 메시지에 여러 줄(DOM·소스 덤프·배열 diff)이 실리지 않도록 시험을 스칼라 비교로 고쳐 `RED_EVIDENCE_OK` 를 받았다.
- 시험 "1 skipped"(전체 3690 통과 중 1)는 이 계획 이전부터 있는 것이다(`.skip(`·`.todo(` git grep 0건).

## Known Stubs

None — 이 계획의 부품들은 속성으로 받은 값만 그리며 하드코딩된 빈 값·자리표시자가 없다. 화면 틀에 붙이는 일은 07-13(로비)·07-15(테이블)·07-18(입력 중)·07-19(키보드)이다.

## Threat Flags

None — 새 네트워크 경로·인증·파일 접근 없음. T-07-07(XSS)은 텍스트 노드만 + `<b>x</b>` 렌더 시험 + 코드 grep 으로, T-07-08(역할 단어 누설)은 채널 분기 안에서만 문구를 읽고 `all` DOM 에 "마피아"·"유령" 0건 시험으로 완화했다. T-07-SC: 패키지 설치 없음.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-05(동작 라벨 표), 07-13(로비 틀), 07-15(테이블 틀), 07-18(입력 중 켜짐 판단 — `onComposingChange`·`TYPING_*` 상수·`HeadStack typing`), 07-19(키보드 `compact`·`KB_*` 상수·CDP IME)가 이 부품과 상수를 그대로 가져다 쓴다.
- 실제 IME 동작(합격 검사 4)은 happy-dom 으로 닫히지 않았다: 07-19 Chromium CDP `imeSetComposition` 과 07-21 iPhone 실기기 확인이 남아 있다. 입력칸 값을 `compositionend` 에서 동기로 읽는 선택(Safari 의 이벤트 순서)이 실기기에서 맞는지 거기서 본다.
- 부르는 쪽(틀)이 해야 할 일: `sendDim` 을 `SEND_DIM_MS` 뒤에 끄기, `notice` 를 `NOTICE_MS` 뒤에 비우기, 키보드 열림 판정 후 `compact`·`logHeight`(72) 넘기기, `inputRef` 로 포커스 제어.

## Self-Check: PASSED

- 신규·변경 9개 파일 모두 존재 확인
- 커밋 8개(`8b53da1` `2647dfb` `2c5b96b` `f74c140` `58ddece` `4c46a4f` `fd1d3be` `7dfa4a1`) 모두 HEAD 의 조상
- `npm run typecheck` 통과, `npx vitest run --project client --project unit` 126 파일 3690 통과, `git grep -F .skip( .todo(` test 0건
- 인수 기준: 각 Task 의 grep 게이트 통과(`onSubmit`·`data-chat-input`, HTML 주입 0건, `onCompositionEnd`·`data-chat-newdot`·`data-chat-notice`, Enter 가로채기 0건, 아이콘·`data-typing`·`mv-typing`·`LOBBY_PANEL_EXTRA = 154`·`TYPING_PILL_H = 22`)

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
