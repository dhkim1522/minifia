---
phase: 08-day-execution-ghost
plan: "13"
subsystem: game-map-screen
tags: [tdd, tracer, gamemap, gamepanel, end-discussion, result-announce, role-card-icon, use-map-insets, day-fx, can-walk]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-06 dayView.ts(headerFor·dayEvents·ANNOUNCE_DAY_MS), 08-04 movement.ts canMoveIn, 08-08 presence.ts sceneLook, 08-12 WorldStage(scene·canWalk·pick·tagProps·deny), 08-02 nomination.ts majorityOf
provides:
  - src/screens/GameMap.tsx — 낮 시작~처형 여섯 단계를 한 장면 키("gameMap")로 그리는 맵 화면 틀(data-game-stage·data-phase)
  - src/screens/GamePanel.tsx — 아래 패널(채팅 + 낮 토론의 [토론 끝내기] 행동 줄, data-end-discussion)
  - src/net/useMapInsets.ts — 로비·게임 맵 공용 측정·키보드·기록 칸 높이 훅
  - src/net/useDayFx.ts — dayEvents → 채팅 시스템 줄·결과 알림 적용 훅
  - src/components/ResultAnnounce.tsx(data-announce, 36px 결과 알림), RoleCardButton iconOnly(44×44), PhaseHeader extra 슬롯
  - src/styles/game.css(.mf-game·.mf-game__panel·.mf-announce), RoomScreen 장면 키 "gameMap"·assigning/roleReveal 의 preloadWorld()
affects: [08-14 이후 지목·찬반·처형 화면(GamePanel·GameMap 위에 얹음), 08-15, 08-16, 08-17 유령, 08-18 밤·아침 임시 틀, 08-19 v1.0 테이블 삭제, 08-27 옛 화면 시험 정리]

actuals:
  tokens: 17200
  tasks: 3
  commits: 5
plan_head_before: fb80be5b6687f7a06657977d37620419e661c8a0
plan_head_after: 07060e78b353fb31b1496546ff7147cd39565da6

tech-stack:
  added: []
  patterns:
    - "방 화면(RoomScreen)이 useDayFx 를 쥐고 announce 만 맵 화면으로 내린다 — 낮 시작은 역할 확인·밤(맵이 아닌 화면)에서 들어와 맵 화면이 새로 마운트되므로 맵 화면은 직전 view 를 모른다"
    - "시간 링의 250ms 다시 그리기를 헤더 하위 부품(MapHeader)에 가둔다 — 맵 화면 전체가 4번/초 다시 그려지지 않는다"
    - "scene(장면 표)은 useMemo([view, stageH])로 만들어 타이머 틱이 WorldStage 의 setScene 을 흔들지 않는다"
    - "거절 카운터(rejected)로 낙관적 눌림을 서버 값으로 되돌린다 — 새 view 가 오지 않아도 복귀"

key-files:
  created:
    - src/screens/GameMap.tsx
    - src/screens/GamePanel.tsx
    - src/styles/game.css
    - src/components/ResultAnnounce.tsx
    - src/net/useMapInsets.ts
    - src/net/useDayFx.ts
    - test/client/gameMap.test.tsx
  modified:
    - src/screens/RoomScreen.tsx
    - src/screens/Lobby.tsx
    - src/components/RoleCardButton.tsx
    - src/components/v2/PhaseHeader.tsx
    - src/styles/rolecard.css
    - src/styles/v2.css
    - src/debug/sheetDebug.ts
    - test/client/lobby.test.tsx

