---
phase: 07-free-chat
plan: "15"
subsystem: client-chat-table
tags: [chat, dayscene, chatpanel, ghost, mafia-channel, system-line, e2e, tracer, tdd, react-hooks]

requires:
  - phase: 07-free-chat
    provides: "07-13 useChat·RoomScreen 의 ChatStore(chat), 07-03 ChatPanel·chatUi·CHAT_TEXT, 07-05 ChatStore.addSystem·visibleLines·useChatLogHeight, 07-10 view.me.chat(서버가 정한 내 채널)"
provides:
  - "DayScene: chat 속성, chatPanelMode(낮 토론·변론 산 사람 all·탈락자 ghost / 밤 산 마피아 mafia·탈락자 ghost / 그 밖 없음), 서버 view.me.chat 이 같을 때만 ChatPanel, 채널 시작·변론 시작 시스템 줄"
  - "verdictScene: ctx.chatBottom 으로 최후 변론 하단을 ChatPanel 로 교체(DefensePanel 상태 줄 부품 삭제)"
  - "day.css: .mf-dayscene__panel--chat · 변수 --mf-chat-panel-h(LOG_H + 92 + 안전 영역)"
  - "verdict.ts: defenseStartLine(기록용 '{닉네임} 님이 변론하는 중' / 끊김)"
  - "test/client/nightChat.test.tsx 재작성(ChatPanel 기준 밤 마피아·탈락자·시민 누설·D1 단계), E2E 흐름 chat-table·chat-ghost"
affects: [07-16, 07-18, 07-19, 07-20, 07-21]

actuals:
  tokens: 15744
  tasks: 3
  commits: 5
  plan_head_before: 42f492ef45e11251f35f167ccac3236722f1657b
  plan_head_after: 5e72473acd1a2010ed119da2a7977ff2f0225d8d

tech-stack:
  added: []
  patterns:
    - "화면은 의도(chatPanelMode)와 서버 값(view.me.chat)이 같을 때만 패널을 그린다 — 어긋나면 패널 없음(서버 값이 기준)"
    - "시스템 줄은 렌더가 아니라 효과에서 직전 {epoch, phase, channel} ref 와 견줘 만든다 — 처음 마운트·재접속 첫 state 는 기준만 잡고, StrictMode 두 번째 실행은 직전 값과 같아 만들지 않는다"
    - "하단이 채팅 패널이면 패널에 안내문이 없으므로 헤더 안내줄이 그 화면의 data-guide 다"
    - "역할 단어 문구(밤 · 마피아 채팅)는 내 채널이 mafia 인 분기 안에서만 꺼낸다"

key-files:
  created:
    - test/client/nightChat.test.tsx
  modified:
    - src/screens/DayScene.tsx
    - src/screens/verdictScene.tsx
    - src/screens/RoomScreen.tsx
    - src/game/verdict.ts
    - src/styles/day.css
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/lib.test.mjs
    - test/client/dayScene.test.tsx
    - test/client/defense.test.tsx
    - test/client/discussion.test.tsx
    - test/client/nightScene.test.tsx
    - test/client/guide.test.tsx
    - test/client/verdictStates.test.tsx
    - test/client/atmosphere.test.tsx
    - test/client/morning.test.tsx
    - test/client/sceneIntro.test.tsx
    - test/helpers/verdictViews.ts
    - test/unit/verdict.test.ts
  deleted:
    - src/components/DefensePanel.tsx

key-decisions:
  - "chatPanelMode 는 화면의 의도일 뿐이고 패널은 view.me.chat === 의도 일 때만 그린다(산 사람에게 ghost, 탈락자에게 all, 시민 밤의 mafia 는 패널 없음). 서버 채널이 아예 없는 탈락 view(옛 서버)는 관전 알약으로 안전하게 폴백한다"
  - "최후 변론 하단은 DefensePanel 감싸개 대신 DayScene 이 만든 ChatPanel 을 ctx.chatBottom 으로 verdictScene 에 넘긴다. DefensePanel 부품과 상태 줄 코드는 지웠다(남은 시간은 헤더 타이머, 닉네임 문구는 기록 첫 줄)"
  - "채팅 패널이 하단이면 헤더 안내줄이 data-guide 다(UX-01 '한 화면에 안내 하나'). 변론은 '{n}일차 · {이름}님의 변론', 탈락자는 '{n}일차'"
  - "유령 시작 줄은 '탈락했을 때'와 '탈락자의 밤마다'이되, 직전 줄이 같은 유령 시작 줄이면 연달아 만들지 않는다(처형 직후 곧바로 밤이 오는 경우, E2E 에서 발견)"
  - "시스템 줄 시각은 Date.now() + connection.offset(서버 시각 추정)이다 — 서버 줄의 at 과 같은 시계로 시간 순이 섞이지 않게 한다"

