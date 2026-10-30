---
phase: 04-execution-verdict
plan: 24
subsystem: verdict-screens-intro-cards
tags: [ExecIntroCard, NoExecutionCard, SceneIntro, delayMs, layer, usePhaseArrival, reduced-motion, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-13 verdict.ts(EXEC_INTRO_MS·NO_EXEC_CARD_MS·NO_EXEC_INTRO_DELAY_MS·noExecutionText·noExecutionPrefix·VERDICT_TEXT), 04-20 DayTable layer 슬롯, 04-16 useVerdictScene·ExecVotePanel, 04-23 usePhaseArrival 를 verdictScene 에서 쓰는 방식, 03-10 SceneIntro"
provides:
  - "ExecIntroCard — 앰버 `처형 투표` 카드(280×176). DayTable layer 슬롯 안에서 0~450ms 낙하(+4px 바운스)·450~850 정지·850~1450 면 지우기(제목 .18+흐림 1.5px)·질문 14→24px 교차 강조·셰브런 3개 120ms 간격 두 번 점등·1450~1600 전체 페이드아웃. 마운트 때 건 타이머 하나가 1600ms 뒤 onDone, 모든 층 pointer-events none, aria-hidden"
  - "NoExecutionCard — 같은 구조·위치의 회색 `처형 무효` 카드(gray-700→800, 테두리 gray-300). 이유 부제는 noExecutionText 에서만. 0~420 낙하(바운스 없음)·1300~1600 페이드아웃, 막 0→.25→0. 셰브런·질문 강조·번짐 없음"
  - "verdict.css `mf-vintro` 구역(시작·끝 표지 주석): 공유 기본 + --intro(앰버) + --void(회색) + 키프레임 mf-vi-* + 축소 모션 분기(낙하·바운스·셰브런 이동 없음, 페이드만)"
  - "verdict.ts: INTRO_CARD_* 상수와 introCardGeometry(sceneW, sceneH, pad?) → {top: cy−105, chevH: clamp(96, 장면 아래−카드 아래끝−16, 230)}"
  - "SceneIntro 선택 prop delayMs(기본 0) — 0 이면 마크업·타이머 불변, 양수면 지연 뒤 표시·onDone 은 delayMs + 2초"
  - "verdictScene — execVote: 같은 접속의 discussion → execVote(arrivedFrom)에서만 ExecIntroCard 를 layer 로(일차 열쇠로 한 번), ExecVotePanel `introActive` 로 집계 줄 회색 문구 교체. night: noExecution 이 있으면 introDelayMs 와(같은 접속 execVote/candidateVoteReveal 도착일 때만) NoExecutionCard layer 를 담은 부분 결과. VerdictScene 필드 전부 선택"
  - "DayScene — 필드마다 `verdict?.field ?? 기존` (title·instruction·calm·seatPatch·bottom), SceneIntro 에 delayMs 연결. RoomScreen — 처형 무효로 온 밤 안내 앞에 `처형 무효. {부제}. ` 접두"
affects: [04-25~04-29 — 종료·결과 화면이 같은 verdictScene 을 이어 쓴다(필드가 선택이므로 새 분기는 필요한 필드만 채운다), 04-30 — E2E 에 인트로 카드·무효 카드·밤 시작 문구 지연, 04-35 — 배포본 실기기 확인]

actuals:
  tokens: 13500
  tasks: 3
  commits: 6
plan_head_before: 969e21570f88bacff9ed2c98090cf881c0ae9ef8
plan_head_after: a9a7fa66a6e74a07e9db98914df90dd0af0790a1

tech-stack:
  added: []
  patterns:
    - "카드 연출은 DayTable layer 슬롯의 한 요소(.mf-vintro, z 70)로 그리고 장면 기하(cy)는 introCardGeometry 한 곳에서만 얻는다. 막은 위·아래로 뻗어 .mf-dayscene 의 잘림에 맡긴다"
    - "한 번만 켜지는 도착 연출: usePhaseArrival 이 직전 단계를 알려 줄 때 렌더 중 상태 조정으로 켜고(열쇠 = 일차 n), 자기 타이머로 끝낸 뒤 같은 열쇠로 되살아나지 않는다. 재접속(epoch 변화)은 arrivedFrom null 이라 켜지지 않는다"
    - "축소 모션: 낙하·바운스·셰브런 이동은 기본 규칙에만 두고, 축소 분기는 별도 키프레임(mf-vi-fade-in)과 animation-delay 로 단계만 잇는다. 이미 페이드뿐인 것은 base.css 의 0.01ms 강제를 !important + 구체 선택자로 길이만 되돌린다"
    - "부분 반환 훅: useVerdictScene 의 필드를 모두 선택으로 바꾸고, 밤은 필요한 필드만 채운다(채울 것이 없으면 null 이라 기존 밤 경로 그대로). DayScene 은 필드마다 `?? 기존`"

key-files:
  created:
    - src/components/ExecIntroCard.tsx
    - src/components/NoExecutionCard.tsx
    - test/client/execIntro.test.tsx
    - test/client/noExecution.test.tsx
  modified:
    - src/components/ExecVotePanel.tsx
    - src/components/SceneIntro.tsx
    - src/styles/verdict.css
    - src/game/verdict.ts
    - src/screens/verdictScene.tsx
    - src/screens/DayScene.tsx
    - src/screens/RoomScreen.tsx
    - test/client/sceneIntro.test.tsx

key-decisions:
  - "P-3(사용자 확인 대기) 기본값 그대로: 무효 카드는 인트로와 같은 모양·낙하·회색, 밤 시작 문구는 카드 뒤 1.6초부터. 같은 시각에 띄우려면 NO_EXEC_INTRO_DELAY_MS = 0 한 줄"
  - "도착 열쇠는 일차(n)다: 같은 날 execVote·밤은 한 번씩이라 마감 시각(phaseEndsAt)이 바뀌어도 카드가 되살아나지 않는다(계획의 '마감 시각 열쇠로 다시 켜지지 않는다'를 만족)"
  - "처형 무효가 아닌 밤은 useVerdictScene 이 null 을 그대로 돌려준다(계획의 '부분 결과'는 noExecution 이 있을 때만) — 처형이 이뤄진 밤·일반 밤의 DayScene 경로는 한 줄도 달라지지 않는다"
  - "DayTableLayout 에 pad 를 더하지 않았다: cy 는 pad 와 무관하고(dayTableGeometry 의 cy 는 sceneH 에서만 나온다) 카드 layout 의 pad 는 선택이다"

requirements-completed: []  # VOTE-01·VOTE-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "같은 접속에서 낮 토론 → 처형 여부 투표로 넘어갈 때만 앰버 `처형 투표` 카드가 위에서 떨어져 가운데에 서고, 카드 면이 지워지며 질문이 24px 로 다시 강조되고 셰브런이 [찬성][반대] 쪽을 가리킨 뒤 1.6초에 DOM 에서 사라진다. 카드가 떠 있어도 [찬성]·[반대] 는 눌린다 (VOTE-01, D-23·D-24·D-30·D-33)"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "execIntro.test.tsx(조건 6가지: discussion→execVote 에서만·처음 마운트·재접속·다른 전환 없음, 1599/1600ms 경계·재그리기 불연장·마감 시각 변경에도 재등장 없음·언마운트 타이머 정리, 위치 cy−105·셰브런 clamp 5개 폰, 집계 줄 회색 문구 교체, 카드 위 [찬성]·[반대] 클릭이 send, CSS 정적 단언 터치 통과·진홍/#색 없음·글자 크기 14·24·36·낙하 키프레임·축소 분기에 낙하 없음) + execVote.test.tsx 불변"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 5, testBotVote) + 헤드리스 Chrome(playwright-core) 390×844·360×640·모션 줄이기 390×844: rAF 프레임 기록에서 카드 지속 1600ms, 낙하 translate -276px → 0(바운스 포함)·rotate -5deg → 0, 막 0→.15→.35→.22→0, 850ms 부터 면 .11(1000ms)→0(1250ms)·제목 .27/blur → .18/1.5px·작은 질문 .25→0·큰 질문 .89→1, 셰브런 120ms 간격 점등 두 번, 1450ms 부터 root .33(1550ms)→.11(1584ms). 계산된 테두리 2px rgb(242,184,75), 글자 크기 {36,14,24}, 카드 모든 요소 pointer-events none, 카드 위 [찬성] 실제 클릭이 aria-pressed true, 집계 줄 회색 문구가 카드 중 `카드 뒤에서도 바로 고를 수 있어요`→사라진 뒤 `아직 5명 · …`, 콘솔 오류 0. 스크린샷 육안으로 IN2·IN3 시안과 같은 모양"
        status: pass
    human_judgment: true
  - id: C2
    description: "처형이 성립하지 않아 밤으로 올 때(반대·동률·0표) 같은 모양의 회색 `처형 무효` 카드가 이유 한 줄과 함께 1.6초 뜨고, 밤 시작 문구는 1.6초 뒤부터 2초 뜬다. 서버 밤 시간은 늘지 않고 밤 조작은 처음부터 가능하다 (VOTE-02, D-34, P-3)"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "noExecution.test.tsx(카드 단위: 세 이유 문구·noExecutionText 출처·aria-hidden·셰브런/질문 강조/번짐 DOM 없음·위치·1600ms onDone 한 번·불연장·정리, CSS: 회색 토큰만·앰버/진홍/#색 없음·낙하 420ms 바운스 없음·1300ms/300ms 페이드아웃·막 .25. RoomScreen: execVote→night(notMajority·tie)·candidateVoteReveal→night(tie·noVotes) 카드와 이유 문구, 도착 조건 5가지 불가, 1599/1600ms 경계, 시작 문구 1000ms 없음·1599ms 없음·1700ms 있음·3598ms 있음·3600ms 없음, noExecution 없는 밤은 즉시, 경찰 좌석 클릭이 카드 중 send, 밤 장면 불변) + sceneIntro.test.tsx(delayMs 0 마크업 불변·양수 지연·onDone delay+2000·불연장·정리) + nightScene.test.tsx 불변"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 390×844·360×640·모션 줄이기(testBotVote exec=no 로 찬성 0·반대 5 → notMajority 밤): 카드 지속 1599~1602ms, 밤 시작 문구 첫 프레임이 카드가 사라진 순간(1599~1602ms)과 일치(겹치지 않음), 낙하 translate -276px → 0 바운스 없음·veil 0→.25(450ms)→0, 1300ms 부터 root .5(1450)→.06(1582)·축소 모션은 페이드만(translate·rotate none), 계산된 테두리 2px rgb(169,174,187)=gray-300, 바탕 gray-700→800, 글자 {36,14}, 터치 통과, 카드 중 밤 좌석 버튼이 elementFromPoint 에서 카드가 아님, 읽기 안내 `처형 무효. 찬성이 과반이 아니에요. 1일차 밤. 함께 지목하세요`(경찰은 `…조사할 사람을 고르세요`), 콘솔 오류 0. 스크린샷 육안으로 회색 카드"
        status: pass
    human_judgment: true
  - id: C3
    description: "재접속·처음 마운트에서는 두 카드가 뜨지 않는다. 모션 줄이기에서는 낙하·바운스·셰브런 이동 없이 단계 전환(페이드)만 한다 (D-24)"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "execIntro.test.tsx·noExecution.test.tsx 도착 조건(처음 마운트·epoch 변화) + 축소 모션 분기 정적 단언(translate|rotate|fall|bounce|chev|smear 없음, mf-vi-fade-in 있음)"
        status: pass
      - kind: manual_procedural
        ref: "모션 줄이기 헤드리스 Chrome: 인트로 drop translate/rotate `none`, drop 불투명도 0→1(160ms), 셰브런 850ms 부터 페이드인 후 1/1/1 정지(이동 없음), 면 지우기·질문 교차는 시각표대로 페이드, 총 1600ms. 무효 카드도 translate/rotate none. 재접속 경로는 단위 시험으로만 확인(브라우저 재접속 미실행)"
        status: pass
    human_judgment: false
  - id: C4
    description: "밤 읽기 안내는 처형 무효일 때 `처형 무효. {부제}. ` 로 시작하고, 아닐 때는 기존과 같다"
    requirement: "VOTE-02"
    verification:
      - kind: unit
        ref: "noExecution.test.tsx 읽기 안내 3경우(시민·마피아 + noExecution 없음) + 헤드리스 Chrome 에서 live 영역 문구 확인"
        status: pass
    human_judgment: false
  - id: C5
    description: "카드의 실제 낙하 느낌·그림자 번짐·셰브런 가독성, 360×640 에서 셰브런(높이 96 하한)이 카드 영역과 겹쳐 작게 보이는 모양, iOS Safari 의 개별 속성 translate·rotate 애니메이션과 backdrop 위 표현, 두 기기에서 동시에 보이는 모양, 재접속 브라우저 시나리오, 실제 서버에서 처형 무효가 나오는 모든 경로(candidateVoteReveal → night)"
    requirement: "VOTE-01"
    verification:
      - kind: manual_procedural
        ref: "헤드리스 Chrome(데스크톱 렌더링)·로컬 dev 서버의 execVote → night(notMajority) 경로만 확인했다. candidateVoteReveal → night(동률·0표)는 단위 시험(RoomScreen 수준)으로만 확인, 실제 서버로 만들지 않았다. iOS·실기기·재접속 브라우저는 확인하지 못했다. 04-35 배포본에서 한다"
        status: partial
    human_judgment: true
---

# Phase 4 Plan 24: 처형 투표 인트로 카드와 회색 처형 무효 카드 Summary

**투표 구간 두 장 카드를 만들었다. 같은 접속에서 낮 토론 → 처형 여부 투표로 넘어갈 때 앰버 `처형 투표` 카드가 떨어져 가운데에서 면이 지워지고 질문이 24px 로 되살아나며 셰브런이 [찬성][반대]를 가리킨 뒤 1.6초에 사라지고, 처형이 성립하지 않아 밤으로 올 때는 같은 모양의 회색 `처형 무효`(이유 한 줄)가 1.6초 뜬 뒤 밤 시작 문구가 이어진다. 둘 다 클라이언트 연출이라 서버 시간을 늘리지 않고 탭을 막지 않는다.**

## 한 일

**Task 1 — ExecIntroCard** — RED `5bae4b9` → GREEN `c583a68`
- `ExecIntroCard`: 마운트 때 건 타이머 하나(`EXEC_INTRO_MS`)가 `onDone`. 마크업은 막(`__veil`) + 낙하 상자(`__drop`: 번짐 `__smear`·방사형 `__glow`·카드 면 `__face`(안쪽 선·장식 선 SVG)·본문 `__title`/`__q` 작은·큰 질문 겹침) + 셰브런 SVG(`__chevs`, 경로 3개 `__chev` 각 `--mf-vi-i`). 위치는 `introCardGeometry`(= `dayTableGeometry` 의 cy − 105)만 쓴다. 제목 요소(h1~h6)를 만들지 않고 직업을 읽지 않는다.
- `verdict.css` `mf-vintro` 구역: 시각표(낙하 450·정지·면 지우기 850~1250·셰브런 850~·전체 1450~1600), 막 키프레임(0→.15→.35→.22→0), 모두 `.mf-vintro, .mf-vintro * { pointer-events: none }`. 축소 모션 분기는 낙하·바운스·셰브런 이동 없이 `mf-vi-fade-in` 160ms + 시각(delay)대로 단계, 이미 페이드뿐인 요소는 `!important` + 구체 선택자로 길이만 되돌린다.
- `verdictScene` execVote: `usePhaseArrival` 이 `discussion` 을 돌려주고 일차 열쇠(`execIntro.n`)가 아직 아닐 때 렌더 중 상태 조정으로 켜고, `onDone` 에서 끈다. `ExecVotePanel` 에 `introActive` 를 넘겨 집계 줄 회색 부분을 `VERDICT_TEXT.execIntroHint` 로 바꾼다(앞부분 `찬성 N · 반대 M` 은 그대로).

**Task 2 — NoExecutionCard** — RED `dd4f42e` → GREEN `3e60d89`
- `NoExecutionCard`: 같은 `.mf-vintro` 구조(`--void` 변형), 부제는 `noExecutionText(reason)`, 타이머 `NO_EXEC_CARD_MS`. CSS: `--mf-vi-out-delay: 1300ms`·`--mf-vi-out-ms: 300ms`, 회색 바탕·테두리·그림자, 낙하 `mf-vi-fall-void`(420ms, 바운스 없음), 막 `mf-vi-veil-void`(0→.25→0). 앰버·진홍·# 색을 쓰지 않는다(정적 단언).

**Task 3 — 밤 도착 연결** — RED `18efba1` → GREEN `a9a7fa6`
- `SceneIntro` `delayMs`: 지연 0 이면 지금과 같은 마크업·타이머, 양수면 지연 뒤 보이기 시작(그 전 `null`)하고 `onDone` 은 delay + 2초. 마운트 때 값을 한 번 읽는다.
- `verdictScene` night: `noExecution` 이 있을 때만 `{ introDelayMs: NO_EXEC_INTRO_DELAY_MS, layer? }` 를 돌려준다(카드는 직전 단계가 `execVote`/`candidateVoteReveal` 인 같은 접속 렌더에서만, 일차 열쇠로 한 번). 그 밖의 밤은 `null` 이라 이전과 같다. `VerdictScene` 필드를 모두 선택으로 바꿨다.
- `DayScene`: `verdict?.title ?? …` 처럼 필드별로 읽고(title·instruction·calm·seatPatch·bottom), `SceneIntro` 에 `delayMs={verdict?.introDelayMs}`. `RoomScreen.nightAnnounce` 앞에 `noExecutionPrefix(reason)`.

## 검증

- `npm test` 98 파일 2549 통과, `npm run typecheck`(app·worker tsc 포함) 오류 없음, `npm run build` 성공, 범위 tsc(`tsc-scoped`) 통과.
- 헤드리스 Chrome 실행 방법과 수치는 coverage C1·C2·C3 의 manual_procedural 에 적었다(`npm run dev` 는 이 세션이 띄우고 끝에 내가 띄운 PID 만 종료).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 인트로 CSS 구역을 파일 끝이 아니라 `과반 확정 두근` 구역 앞에 둠**
- **Found during:** Task 1 GREEN 전체 클라이언트 시험
- **Issue:** 처음 파일 끝에 붙인 `@media (prefers-reduced-motion: reduce)` 가 `reveal.test.tsx`(04-20)의 `css.lastIndexOf("@media (prefers-reduced-motion: reduce)")` 를 가로채 두 시험이 실패
- **Fix:** 구역을 `과반 확정 두근` 구역 바로 앞으로 옮김(기존 시험은 느슨하게 하지 않음)
- **Files modified:** src/styles/verdict.css
- **Commit:** c583a68

### 계획과 다르게 구현한 점(편차는 아님, 판단 기록)

- 계획의 `VERDICT_TEXT.introTitle/question/introHint/voidTitle` 은 실제 이름이 `execIntroCardTitle`·`execTitle`·`execIntroHint`·`noExecCardTitle` 이라 있는 이름을 썼다(04-13).
- 계획 (3)의 night 부분 결과는 `noExecution` 이 있을 때만 돌려주고 그 밖은 `null` 로 둬 일반 밤 경로를 한 줄도 건드리지 않았다.
- 축소 모션: 계획은 delay 로 단계 시각을 지정하라고 했고 그대로 하되, 이미 페이드뿐인 요소(면 지우기·막·질문·페이드아웃)는 base.css 의 0.01ms 강제 때문에 순간 전환이 되므로 길이만 `!important` 로 되돌렸다(04-23 의 유령 전환과 같은 방식).
- 360×640 처럼 장면이 낮으면 셰브런 높이가 하한 96 이라(UI-SPEC clamp) 카드 영역·내 캐릭터 앞과 겹쳐 작게(약 50px 폭) 보인다. 스크린샷 육안으로 확인했고, 카드 면이 지워진 뒤라 시안 의도(카드·셰브런 비겹침)는 깨지지 않지만 보기 좋은지는 사용자 판단이다.

## Known Stubs

없음. 새 코드에 하드코딩 빈 값·자리표시 문구는 없다.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. 무효 카드가 그리는 입력은 이유 코드 하나뿐이고(T-04-63 accept), 모든 층 pointer-events none 은 정적 CSS 단언과 카드 위 [찬성] 클릭·경찰 좌석 클릭 시험, 헤드리스 Chrome 의 elementFromPoint 로 확인했다(T-04-62 mitigate). 새 패키지 설치 없음(T-04-SC).

## Self-Check: PASSED

- 파일: ExecIntroCard.tsx, NoExecutionCard.tsx, execIntro.test.tsx, noExecution.test.tsx — 존재 확인
- 커밋: 5bae4b9, c583a68, dd4f42e, 3e60d89, 18efba1, a9a7fa6 — `HEAD` 의 조상 확인