key-decisions:
  - "useDayFx 는 계획의 GameMap 안이 아니라 RoomScreen 이 쥔다. 낮 시작(dayAnnounce)은 역할 확인·밤에서 들어와 GameMap 이 새로 마운트되는 순간이라, GameMap 안의 훅은 직전 view 가 없어 '낮이 되었습니다' 알림과 '{N}일차' 줄을 영영 못 만든다(첫 스냅샷 규칙이 가린다). 방 화면은 모든 단계에서 살아 있어 직전 view 를 쥘 수 있고, 밤의 '처형 없음' 줄도 밤 화면이 맵으로 바뀌기 전에 채팅에 남는다. GameMap 은 announce 문자열만 받는다"
  - "GameMap 속성에서 계획의 epoch·bannerVisible·myRoleButton 을 뺐다: epoch 는 훅이 방 화면으로 올라가 쓸 곳이 없고, bannerVisible 은 이 계획에 알림 억제 규칙이 없으며, myRoleButton 은 roleCard {unread, onOpen} 으로 바꿨다(계획이 허용한 방식). 거절 알림용 onEvent·결과 알림용 announce·불가 카드용 onLeave 를 더했다"
  - "맵을 쓸 수 없는 기기의 불가 카드 [처음으로] 는 onExit('gaveUp') 로 방을 떠난다(입장 정보는 지우지 않아 다시 들어올 수 있음). v1.0 테이블 화면으로 몰래 대체하지 않는다(E8 #30)"
  - "PhaseHeader 에 선택 속성 extra(시간 링 왼쪽, 링이 없으면 오른쪽 끝)를 더했다 — 계획 files 밖이지만 [역할 카드] 를 링 '왼쪽 형제' 로 두려면 필요하다. extra 가 없으면 마크업이 그대로다"
  - "토론 끝내기 버튼은 ActionButton 을 못 써서(aria-pressed 미지원, 계획이 ActionButton 변경을 files 밖으로 둠) .mf-act 규칙을 쓰는 button 을 GamePanel 안에 직접 그렸다. 눌림 면은 .mf-game__end[aria-pressed=true] CSS"
  - "오류 프레임 WRONG_PHASE·BAD_MESSAGE 를 거절로 본다(둘 다 서버가 단계·산 사람 검사에서 돌려주는 코드). RATE_LIMITED 는 알림도 되돌림도 만들지 않는다"
  - "헤더 안내(2.5초 접힘)는 GameMap 이 단계(phase)마다 다시 켠다. 재접속·첫 마운트에서도 한 번 보인다(맵이 열린 시점이 아닌 화면 마운트 기준 — onReady 에 묶으면 가림막이 길어질 때 안내가 안 보인다)"

requirements-completed: []