patterns-established:
  - "E2E 판정은 DOM 치수를 UI-SPEC 표 값 사본(LOG_H·+92)과 견준다 — readTablePanel 이 한 번의 evaluate 로 모은다"
  - "readChannelTraces: 문서 글자·aria-label·placeholder·title 에 든 금지 문구 수와 채널 표식 수를 센다(시민 편 누설 검사 도구)"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-06]

coverage:
  - id: D1
    description: "낮 토론의 산 사람 하단이 ChatPanel(채널 all, '채팅 입력')이고 보낸 줄이 기록 칸에 data-ch all·이름 '나'로 돌아오며 하단 높이가 LOG_H + 92 다 (6종 폰 크기)"
    requirement: "CHAT-01"
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only chat-table (CT0~CT4·TP1~TP5·G, 6종 크기 모두 33/33)"
        status: pass
      - kind: unit
        ref: "test/client/discussion.test.tsx#산 사람의 낮 토론 하단은 ChatPanel(채널 all)이다 / 채팅 패널이 붙은 하단은 --mf-chat-panel-h(LOG_H + 92)"
        status: pass
    human_judgment: true
    rationale: "키보드가 열린 테이블 화면의 인물 가림(가정 A1)과 실기기 입력은 07-19·07-21 몫이라 이 계획의 자동 시험이 판정하지 않는다"
  - id: D2
    description: "최후 변론 하단이 후보 포함 살아 있는 모두에게 ChatPanel(all), 탈락자에게 ChatPanel(ghost)이고 변론 시작 때 point 아이콘 + '{닉네임} 님이 변론하는 중'(끊김이면 '님은 연결이 끊겨 있어요') 시스템 줄이 한 번(재접속 첫 state 에는 없음), 상태 줄 부품은 지워졌다"
    requirement: "CHAT-01"
    verification:
      - kind: unit
        ref: "test/client/defense.test.tsx#defense 화면 한 경로 (후보 본인도 같은 ChatPanel · 시작 줄 · 끊김 · 탈락 viewer); test/client/verdictStates.test.tsx#내가 후보인 변론 화면; test/unit/verdict.test.ts#defenseStartLine"
        status: pass
    human_judgment: false
  - id: D3
    description: "밤의 산 마피아 하단이 채널 mafia ChatPanel(입력칸 '마피아 채팅 입력'·'마피아끼리만 보여요'·roleMafia 아이콘)이고 기록에는 마피아 줄과 '밤 · 마피아 채팅' 시스템 줄(한 번)만 보이며 낮 줄은 아침 뒤 다음 낮에 돌아온다"
    requirement: "CHAT-02"
    verification:
      - kind: e2e
        ref: "chat-table/night-mafia NM0~NM5·NTP1~NTP5 (실제 브라우저, 6종 크기)"
        status: pass
      - kind: unit
        ref: "test/client/nightChat.test.tsx#밤 마피아 채팅 (CHAT-02, 채널 mafia)"
        status: pass
    human_judgment: false
  - id: D4
    description: "탈락자는 낮 토론·변론·밤에 채널 ghost ChatPanel('유령 채팅 입력'·'유령끼리만 보여요')을 쓰고 기록은 공개+마피아(roleMafia·진홍 이름)+유령(ghost) 줄이 시간 순 한 흐름이며 탈락했을 때·밤마다 유령 시작 줄이 생긴다(연달아 중복 없음). 그 밖의 단계는 관전 알약 그대로"
    requirement: "CHAT-03"
    verification:
      - kind: e2e
        ref: "npm run e2e -- --only chat-ghost (GH0~GH4·GTP1~GTP5·G, 방장이 처형된 뒤의 밤, 390x664 13/13)"
        status: pass
      - kind: unit
        ref: "test/client/nightChat.test.tsx#탈락자 채팅 (CHAT-03, 채널 ghost)"
        status: pass
    human_judgment: false
  - id: D5
    description: "시민 편 화면(산 시민·경찰·의사의 밤, 낮의 산 마피아 포함)의 DOM 에 '마피아 채팅'·'마피아끼리만'·data-ch mafia·ghost 줄·비공개 채널 패널이 0건이고, 서버 채널이 화면 의도와 다르면 패널을 그리지 않는다"
    requirement: "CHAT-02"
    verification:
      - kind: e2e
        ref: "chat-table CT4·CN1~CN3·CM1~CM2 (시민 방장 낮·밤, 마피아 방장 낮)"
        status: pass
      - kind: unit
        ref: "test/client/nightChat.test.tsx#시민 편 화면에는 비공개 채널의 흔적이 없다 (T-07-40)"
        status: pass
    human_judgment: false
  - id: D6
    description: "처형 여부 투표·후보 선택·공개 연출·처형·아침·낮 시작 단계에는 입력줄이 없고(산 사람·탈락자 모두), 그 단계에 서버가 보낸 줄은 저장소에 쌓였다가 다음 낮 토론에서 보인다 (UI-SPEC D1)"
    requirement: "CHAT-06"
    verification:
      - kind: unit
        ref: "test/client/nightChat.test.tsx#D1: 입력줄을 붙이지 않는 단계; test/client/verdictStates.test.tsx(투표 구간 7단계 × 6시점 × 2인원)"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-11-01
