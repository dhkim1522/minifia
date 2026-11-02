---
phase: 08-day-execution-ghost
plan: "18"
subsystem: night-morning-frame
tags: [tdd, tracer, gamemap, gamepanel, night, morning, ghost-ring, usedayfx, roomscreen]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-12 WorldStage pick·tagProps.ring, 08-13 GameMap·GamePanel·headerFor·useDayFx 가 RoomScreen 에 있음, 08-06 dayView noExecution 밤 알림, 08-08 presence lightingOf(night·morning), 08-17 유령 분기·ghostEnter
provides:
  - RoomScreen 이 night·morning 도 장면 키 gameMap 으로 GameMap 에서 그린다(옛 투표 세 단계만 DayScene)
  - GameMap 밤 이름표 선택 — 산 마피아(자신·동료 제외)·경찰·의사(자신 포함)가 이름표를 눌러 send pick, 선택 거절 시 알림 뒤 서버 값 복귀
  - 밤 발밑 고리(data-ring-kind) — 산 마피아 = 내 선택·동료 선택(allyPicks), 경찰 police, 의사 doctor, 유령 = spectate.picks(마피아 → 경찰 → 의사 우선 하나)
  - GamePanel 밤 하단 — 산 경찰·의사·시민 NightPanel 알약(NIGHT_PANEL_TEXT), 산 마피아·유령 채팅(서버 me.chat 이 그 채널일 때만)
  - useDayFx 마피아 채널 시작 줄 '밤 · 마피아 채팅', 아침 알림(morningCardText 제목)
  - headerFor 산 마피아 밤 안내 '없앨 사람을 눌러요'
  - test/client/nightMap.test.tsx (28개)
affects: [08-19 DayScene 삭제(밤·아침 경로가 이미 없음), 08-27 옛 화면 시험 정리(아래 시험 정리 표 참고), 08-23·24 E2E, 9페이즈 밤·아침 본 화면]

actuals:
  tokens: 14000
  tasks: 3
  commits: 5
plan_head_before: 56088712eb7e2c1e689ae629924cad3f071e90dd
plan_head_after: 4949e9b26169108218f8189b67cdddc41a210827

tech-stack:
  added: []
  patterns:
    - "밤 고리는 서버가 이 사람에게 보낸 값에서만 만든다: 산 사람 = me.pick(+마피아는 me.allyPicks), 유령 = spectate.picks. 산 사람 view 에 spectate.picks 가 잘못 섞여 와도 spectate 는 내가 탈락했을 때만 읽으므로 고리가 없다(시험으로 변이 확인)"
    - "채팅 패널 게이트는 서버 view.me.chat 기준: 밤에는 산 사람 = mafia, 유령 = ghost 일 때만 ChatPanel 을 그리고 아니면 패널 자체가 없다(역할 문구가 DOM 에 먼저 들어오지 않음)"
    - "밤 pick 과 낮 point 는 같은 mine·거절 복귀 장치를 쓴다: serverMine 만 단계별(points 의 내 줄 / me.pick)이고, 보낸 뒤 3초 안의 error 프레임은 선택 거절로 본다"

key-files:
  created:
    - test/client/nightMap.test.tsx
  modified:
    - src/screens/RoomScreen.tsx
    - src/screens/GameMap.tsx
    - src/screens/GamePanel.tsx
    - src/net/useDayFx.ts
    - src/game/dayView.ts
    - test/client/{characterAudit,execVote,guide,noExecution,phaseScreens,roleCardFlow,testTools,verdictStates}.test.tsx

key-decisions:
  - "마피아 헤더 안내 '없앨 사람을 눌러요' 는 headerFor 의 night 분기(DAY_COPY.mafiaNightHint)에 둔다. 경찰·의사·시민의 밤 문구는 하단 NIGHT_PANEL_TEXT 표가 맡아 헤더 안내가 없고(화면당 data-guide 하나), 유령은 기존 ghostNightHint"
  - "아침 알림 길이 = 서버 phaseDurationMs(아침 5초, 가정 A3). 알림은 서버 마감에서 끊기는 것이 아니라 표시 시간이 같을 뿐이고, 다음 단계(낮 시작) 알림이 오면 한 번에 하나 규칙으로 바뀐다"
  - "유령 시작 줄은 밤마다 다시 만들지 않는다(DayScene 은 탈락자의 밤마다 만들었다). 계획에 옮길 규칙으로 적힌 것은 마피아 채널 시작 줄뿐이고, 유령 줄은 08-17 의 산 → 탈락 전환 규칙을 그대로 둔다"