coverage:
  - id: D1
    description: "낮 토론 산 사람: [data-end-discussion] 하나, 점 total = ⌊산 사람 ÷ 2⌋ + 1(5명→3, 산 사람 5·2명 경우 포함), 누르면 endDiscussion {on} 한 번·aria-pressed 즉시 바뀜(점은 서버 값 그대로), 서버 view(endCount 1·me.endDiscussion) 가 오면 점 1·서버 눌림, send 가 false 면 눌림 무변경, 끊김은 aria-disabled 이고 안 보냄, 유령·다른 단계에는 행동 줄 없음, 보내는 메시지 키는 t·on 뿐"
    requirement: DAY-03
    verification:
      - kind: component
        ref: "test/client/gameMap.test.tsx '낮 토론 [토론 끝내기] (DAY-03, 08-13)' (10 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "낮 시작→토론→지목→변론→찬반→처형: [data-world-stage-fake] 가 같은 노드이고 마운트 1번, 헤더→맵→패널 DOM 순서, 여섯 단계 어디에도 .mf-dt·.mf-dayscene 없음, 불가 카드 onLeave 는 onExit('gaveUp')"
    requirement: DAY-07
    verification:
      - kind: component
        ref: "test/client/gameMap.test.tsx '한 장면 키 (DAY-07, 08-13)' (4 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "헤더·패널 측정이 stageInsets 로, 키보드 열림은 data-kb-open·행동 줄 숨김·기록 칸 72·패널 --kb·스테이지 아래 = 150 + lift, 경계 아래·블러 복귀, 로비는 같은 훅(소스 게이트: Lobby 에 new ResizeObserver·useKeyboardLift( 없음)이며 로비 기존 키보드 시험 그대로 통과"
    requirement: DAY-07
    verification:
      - kind: component
        ref: "test/client/gameMap.test.tsx '스테이지 사각형 측정과 키보드 (CHAT-05, 08-13)' (5 tests); test/client/lobby.test.tsx 'Lobby — 측정·키보드 코드는 useMapInsets 훅 하나다' + 기존 키보드 6 tests"
        status: pass
    human_judgment: false
  - id: D4
    description: "헤더: 제목 '낮 토론'·안내 [data-guide] 하나('이야기하며 마피아를 찾아요')·2500ms 뒤 .is-folded·단계마다 다시, 서버 마감 기준 시간 링 role=timer(낮 시작은 링 없음), 유령 안내 '모두의 직업이 보여요', [역할 카드] 44×44 글자 없는 아이콘 버튼(링 앞 형제, aria-label 역할 카드 / 새 기록, 점 gray-100)"
    requirement: DAY-07
    verification:
      - kind: component
        ref: "test/client/gameMap.test.tsx 'GameMap — 헤더·[역할 카드] (UI-SPEC A2)' (7 tests); test/client/roleCardFlow.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "이동 차단: 산 사람은 dayAnnounce·discussion 만 canWalk, 지목·변론·찬반·처형은 막힘, 유령은 여섯 단계 모두 걷는다, scene(talk 조명·follow 카메라)을 WorldStage 에 넘김"
    requirement: MAP-04
    verification:
      - kind: component
        ref: "test/client/gameMap.test.tsx 'GameMap — 이동 차단 canWalk (MAP-04)' (3 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "결과 알림: 밤→낮 시작 진입에 '낮이 되었습니다'(role=status)·채팅 '2일차'·2000ms 뒤 사라짐, 첫 스냅샷·epoch 변경 첫 스냅샷은 알림·줄 없음, 찬반 결과 '찬성 2 · 반대 3' 뒤 2000ms 에 '처형 없음' 이 바꿈(한 번에 하나), 닉네임 '<b>영희</b>' 가 글자로 보임, 결과 없으면 요소 없음, CSS 위 240·36px·keep-all·62% 어둡게·움직임 줄이기, 28px 로 줄이지 않음"
    requirement: DAY-07
    verification:
      - kind: component
        ref: "test/client/gameMap.test.tsx '낮 시작 결과 알림과 채팅 줄 (E5 #17~#19)' (7 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "거절: 토론 끝내기가 WRONG_PHASE 로 거절되면 위 알림 '지금은 고를 수 없어요' 뒤 눌림이 서버 값으로 복귀, RATE_LIMITED 는 무반응. 소스 게이트: ResultAnnounce·GameMap·GamePanel 에 innerHTML 0건, 보내는 메시지에 seat·id 필드 없음"
    requirement: DAY-03
    verification:
      - kind: component
        ref: "test/client/gameMap.test.tsx '거절과 끊김 (E1 #4)' (2 tests) + '소스 게이트 (T-08-33)' (1 test)"
        status: pass
    human_judgment: false
  - id: D8
    description: "전체: 타입 검사(npm run typecheck) 0 오류, client+unit 130 파일 4050 통과(1 skipped 는 이전부터), vite build 통과, .skip(/.todo( 0건, 레포 위생 grep 0건"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project client --project unit; npx vite build"
        status: pass
    human_judgment: false
  - id: D9
    description: "역할 확인 → 낮 시작에서 맵이 열리기 전에도 헤더·패널이 먼저 보이고, 가림막이 걷히면 알림이 이어지는 체감, 알림 36px 한 줄이 360 폭에서 두 줄로 감기는 모양, 아이콘 [역할 카드] 와 시간 링·안내의 겹침 없음(폭 360·390), 실제 키보드에서 행동 줄이 숨는 체감"
    verification: []
    human_judgment: true
    rationale: "가짜 WorldStage 와 happy-dom 은 레이아웃·가림막 타이밍을 모른다. preloadWorld 는 assigning·roleReveal 에서 한 번 불리지만 체감 지연은 실기기(백로그 '실기기 확인은 끝에 몰아서')와 E2E(08-23)가 본다. 계획의 backstop 항목"

duration: 70min
completed: 2026-11-02
---

# Phase 8 Plan 13: 게임 맵 화면 틀 — 낮 시작·토론 Summary

**낮 시작·낮 토론이 3D 맵 위 GameMap 한 화면에서 돈다: [토론 끝내기] 가 서버까지 가서 점이 서버 값대로 켜지고, 시간 링·접히는 안내·아이콘 [역할 카드]·36px 결과 알림이 붙고, 지목 이후 단계로 바뀌어도 맵이 다시 열리지 않는다.**

## Accomplishments

- **트레이서 (DAY-03)**: `GameMap`(헤더·맵·패널) → `GamePanel`(채팅 + [토론 끝내기] 행동 줄) → `send({t:"endDiscussion", on})` → 서버 view 의 `day.endCount`/`me.endDiscussion`. 눌림은 `useViewChoice` 로 낙관적이고 서버 view 가 오면 서버 값이 이긴다. `RoomScreen` 이 낮 시작·토론·지목·변론·찬반·처형을 장면 키 `"gameMap"` 하나로 그려 단계가 바뀌어도 `WorldStage` 가 같은 노드다. assigning·roleReveal 동안 `preloadWorld()`.
- **useMapInsets (CHAT-05)**: Lobby 의 헤더·패널 `ResizeObserver` 측정, 키보드 lift getter(`bottom` = 패널 + lift), 기록 칸 높이, `.mf-room` CSS 변수 규칙(07-19)을 훅 하나로 옮겼다. Lobby 의 기존 키보드 시험 6개가 그대로 통과하고 GameMap 이 같은 훅을 쓴다.
- **헤더·알림·연출 (DAY-07, MAP-04)**: `MapHeader`(제목 + 단계마다 2.5초 접히는 안내 + 서버 마감 기준 시간 링 + 링 왼쪽 아이콘 [역할 카드]), `ResultAnnounce`(위 240·36px·keep-all·뒤 62% 어둡게·한 번에 하나), `useDayFx`(dayEvents → 채팅 줄·지연 줄·결과 알림), `canMoveIn` 으로 맵 탭 차단, `sceneLook` 장면 표, 거절 알림.

## TDD Gate Compliance

| 작업 | RED 커밋 | GREEN 커밋 | 비고 |
|------|----------|------------|------|
| 1 (트레이서) | — | 8f8c983 | `type="tracer"` 라 시험과 구현을 한 커밋에 넣었다(08-12 와 같음). 시험은 구현 직후 통과 확인 |
| 2 | a4e05be | aa2ca0e | RED 5건 |
| 3 | 2bfbed2 | 07060e7 | RED 12건 |

**semanticAssessment**: 작업 2 RED 5건 중 4건은 `expected undefined to deeply equal { top: 62, bottom: 306 }`·`expected null to be 'true'`(data-kb-open)·`expected <button …> to be null`(행동 줄이 남음) 같은 계획한 행동 단언 실패다. 나머지 1건(로비 훅 사용 게이트)은 `ENOENT: src/net/useMapInsets.ts` — 훅 파일이 없다는 구조 시험으로 실패 이유가 계획한 것(구현 부재)과 같다. 기록 칸 높이 시험은 구현 전에도 맞는 대조라 통과했다. 작업 3 RED 12건은 `expected undefined to be '낮이 되었습니다'`·`expected [] to deeply equal ['찬성 2 · 반대 3']`·`expected 'dayAnnounce:undefined' to be 'dayAnnounce:true'`·`expected '역할 카드' to be ''`·`expected '' to be '지금은 고를 수 없어요'` 등 행동 단언 실패이고, 소스 게이트 1건과 CSS 문자열 2건은 파일·규칙 부재로 실패했다(import·문법 오류 없음). `gsd_run check tdd-red-evidence` 는 따로 돌리지 않았다(08-10·08-12 와 같음).

**트레이서 게이트**: 작업 1 `<verify>`(`npx vitest run test/client/gameMap.test.tsx test/client/roomScreen.test.tsx`)를 통과한 뒤 확장했다(⚡ Tracer verified end-to-end — expanding).

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 | 8f8c983 | feat: 트레이서 — GameMap·GamePanel·game.css·RoomScreen 장면 키, 옛 테이블 시험 정리 |
| 2 RED | a4e05be | test: 스테이지 측정·키보드·로비 훅 사용 |
| 2 GREEN | aa2ca0e | feat: useMapInsets, Lobby·GameMap 이 같은 훅 |
| 3 RED | 2bfbed2 | test: 헤더·역할 카드·결과 알림·낮 시작·canWalk·거절 |
| 3 GREEN | 07060e7 | feat: RoleCardButton iconOnly·ResultAnnounce·useDayFx·MapHeader·거절 복귀 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 버그 예방] useDayFx 를 GameMap 이 아니라 RoomScreen 이 쥔다**
- **Found during:** Task 3 설계
- **Issue:** 계획은 GameMap 안에서 `useDayFx({view, epoch, chat})` 를 부르게 했다. 그러나 낮 시작은 역할 확인·밤(맵이 아닌 화면)에서 들어와 GameMap 이 그 순간 처음 마운트된다. 훅의 '직전 view' 가 비어 있어 첫 스냅샷 규칙이 이벤트를 모두 지우므로 '낮이 되었습니다'·'{N}일차' 가 한 번도 나오지 않는다(계획 자신의 Task 3 행동 '밤 → 낮 시작이면 알림' 과 모순).
- **Fix:** RoomScreen 이 훅을 부르고 `announce` 를 GameMap 속성으로 내린다. 부수 이득: 밤의 '처형 없음' 채팅 줄도 밤이 아직 기존 화면인 동안 기록에 남는다.
- **Files modified:** src/screens/RoomScreen.tsx, src/screens/GameMap.tsx
- **Commit:** 07060e7