status: complete
---

# Phase 7 Plan 15: 테이블 화면 자유 채팅 Summary

**DayScene 의 낮 토론·최후 변론·밤 마피아·탈락자 하단을 서버 view.me.chat 이 정하는 ChatPanel(all·mafia·ghost)로 바꾸고, 같은 연결 안의 단계·채널 변화에서만 채널 시작·변론 시작 시스템 줄을 만들었다. 시민 편 DOM 의 마피아 채널 흔적 0건을 실제 브라우저(6종 폰 크기)와 클라이언트 시험으로 확인했다**

## Performance

- **Duration:** 약 18분 (2026-11-01T15:00:54Z ~ 15:19Z)
- **Tasks:** 3 (트레이서 1 + auto TDD 1 + auto 1)
- **Commits:** 5 (`94d6c78` · `6021935` · `20ba869` · `3bc39dc` · `5e72473`)
- **Files:** 변경 파일 21 (신규 1, 삭제 1)

## Accomplishments

- RoomScreen 이 `chat`(ChatStore)을 DayScene 에 넘기고, DayScene 은 `useChat`·`useChatLogHeight` 로 만든 `ChatPanel` 을 하단에 그린다. 패널 높이는 `LOG_H + 92`(+ 안전 영역, `--mf-chat-panel-h`, `.mf-dayscene__panel--chat`)이고 157 기본 패널은 투표 단계 그대로다.
- `chatPanelMode(view, meAlive)`: 낮 토론·변론은 산 사람 all·탈락자 ghost, 밤은 산 마피아 mafia·탈락자 ghost, 시민·경찰·의사의 밤과 투표·공개·처형·아침·낮 시작은 패널 없음. **서버가 보낸 `view.me.chat` 이 같을 때만** 그린다(T-07-41).
- 최후 변론은 후보 포함 모두 같은 ChatPanel 이다. `DefensePanel`(상태 줄 "…님이 변론하는 중 · N초")을 지우고 닉네임 문구는 기록 첫 줄(point 아이콘)로, 남은 시간은 헤더 타이머만 남겼다. 헤더 안내줄이 그 화면의 `data-guide` 다.
- 시스템 줄: 같은 epoch 의 변론 진입 → point + `defenseStartLine`, 밤 진입 마피아 → roleMafia + "밤 · 마피아 채팅"(scope mafia), 탈락했을 때·탈락자의 밤 → ghost + "유령 채팅 · 산 사람에게 안 보여요"(scope ghost). 처음 마운트·재접속 첫 state·StrictMode 두 번째 실행은 만들지 않는다.
- 시험: `nightChat.test.tsx` 재작성(밤 마피아·탈락자·시민 누설·D1 단계·재접속 27건), `defense`·`dayScene`·`discussion`·`guide`·`verdictStates` 갱신.
- E2E `chat-table`(6종 폰 크기 33/33): 시민 방장 낮 한 줄·패널 치수·밤 패널 없음·마피아 흔적 0건, 마피아 방장 밤 mafia 패널·mafia 줄만·시스템 줄 한 번. `chat-ghost`(390x664 13/13): 방장 처형 뒤 밤의 ghost 패널.