requirements-completed: []

coverage:
  - id: N1
    description: "밤(산 마피아): 자신·동료를 뺀 산 좌석만 이름표 버튼, 누르면 send {t:pick,target}, 서버 view(me.pick·allyPicks)가 오면 내 선택·동료 선택 좌석 data-ring-kind=mafia, 눌림 aria-pressed. 시민은 버튼·고리 0개"
    requirement: GHOST-02
    verification:
      - kind: component
        ref: "test/client/nightMap.test.tsx '밤 임시 틀 트레이서' (4 tests) · '역할별 하단 패널' (경찰·의사 고리)"
        status: pass
    human_judgment: false
  - id: N2
    description: "밤 아래 패널: 경찰 '조사할 사람을 고르세요'·의사 '지킬 사람을 고르세요'(자기 좌석 포함)·시민 '밤이 되었어요' + 알약, 마피아 마피아 채널 채팅 + 헤더 '없앨 사람을 눌러요', 유령 유령 채널 채팅 + '모두의 직업과 밤 행동이 보여요'. 채팅 패널은 서버 me.chat 기준(없으면 패널·마피아 문구 0)"
    requirement: GHOST-02
    verification:
      - kind: component
        ref: "test/client/nightMap.test.tsx '밤 임시 틀 — 역할별 하단 패널' (8 tests), '유령이 보는 밤 행동' (2 tests)"
        status: pass
      - kind: component
        ref: "test/client/guide.test.tsx 'UX-01 맵 화면: night·morning' · '처형 무효로 온 밤(맵 화면)'"
        status: pass
    human_judgment: false
  - id: N3
    description: "마피아 채널 시작 줄 '밤 · 마피아 채팅' — 낮에서 밤으로 넘어올 때 한 번(재그림에도 한 번), 밤 첫 스냅샷은 줄 없음, 시민·경찰·의사 화면에는 마피아 문구가 없다"
    requirement: GHOST-02
    verification:
      - kind: component
        ref: "test/client/nightMap.test.tsx 시스템 줄 · 시민·경찰·의사 화면 마피아 문구 0 (2 tests)"
        status: pass
    human_judgment: false
  - id: N4
    description: "유령은 서버가 보낸 spectate.picks 만큼 대상 발밑에 고리(한 좌석 여럿이면 마피아 우선), 빈 picks·낮 단계는 0개. 산 사람 화면에 남의 선택 고리가 없다(잘못 섞인 spectate.picks 포함, 산 경찰의 allyPicks 도 마피아 고리가 되지 않음)"
    requirement: GHOST-02
    verification:
      - kind: component
        ref: "test/client/nightMap.test.tsx '밤 임시 틀 — 유령이 보는 밤 행동' (6 tests)"
        status: pass
    human_judgment: false
  - id: N5
    description: "밤 조명(setScene lighting night), 산 사람 맵 탭 move 없음·유령은 있음, 선택 거절 시 알림 '보내지 못했어요. 다시 해 보세요' 뒤 눌림·고리가 서버 값으로 복귀"
    requirement: GHOST-02
    verification:
      - kind: component
        ref: "test/client/nightMap.test.tsx '밤 임시 틀 — 조명·이동·거절' (2 tests)"
        status: pass
    human_judgment: false
  - id: M1
    description: "아침: 알림 = morningCardText 제목('{닉네임}님이 …' / '아무 일도 없었습니다') 서버 마감(5초)까지, 아침 조명, 채팅 패널 all(유령 ghost), 밤 탈락자는 산 사람 화면의 이름표·장면 표에서 사라지고 떠오름(fadeAt) 없음, 본인이 당하면 유령 view·유령 시작 줄 한 번. 첫 스냅샷 아침은 알림 없음"
    requirement: DAY-07
    verification:
      - kind: component
        ref: "test/client/nightMap.test.tsx '아침 임시 틀' (5 tests)"
        status: pass
    human_judgment: false
  - id: M2
    description: "지목 동률·0표로 온 밤 '처형 없음' 알림 1.4초, 처형이 이뤄진 밤·재접속 밤은 알림 없음. 낮 시작부터 아침까지 8단계 모두 .mf-game 이고 .mf-dt·.mf-dayscene 는 없으며, 단계가 바뀌어도 WorldStage 노드가 같고 런타임이 다시 만들어지지 않는다"
    requirement: DAY-07
    verification:
      - kind: component
        ref: "test/client/nightMap.test.tsx '아침 임시 틀' 처형 없음·고정 테이블 없음 (3 tests) + 트레이서 '같은 노드'"
        status: pass
    human_judgment: false
  - id: M3
    description: "전체: npm run typecheck 통과, client 60 파일 1854 통과, vite build 통과, 시험에 .skip/.todo 0건"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project client; npx vite build"
        status: pass
    human_judgment: false
  - id: M4
    description: "밤 발밑 고리 색(마피아 진홍·경찰·의사)의 실제 보임, 밤 이름표 글자 대비, 아침 알림 36px 가독성, 밤 하단 알약 높이(157)가 맵을 가리지 않는지"
    verification: []
    human_judgment: true
    rationale: "화면 시험은 data-ring-kind 값과 DOM 만 고정한다(가짜 런타임이라 3D 고리·조명이 그려지지 않는다). 색·대비·가림은 08-24 E2E 와 9페이즈 팀 테스트가 본다"