**2. [Rule 3 - 막힘 해소] RoomScreen 장면 키 전환이 옛 테이블 화면 시험을 깨뜨림**
- **Found during:** Task 1
- **Issue:** 낮 시작·토론·변론·처형이 GameMap 으로 가면서 그 단계의 DayScene 마크업(`.mf-dt`·`.mf-dayscene__panel`·`.mf-phasebar__do`·인트로 카드 등)을 검사하던 시험 11파일 119건이 실패했다. 계획의 `<verify>`(`npx vitest run --project client` 통과)와 ROADMAP 공통 조건("대체한 v1.0 코드와 그 코드만 검사하던 테스트는 같은 페이즈에서 함께 지운다, skip 금지")을 함께 지키려고 08-27 보다 먼저 정리했다.
- **Fix:** 아래 표대로 (a) 맵 화면 기준으로 옮김, (b) 닿을 수 없는 경로라 지움. skip·기준 수치 낮추기는 없다. 08-27 의 대응표는 이 표의 지움 항목을 '08-13 선행(git show 8f8c983 의 이전 버전)'으로 적으면 된다.
- **Files modified:** test/client 11파일 (아래 표)
- **Commit:** 8f8c983, 07060e7

| 파일 | 처리 | 이유 |
|------|------|------|
| defense.test | 시험 14개 지움(2개 남음: 변론 하단 채팅 키 `1:defense`, DayTable candidateCenter 소스 게이트) | DayScene 변론 화면(중앙 이동·원뿔·후광·유령 패널)은 닿지 않음 |
| execution.test | 시험 16개와 빈 describe 3개 지움, 라우팅 시험은 GameMap 기준으로 다시 씀(`[data-game-stage]` 같은 노드) | 처형 카드·후광 상한·defense→execution 이어 가기는 DayScene 몫 |
| execIntro.test | 시험 6개 지움(10개 남음) | 인트로 카드는 discussion → execVote 에서만 켜지는데 discussion 이 맵 화면이 됨 |
| execVote.test | 시험 1개 지움, 1개를 night → execVote 로 바꿈 | 같은 이유(낮 → 낮 기록 카드 유지) |
| guide.test | 트레이서 describe 6개·변론/처형 부품 3개·누출 1개 지움, 점검표 13단계 → 9단계 | 맵 화면의 안내는 gameMap.test 가 본다. 08-27 이 '화면당 [data-guide] 하나' 를 GameMap 기준으로 되살린다 |
| phaseScreens.test | 8개 지움, 3개 맵 화면 기준으로 옮김(day 전환·시트 열림 중 day·마피아/시민 마크업 동일) | 낮 시작/토론의 헤더·타이머·테이블·문구 시험 |
| verdictStates.test | defense·execution 단계 24칸과 execVote 재접속 대조 1칸 제외, 후보 변론 4칸은 `.mf-game__panel` 로 옮김(통과) | 테이블 불변식(마름모·후광) |
| characterAudit.test | 낮(토론) 3개를 같은 DayTable 을 쓰는 밤으로 옮김 | 테이블 인물 검사 |
| candidateVote·resultScreen·testTools·roleCardFlow | 단계/선택자만 맵 화면 기준으로 고침 | `.mf-game__test` 자리, `[data-game-stage]`, 아이콘 22 |

