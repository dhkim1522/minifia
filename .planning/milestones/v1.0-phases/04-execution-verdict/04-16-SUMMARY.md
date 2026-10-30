---
phase: 04-execution-verdict
plan: 16
subsystem: verdict-screens-tracer
tags: [execVote, tracer, react, DayScene, verdictScene, ExecVotePanel, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-13 verdict.ts(VERDICT_TEXT·execTallyText), 04-14 PHASE_SCENE dusk 표, 서버 웨이브의 view.day.execTally·view.me.voteAgree·execVote 메시지"
provides:
  - "RoomScreen 이 execVote 를 DayScene 으로 라우팅(sceneKey dayScene 유지 — 테이블·장면 래퍼 재마운트 없음)"
  - "useVerdictScene(ctx) — 투표 구간 전용 장면 조립 훅. execVote 가 아니면 null 이라 낮·밤·아침 경로는 불변. 반환 { title, instruction, calm, bottom, seatPatch }"
  - "ExecVotePanel — 제목·집계 줄·[찬성][반대], 낙관적 선택 + 새 view 의 me.voteAgree 우선, 같은 쪽 재클릭 무시, !canSend 면 비활성, readOnly 면 관전 알약"
  - "ReadOnlyRow 선택 인자 text(기본값 불변)"
  - "verdict.css — 집계 줄·버튼 줄·숫자 팝(scale 1.15 → 1, 180ms, 모션 줄이기 없음)"
  - "BAD_MESSAGE 토스트 구독(execVote·candidateVote 에서만)과 모든 좌석의 기록 카드 버튼"
affects: [04-17, 04-18, 04-19, 04-20, 04-21 — 후보 선택·공개·변론·처형·카드·결과 화면이 같은 훅·같은 라우팅에 단계를 더한다]

actuals:
  tokens: 8400
  tasks: 2
  commits: 5
plan_head_before: b667f3a6c1f5d820c8bb7d860ebab21eeebdeec7
plan_head_after: 316821227944c30ccdedf435d3e0007767b81408

tech-stack:
  added: []
  patterns:
    - "투표 구간 화면은 DayScene 에 분기를 늘리지 않고 useVerdictScene 한 곳에서 조립한다(null 이면 기존 경로 그대로)"
    - "집계 숫자를 값이 key 인 span 으로 그려 바뀐 숫자만 새 노드가 되게 한다(팝 애니메이션 재시작). 문구는 execTallyText 의 결과를 숫자 기준으로 나눠 쓴다"
    - "ClaimPanel·밤 pick 과 같은 낙관적 선택 { view, agree } — 새 view 객체가 오면 서버 값이 이긴다"

key-files:
  created:
    - src/components/ExecVotePanel.tsx
    - src/screens/verdictScene.tsx
    - src/styles/verdict.css
    - test/client/execVote.test.tsx
  modified:
    - src/screens/RoomScreen.tsx
    - src/screens/DayScene.tsx
    - src/components/ReadOnlyRow.tsx

key-decisions:
  - "투표 단계의 말풍선·이모티콘·채팅 줄은 FLOAT_PHASES·CHAT_PHASES 에 단계를 넣지 않는 것으로 막는다(seatFloats.ts 불변). 시험이 chat·emoji 이벤트가 와도 테이블에 안 뜸을 단언한다"
  - "BAD_MESSAGE 구독은 execVote·candidateVote 두 단계에서만 켠다. 밤 구독(DayScene)과 단계가 겹치지 않아 토스트가 두 번 뜨지 않는다"
  - "P-4(관전 문구)는 확인 대기 기본값 그대로: 탈락 viewer 하단은 제목 + 집계 줄 + 알약 `관전 중 · 볼 수만 있어요`(문구는 VERDICT_TEXT 에서만 온다)"

requirements-completed: []  # VOTE-01·CONN-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: D1
    description: "execVote 단계에서 폰이 연결 중… 대신 낮 테이블과 하단 제목 `오늘 처형을 할까요?`·집계 줄·[찬성][반대]를 그리고, 헤더 `낮 · 처형 여부`/`1일차`·calm 타이머·aria-live 안내가 맞다"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "npx vitest run --project client test/client/execVote.test.tsx (19 통과)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방 + 헤드리스 Chrome 390x844·360x640 에서 실제 렌더 확인(스크린샷 판독, 아래 본문)"
        status: pass
    human_judgment: true
  - id: D2
    description: "[찬성]/[반대] 가 {t:execVote, agree} 를 한 번 보내고 즉시 눌림 표시, 같은 쪽 재클릭은 무전송, 새 view 의 me.voteAgree 가 이기며 !canSend 면 비활성"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "test/client/execVote.test.tsx(찬성·반대·새 서버 view·canSend)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 에서 찬성 → 반대 번복, 서버가 보낸 집계(찬성 0 · 반대 1)가 화면에 반영됨. 봇 표가 몇 초 뒤 합산됨"
        status: pass
    human_judgment: false
  - id: D3
    description: "개인별 선택은 익명: .mf-dt 안에 찬성·반대·투표 글자와 후광이 없고 기권 글자가 어디에도 없다"
    requirement: "VOTE-01"
    verification:
      - kind: unit
        ref: "test/client/execVote.test.tsx(테이블 안에는 찬성·반대·투표 글자도 후광도 없고…)"
        status: pass
    human_judgment: false
  - id: D4
    description: "탈락 viewer 는 버튼 없이 집계 줄과 관전 알약, 모두 투표 문구, 집계 팝(바뀐 숫자만 새 노드), BAD_MESSAGE 토스트, 좌석 탭 기록 카드, 말하기·이모티콘 입구 없음, 끊긴 사람 흐림"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "test/client/execVote.test.tsx(Task 2 시험 9개)"
        status: pass
    human_judgment: false
---

# Phase 4 Plan 16: 처형 여부 투표 화면 트레이서 Summary

**서버가 보내는 `execVote` 단계가 방 화면 → 낮 장면 → 하단 패널 → 소켓 `execVote` 메시지까지 끝까지 이어져, 폰에서 찬성·반대·번복·집계·관전·오류·기록 카드가 실제로 동작한다. 이후 화면 계획이 같은 훅(`useVerdictScene`)과 같은 라우팅에 단계를 하나씩 더한다.**

## 한 일

**Task 1 (트레이서)** — RED `149c269` → GREEN `90e3818`
- `RoomScreen`: `execVote` 를 `renderPhase` 의 DayScene 묶음과 `sceneKey` 의 dayScene 키에 추가. `PHASE_ANNOUNCE.execVote` 는 `VERDICT_TEXT.announce.execVote`(`처형 여부 투표. 오늘 처형을 할까요?`)에서 읽는다. 나머지 네 단계와 `ended` 는 건드리지 않았다(여전히 `연결 중…`).
- `src/screens/verdictScene.tsx` 신설: `useVerdictScene`. execVote 면 제목 `낮 · 처형 여부`, 안내 `{n}일차`, `calm: true`, 하단 `ExecVotePanel`. 아니면 null.
- `src/components/ExecVotePanel.tsx` 신설: 낙관적 선택(`{view, agree}`), 같은 쪽 재클릭 무전송, `!canSend` 비활성, `.mf-seg` 안 `.mf-seg__b` 두 개 + 체크 배지(ClaimPanel 과 같은 마크업). 말하기·이모티콘 버튼은 그리지 않는다.
- `DayScene`: `useVerdictScene` 을 한 번 부르고 null 이 아닐 때만 제목·안내·타이머 calm·하단을 덮는다. 테이블 루트와 `bar-`·`panel-` key 규칙은 그대로.
- 트레이서 게이트: 자동 검증만 있는 `<verify>`(execVote 시험·기존 dayScene/roomScreen/phaseScreens 시험·`npm run typecheck`)를 다시 돌려 통과한 뒤 확장했다.

**Task 2 (나머지 상태)** — RED `7ae7c0c` → GREEN `8137ff6`
- `ReadOnlyRow`: 선택 인자 `text`(기본값은 기존 `탈락했어요 · 볼 수만 있어요`, 기존 호출 불변).
- `ExecVotePanel`: `readOnly`(탈락 viewer)면 버튼 줄 대신 `ReadOnlyRow text={VERDICT_TEXT.spectatorPill}`. 집계 숫자는 값이 key 인 span 이라 바뀐 숫자만 새 노드가 되어 `scale 1.15 → 1` 180ms 팝이 다시 돈다(`prefers-reduced-motion` 에서는 없음).
- `verdictScene`: `seatPatch` 가 모든 좌석에 `onInspect` 를 준다(살아 있든 탈락했든). BAD_MESSAGE 구독은 execVote·candidateVote 에서만 켜서 `NIGHT_PANEL_TEXT.pickError` 로 토스트한다.
- `DayScene`: verdict 가 있으면 좌석 덧입힘을 verdict 가 정한다.

**실제 렌더 확인 후 수정** — `3168212`
- 브라우저에서 보니 `.mf-execvote__tally span { margin-left: 8px }` 가 숫자 span 에도 걸려 `찬성 1 · 반대 0` 이 벌어져 보였다. 선택자를 직계 `> span` 으로 좁혔다.

## 검증

- `npm test`: 89 파일 2298 통과. `npm run typecheck`(토큰 검사 + 두 tsc): 통과. `npm run build`: 통과.
- 새 시험 `test/client/execVote.test.tsx`: 19개(Task 1 · 10, Task 2 · 9). 기존 낮·밤·아침 장면 시험(`dayScene`·`roomScreen`·`phaseScreens`)은 한 줄도 고치지 않고 통과.
- 수용 기준 grep: `case "execVote"` 1, `useVerdictScene`(DayScene) 2, `관전 중 · 볼 수만 있어요`(verdict.ts) 1, ExecVotePanel 안 `관전 중` 0, `기권` 0.

### 브라우저에서 실제로 그려지는지 (정직한 보고)

**확인했다.** `vite dev`(내가 띄운 PID 만 종료함)를 켜고, 스크래치패드의 일회용 스크립트로 다음을 했다. 스크립트는 저장소에 넣지 않았다.
1. Node 소켓으로 테스트 방(`testMode`)을 만들고 봇 3 을 앉혀 시작한 뒤 discussion 까지 넘기고 소켓을 닫았다(같은 토큰의 소켓 둘은 서로를 쫓아낸다).
2. 헤드리스 Chrome(Google Chrome, playwright-core)을 방장으로 붙이고 [테스트] → `다음 단계로 넘기기` 로 execVote 에 들어갔다.
3. 관찰: 헤더 `낮 · 처형 여부`/`1일차`, 하단 제목 `오늘 처형을 할까요?`, 집계 `찬성 0 · 반대 0 아직 4명 · 마감까지 바꿀 수 있어요`, [찬성][반대](둘 다 aria-pressed false), 타이머 진홍 아님, 테이블 글자에 찬성·반대 없음. [찬성] 클릭 → 서버가 `찬성 1 · 반대 0 아직 3명` 으로 방송, 체크 배지. [반대] 번복 → `찬성 0 · 반대 1`. 몇 초 뒤 봇 표가 합산되어 `찬성 1 · 반대 1 아직 2명`, 끝에는 `찬성 2 · 반대 2 모두 투표했어요`. 좌석 탭 → 기록 카드 열림. 콘솔 오류 0.
4. 390×844 와 360×640 모두 집계 줄이 한 줄에 들어간다(scrollWidth = clientWidth). 스크린샷을 눈으로 읽어 레이아웃을 확인했다.

**확인하지 못한 것:** 탈락 viewer(관전 알약) 화면은 브라우저에서 보지 않았다(방장이 첫 낮에 탈락할 수 없어 만들기 어렵다). 단위 시험으로만 검증했다. 실제 폰·iOS 사파리·`prefers-reduced-motion`·팝 애니메이션의 눈으로 본 모양도 보지 않았다. 배경은 PHASE_SCENE 표대로 dusk 를 쓰는데 dusk 그림이 따로 구워져 있는지는 이 계획의 범위가 아니라 판단하지 않았다.

## Deviations from Plan

### 자동 수정

**1. [Rule 1 - Bug] 집계 줄 숫자 사이 간격이 벌어짐**
- **발견:** 브라우저 스크린샷 확인 중(Task 2 GREEN 뒤)
- **문제:** `.mf-execvote__tally span` 선택자가 숫자 span(`mf-execvote__num`)에도 `margin-left` 를 줌
- **수정:** `.mf-execvote__tally > span`
- **파일:** `src/styles/verdict.css`
- **커밋:** `3168212`

**2. [시험 정정] Task 2 RED 의 `ev.count()` 단언 제거**
- 구독자 수를 1 로 단언했으나 `useSeatFloats`·`useDayChat` 등 다른 구독도 있어 틀린 단언이었다. 토스트가 정확히 한 번 뜬다는 단언으로 충분해 제거했다(GREEN 커밋에 포함).

### 계획과 다르게 하지 않은 것

- 계획 `files_modified` 에 있는 `src/screens/verdictScene.tsx` 외에 `phaseScreens.test.tsx` 는 고칠 곳이 없었다. execVote 를 `연결 중…` 으로 가정한 단언이 없다(`연결 중…` 은 알 수 없는 단계 `vote` 시험에만 있고 그대로 맞다). 느슨하게 하지 않았다.
- `phaseScreens.test.tsx` 의 `단계 표 라벨` 시험 등 기존 시험은 변경 없음.

## 알려진 미해결

- 집계 숫자 팝은 execVote 에 처음 들어오는 첫 렌더에서도 한 번 돈다(값이 key 라 마운트 때도 새 노드). 시안에 맞는지는 폰에서 보고 판단한다. 거슬리면 04-17 이후에 첫 렌더만 막는다.
- `scripts/e2e/flows.mjs`·`browser.mjs`, `scripts/uat-test-bots.mjs` 는 여전히 4페이즈 흐름에 맞춰지지 않았다(`deferred-items.md`). 이 계획은 건드리지 않았다.

## Known Stubs

없음. 이 계획이 새로 쓴 화면 파일에 하드코딩된 빈 값·자리표시 문구가 없다. (여부 투표 인트로 카드 `카드 뒤에서도 바로 고를 수 있어요` 는 이후 계획이 더한다. 나머지 단계 화면은 이 계획의 범위 밖이라 여전히 `연결 중…` 이며 04-17~04-21 이 채운다.)

## Threat Flags

없음. 새 네트워크 경로·권한 경로·스키마 변경이 없다. 위협 표 T-04-47(익명 깨짐)·T-04-48(낙관적 선택 어긋남)은 시험으로 완화를 확인했다.

## Self-Check: PASSED

- 파일: `src/components/ExecVotePanel.tsx`, `src/screens/verdictScene.tsx`, `src/styles/verdict.css`, `test/client/execVote.test.tsx` 존재.
- 커밋: `149c269`, `90e3818`, `7ae7c0c`, `8137ff6`, `3168212` 모두 HEAD 의 조상.