duration: 12min
completed: 2026-11-02
---

# Phase 8 Plan 18: 밤·아침 임시 틀 Summary

**밤·아침도 낮과 같은 GameMap 한 장면에서 돈다 — 산 마피아·경찰·의사는 이름표를 눌러 pick 을 보내고 그 선택이 발밑 고리로 보이며, 유령은 서버가 보낸 spectate.picks 만큼 같은 고리를 보고, 아침은 v1.0 morningCardText 제목 알림과 채팅으로 이어지고 고정 테이블 화면은 어느 단계에서도 그려지지 않는다.**

## Accomplishments

- **밤 이름표 선택 (GHOST-02, 트레이서)**: `RoomScreen` 의 night·morning 을 `gameMap` 으로 옮기고(옛 투표 세 단계만 DayScene), `GameMap` 이 산 마피아·경찰·의사에게 `WorldStage.pick` 을 준다. 대상 좌석은 DayScene 규칙 그대로(마피아는 자신·동료 제외, 경찰·의사는 자신 포함, 권위는 서버 pickTarget). 누르면 `send({t:"pick"})`, `mine` 은 서버 `me.pick` 에 낙관적 값을 얹는 낮 지목과 같은 장치다. 거절(보낸 뒤 3초 안의 error)은 '보내지 못했어요. 다시 해 보세요' 뒤 서버 값으로 되돌린다.
- **밤 발밑 고리 (A2 임시 예외)**: `tagProps` 의 night 분기가 `ring`(mafia·police·doctor)을 준다. 산 마피아 = 내 선택 + `me.allyPicks`, 경찰/의사 = 내 선택 하나, 유령 = `spectate.picks`(마피아 → 경찰 → 의사 우선 하나). 산 시민과 단계가 밤이 아닌 화면에는 고리가 없다(T-08-46).
- **밤 아래 패널**: `GamePanel` 이 산 경찰·의사·시민에게 v1.0 `NightPanel`(NIGHT_PANEL_TEXT)+선택 알약/안내 알약을, 산 마피아·유령에게는 **서버 `me.chat` 이 mafia/ghost 일 때만** `ChatPanel` 을 그린다(T-08-47). 새 문구는 마피아 헤더 안내 '없앨 사람을 눌러요' 하나(계획이 명시)이고 `headerFor` 에 둔다.
- **useDayFx**: 낮 → 밤에 산 마피아(서버 채널 mafia)의 시스템 줄 '밤 · 마피아 채팅' 한 번, 밤 → 아침에 `morningCardText` 제목을 서버 마감 길이만큼 결과 알림으로. 첫 스냅샷·재접속은 둘 다 없다.
- **아침의 사라짐**: 새 코드 없이 `visibleSeats` 가 산 사람 화면에서 탈락자를 뺀다. 아침 view 에는 ghostRise fx 가 없어 떠오름 없이 알림과 함께 사라지고, 본인이 당하면 08-17 유령 시작 줄·유령 view 로 바뀐다(시험으로 고정).