**3. [Rule 3 - 막힘 해소] PhaseHeader 에 extra 슬롯**
- **Found during:** Task 3
- **Issue:** [역할 카드] 를 '시간 링 왼쪽 형제' 로 두려면 PhaseHeader 의 링 옆에 자리가 필요한데 슬롯이 없었다.
- **Fix:** 선택 속성 `extra`(없으면 마크업 그대로) + `.mv-phase__side` 규칙.
- **Files modified:** src/components/v2/PhaseHeader.tsx, src/styles/v2.css
- **Commit:** 8f8c983

**4. [Rule 1 - 버그] sheetDebug 화면 종류가 맵 화면을 'other' 로 기록**
- **Found during:** Task 1 (phaseScreens G-01-9 계측 시험 실패)
- **Fix:** `screenKind` 가 `main.mf-game` 도 day 로 센다(한 줄).
- **Files modified:** src/debug/sheetDebug.ts
- **Commit:** 8f8c983

## Authentication Gates

없음.

## Known Stubs

없음. 의도적으로 비워 둔 것(뒤 계획이 채움)은 Known limitations 에 적었다.

## Known limitations

- GamePanel 은 낮 토론 행동 줄만 있다. 지목(이름표 `pick`·`tagProps`)은 08-14/15, 찬반 줄은 08-16, 유령 화면은 08-17, 밤·아침 임시 틀은 08-18 이 같은 틀 위에 얹는다. 그때까지 지목·변론·찬반·처형 단계의 GameMap 은 채팅 패널과 헤더만 보인다(서버 흐름이 이 화면으로 넘어오는 것은 이 계획 이후 웨이브).
- 맵 화면의 `onKick`은 아무것도 하지 않는다(게임 중엔 내보내기 없음). `fading`(처형 떠오름 연출)은 아직 장면 표에 넘기지 않는다(08-16).
- 낮 시작 결과 알림은 단계 진입 시각 기준 2초라 맵이 아주 늦게 열리면 가림막 뒤에서 끝날 수 있다(preload 로 줄임, 계획의 backstop).
- 알림은 방 화면이 쥐지만 밤·아침(DayScene)은 아직 `ResultAnnounce` 를 그리지 않는다. 밤의 '처형 없음' 알림 글자는 08-18 이 같은 `announce` 를 받아 그린다(채팅 줄은 지금도 남는다).
- 08-27 이 옛 화면 시험을 마저 정리할 때 위 표의 '지움' 항목은 이미 없다.
- 계획 A1·A2(작은 방 스테이지·8자 이름표 가장자리)는 계획대로 고치지 않았다. HANDOFF.md 는 갱신하지 않았다(6KB 제한, 페이즈 단위로 오케스트레이터가 정리).