## Task Commits

1. **Task 1 (tracer): 낮 토론 한 줄 → 다른 폰 기록** — `94d6c78` (feat). 트레이서 게이트(`human_verify_mode=end-of-phase`, `<verify>` 자동만): E2E(390x664 13/13)·vitest(dayScene·roomScreen) 재실행 통과 → "Tracer verified end-to-end — expanding".
2. **Task 2 (TDD): 변론·밤 마피아·탈락자 패널, 시스템 줄, D1** — `6021935` (test, RED) → `20ba869` (feat, GREEN). 이어 E2E 에서 찾은 유령 시작 줄 중복을 `3bc39dc` (fix) 로 고쳤다.
3. **Task 3: chat-table 확장 + chat-ghost** — `5e72473` (test)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 갱신(docs)이 따른다.

## TDD Gate Compliance

Task 2 는 RED(`test(07-15)` `6021935`) → GREEN(`feat(07-15)` `20ba869`) 순서다. REFACTOR 커밋은 없다(정리할 변경 없음).

- RED 대상: `test/client/nightChat.test.tsx > 밤 마피아 채팅 (CHAT-02, 채널 mafia) > 산 마피아의 밤 하단은 ChatPanel(mafia)…` — `gsd check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(reason `target_test_failed`).
- RED 의미 평가(semanticAssessment): 시험이 실제로 돌았고(26개 중 대상 1개 실행, `-t`), ChatPanel 이 아직 없어 `expected undefined to be 'mafia'`(data-chat-channel) 단언에서 실패했다. 구문·로드·픽스처 오류가 아니라 계획한 이유로 실패. 전체 RED 는 17건 실패(nightChat 10, defense 7), 나머지 63건은 통과.
- RED 시점의 `defenseStartLine` 는 import 만 있고 정의가 없어(런타임 undefined) 해당 시험은 "함수 없음"이 아니라 시스템 줄이 없다는 단언에서 실패했다.
- `20ba869` 는 첫 `git add` 가 이미 스테이지된 삭제 경로 때문에 중단되어 삭제 한 건만 커밋됐고, 같은 커밋을 푸시 전에 `--amend` 로 나머지 파일을 담았다(이력 정리, 동작 변경 없음).

## Files Created/Modified

위 frontmatter `key-files` 참고. 핵심은 `src/screens/DayScene.tsx`(패널·시스템 줄·헤더 안내), `src/screens/verdictScene.tsx`(`chatBottom`), `test/client/nightChat.test.tsx`(신규), `scripts/e2e/flows.mjs`(chat-table·chat-ghost).

## Decisions Made

- 위 key-decisions 5건. 로컬 개발 서버: 처음 5173 이 응답하지 않아 **이 계획이 `npm run dev` 를 띄웠다(PID 20028)**. 마지막 검증 뒤 그 PID 와 자식 프로세스를 끝냈고 5173 응답 없음을 확인했다.
- 사용자 위임에 따른 추천안 선택: 해당 없음(checkpoint:decision 이 없었다).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] DayScene 을 직접 그리는 기존 시험 6개 파일이 새 필수 속성 `chat` 때문에 깨짐**
- **Found during:** Task 1
- **Issue:** `DayScene` 이 `chat: ChatStore` 를 필수로 받아 `atmosphere`·`morning`·`sceneIntro`(계획 파일 목록 밖)·`discussion`·`nightScene`·`dayScene` 시험의 렌더 헬퍼가 타입 오류
- **Fix:** 헬퍼마다 시험별 새 `ChatStore` 를 만들어 rerender 에도 같은 것을 넘김
- **Files modified:** test/client/{atmosphere,morning,sceneIntro,discussion,nightScene,dayScene}.test.tsx
- **Committed in:** 94d6c78

**2. [Rule 3 - Blocking] 옛 변론 상태 줄을 전제한 시험·픽스처 갱신**
- **Found during:** Task 2 GREEN (전체 client 실행)
- **Issue:** `guide.test.tsx`(변론의 `data-guide` 가 상태 줄 `<b>`), `verdictStates.test.tsx`(변론 하단 `.mf-turnpanel > .st-row`·버튼 0개·탈락자 `.mf-ro`·끊김 문구), `test/helpers/verdictViews.ts`(픽스처에 내 채널 없음)가 지운 DefensePanel 을 전제
- **Fix:** 픽스처가 서버 `channelOf` 규칙대로 `me.chat` 을 내리도록 하고(CHAT_PHASES), 변론의 안내를 헤더 한 줄로·버튼은 보내기 하나로·탈락자는 ghost 패널로 시험을 고침. 투표·공개·처형 단계는 서버가 채널을 내려도 입력줄이 없다는 불변식을 모든 칸에 더함
- **Files modified:** test/client/guide.test.tsx, test/client/verdictStates.test.tsx, test/helpers/verdictViews.ts
- **Committed in:** 20ba869

**3. [Rule 1 - Bug] 처형 직후 곧바로 밤이 오면 유령 시작 줄이 연달아 두 번**
- **Found during:** Task 3 (E2E chat-ghost GH4 가 시스템 줄 두 개를 잡음)
- **Issue:** 탈락했을 때(처형 단계 진입)와 밤 시작에 각각 줄이 만들어져 사이에 다른 줄이 없는데도 같은 안내가 두 번 보임
- **Fix:** 직전 줄이 같은 유령 시작 줄이면 만들지 않음. 사이에 말이 오간 뒤의 밤에는 다시 생기는 것을 시험으로 고정
- **Files modified:** src/screens/DayScene.tsx, test/client/nightChat.test.tsx
- **Committed in:** 3bc39dc

**4. [Rule 3 - Blocking] scripts/e2e/lib.test.mjs 의 extraSizes 흐름 목록 시험**
- **Found during:** Task 1 (계획 파일 목록에 없음)
- **Issue:** chat-table 에 `extraSizes` 를 주면 이 시험의 기대 목록(`lobby·world·chat-lobby`)이 어긋남
- **Fix:** 기대 목록·제목에 chat-table 추가
- **Committed in:** 94d6c78

**5. [Rule 2 - Missing critical] 헤더 안내줄을 채팅 패널 하단의 `data-guide` 로**
- **Found during:** Task 2 (guide.test 점검표 변론 칸이 `data-guide` 0개)
- **Issue:** 상태 줄이 사라지고 패널에는 안내문이 없어 UX-01 "한 화면에 지금 할 일 한 문장" 요소가 없어짐
- **Fix:** `headerGuide` 에 `chatBottom !== null` 을 더해 헤더 안내줄이 그 화면의 안내가 되게 함
- **Files modified:** src/screens/DayScene.tsx
- **Committed in:** 20ba869

### 계획 대비 달라진 점 (범위 내 조정)

- **탈락자 E2E 는 만들 수 있어서 만들었다.** 계획은 chat-table 안에서 "만들 수 있으면" 이라 했는데, 방장이 처형되는 흐름(봇 모두 찬성 + 방장 후보)이 시간이 걸리고 폰 크기와 무관해 **별도 흐름 `chat-ghost`(390x664 고정)** 로 뒀다. `--only chat-table` 판정은 6종 크기를 그대로 돈다.
- `DefensePanel` 은 감싸개로 남기지 않고 **파일을 지웠다**(계획이 허용한 "verdictScene 의 ChatPanel 하단" 쪽).

**Total deviations:** 5 auto-fixed (Rule 3 셋, Rule 1 하나, Rule 2 하나)
**Impact on plan:** 범위 확장 없음. 시험 파일이 계획 목록보다 7개 더 바뀌었다(전부 지운 상태 줄·필수 속성의 직접 결과).

## Issues Encountered

- 첫 `git commit` 이 스테이지된 삭제 경로를 다시 `git add` 해 중단되어 한 건만 커밋됐다 → 푸시 전 amend 로 정리(위 TDD 항목).
- E2E 첫 실행에서 마피아 방장 판으로 돌아간 뒤 `chooseRole` 의 클릭이 시간 초과(8초 × 재시도로 70초)했다. [대기실로 되돌리기] 뒤 테스트 시트가 닫혀 있어서였고 `openTestSheet` 를 먼저 부르게 했다.
- 알려진 불안정 시험 `bots.test` "봇 chat: 밤에는 마피아 봇의 줄이…" 는 이번 전체 실행에서 실패하지 않았다.
- 계획 `estimate.tokens` 80000 대비 실제 변경량은 chars/4 약 15744 이다(훅·부품이 07-13 까지 준비돼 있어 얇은 연결이었다).

## Known Stubs

없음. 이 계획이 그리는 값은 모두 서버 view·프레임·연결 상태에서 온다.

## Threat Flags

없음. 새 네트워크 경로·인증·파일 접근 없음. T-07-40(시민 편 DOM 의 마피아 채널 흔적)은 채널 문구를 `mode === mafia` 분기 안에서만 꺼내는 것과 클라이언트 시험·E2E(시민 방장 낮·밤, 마피아 방장 낮) 0건 단언으로, T-07-41(산 사람 화면의 유령 입력)은 서버 `me.chat` 과 화면 의도가 같을 때만 패널을 그리는 것(어긋남 시험 5가지)으로 완화했다. T-07-SC: 패키지 설치 없음.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-16(smoke·손 봇)·07-17(uat 스크립트)은 이 계획과 독립이다. 07-18(머리 위 "…")은 `DayScene` 의 `ChatBinding` 에서 입력 중 신호를 붙이면 되고, 07-19(키보드)는 `compact`·`inputId`·포커스 훅을 `DayScene` 의 `inputRef`/패널에 붙이면 된다(`rootRef`·`inputRef` 가 이미 DayScene 에 있다).
- 07-20(E2E 하네스 정리)이 `deferred-items.md` "07-15 에서 발견" 의 옛 낮 화면 흐름(`claim`·157 패널 높이·변론 상태 줄)을 정리한다. 이 계획의 새 흐름은 그 도우미를 쓰지 않는다.
- 남은 위험: 키보드가 열린 테이블 화면에서 패널이 인물을 가리는 알려진 한계(가정 A1)와 실제 한글 조합·iOS 키보드는 07-19·07-21 몫이다.

## Self-Check: PASSED

- 파일 존재: src/screens/DayScene.tsx, src/screens/verdictScene.tsx, src/game/verdict.ts, src/styles/day.css, test/client/nightChat.test.tsx, scripts/e2e/flows.mjs, scripts/e2e/browser.mjs 확인, src/components/DefensePanel.tsx 삭제 확인
- 커밋 5개(94d6c78, 6021935, 20ba869, 3bc39dc, 5e72473) 모두 HEAD 의 조상
- 수용 기준 통과: `chat={chat}`(RoomScreen)·`<ChatPanel`(DayScene)·`mf-dayscene__panel--chat`(day.css)·`id: "chat-table"`, `defenseStartLine`(verdict.ts)·`addSystem(`(DayScene)·nightChat.test 의 ChatPanel/data-chat-channel, `마피아끼리만`(flows.mjs), `.skip(`·`.todo(` git grep 0건
- 전체 검증: `npx vitest run` 142 파일 3788 통과(1 skipped 는 이전부터), `npm run typecheck` 종료 0, `npx vite build` 성공, `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 280 통과, `npm run e2e -- --only chat-table` 6종 크기 모두 33/33 `E2E OK`, `--only chat-ghost` 13/13

---
*Phase: 07-free-chat*
*Completed: 2026-11-01*