## TDD Gate Compliance

| 작업 | RED 커밋 | GREEN 커밋 | 비고 |
|------|----------|------------|------|
| 1 (트레이서, tdd 아님) | — | d83d1f5 | 시험과 구현을 한 커밋에(`type="tracer"`). 처음 돌렸을 때 4개 중 3 실패(밤 마피아 버튼 없음·고리 없음·WorldStage 노드가 다시 열림)로 의도한 단언이 실패함을 보고 구현했다 |
| 2 | 8235aaf | 3f328d3 | RED: 신규 20개 중 6 실패(패널 문구·채팅 게이트·마피아 시스템 줄) + guide 시험 2 실패. 고리·거절 알림·유령 시험은 작업 1 이 이미 만든 동작이라 통과(특성 시험) |
| 3 | 875a35d | 4949e9b | RED: 28개 중 4 실패(아침 알림 없음). '처형 없음' 밤 알림은 08-06 dayView 가 이미 있어 통과 |

**semanticAssessment**: 작업 2 RED 는 `expected null to be '조사할 사람을 고르세요'`(NightPanel 없음)·`expected <section class="mv-chat"> to be null`(서버 채널 없는데 채팅 패널)·`expected [] to have a length of 1`(마피아 시스템 줄 없음) 등 계획한 단언의 실패다. 처음에는 제목 선택자(`h1`)와 거절 알림 시험의 이벤트 구독(`onEvent` 구독자가 여럿이라 마지막 것만 불러서 알림이 비어 있었음)이 시험 오류여서 RED 커밋 전에 고쳤다. 작업 3 RED 는 `expected '' to be '서준님이 조용히 눈을 감았습니다'`(아침 알림 없음). `gsd_run check tdd-red-evidence` 는 따로 돌리지 않았다(08-10·12·15·16·17 과 같음).

**트레이서 게이트**: 작업 1 `<verify>`(`npx vitest run test/client/nightMap.test.tsx`) 통과 뒤 확장했다(⚡ Tracer verified end-to-end — expanding).

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 | d83d1f5 | feat: RoomScreen night·morning → GameMap, 밤 pick·고리, 옛 시험 정리 |
| 2 RED | 8235aaf | test: 역할별 패널·마피아 시작 줄·유령 고리·거절, guide 시험 맵 기준 |
| 2 GREEN | 3f328d3 | feat: GamePanel 밤 분기, useDayFx 마피아 줄, headerFor 마피아 안내 |
| 3 RED | 875a35d | test: 아침 알림·사라짐·유령 전환·처형 없음·고정 테이블 없음 |
| 3 GREEN | 4949e9b | feat: useDayFx 아침 알림(morningCardText) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘 해소] 밤·아침이 맵으로 가면서 옛 DayScene 시험이 깨짐 (49건)**
- **Found during:** Task 1
- **Issue:** 계획 `<verify>`(`npx vitest run --project client` 통과)와 ROADMAP 공통 조건(대체한 v1.0 코드만 검사하던 시험은 같은 페이즈에서 정리, skip 금지)을 지키려면 08-13 처럼 08-27 보다 먼저 정리해야 했다. 계획 files_modified 밖 시험 8파일.
- **Fix:** 아래 표대로 맵 화면 기준으로 옮기거나, 닿을 수 없는 경로라 지움. skip·기준 수치 낮추기 없음. 시험 수 client 1861 → 1854(순감 7: 지운 10, 옮기며 만든 새 it 포함).
- **Files modified:** test/client 8파일 (아래 표)
- **Commit:** d83d1f5, 8235aaf