## Verification

- `npx vitest run test/client/gameMap.test.tsx test/client/roomScreen.test.tsx` 통과(트레이서 게이트), `test/client/lobby.test.tsx test/client/keyboardLift.test.tsx test/client/stageBox.test.tsx test/client/gameMap.test.tsx` 통과, `test/client/gameMap.test.tsx test/client/roleCard.test.tsx test/client/roleCardFlow.test.tsx` 통과
- `npm run typecheck` — 오류 0, `npx vitest run --project client --project unit` — 130 파일 4050 통과(1 skipped 는 이전부터), `npx vite build` 통과
- 인수 기준 grep: 작업 1·2·3 의 `grep -q` 모두 성공, 신원 필드 grep rc 1, `new ResizeObserver` Lobby rc 1, innerHTML grep rc 1, `.skip(`/`.todo(` rc 1
- 레포 위생 grep: 이 계획이 건드린 파일에 결과 없음

## Self-Check: PASSED

- 파일: src/screens/GameMap.tsx, src/screens/GamePanel.tsx, src/styles/game.css, src/components/ResultAnnounce.tsx, src/net/useMapInsets.ts, src/net/useDayFx.ts, test/client/gameMap.test.tsx 모두 존재
- 커밋: 8f8c983, a4e05be, aa2ca0e, 2bfbed2, 07060e7 모두 HEAD 의 조상