| 파일 | 처리 | 이유 |
|------|------|------|
| noExecution.test | 'RoomScreen 처형 무효로 밤이 올 때' 시험 9개 지움(카드 단위·CSS·소스 시험 8개 남음) | 회색 카드(NoExecutionCard)·밤 시작 문구·읽기 안내는 DayScene 몫. 경찰 버튼→pick 은 nightMap, '처형 없음' 알림 1.4초는 nightMap 이 봄 |
| verdictStates.test | noExecution 단계 12칸(테이블 불변식)과 재접속 대조 1칸 제외 | 맵 화면에는 .mf-dt·마름모·후광이 없다. 같은 뜻(익명·직업 비노출)은 gameMap·ghostView·nightMap 이 봄 |
| phaseScreens.test | 'night → morning 같은 노드' 를 .mf-game 기준으로 다시 씀, '헤더 제목·안내 문구표' 지움 | 문구표는 PhaseBar(`.mf-phasebar__do` '1일차 · 함께 지목하세요') 전용. 밤·아침 제목·안내는 guide·nightMap 이 봄 |
| guide.test | night·morning 시험을 GameMap 기준으로 다시 씀(밤 5시점 + 아침 5시점 + 타이머), 처형 무효 밤 시험을 맵 기준으로, 점검표 9 → 7단계 | 밤 안내는 하단 NightPanel 제목 또는 헤더 안내. **아침은 UI-SPEC 단계표에 안내가 없어 산 사람 [data-guide] 0개**(유령만 하나) — 08-27 '화면당 [data-guide] 하나' 에서 이 칸을 예외로 다뤄야 함 |
| roleCardFlow.test | 단계별 버튼 모양을 night·morning 도 아이콘 22 버튼으로, 아이콘 20 시험은 execVote 로, 알림 개수에서 맵 구조 자리·아침 알림 제외 | 선택자만 맵 화면 기준 |
| testTools.test | '아침 어둡게 층(.mf-dt__dim)' 시험을 '아침에도 .mf-game__test 에 버튼이 있고 눌린다' 로 | 어둡게 층은 맵 조명으로 대체 |
| characterAudit.test | 테이블 인물 시험을 night → execVote 로 | 같은 DayTable 을 쓰는 남은 단계 |
| execVote.test | 'night → execVote 같은 노드' 를 candidateVote → execVote 로 | 두 단계 모두 DayScene |

**2. [Rule 3 - 막힘 해소] 계획 files_modified 밖 파일 `src/game/dayView.ts`**
- **Issue:** 마피아 헤더 안내 '없앨 사람을 눌러요' 는 헤더 문구의 단일 출처 `headerFor` 에 두는 것이 맞아 `DAY_COPY.mafiaNightHint` 와 night 분기를 더했다(GameMap 에 따로 두면 문구 표가 둘이 된다).
- **Files modified:** src/game/dayView.ts
- **Commit:** 3f328d3

### 검증 방식 차이

- 계획 작업 2 의 "가짜 렌더러 setLighting('night')" 는 08-17 과 같이 가짜 런타임이 받은 장면 표(`setScene`)의 `lighting` 값으로 단언했다. 3D 고리·조명이 실제로 그려지는지는 이 시험이 보지 않는다(coverage M4).
- "유령 고리: 좌석 2 가 mafia 또는 doctor 중 하나" 는 계획 우선순위(마피아 → 경찰 → 의사)대로 mafia 로 고정해 단언했다.

## Known Stubs

None.

## Threat Flags

None — 새 네트워크 표면 없음(기존 `pick` 메시지 재사용). 밤 고리는 서버가 이 사람에게 보낸 값(me.pick·allyPicks·spectate.picks)에서만 만들고 산 시민 화면 고리 0개·잘못 섞인 spectate.picks 무시를 시험으로 고정했다(T-08-46). 마피아 채널 문구와 채팅 패널은 서버 me.chat 이 mafia 일 때만 나온다(T-08-47). 패키지 설치 없음(T-08-SC).

## Self-Check: PASSED

- 파일 있음: test/client/nightMap.test.tsx, src/screens/GameMap.tsx, src/screens/GamePanel.tsx, src/screens/RoomScreen.tsx, src/net/useDayFx.ts, src/game/dayView.ts
- 커밋 5개 모두 HEAD 의 조상: d83d1f5, 8235aaf, 3f328d3, 875a35d, 4949e9b
- 인수 기준: `t: "pick"`·`allyPicks` (GameMap) / `NIGHT_PANEL_TEXT` (GamePanel) / `channelStart.mafia`·`morningCardText` (useDayFx) / RoomScreen `"gameMap"` 1곳 이상, sceneKey 의 dayAnnounce 다음 12줄 안에 `case "morning"` / 시험 `.skip(`·`.todo(` 0건 — 모두 성공
- 계획 검증: `npm run typecheck`(rc 0) · `npx vitest run --project client`(60 파일 1854 시험) · `npx vite build` 통과
