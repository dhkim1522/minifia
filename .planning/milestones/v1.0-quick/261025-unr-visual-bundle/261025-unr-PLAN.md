---
phase: quick-261025-unr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - shared/game/bots.ts
  - scripts/bots.mjs
  - scripts/uat-test-bots.mjs
  - test/unit/bots.test.ts
  - src/game/dayTable.ts
  - src/components/DayTable.tsx
  - src/styles/daytable.css
  - src/screens/DayScene.tsx
  - src/screens/Lobby.tsx
  - src/game/scenes.ts
  - src/components/Backdrop.tsx
  - src/components/SceneIntro.tsx
  - src/components/NightIntro.tsx
  - src/screens/Day.tsx
  - src/screens/RoomScreen.tsx
  - src/screens/Assigning.tsx
  - src/screens/RoleReveal.tsx
  - src/screens/Home.tsx
  - src/screens/JoinByLink.tsx
  - src/screens/ErrorScreen.tsx
  - src/App.tsx
  - src/net/assets.ts
  - src/net/phaseArrival.ts
  - src/styles/ds.css
  - src/styles/night.css
  - src/styles/phase.css
  - src/styles/day.css
  - public/backgrounds/bg_game_lobby.webp
  - public/backgrounds/bg_game_night.webp
  - public/backgrounds/bg_game_morning.webp
  - public/backgrounds/bg_game_day.webp
  - public/backgrounds/bg_game_dusk.webp
  - public/backgrounds/bg_game_verdict_dusk.webp
  - public/backgrounds/bg_entry_lobby.webp
  - public/_headers
  - scripts/make-backdrops.mjs
  - scripts/make-og.mjs
  - scripts/smoke.mjs
  - package.json
  - test/unit/dayTable.test.ts
  - test/unit/scenes.test.ts
  - test/unit/assets.test.ts
  - test/unit/backdropContrast.test.ts
  - test/client/dayTable.test.tsx
  - test/client/dayScene.test.tsx
  - test/client/nightScene.test.tsx
  - test/client/morning.test.tsx
  - test/client/lobby.test.tsx
  - test/client/phaseScreens.test.tsx
  - test/client/discussion.test.tsx
  - test/client/screens.test.tsx
  - test/client/roleCardFlow.test.tsx
  - test/client/testTools.test.tsx
  - test/client/roomScreen.test.tsx
  - test/client/backdrop.test.tsx
  - test/client/sceneIntro.test.tsx
  - test/client/nightIntro.test.tsx
  - test/client/phaseArrival.test.tsx
  - scripts/e2e/lib.mjs
  - scripts/e2e/lib.test.mjs
  - scripts/e2e/browser.mjs
  - scripts/e2e/flows.mjs
  - docs/decisions/0030-visual-bundle.md
  - docs/decisions/0024-test-room-bots.md
  - .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md
  - HANDOFF.md
autonomous: true
requirements: [QUICK-261025-unr]

estimate:
  tokens: 630000
  raw_tokens: 630000
  tasks: 6
  confidence: low

must_haves:
  truths:
    - "대기실·역할 배정·낮·밤·아침 어디에도 발밑 원(차례 링 앞뒤 호, 내 링, 마피아 동료 링, 밤 선택 링)과 이름표 반전이 없다. 말하는 차례 자리와 내가 밤에 고른 대상은 캐릭터 PNG 알파 윤곽을 따르는 흰 후광(filter drop-shadow 안쪽 2px + 바깥 9px, 토큰 gray-50), 마피아 동료와 관전자 화면의 모든 마피아는 진홍 후광(crimson-400, 마름모는 유지), 내 표시는 후광 없이 이름표 테두리뿐이다. 한 화면의 후광은 최대 3개(마피아 최대 2명 + 차례·선택 1개)이고 번짐은 9px 이하다. 이름표 1~11·캐릭터 12~22·어둡게 층 30·유령 31·이모티콘 60+ 와 E2E D3a·D3b·D9 가 그대로 통과한다 (V-01)"
    - "말하는 중(주장 차례, 낮 토론에서 빠른 메시지를 보낸 사람 3초)은 머리 위 '…' 말풍선(점 셋이 차례로 깜박임, 축소 모션에서는 정지)이다. 같은 자리에 이모티콘이 오면 그 2초는 말풍선이 없고 이모티콘만 보이며, 옛 말풍선 배지(.mf-dt__turn)는 없다. 말풍선(꼬리 포함)은 4~8명판 어디서도 이웃 얼굴과 0.5px 넘게 겹치지 않는다 (V-02)"
    - "방장 왕관은 대기실에서만 정확히 하나(role=img 이름 '방장') 보이고 역할 배정·낮·밤·아침에는 0개다 (V-03)"
    - "배경은 장면 목록 6개(lobby·night·morning·day·dusk·verdictDusk)와 단계→장면 규칙표(PHASE_SCENE)로 정해진다. 앱용 그림은 design/backgrounds/v2 원본에서 만든 WebP 7개(game 6 + entry lobby 1)이고 장면 하나 ≤ 48KB(set2)·≤ 24KB(set1)·entry ≤ 64KB, 합계 ≤ 260KB(실측 248KB)다. 옛 SVG 8개는 public 에 없다(원본은 design/ 에만). 아침·낮은 set1 + 헤더 위쪽 어두운 막, 나머지는 set2 이다. 첫 화면에 필요한 그림은 프리로드하고 해질녘·투표·처형(등록만) 은 처음 쓰일 때 불러온다 (V-04)"
    - "낮 시작 전용 Day 화면이 없다. 서버 단계 dayAnnounce 도 테이블 장면(DayScene) 위에서 그려지고 테이블·헤더·패널 위치가 claim 과 같다(E2E T1). 아침·낮·밤이 바뀌면 같은 장면 위에서 배경만 0.8초 크로스페이드되고, 밤 진입과 낮 시작 때 같은 컴포넌트(SceneIntro)로 'N일차 / 밤이 되었습니다'·'N일차 / 낮이 되었습니다' 가 2초 뜬다. 재접속·처음 마운트에는 크로스페이드도 문구도 없다. 해·달은 배경 이미지에 맡겨 이중으로 그리지 않는다. 서버 규칙·시간·와이어는 바뀌지 않는다 (V-05)"
    - "E2E 기준 수치(OVERLAP_EPS 0.5, ONE_LINE_FACTOR 1.6, FACE_RATIO 0.45, TAP_MIN 44, PANEL_H 157)와 TEXT_SIZE_ALLOW(.mf-journal__new·.mf-tt* 뿐), 승인된 완화 M1·D3a/D3b·D4 는 그대로다. 헤더 제목·타이머 글씨 대비를 배경별로 4.5:1 이상으로 재는 새 규칙 H1(글씨를 감춘 스냅숏의 요소 뒤 픽셀 p95 휘도 기준)이 있고, 모든 장면 그림은 같은 기준의 오프라인 단위 테스트로도 닫혀 있다 (V-06)"
    - "5글자 봇 이름 변경이 첫 커밋에 들어갔다. 로컬 npm run e2e 와 배포본 node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev 가 E2E OK, 배포본 smoke 4·5·8명(--stage full)과 봇 UAT 가 통과하고, 결정 0030·UI-SPEC·HANDOFF 가 갱신되어 개인 원격에 push 된다 (V-07~V-09)"
  artifacts:
    - path: "src/components/DayTable.tsx"
      provides: "후광 클래스(img.mf-figure--halo-white / --halo-crimson)와 말풍선 .mf-dt__bubble, 방장 왕관은 hostCrown prop 일 때만"
      contains: "mf-figure--halo-white"
    - path: "src/styles/daytable.css"
      provides: "filter drop-shadow 후광(흰·진홍·끊김 조합), 말풍선·점 깜박임·축소 모션 정지. 발밑 원 규칙 없음"
      contains: "drop-shadow"
    - path: "src/game/scenes.ts"
      provides: "장면 목록(SCENES)·단계→장면 규칙(PHASE_SCENE)·단계별 문구(PHASE_INTRO)·헤더 막 값(HEADER_SCRIM_STOPS)의 단일 출처"
      contains: "PHASE_SCENE"
    - path: "src/components/Backdrop.tsx"
      provides: "장면이 바뀌면 층을 쌓아 0.8초 크로스페이드, 처음 마운트·재접속은 즉시, 새 층은 이미지가 준비된 뒤 시작, 막은 층과 함께 전환"
      contains: "data-state"
    - path: "scripts/make-backdrops.mjs"
      provides: "design/backgrounds/v2 원본 → public/backgrounds WebP 변환(예산 초과면 실패)"
      contains: "webp"
    - path: "src/components/SceneIntro.tsx"
      provides: "밤·낮 시작 문구 한 부품(마운트 때 한 번 거는 2초 타이머, 터치 통과, aria-hidden)"
      contains: "mf-sceneintro"
    - path: "src/net/phaseArrival.ts"
      provides: "같은 접속(epoch)에서 직전 단계를 알려 주는 훅 — 역할 확인에서 낮 시작으로 DayScene 이 새로 마운트될 때 문구·크로스페이드의 근거"
      contains: "usePhaseArrival"
    - path: "scripts/e2e/lib.mjs"
      provides: "K1·K4 개정, W1 왕관, N6~N9 장면 문구, B1 배경 장면, H1 헤더 대비(HEADER_CONTRAST_MIN 4.5)"
      contains: "headerContrastChecks"
    - path: "test/unit/backdropContrast.test.ts"
      provides: "WebP 장면 6장 × 폰 3 폭 × 헤더 글씨 구역의 p95 대비 ≥ 4.5 (막 값 포함) 오프라인 증명"
      contains: "HEADER_SCRIM_STOPS"
    - path: "docs/decisions/0030-visual-bundle.md"
      provides: "후광·말풍선·왕관·배경 장면·전환 연출·해·달 선택·헤더 막 값 변경·E2E 규칙·봇 이름 결정 기록"
      contains: "0029"
  key_links:
    - from: "src/components/DayTable.tsx"
      to: "src/styles/daytable.css"
      via: "Figure className 의 mf-figure--halo-white/-crimson 규칙. 후광은 자리 안 img 하나의 filter 라 자리의 쌓임 맥락(z 12~22)을 벗어나지 않는다. 바깥 층 규칙은 그대로"
      pattern: "mf-figure--halo-(white|crimson)"
    - from: "src/screens/DayScene.tsx"
      to: "src/game/scenes.ts"
      via: "sceneOfPhase(view.phase) 로 배경 장면을, PHASE_INTRO[view.phase] 로 문구를 정한다. 화면에 단계별 분기를 따로 두지 않는다"
      pattern: "sceneOfPhase|PHASE_INTRO"
    - from: "src/components/Backdrop.tsx"
      to: "src/net/assets.ts"
      via: "backdropUrl — 장면 id → /backgrounds/bg_{game|entry}_{파일}.webp 한 곳. 프리로드 목록(entry·role)도 같은 함수"
      pattern: "backdropUrl"
    - from: "src/screens/RoomScreen.tsx"
      to: "src/screens/DayScene.tsx"
      via: "usePhaseArrival 이 준 arrivedFrom 으로 DayScene 이 역할 확인 직후 새로 마운트돼도 낮 시작 문구·크로스페이드를 한 번 건다(재접속이면 null)"
      pattern: "arrivedFrom"
    - from: "src/game/scenes.ts"
      to: "src/components/Backdrop.tsx"
      via: "HEADER_SCRIM_STOPS(test/unit/backdropContrast.test.ts 도 같은 상수를 쓴다) — 같은 상수를 인라인 변수로 층에 싣고, 같은 상수로 오프라인 대비를 잰다"
      pattern: "HEADER_SCRIM_STOPS"
    - from: "scripts/e2e/browser.mjs"
      to: "scripts/e2e/lib.mjs"
      via: "readHeaderContrast 결과를 headerContrastChecks 가 판정 — 글씨를 투명하게 한 스냅숏의 요소 뒤 픽셀 p95 휘도와 계산된 글자색으로 H1 이 판정"
      pattern: "readHeaderContrast"
---

<objective>
시각 개선 묶음(17·18차 시안 승인본, quick 261025-unr)을 한 계획으로 구현한다. 시안은 새로 만들지 않는다. 기준은 `design/screens/visual-v1/SPEC.md`(승인 결정 5개)와 시안 Z1~Z6·Y1~Y5·`f12.css`, `design/backgrounds/v2/README.md`(장면별 사용 표), `docs/decisions/0029-background-set-v2.md`, 직전 결정 0028 과 `03.1-UI-SPEC.md`(z-index·기하·E2E 표) 이다.

| 출처 | 항목 | 담당 |
|------|------|------|
| 사용자 지시 V-01 | (1) 발밑 원 전부와 이름표 반전 제거, 캐릭터 윤곽 후광(흰 = 말하는 차례 + 밤에 고른 대상, 진홍 = 마피아 동료, 내 표시는 이름표 테두리뿐), 층·번짐·성능 산술 검증 | 과제 1 (E2E K1·K4 는 과제 2) |
| 사용자 지시 V-02 | (2) 머리 위 '…' 말풍선, 이모티콘이 오면 그 2초는 이모티콘이 대신, 옛 배지 대체 | 과제 1 |
| 사용자 지시 V-03 | (3) 방장 왕관은 대기실만 | 과제 1 (E2E W1 은 과제 2) |
| 사용자 지시 V-04 | (4) 배경 장면 목록·전환 규칙, WebP 변환, 용량 예산, 프리로드·지연 로딩, 캐시, 헤더 막, 옛 SVG 정리 | 과제 3 (E2E B1 은 과제 5, smoke 검사는 과제 3·6) |
| 사용자 지시 V-05 | (5) Day 화면 제거, 테이블 장면 위 배경 크로스페이드 0.8초, 밤·낮 문구 한 컴포넌트, 해·달 처리 선택, 재접속·처음 마운트 제외 | 과제 4 (E2E N8·N9·T1 은 과제 5) |
| 사용자 지시 V-06 | (6) E2E 규칙을 새 표시에 맞게 고치되 임계값·승인 완화 불변, 헤더 글씨 대비 새 규칙 | 과제 2·5 |
| 사용자 지시 V-07 | 5글자 봇 이름(작업 트리에 이미 수정됨)을 첫 커밋에 포함 | 과제 1 가 |
| 사용자 지시 V-08 | 결정 0030, UI-SPEC·HANDOFF 갱신(실기기 확인 목록에 후광 모양·말풍선·배경 전환 속도·아침·낮↔밤·해질녘 색 차이·이름표 5자 경계) | 과제 6 |
| 사용자 지시 V-09 | 전체 검증, 개인 계정 배포, 배포본 smoke 4·5·8명·봇 UAT·E2E, push | 과제 6 |

범위 밖(건드리지 않는다): `shared/game/` 서버 규칙·와이어·단계 길이(봇 이름 상수 하나만 첫 커밋에서 예외), `worker/`, 서버 좌석 번호, 낮 차례 순서, 승인 시안 사본(`design/screens/`, `design/backgrounds/v2/`). 4페이즈의 투표·처형·해질녘 연출은 이번에 만들지 않는다 — 장면 목록에 등록하고 전환 규칙표가 끼울 자리를 갖게만 한다.

참고 자료(`gsd-addons:design-refs` 규칙):

| 경로 | 가져온 요소 |
|------|-------------|
| `design/screens/visual-v1/SPEC.md` | 승인 결정 5개(후광·말풍선·왕관·배경 전환·배경 에셋). 숫자는 구현 계획이 정한다는 문장 |
| `design/screens/visual-v1/f12.css` | 후광 = 그림에 filter drop-shadow 두 겹(흰: 2px .95 + 9px .75, 진홍 rgb(224,52,75): 2px .95 + 9px .7), 말풍선 높이 26·좌우 11·점 6px 간격 4·꼬리 5·점 불투명도 1/.6/.3, 해·달 층 z 2·문구 층 z 90 |
| `design/screens/visual-v1/Z4-speak5.dc.html`, `Z5-speak8.dc.html`, `Z6-night-mafia.dc.html` | 후광은 `<img>` 에 붙는다(이름표·마름모는 후광 없음), 밤 마피아 = 동료 진홍 후광 + 마름모, 고른 대상 흰 후광 |
| `design/screens/visual-v1/Z1-morning`, `Z2-day`, `Z3-night.dc.html` | 전환 직후 장면: 문구 가운데(top 250), `N일차` 14px, 제목 36px 700, text-shadow `0 2px 12px .55`. 시안의 해 원은 옛 배경(해 없음) 위에 얹은 장식이었다 |
| `design/screens/visual-v1/Y3-am-scrim`, `Y5-pm-scrim.dc.html` | 헤더 위쪽 어두운 막: night-900(14,19,38) 위 66% → 0, 150px(0px .66 · 60px .42 · 110px .18 · 150px 0) |
| `design/backgrounds/v2/README.md` | 장면별 사용 표(구도 game·entry), 헤더 대비 표, 아침·낮(set1)과 밤·해질녘(set2) 하늘 색 차이 주의 |
| `design/backgrounds/v2/set1`, `set2` | 이미지 직접 열어 해·달 위치와 밝기를 확인했다(아래 측정 표) |

참고 자료와 다르게 하는 곳과 이유: (1) 말풍선 위치 시안 `top: -30px` → `-26px`: 8명판 앞쪽 옆자리의 말풍선이 이웃 얼굴을 4.1px 덮는다(아래 산술). (2) 헤더 막 알파 시안 `.66/.42/.18/0` → `.70/.58/.40/0`(길이 150px 은 그대로): 사용자 규칙 4.5:1 에 시안 값은 타이머 구역이 3.5~4.1:1 로 못 미친다(아래 표) — 확인 필요 2. (3) 후광 색은 시안의 rgba 대신 같은 값의 토큰 `color-mix`(gray-50 = rgb(241,242,245), crimson-400 = rgb(224,52,75)). (4) 해·달은 시안처럼 따로 그리지 않고 이미지에 맡긴다(아래 해·달 결정). 열지 못한 참고 자료: 시안 html 이 링크하는 `f3~f11.css`·`v2.css`·`support.js` 는 사본 폴더에 없다(그림은 `/_blob/…`). 이름표 내 표시 테두리(`.tg--me`) 시안 값은 확인할 수 없어 앱의 기존 값(gray-100 테두리)을 유지한다.

Tracer 생략 사유: 후광·말풍선·왕관, 배경 장면과 WebP, 전환 연출, E2E 규칙은 서로 다른 계층에서 각각 화면 → 단위 테스트 → E2E 규칙을 RED→GREEN 으로 끝까지 닫는다. 한 줄기로 모든 계층을 관통하는 얇은 슬라이스를 따로 둘 새 계층이 없고, 첫 과제(후광·말풍선·왕관)가 이미 그림 → 부품 → 화면 → E2E 스냅숏을 한 줄로 관통한다.

Output: 위 항목의 코드·테스트·E2E 규칙, WebP 변환 스크립트와 7개 그림, `docs/decisions/0030-visual-bundle.md`, 갱신된 UI-SPEC·HANDOFF, 배포 및 push.
</objective>

<execution_context>
@~/.claude-personal/gsd-core/workflows/execute-plan.md
@~/.claude-personal/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@design/screens/visual-v1/SPEC.md
@design/backgrounds/v2/README.md
@docs/decisions/0028-test-feedback-fixes.md
@docs/decisions/0029-background-set-v2.md
@docs/decisions/0027-sequential-claims-wire.md
@.planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md
@.planning/quick/261025-qvx-test-feedback-fixes/261025-qvx-SUMMARY.md
@HANDOFF.md

정리된 사실(계획 작성 시점 HEAD = 97ce655, 이 계획의 불변 검사 기준 커밋. 작업 트리에는 봇 이름 변경 4파일이 커밋 전 상태로 있고 추적 안 된 `.planning/milestone.lock` 이 있다 — 후자는 어떤 커밋에도 넣지 않는다):

- **지금 구조.** 발밑 원은 네 가지다: 차례 링 묶음 `.mf-dt__spot`(뒤쪽·앞쪽 호), 내 링 `.mf-dt__ring--me`, 동료 링 `.mf-dt__ring--mate`, 밤 선택 링 `.mf-dt__sel`. 이름표 반전은 `.mf-dt__tag--turn`(주장 차례)과 `.mf-dt__tag--spoke`(낮 토론 빠른 메시지를 보낸 사람 3초, `useSeatFloats` 의 SPOKE_MS). 머리 위 배지 `.mf-dt__turn`(28px 말풍선 아이콘). 왕관 `.mf-dt__crown` 은 `DayTableSeat.isHost` 가 참이면 어느 화면에서나 그려진다. 이 요소들은 모두 `src/components/DayTable.tsx` 한 곳과 `src/styles/daytable.css` 에 있고 `DayScene`·`Lobby`·`Assigning` 이 같은 부품을 쓴다.
- **배경.** `src/components/Backdrop.tsx` 는 `layout("entry"|"game")` 과 `variant("lobby"|"night"|"day"|"verdict")` 로 `src/net/assets.ts` 의 `backdropUrl` 이 `/backgrounds/bg_{layout}_{variant}.svg` 를 준다. 한 `<div>` 의 `background-image` 만 바꾸고 CSS 가 `transition: background-image` 를 건다. `public/backgrounds/` 에는 SVG 8개(합 약 356KB)가 있고 `design/backgrounds/A_cute/` 에 같은 파일이 있다(`cmp` 로 확인: 8개 모두 동일). `scripts/make-og.mjs` 가 `public/backgrounds/bg_entry_lobby.svg` 를 읽는다. `public/_headers` 는 `/backgrounds/*` 에 `Cache-Control: public, max-age=86400`. `scripts/smoke.mjs` 의 에셋 검사는 `/characters/table/…` 한 개(image/png + max-age=86400)와 `/og.png` 뿐이다. 정적 에셋 서빙은 `single-page-application` 이라 없는 경로도 index.html 을 200 으로 준다 — 새 검사는 content-type 으로 구분한다.
- **화면 흐름.** 서버 단계는 `lobby → assigning → roleReveal → dayAnnounce(2초) → claim → discussion → night → morning → dayAnnounce …`. `RoomScreen` 의 `sceneKey` 가 claim·discussion·night·morning 을 `dayScene` 한 키로 묶어 `DayScene` 이 다시 마운트되지 않는다. `dayAnnounce` 만 별도 화면 `src/screens/Day.tsx`(테이블·타이머 없음, 방사형 빛 + `N일차` + `낮이 되었습니다` + 보조줄 `토론 전에 먼저 직업을 공개해요`)다. 밤 시작 문구는 `src/components/NightIntro.tsx`(결정 0028, 클라이언트 2초 타이머, 같은 epoch 의 비밤 → 밤에서만)다. `DayScene` 은 렌더 중 상태 조정으로 `prevPhase`·`prevEpoch` 를 쥔다. 헤더 `PhaseBar` 는 타이머가 있어야 높이가 119.2(= 16 + 50.4 + 8 + 28.8 + 16)이다.
- **서버·E2E 시간.** `dayAnnounce` 2초는 `DAY_ANNOUNCE_MS`. E2E 의 `skipTo(page, tracker, phase)` 는 테스트 시트의 「다음 단계로 넘기기」 로 단계를 빠르게 넘긴다.
- **봇 이름.** 작업 트리의 변경은 봇 이름 7개를 모두 5글자로 바꾼다(`shared/game/bots.ts` BOT_NAMES, `scripts/bots.mjs`, `scripts/uat-test-bots.mjs`, `test/unit/bots.test.ts` 한 테스트 이름). E2E 의 방장 닉네임(`화면검사기`)도 5글자라 8명판은 5글자 이름표 8개가 된다 — 99px 이름표 칼날 경계(결정 0028, 폰 가장자리 −0.5)를 처음으로 실제 시험한다. `docs/decisions/0024-test-room-bots.md` 와 `HANDOFF.md` 에 옛 봇 이름이 적혀 있다(과제 6 에서 고친다).

**후광·말풍선 산술(계획 시점 계산, 기하는 결정 0028 값: 390폭 장면 366·rx 146·cy 210·ry 100·캐릭터 72×96·k0 0.8).**

| 항목 | 값 |
|------|----|
| 후광 CSS | `filter: drop-shadow(0 0 2px 색 95%) drop-shadow(0 0 9px 색 75%)` (진홍은 95%·70%). 색은 `color-mix(in srgb, var(--gray-50) N%, transparent)` / `var(--crimson-400)` |
| 번짐 | 가우시안 σ = 반지름/2 → 바깥 층 σ 4.5. 윤곽 바깥 알파: 4px 에서 0.14, 9px 에서 0.017(이하 보이지 않음) → **보이는 번짐 9px(배율 0.8~1 적용 7.2~9px)**. 안쪽 층 σ 1 은 2px 안에서 끝 |
| 이름표 위로 겹침 | 후광은 자리 층(12~22)이라 자기·이웃 이름표(1~11) 위에 그려질 수 있다. 윤곽에서 4px 이상 떨어진 이름표 글자는 알파 ≤ 0.15 → gray-50 글자 / night-900 86% 면 위 대비 ≥ 11:1 (≥ 9:1 로 기준을 잡는다) |
| 장면 안 | 번짐 9px 을 더한 캐릭터 상자는 네 폰(360·375·390·430) × 1~8명 모두 폰 가장자리 안(최소 여유 390폭 4.6 − 9 + 여백 12 = 7.6, 360폭 12.6 − 9 + 4 = 7.6). 위쪽: 장면 높이 ≥ 332(cy 210)에서는 맨 뒤 캐릭터 위가 33.2 라 번짐을 더해도 장면 안(24.2), 가장 낮은 cy 177(장면 높이 299.8)에서도 장면 위로 최대 8.8px → 헤더 아래 안쪽 여백 16px 안(타이머 줄 아래 끝 103.2 와 7.2px 이상) |
| 성능 | 필터는 72×96 CSS px 그림 한 장에 두 겹 — 한 화면 최대 3개(마피아 ≤ 2명: 로스터 표 6~8명판 마피아 2, 관전자는 모든 마피아 2 + 차례 1; 마피아 보는 밤은 동료 1 + 내 선택 1). 필터 값은 애니메이션하지 않고 `transition: filter var(--dur-fast)` 만 둔다(축소 모션 전역 규칙이 끈다) |
| 말풍선 | 폭 = 좌우 11×2 + 점 6×3 + 간격 4×2 = 48, 높이 26, 꼬리 5, 자리 상자 위 `top: -26px`(배율 적용), 가운데. 4~8명판 × 네 장면 폭 (352·367·366·406): 이웃 **얼굴(상자 위 45%)** 과 겹침 0, 자기보다 z 가 높은 이웃 상자에 가려지는 경우 0, 말풍선 x 범위 15.4~350.6(장면 366 안), 장면 높이 ≥ 332 에서 맨 위 12.4. 시안 −30 이면 8명판 자리 1·7 이 이웃 얼굴을 4.1px(폭 12.9~17.3) 덮는다. 이웃 **상자 전체**와는 겹쳐도 되고(뒤쪽 이웃 몸통 위에 놓임) 그림 알파 영역만 보이므로 D3b 에 영향 없음 |
| 이모티콘 | 이모티콘은 `y − 96·배율 − 36`(32px)이라 말풍선 자리 바로 위·겹침. 같은 자리에 이모티콘이 있으면 말풍선을 그리지 않는다 |

**배경 측정(계획 시점, `sharp` 로 원본을 읽은 값).**

| 장면 | 원본 | 크기 | 해·달(1080 폭 좌표) | WebP 실측(q90, effort 6) | 막 |
|------|------|------|----------------------|--------------------------|----|
| lobby | set2/bg_game_lobby.png | 1080×2340 | 우상단에 큰 달(헤더 타이머 구역과 겹침) | 43.1KB | 없음 |
| night | set2/bg_game_night.png | 1080×2340 | 달(구름 뒤 빛무리) 약 (854, 211) | 39.2KB | 없음 |
| dusk | set2/bg_game_dusk.png | 1080×2340 | 해·달 없음 | 36.3KB | 없음 |
| verdictDusk | set2/bg_game_verdict_dusk.png | 1080×2340 | 해·달 없음 | 39.3KB | 없음 |
| morning | set1/bg_game_morning.jpg | **540×1170**(README 의 1080×2340 과 다름, 업스케일하지 않는다) | 흰 원 중심 (841, 198) 반지름 65 | 15.8KB | 있음 |
| day | set1/bg_game_day.jpg | **540×1170** | 노란 해 중심 (755, 255) 반지름 65 + 빛무리(아침보다 왼쪽·아래) | 18.7KB | 있음 |
| entry lobby | set2/bg_entry_lobby.png | 1080×2340 | 큰 달 | 55.7KB | 없음 |

합계 248KB(옛 SVG 합 356KB). 화질 확인: q75 는 어두운 면의 시계탑 윤곽이 뭉개지고 q90 은 원본과 거의 같다(나머지 근사 방식은 240~340KB 로 PNG 와 비슷해 의미 없음). 원본 PNG 7장은 합 약 2.7MB 다.

**해·달 결정(사용자 요청: 이중으로 보이지 않게 처리 방법을 정하고 장단·이유를 적는다, 최소 위험안).** 모든 장면 그림에 해·달이 이미 그려져 있고 위치가 장면마다 다르다(위 표: 아침 해 (841,198) → 낮 해 (755,255), 밤 달 (854,211)). 이미지에서 해·달만 떼어낼 수 없고 원본을 고쳐 그리는 것은 허용되지 않는다(원본 불변, 변환만).

| 안 | 장점 | 단점 |
|----|------|------|
| A. 측정 좌표에 움직이는 SVG 해·달을 겹침 | 해가 실제로 떠오름 | 이미지의 해·달이 그대로 남아 전환 중 **해 두 개**가 보이거나, 가리려면 하늘색 패치를 덧대야 해 장면마다·폰 비율마다(cover 확대) 어긋남. 폰 폭 3종 × 장면 4개 좌표 계산과 시각 확인이 필요 |
| B. 배경만 크로스페이드, 해·달은 이미지에 맡김 (**채택**) | 이중 표시가 구조상 불가능, 위험·코드량 최소, 테스트가 결정적 | 해가 '떠오르는' 연속 이동은 없다. 이미지 사이 위치·밝기 변화(아침 우상단 → 낮 더 왼쪽·아래 + 쨍한 빛무리, 밤에 달)와 문구로만 보인다. 낮 해가 아침보다 낮은 위치에 그려져 있다 |
| C. B + 이동 없이 빛무리만 겹침 | 쨍한 느낌을 더할 수 있음 | cover 확대 때문에 폰마다 이미지 해와 빛이 어긋남 |

선택 이유: B 가 최소 위험이고 사용자가 직접 허용한 안이다. 해 이동 연출이 꼭 필요하면 데스크톱에서 해·달을 뺀 하늘 + 해·달 PNG 를 따로 받아 A 로 간다(후속). → 확인 필요 1.

**헤더 글씨 대비(계획 시점 계산).** 390폭에서 `cover`·위쪽 기준으로 그린 WebP 의 헤더 구역(제목 x16~120·y16~45, 타이머 숫자 오른쪽 53px·y78~100, 대기실 코드 가운데)의 휘도 95번째 백분위수(p95)와 gray-50(#f1f2f5) 글자의 WCAG 대비. (p90 은 README 표와 거의 같은 숫자를 낸다: 막 없는 아침 2.9/2.6.)

| 장면 | 제목 | 타이머 숫자 | 비고 |
|------|------|-------------|------|
| night | 16.8 | 13.4 | |
| dusk | 14.0 | 12.0 | |
| verdictDusk | 14.0 | 12.0 | 대기실식 가운데 코드는 해당 없음 |
| lobby | 15.8(역할 배정 제목), 코드 10.7 | 2.0 → 역할 확인(타이머 있음)은 `--scrim` 60% 막 아래라 7.4 | 대기실·배정에는 타이머가 없다 |
| morning + 시안 막 (.66/.42/.18/0) | 7.1 | **3.9** | 4.5 미달 |
| day + 시안 막 | 6.9 | **3.5** | 4.5 미달 |
| morning + 후보 막 (.70/.58/.40/0) | 9.0 | 5.8 | 360·430 폭도 5.2~6.1 |
| day + 후보 막 | 8.7 | 5.4 | 360·430 폭도 5.2~5.9 |
| 안내 줄(gray-300) morning/day + 막 | 약 3.1 / 2.8 | - | 사용자 지정 대상 아님 → 확인 필요 5 |

기본값은 후보 막 `HEADER_SCRIM_STOPS = [[0, .70], [60, .58], [110, .40], [150, 0]]` 이다(색 night-900, 150px 길이는 시안 그대로). 단위 테스트와 E2E H1 이 같은 4.5 를 재고, 실제 측정이 다르면 숫자를 이 상수 한 곳에서만 바꾼다.

**E2E 틀.** 로컬은 `npm run dev`(5173) 를 띄우고 `npm run e2e -- --url http://localhost:5173 [--only 흐름]`. 배포본 주소는 `scripts/prod-url.txt`(https://minifia.dhplay.workers.dev). 결정 번호 다음 값은 0030. `sharp 0.35.5` 는 이미 devDependency 이고 `scripts/make-og.mjs` 가 쓰고 있다 — 새 패키지를 설치하지 않는다(로드되지 않으면 STOP).

</context>

<!-- planner-discipline-allow: mf-dt__spot -->
<!-- planner-discipline-allow: mf-dt__ring -->
<!-- planner-discipline-allow: mf-dt__sel -->
<!-- planner-discipline-allow: mf-dt__turn -->
<!-- planner-discipline-allow: tag--turn -->
<!-- planner-discipline-allow: tag--spoke -->
<!-- planner-discipline-allow: mf-day__ -->
<!-- planner-discipline-allow: mf-nightintro -->
<!-- planner-discipline-allow: NightIntro -->
<!-- planner-discipline-allow: .svg -->
<tasks>

<task type="auto" tdd="true">
  <name>과제 1: 봇 이름 커밋 + 발밑 원·이름표 반전 제거와 후광 + '…' 말풍선 + 방장 왕관은 대기실만 — RED → GREEN (V-01·V-02·V-03·V-07)</name>
  <files>shared/game/bots.ts, scripts/bots.mjs, scripts/uat-test-bots.mjs, test/unit/bots.test.ts (넷은 이미 수정됨 — 첫 커밋), test/unit/dayTable.test.ts, test/client/dayTable.test.tsx, test/client/dayScene.test.tsx, test/client/nightScene.test.tsx, test/client/morning.test.tsx, test/client/lobby.test.tsx, test/client/phaseScreens.test.tsx, test/client/discussion.test.tsx, src/game/dayTable.ts, src/components/DayTable.tsx, src/styles/daytable.css, src/screens/DayScene.tsx, src/screens/Lobby.tsx</files>
  <read_first>design/screens/visual-v1/SPEC.md, design/screens/visual-v1/f12.css, design/screens/visual-v1/Z4-speak5.dc.html, design/screens/visual-v1/Z6-night-mafia.dc.html, src/components/DayTable.tsx, src/styles/daytable.css, src/game/dayTable.ts, src/components/Figure.tsx, src/styles/ds.css (.mf-figure--disconnected), src/screens/DayScene.tsx (seats 입력 만드는 곳), src/screens/Lobby.tsx, src/net/seatFloats.ts (SPOKE_MS·EMOJI_MS), test/client/dayTable.test.tsx (왕관·링·동료·보낸 사람 / 밤 선택 / 지금 주장하는 차례 / daytable.css 규약 describe), test/unit/dayTable.test.ts, .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md (이름표 층 순서·말풍선 배지의 겹침)</read_first>
  <behavior>
    - 후광: 차례 자리(turn)와 내가 밤에 고른 자리(pick.mine)는 그림 img.mf-figure 에 클래스 mf-figure--halo-white, 동료 자리(isAlly — 마피아 화면의 동료, 관전자 화면의 모든 마피아)는 mf-figure--halo-crimson 이고 마름모 .mf-dt__mark 는 그대로다. 한 자리가 둘 다면 흰 후광이 이긴다. 내 자리라는 이유(isMe)만으로는 후광 클래스가 없고(내 차례·내 선택이면 흰 후광은 붙는다) 내 표시는 내 이름표의 .mf-dt__tag--me 테두리뿐이다. 후광 클래스는 그림 img 에만 붙는다(자리·이름표·말풍선·마름모에는 안 붙는다)
    - 발밑 원이 없다: 차례 링 묶음·내 링·동료 링·밤 선택 링 요소가 DOM 에도 daytable.css 에도 없고, 이름표 반전 클래스(차례·빠른 메시지 두 가지)도 없다. 머리 위 배지(.mf-dt__turn)도 없다. 표적 배지(PickBadge)와 aria-pressed 는 그대로
    - 말풍선: turn 인 자리는 span.mf-dt__bubble.mf-dt__bubble--turn, spoke 인 자리는 .mf-dt__bubble--spoke 가 자리 상자 안에 하나 있고(aria-hidden, 자식 i 셋), 같은 자리에 emoji 가 있으면 말풍선이 없다(이모티콘이 대신). 이모티콘이 사라지면 말풍선이 다시 나온다. 자리 읽기 이름의 「지금 주장하는 차례」 는 그대로
    - 왕관: DayTable prop hostCrown 이 참일 때만 isHost 자리에 .mf-dt__crown(role=img, 이름 방장). 낮·밤·아침·역할 배정(기본값) 0개, 대기실(Lobby) 정확히 1개
    - CSS: --mf-halo-white = drop-shadow(0 0 2px gray-50 95%) drop-shadow(0 0 9px gray-50 75%), --mf-halo-crimson = 같은 모양 crimson-400 95%·70%. 끊김(.mf-figure--disconnected)과 함께면 grayscale(1) 뒤에 후광이 붙는다. 말풍선: 높이 26·좌우 11·모서리 13·gray-50 면·위 -26px·가운데·꼬리 5px, 점 6px 은 night-900 이고 1200ms 순환·0/200/400ms 지연으로 차례대로 깜박이며, 축소 모션에서는 animation: none 과 정지 불투명도 1/.6/.3. 코드 줄에 # 색 값 없음
    - 산술(단위 테스트가 계산): 네 폰 × 1~8명 후광 번짐(9px × 배율)을 더한 캐릭터 상자가 폰 안이고, 장면 높이 299.8 이상에서 장면 위 16px 안(헤더 아래 안쪽 여백)이다. 흰 후광 알파는 윤곽에서 4px 에 ≤ 0.15, 9px 에 ≤ 0.02 이고 그 알파를 이름표 면·글자 위에 겹쳐도 대비 ≥ 9:1. 말풍선(꼬리 포함)은 4~8명 × 네 장면 폭에서 이웃 얼굴과 겹침 ≤ 0.5, 자기보다 z 높은 이웃에게 가려지지 않음, 장면 안(x), 장면 높이 ≥ 332 에서 장면 위로 안 나감
    - 층: 후광·말풍선이 있어도 자리 인라인 z-index 는 12~22(탈락 강조 31), 이름표 최댓값 < 자리 최솟값(4~8명). 마피아 밤(동료 + 내 선택)·관전자 낮(마피아 전부 + 차례)에서 후광 img 는 3개 이하
  </behavior>
  <action>
    진행 순서는 가(첫 커밋) → 나(RED) → 다(GREEN)다. 사용자 지시 V-07: 5글자 봇 이름은 작업 트리에 이미 수정되어 있고 첫 커밋에 포함한다.

    가. 봇 이름 커밋. `git status --short` 로 수정된 네 파일과 추적 안 된 `.planning/milestone.lock` 만 있는지 확인한다(그 밖의 변경이 있으면 이 과제의 것이 아니니 멈추고 보고). 네 파일의 diff 가 봇 이름 7개를 모두 정확히 5글자로 바꾼 것(서로 다름, 세 군데 목록이 같음)임을 확인하고 `npx vitest run test/unit/bots.test.ts test/worker/bots.test.ts` 가 통과하면 `feat(unr): 봇 이름을 닉네임 최대 길이(5자)로 채운다 (결정 0028 칼날 경계)` 로 커밋한다. `.planning/milestone.lock` 은 `git add` 하지 않는다. 이 커밋이 이 계획에서 `shared/` 를 건드리는 유일한 곳이다(이름 목록 상수).

    나. RED — 테스트만 먼저 고쳐 실패를 확인한 뒤 `test(unr): 후광·말풍선·왕관 기준` 으로 커밋한다.
    - `test/unit/dayTable.test.ts`: 새 상수(`HALO_CORE_BLUR_PX` 2, `HALO_BLUR_PX` 9, `HALO_MAX_SIMULTANEOUS` 3, `BUBBLE_W` 48, `BUBBLE_H` 26, `BUBBLE_TAIL` 5, `BUBBLE_TOP` 26)를 단언한다. 후광 번짐 산술 테스트 — 장면 (352, 여백 4)·(367, 4)·(366, 12)·(406, 12) × 인원 1~8, 캐릭터 상자(72 × 배율)를 9 × 배율 만큼 넓힌 상자의 왼쪽 ≥ −여백, 오른쪽 ≤ 장면 폭 + 여백, 장면 높이 387.8 에서 위쪽 ≥ 0, 장면 높이 299.8(cy 177)에서도 위쪽 ≥ −16. 후광 알파 도우미는 테스트 안에 둔다(σ = 반지름/2, 흰 외곽층 계수 .75, 알파(d) = 계수 × 0.5 × erfc(d/(σ√2)))고 4px 에서 ≤ 0.15, 9px 에서 ≤ 0.02, 그 알파로 night-900 86% 이름표 면과 gray-50 글자를 흰색(gray-50 값, 토큰 hex 는 src/styles/tokens.css 에서 읽는다)과 섞은 WCAG 대비 ≥ 9. 말풍선 기하 테스트 — 위 context 표의 규칙(폭 48, 높이 26, 꼬리 5, 위 26, 배율 적용, 가운데)으로 4~8명 × 네 장면 폭에서 (i) 이웃 얼굴 영역(상자 위 45%)과 겹침 ≤ 0.5, (ii) 말풍선이 자기보다 z 가 높은 이웃 상자에 가려지지 않음, (iii) 말풍선 x 범위가 장면 안, (iv) 장면 높이 387.8 에서 말풍선 맨 위 ≥ 0. 같은 테스트 주석에 「시안 위 −30 은 8명판 자리 1·7 이 이웃 얼굴을 4.1px 덮어 −26 으로 정했다」 한 줄을 남긴다.
    - `test/client/dayTable.test.tsx`: 옛 발밑 원·배지·반전·왕관을 가정한 단언을 새 계약으로 옮긴다(지우지 않고 같은 의미를 보증하게). 「왕관·링·동료·끊김·보낸 사람」 describe: 왕관은 `hostCrown` 이 있을 때만 하나, 없으면 0개(기본), 내 자리는 차례·선택이 아니면 후광 없음 + 이름표 `--me` 만(내 차례면 흰 후광), 동료는 `halo-crimson` + 마름모 aria-label 동료 유지, 동료이면서 나이면 후광 클래스가 crimson, 끊긴 자리는 `mf-figure--disconnected` 와 후광이 함께 있어도 둘 다 유지, spoke 자리는 `.mf-dt__bubble--spoke` 하나(이름표에 반전 클래스 없음). 「밤 대상 선택」: 내 선택 자리의 img 에 `halo-white` + PickBadge, 동료 선택은 배지만(후광 없음). 「지금 주장하는 차례」: turn 자리 img `halo-white` 정확히 하나·`.mf-dt__bubble--turn` 정확히 하나·그 자리 안·이름표 반전 없음, 차례가 없으면 0개, 두 자리에 turn 을 주어도 입력 그대로 둘 다, 같은 자리의 emoji 가 있으면 말풍선이 없고 emoji 가 없어지면 다시 있음, 후광 우선순위(흰 > 진홍). 발밑 원 클래스와 이름표 반전 클래스와 `.mf-dt__turn` 이 container 어디에도 없다. 층: 후광·말풍선 자리의 인라인 z 12~22/31, 4~8명 이름표 z 최댓값 < 자리 z 최솟값(기존 단언 유지). 동시 후광: 마피아 밤 장면(동료 1 + 내 선택 1)과 관전자(마피아 2 + 차례 1)를 DayTable 에 입력해 후광 img 3개 이하(HALO_MAX_SIMULTANEOUS). CSS 규약(daytable.css 를 `readFileSync` 로 읽는다 — vitest 가 CSS import 를 비운다): 옛 링·내 링·동료 링·선택 링·차례 배지·이름표 반전 규칙이 없고, `--mf-halo-white`·`--mf-halo-crimson` 정의가 위 값, `.mf-figure--halo-white` / `--halo-crimson` 이 `filter: var(--mf-halo-…)`, 끊김 조합 규칙이 `grayscale(1)` 다음에 후광, `.mf-dt__seat .mf-figure` 에 `transition: filter var(--dur-fast) var(--ease-out)`, 말풍선 위 -26px·높이 26·점 6px·키프레임·지연 0/200/400ms, 축소 모션 블록의 `animation: none` 과 정지 불투명도, 코드 줄에 `#` 색 값 없음.
    - 다른 client 테스트: `test/client/dayScene.test.tsx`·`nightScene.test.tsx`·`morning.test.tsx`·`lobby.test.tsx`·`phaseScreens.test.tsx`·`discussion.test.tsx` 에서 옛 클래스(이 과제 검증 명령 의 grep 패턴)를 쓰는 단언을 `grep -n` 으로 찾아 같은 방식으로 옮긴다(예: 「내 링이 있다」 → 「내 자리에 후광이 없다」, 「--spoke 반전」 → 「말풍선 --spoke」). `lobby.test.tsx` 의 왕관 테스트는 그대로 유효해야 한다(대기실은 `hostCrown`). 낮 장면 view(claim·discussion·night·morning)와 역할 배정 화면에는 `[aria-label="방장"]` 이 0개라는 단언을 더한다.
    - 실행: `npx vitest run test/unit/dayTable.test.ts test/client/dayTable.test.tsx test/client/dayScene.test.tsx test/client/nightScene.test.tsx test/client/morning.test.tsx test/client/lobby.test.tsx test/client/phaseScreens.test.tsx test/client/discussion.test.tsx` 가 지금은 실패해야 한다(상수·후광·말풍선·prop 이 없다). 실패 이유가 의도한 것인지 확인하고 커밋한다.

    다. GREEN — `feat(unr): 발밑 원을 후광으로, 말하는 중을 '…' 말풍선으로, 방장 왕관은 대기실만 (결정 0030)` 으로 커밋한다.
    - `src/game/dayTable.ts`: 위 상수를 export 한다(머리 주석에 후광 번짐 산술 한 줄, 말풍선 위 26 이 시안 30 과 다른 이유 한 줄). 좌표·z 규칙은 그대로다.
    - `src/components/DayTable.tsx`: `hostCrown?: boolean` prop 을 더하고 왕관은 `hostCrown && s.isHost` 일 때만 그린다. 동료 링·내 링·선택 링·차례 링 묶음·배지 요소와 이름표의 차례·보낸 사람 반전 클래스를 지운다. `Figure` 에 `className` 으로 후광 클래스를 넘긴다: 흰 후광은 `s.turn || s.pick?.mine`, 진홍 후광은 `s.isAlly && !(흰 후광 조건)`. 동료 마름모(`Icon diamond`)·표적 배지·내 이름표 `--me` 는 그대로. 말풍선은 `(s.turn || s.spoke) && !s.emoji` 일 때 Figure 다음 마크업 순서로 `span.mf-dt__bubble`(turn 이면 `--turn`, 아니면 `--spoke`, `aria-hidden="true"`, 자식 `<i />` 셋)을 그린다. 머리 주석의 옛 링·배지 설명을 「후광·말풍선」 설명으로 고친다(옛 클래스 이름을 주석에 남기지 않는다 — 발밑 원이라고 쓴다). `Icon` 의 `speech` 는 쓰는 곳이 없어지지만 Icon 테스트가 목록으로 보므로 남긴다.
    - `src/styles/daytable.css`: 머리 주석 z 규칙 문단을 「발밑 원은 없다. 후광은 자리 안 그림 하나의 filter 라 자리 쌓임 맥락(12~22)을 벗어나지 않는다」 로 바꾼다. 위 behavior 의 CSS 를 쓴다 — 후광 값은 `.mf-dt` 의 사용자 지정 속성 두 개에 한 번만 적고 후광 클래스와 끊김 조합이 `var()` 로 쓴다(색은 `color-mix(in srgb, var(--gray-50) N%, transparent)` 와 `var(--crimson-400)` 토큰만, `#` 색 없음). 말풍선: `position: absolute; left: 50%; top: -26px; transform: translateX(-50%); height: 26px; padding: 0 11px; border-radius: 13px; background: var(--gray-50); display: flex; align-items: center; gap: 4px; pointer-events: none`, 그림자 `0 4px 10px color-mix(in srgb, var(--shadow) 82%, transparent)`, 꼬리는 `::after`(5px 삼각형, gray-50). 점은 `i`(6px 원, `var(--night-900)`, 불투명도 .3)와 `mf-dt-dot` 키프레임(1200ms 순환, `nth-child` 지연 0·200·400ms). 말풍선이 나타날 때 `mf-dt-fade` 를 쓴다. 축소 모션 블록에서 점·말풍선 animation 을 `none` 으로 하고 점 불투명도를 1/.6/.3 으로 고정한다. 옛 링·내 링·동료 링·선택 링·차례 배지·이름표 반전 규칙과 그 키프레임 중 안 쓰는 것과 축소 모션 블록의 옛 선택자를 지운다.
    - `src/screens/DayScene.tsx`: 입력 만드는 코드는 이미 turn·spoke·isAlly·pick 을 넘기므로 의미는 그대로다. 주석의 「발밑 링·말풍선 배지·이름표 반전」 을 「후광·말풍선」 으로 고친다. `hostCrown` 을 넘기지 않는다(낮·밤·아침은 왕관 없음). `Assigning` 도 고치지 않는다(기본값이 왕관 없음).
    - `src/screens/Lobby.tsx`: `<DayTable … hostCrown />` 한 줄.
    - 옛 이름이 코드에 남지 않았는지 이 과제 검증 명령 의 grep 으로 확인한다.
    - 실행: 위 vitest 와 `npm run typecheck`. 산술 테스트가 context 표(번짐 7.6 여유·말풍선 겹침 0)와 다른 숫자를 내면 이 계획의 숫자가 아니라 테스트가 맞는지 먼저 의심하고, 어긋나면 멈추고 숫자를 보고한다. 이 과제는 E2E 를 고치지 않는다(과제 2).
  </action>
  <verify>
    <automated>npx vitest run test/unit/bots.test.ts test/unit/dayTable.test.ts test/client/dayTable.test.tsx test/client/dayScene.test.tsx test/client/nightScene.test.tsx test/client/morning.test.tsx test/client/lobby.test.tsx test/client/phaseScreens.test.tsx test/client/discussion.test.tsx && npm run typecheck && ! grep -rnE "mf-dt__(spot|ring|sel|turn)|tag--(turn|spoke)" src && test "$(git diff --name-only 97ce655 -- shared worker)" = "shared/game/bots.ts"</automated>
  </verify>
  <done>대기실·배정·낮·밤·아침에서 발밑 원과 이름표 반전이 사라지고, 차례·내가 고른 대상은 흰 후광, 마피아 동료(와 관전자 화면의 마피아)는 진홍 후광이며, 말하는 중은 머리 위 '…' 말풍선(이모티콘이 대신, 축소 모션 정지)이다. 방장 왕관은 대기실에만 있다. 후광 번짐·말풍선 겹침·층 규칙·동시 후광 수가 단위 테스트의 산술로 닫혀 있다. 봇 이름 커밋과 RED·GREEN 커밋이 따로 있고 서버 규칙은 바뀌지 않았다(shared 는 봇 이름 상수 하나).</done>
</task>

<task type="auto" tdd="true">
  <name>과제 2: E2E 규칙을 후광·말풍선·왕관 없음에 맞춘다 — K1·K4 개정, W1 신설, 밤 선택 후광, 부분 로컬 E2E (V-06 일부)</name>
  <files>scripts/e2e/lib.test.mjs, scripts/e2e/lib.mjs, scripts/e2e/browser.mjs, scripts/e2e/flows.mjs</files>
  <read_first>scripts/e2e/lib.mjs (turnChecks·ringChecks·insetSides), scripts/e2e/lib.test.mjs (K1·K2·K4 테스트와 상수 테스트), scripts/e2e/browser.mjs (collectSnapshot 의 turn·seats·sel), scripts/e2e/flows.mjs (selState·nightActions·dayState·lobbyFlow), src/components/DayTable.tsx, src/styles/daytable.css, .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md (E2E 갱신 표)</read_first>
  <behavior>
    - K1 「차례 표식이 정확히 한 자리」: claim 에서 차례 말풍선(.mf-dt__bubble--turn)이 정확히 한 자리, 흰 후광 img 가 같은 자리 하나, 발밑 원·옛 배지·이름표 반전·이름표 아랫줄이 0 개. expectNone(토론·밤·아침)이면 차례 말풍선 0 개(토론의 빠른 메시지 말풍선 --spoke 는 세지 않는다 — 봇이 말하는 시점에 흔들리지 않게)
    - K4 「후광은 윤곽을 따르는 filter 이고 발밑 원이 없음」(모든 상태, 차례가 있든 없든): 후광 img 의 계산된 filter 에 drop-shadow( 가 두 개이고 9px 반지름이 있으며, 후광 클래스는 img 에만 있고, 자리 z-index 는 유한한 정수(자리가 쌓임 맥락), 후광 img 수 ≤ 3, 발밑 원 요소(차례 링·내 링·동료 링·선택 링) 0 개. claim 이면 흰 후광은 말풍선과 같은 자리. 측정값이 없으면 조용히 통과시키지 않고 실패
    - W1 「방장 왕관」: 대기실은 정확히 1개(role=img 이름 방장), 배정·낮·밤·아침(모든 낮 상태)은 0개. 측정값 없으면 실패
    - 밤 선택(N2·N3): 선택 표시는 .mf-dt__seat 안 img.mf-figure--halo-white 로 읽는다(옛 선택 링 대신). 마피아 화면의 동료는 진홍 후광이라 선택으로 세지 않는다. aria-pressed·알약 확인은 그대로
    - 기존 D3a·D3b·D9·T1·T2·L6·K2·K3 판정 코드와 기준 수치(OVERLAP_EPS 0.5·ONE_LINE_FACTOR 1.6·FACE_RATIO 0.45·TAP_MIN 44·PANEL_H 157·D3b 바닥 4·5명 99.9 %·6명 85 %·7명 50 %·8명 55 %), DECORATIVE_ALLOW·TAP_ALLOW·TEXT_SIZE_ALLOW 는 바뀌지 않는다
  </behavior>
  <action>
    진행 순서는 가(RED) → 나(GREEN) → 다(부분 로컬 E2E)다. 이 과제는 앱 코드를 고치지 않는다(과제 1 의 결과를 E2E 가 읽게 한다).

    가. RED — `scripts/e2e/lib.test.mjs` 만 고쳐 실패를 확인하고 `test(unr): E2E 후광·말풍선·왕관 규칙` 으로 커밋한다.
    - 옛 K4(링 앞뒤 호) 테스트를 지우고 새 K4(후광 구조) 테스트를 쓴다: 통과 픽스처 하나(흰 후광 한 개 + 진홍 한 개, 두 겹 drop-shadow 문자열, 발밑 원 0, 자리 z 유한)와 어긋남마다 실패 — 후광 img 4개, drop-shadow 한 겹뿐, 9px 없음, 발밑 원 요소 있음, claim 인데 흰 후광이 말풍선 자리와 다름, 측정값(`halo` 필드) 없음. `turnChecks` 는 이제 K1 과 K4 를 항상(expectNone 이어도) 돌려주고 myTurn 이 불리언이면 K2 도 돌려준다는 단언으로 옛 「expectNone 이면 K1 하나」 테스트를 바꾼다. K1 테스트는 새 필드(`turn.bubbleTurnSeats`·`turn.haloWhiteSeats`·`turn.legacyCircles`·`turn.tagInverted`·`turn.legacyRows`)로 고치고, 토론 빠른 메시지 말풍선(--spoke)이 expectNone 을 실패시키지 않음을 단언한다. W1 테스트: `crownChecks(snap, { expect })` 가 expect 1 이면 1개 통과·0개 실패, expect 0 이면 0개 통과·1개 실패, `snap.crowns` 가 없으면 `측정값 없음` 으로 실패. 기존 불변 상수 테스트(0.5·1.6·0.45·44·157, SIDE_GAP_MIN·HEADER_H, TEXT_SIZE_ALLOW 두 항목)는 그대로 둔다.
    - `node --test scripts/e2e/lib.test.mjs` 가 지금은 실패해야 한다. 실패 이유가 의도한 것인지 확인하고 커밋한다.

    나. GREEN — `feat(unr): E2E 가 후광·말풍선·왕관을 읽는다 (결정 0030)` 으로 커밋한다.
    - `scripts/e2e/lib.mjs`: 옛 링 검사 함수와 `insetSides` 를 지우고 `haloChecks`(K4)·`crownChecks`(W1)를 더한다. `turnChecks` 는 K1 → K4 → (myTurn 이면) K2 순으로 돌려준다. 상수·허용 목록은 건드리지 않는다.
    - `scripts/e2e/browser.mjs` `collectSnapshot`: `turn` 을 `{ bubbleTurnSeats, haloWhiteSeats, legacyCircles(발밑 원 요소 수: 옛 링 네 종류 선택자 합 — 0 임을 증명하려고 browser.mjs 한 곳에서만 옛 선택자를 쓴다, 위 검증 명령 의 grep 은 lib.mjs·flows.mjs 만 본다), tagInverted(이름표 반전 클래스 수), legacyRows }` 로, 새 `halo` 필드를 `{ items: [{ seat, cls(white|crimson), filter(계산된 값), seatContext(자리 z 유한), onImg }], max(후광 img 수) }` 로 바꾸고 `crowns`(`.mf-dt__crown` 수)를 더한다. `seats[].sel` 은 자리 안 `img.mf-figure--halo-white` 가 있는지로 바꾼다. 글자·토큰·프레임은 싣지 않는다. `readStage` 는 그대로다.
    - `scripts/e2e/flows.mjs`: `selState` 와 N2·N3 의 선택 링 조회를 후광 img 로 바꾼다(`total` = 흰 후광 img 수). 대기실 흐름의 첫 스냅숏에 W1(expect 1)을, `dayState` 의 스냅숏마다 W1(expect 0)을 기록한다. 그 밖의 흐름·ID 는 바꾸지 않는다.
    - 실행: `node --test scripts/e2e/lib.test.mjs`, `npm run typecheck`.

    다. 부분 로컬 E2E(커밋 전, 코드 변경 없음). 5173 포트가 비어 있는지(`lsof -i :5173`) 확인하고 `npm run dev` 를 백그라운드로 띄워 응답을 기다린 뒤 `npm run e2e -- --url http://localhost:5173 --only mafia8` 와 `--only citizen4`, `--only lobby` 를 돈다. mafia8 은 방장 닉네임(5글자)과 5글자 봇 이름 7개로 8명판 5글자 이름표 최악 경우를 처음 시험한다(D2·G2 의 폰 가장자리 −0.5 칼날 경계, D9, D3b 바닥 55 %). 후광·말풍선·왕관·K1·K4·W1·N2·N3 와 T1·T2·L6·D3a·D3b·D4·D9 가 모두 통과해야 한다. 실패하면 완화하지 말고 원인(앱 결함 또는 새 측정 오류)을 고친다 — 완화가 허용되는 것은 이미 승인된 M1·D3a/D3b·D4 뿐이다. D2·G2 가 5글자 이름표 때문에 폰 가장자리에서 실패하면 임계값을 낮추지 말고 멈춰 측정 숫자(자리·폭·여유)를 보고한다(결정 0028 의 대안 이름표 여유 49 → 50 은 사용자가 정한다). 끝나면 dev 서버를 종료하고 포트가 비었는지 확인한다.
  </action>
  <verify>
    <automated>node --test scripts/e2e/lib.test.mjs && npm run typecheck && ! grep -nE "mf-dt__(spot|ring|sel|turn)|tag--(turn|spoke)" scripts/e2e/lib.mjs scripts/e2e/flows.mjs</automated>
  </verify>
  <done>E2E K1·K4·W1 이 새 표시(후광·말풍선·왕관 없음)를 읽고, 밤 선택은 후광으로 확인하며, 기준 수치·허용 목록은 그대로다. 부분 로컬 E2E(mafia8·citizen4·lobby)가 5글자 이름표 8명판에서도 통과한다(실패 시 낮추지 않고 숫자를 보고). RED/GREEN 커밋쌍이 있다.</done>
</task>

<task type="auto" tdd="true">
  <name>과제 3: 배경 장면 목록·전환 규칙·WebP 파이프라인과 크로스페이드 Backdrop — RED → GREEN (V-04)</name>
  <files>test/unit/scenes.test.ts, test/unit/assets.test.ts, test/client/backdrop.test.tsx, test/client/screens.test.tsx, test/client/lobby.test.tsx, test/client/phaseScreens.test.tsx, test/client/morning.test.tsx, test/client/nightScene.test.tsx, test/client/dayScene.test.tsx, src/game/scenes.ts, src/components/Backdrop.tsx, src/net/assets.ts, src/styles/ds.css, src/screens/Home.tsx, src/screens/JoinByLink.tsx, src/screens/ErrorScreen.tsx, src/App.tsx, src/screens/Lobby.tsx, src/screens/Assigning.tsx, src/screens/RoleReveal.tsx, src/screens/Day.tsx, src/screens/DayScene.tsx, scripts/make-backdrops.mjs, scripts/make-og.mjs, scripts/smoke.mjs, package.json, public/_headers, public/backgrounds/*.webp (7개 생성), public/backgrounds/*.svg (8개 삭제)</files>
  <read_first>design/backgrounds/v2/README.md, docs/decisions/0029-background-set-v2.md, design/screens/visual-v1/SPEC.md (5번), src/components/Backdrop.tsx, src/net/assets.ts, src/styles/ds.css (Backdrop 절), test/unit/assets.test.ts, 이 계획 context 의 「배경 측정」 표와 「해·달 결정」·「헤더 글씨 대비」 표, scripts/make-og.mjs (입력 경로), scripts/smoke.mjs (에셋 검사 부분), public/_headers, src/screens/DayScene.tsx (Backdrop 호출), src/screens/Day.tsx, test/client/morning.test.tsx·nightScene.test.tsx (backdrop 클래스 단언)</read_first>
  <behavior>
    - 장면 목록(src/game/scenes.ts): id 여섯(lobby·night·morning·day·dusk·verdictDusk), 파일 이름 조각(lobby·night·morning·day·dusk·verdict_dusk), 막(morning·day 만 true), entry 구도는 lobby 만. 단계→장면 규칙표 PHASE_SCENE(Record<PhaseId, SceneId>): lobby·assigning·roleReveal → lobby, dayAnnounce·claim·discussion → day, night → night, morning → morning. dusk·verdictDusk 는 어떤 단계도 가리키지 않는다(등록만)
    - 그림: public/backgrounds 에는 WebP 정확히 7개(bg_game_lobby·night·morning·day·dusk·verdict_dusk, bg_entry_lobby)뿐이고 SVG 는 없다. 각 파일은 RIFF…WEBP 머리를 갖고 크기 상한(set2 game ≤ 48KB, set1 ≤ 24KB, entry ≤ 64KB)과 합계 ≤ 260KB 를 지킨다. 원본은 design/ 에만 있다(design/backgrounds/A_cute 와 v2 는 그대로)
    - Backdrop: 첫 마운트는 층 하나가 바로 current(진입 연출 없음). scene 이 바뀌면 이전 층은 leaving, 새 층은 이미지가 준비된 뒤(Image.decode, 없으면 즉시, 상한 1200ms) current 로 0.8초(var(--dur-slow)) 크로스페이드하고 leaving 은 전환이 끝나면 걷어낸다(동시에 최대 3층). instant 이면 크로스페이드 없이 즉시 바꾼다. fromScene 이 있으면 처음에는 그 장면이 current 였다가 곧 scene 으로 크로스페이드한다. 막이 있는 장면의 층은 헤더 위쪽 어두운 막을 같은 층 안에 가진다(층과 함께 전환). 층은 aria-hidden·pointer-events none
    - 막 값: HEADER_SCRIM_STOPS = [[0,.70],[60,.58],[110,.40],[150,0]](색 night-900, 길이 150px, 시안 알파 .66/.42/.18/0 에서 올림 — 확인 필요 2)를 층의 인라인 사용자 지정 속성으로 싣고 CSS ::after 가 쓴다. 층의 background-image 는 url 하나뿐(막은 그림에 합치지 않는다)
    - 용량·로딩: entryPreloadList = entry lobby + game lobby WebP + 인물 8장(실측 약 99KB + 인물). rolePreloadList = 직업 그림 4종 + morning·day·night WebP(약 74KB) + 유령 + 일지 9개, 역할과 무관하게 같은 목록. dusk·verdictDusk 는 어떤 프리로드 목록에도 없다(처음 쓰일 때 불러온다)
    - 캐시: /backgrounds/* 의 Cache-Control max-age=86400 규칙은 그대로이고 .webp 에도 적용된다. smoke 가 배포본의 night·entry lobby WebP 를 image/webp·max-age=86400·용량 상한으로 확인한다
  </behavior>
  <action>
    진행 순서는 가(도구 확인) → 나(RED) → 다(GREEN)다. 이 과제는 화면의 단계 흐름을 바꾸지 않는다(Day 화면은 과제 4 에서 없앤다) — 모든 화면이 새 Backdrop 계약으로 옮겨 갈 뿐이다.

    가. 도구 확인. `node -e "require('sharp')"` 를 프로젝트 루트에서 돌려 sharp 가 로드되는지 본다(안 되면 설치하지 말고 STOP 사유로 보고 — 이 계획은 새 패키지를 설치하지 않는다). `git status --short` 가 깨끗한지(추적 안 된 `.planning/milestone.lock` 외) 확인한다.

    나. RED — `test(unr): 배경 장면 목록·WebP 예산·크로스페이드 기준` 으로 커밋한다.
    - 새 `test/unit/scenes.test.ts`(unit 환경 = node): (1) `PHASE_SCENE` 이 모든 PhaseId 를 덮고 behavior 의 표와 같다(PhaseId 목록은 `shared/protocol` 에서 읽는다), dusk·verdictDusk 를 가리키는 단계가 없다. (2) `SCENES` 가 여섯 장면·파일 조각·막(morning·day 만)·entry 구도(lobby 만)를 갖는다. (3) `readdirSync("public/backgrounds")` 가 정확히 WebP 일곱 개이고 SVG 가 없으며, 각 파일 앞 12바이트가 RIFF…WEBP, 크기 상한과 합계 ≤ 260KB 를 지킨다. (4) `scripts/make-backdrops.mjs` 가 export 하는 `SOURCES`(출력 이름·원본 경로·품질·상한)가 `SCENES` 와 일치하고 원본 파일이 모두 존재한다(원본이 `design/backgrounds/v2` 안). (5) `public/_headers` 에 `/backgrounds/*` 규칙과 `max-age=86400` 이 있다. (6) `HEADER_SCRIM_STOPS` 값과 `headerScrimGradient()` 문자열(night-900 토큰 color-mix, 150px 끝 0)을 단언한다.
    - `test/unit/assets.test.ts` 개정: `backdropUrl("game", "night")` = `/backgrounds/bg_game_night.webp`, `backdropUrl("game", "verdictDusk")` = `…bg_game_verdict_dusk.webp`, `backdropUrl("entry", "lobby")` = `…bg_entry_lobby.webp`(entry 에 다른 장면을 주면 타입 오류 — `// @ts-expect-error` 한 줄). 실제 파일 존재 검사는 SVG glob 대신 WebP glob. `entryPreloadList`·`rolePreloadList` 단언을 behavior 대로(morning·day·night 포함, dusk·verdictDusk 없음, 역할과 무관한 같은 목록, SVG 없음).
    - 새 `test/client/backdrop.test.tsx`: behavior 의 Backdrop 항목을 하나씩 — 첫 마운트 단일 current, scene 변경 후 leaving + current 두 층과 가짜 타이머로 전환이 끝나면 한 층, 이미지가 늦게 준비되면(Image 스텁이 늦게 resolve) 새 층이 entering 에 머물다 상한 1200ms 에 시작, instant, fromScene, 막(인라인 사용자 지정 속성은 morning·day 층에만), 층 최대 3, aria-hidden, 층 CSS 규약(ds.css 를 `readFileSync` 로 읽는다: `.mf-backdrop__art` 의 `transition: opacity var(--dur-slow) var(--ease-out)`, 상태별 불투명도, `::after` 막 150px, `transition: background-image` 없음, `#` 색 없음). 루트 클래스 `mf-backdrop--{현재 장면}`.
    - 기존 테스트 개정: `screens.test.tsx`(Home 의 배경 URL → `bg_entry_lobby.webp`), `lobby.test.tsx`(`bg_game_lobby.webp`), `phaseScreens.test.tsx`(낮 시작 발표·직업 공개 화면의 `bg_game_day.webp`), `morning.test.tsx`(아침의 루트 클래스 `mf-backdrop--morning` — 이제 아침은 day 가 아니라 morning 장면), `nightScene.test.tsx`(`--night` 유지), `dayScene.test.tsx`(필요하면). Backdrop 의 prop 이름이 `variant` → `scene` 으로 바뀐다.
    - 실행해 실패(목록·파일·새 Backdrop 없음)를 확인하고 커밋한다.

    다. GREEN — `feat(unr): 배경을 장면 목록과 WebP 로 바꾸고 장면이 바뀌면 크로스페이드한다 (결정 0030)` 으로 커밋한다.
    - `scripts/make-backdrops.mjs`: sharp 로 `design/backgrounds/v2/{set1,set2}` 원본을 읽어 `public/backgrounds/*.webp` 를 쓴다. 품질 90·effort 6, **리사이즈 없음**(set2 1080×2340, set1 540×1170 원본 크기 그대로 — 업스케일은 용량만 늘린다). `SOURCES` 를 export 하고(출력 이름·원본·품질·상한 KB) 직접 실행했을 때만 변환한다(`import.meta.url` 이 실행 파일일 때). 출력 크기를 표로 찍고 상한을 넘으면 비정상 종료한다. 원본은 읽기만 한다. `package.json` scripts 에 `"backdrops": "node scripts/make-backdrops.mjs"` 한 줄만 더한다(패키지·lock 은 그대로). 실행해 WebP 일곱 개를 만들고 실측 크기를 SUMMARY 에 적는다(context 표의 43.1·39.2·36.3·39.3·55.7·15.8·18.7KB 와 크게 다르면 원인을 보고).
    - 옛 SVG 8개를 `git rm` 하고(원본은 `design/backgrounds/A_cute` 에 그대로) `scripts/make-og.mjs` 의 입력 경로를 `design/backgrounds/A_cute/bg_entry_lobby.svg` 로 바꾼다(같은 파일이라 `public/og.png` 재생성 결과가 그대로다 — 스크립트는 실행하지 않는다). `design/backgrounds/A_cute` 는 지우지 않는다(확인 필요 6).
    - `src/game/scenes.ts`(DOM 을 쓰지 않는 순수 모듈): `SceneId`·`SCENES`·`PHASE_SCENE`·`sceneOfPhase(phase)`·`SCENE_FADE_MS = 800`(주석에 `--dur-slow` 와 같다)·`SCENE_IMAGE_WAIT_MS = 1200`·`HEADER_SCRIM_STOPS`·`headerScrimGradient()`. 머리 주석에 「4페이즈: 투표·처형 단계가 생기면 PHASE_SCENE 에 행을 더한다(dusk·verdictDusk 는 이미 등록)」 와 해·달 결정 요약(이미지에 맡김, 이중 표시 없음)을 적는다. `PhaseId` 가 늘면 `Record<PhaseId, SceneId>` 가 타입 오류로 알려 준다.
    - `src/net/assets.ts`: `BackdropLayout`·`BackdropVariant` 를 장면 id 기반으로 바꾸고 `backdropUrl(layout, scene)` 이 `/backgrounds/bg_{layout}_{파일 조각}.webp` 를 돌려준다(entry 는 lobby 만 허용하는 타입). `entryPreloadList`·`rolePreloadList` 를 behavior 대로 고친다.
    - `src/components/Backdrop.tsx`: props `layout`·`scene`·`fromScene?`·`instant?`·`className`·`children` — 유니온 타입으로 entry 는 `scene: "lobby"` 만. 층 목록 상태와 렌더 중 상태 조정(또는 효과)으로 behavior 의 층 규칙을 구현한다: 층은 `div.mf-backdrop__art` 에 `data-scene`·`data-state`(`entering`·`current`·`leaving`)와 인라인 `backgroundImage: url(...)`·`backgroundPosition: center top`, 막 장면이면 인라인 `--mf-scrim`(`headerScrimGradient()`). 새 층의 이미지 준비는 `new Image()` + `decode()`(없거나 실패하면 즉시)이고 `SCENE_IMAGE_WAIT_MS` 가 상한이다. 걷어내기는 `SCENE_FADE_MS` + 여유 타이머(언마운트 때 정리). 루트 클래스는 `mf-backdrop mf-backdrop--{scene}`.
    - `src/styles/ds.css` Backdrop 절: `.mf-backdrop__art` 에서 `transition: background-image` 를 지우고 `transition: opacity var(--dur-slow) var(--ease-out)`, `[data-state="entering"], [data-state="leaving"] { opacity: 0 }`, `[data-state="current"] { opacity: 1 }`, 막 `.mf-backdrop__art[style*="--mf-scrim"]::after`(`content: ""; position: absolute; inset: 0 0 auto 0; height: 150px; background: var(--mf-scrim); pointer-events: none`). 축소 모션은 `base.css` 전역 규칙이 처리한다(개별 규칙 없음).
    - 호출처: `Home`·`JoinByLink`·`ErrorScreen`·`App`(입구, `layout="entry" scene="lobby"`), `Lobby`·`Assigning`·`RoleReveal`(`scene="lobby"`), `Day`(`scene="day"`, 과제 4 에서 지운다), `DayScene`(`scene={sceneOfPhase(view.phase)}` — 같은 장면 안에서 낮 → 밤 → 아침 → 낮이 크로스페이드되고, 처음 마운트는 즉시). `DayScene` 의 `variant={isNight ? …}` 식을 지운다.
    - `scripts/smoke.mjs`: full 단계의 에셋 검사에 `/backgrounds/bg_game_night.webp` 와 `/backgrounds/bg_entry_lobby.webp` 를 더한다 — 200, content-type 에 `image/webp`(없는 경로는 SPA 가 html 로 답하므로 이 검사가 파일 존재를 증명한다), cache-control 에 `max-age=86400`, 본문 크기가 각 상한(48KB·64KB) 이하. 기존 인물 그림·og 검사는 그대로. `public/_headers` 는 규칙을 바꾸지 않고 주석에 새 파일이 `.webp` 라는 한 줄만 더한다.
    - 실행: 위 vitest 와 `npm run typecheck`. 개발 서버를 띄우지 않고도 `node scripts/make-backdrops.mjs` 를 한 번 더 돌려 같은 크기가 나오는지(결정적) 확인한다.
  </action>
  <verify>
    <automated>npx vitest run test/unit/scenes.test.ts test/unit/assets.test.ts test/client/backdrop.test.tsx test/client/screens.test.tsx test/client/lobby.test.tsx test/client/phaseScreens.test.tsx test/client/morning.test.tsx test/client/nightScene.test.tsx test/client/dayScene.test.tsx && npm run typecheck && test "$(ls public/backgrounds | wc -l | tr -d ' ')" = "7" && ! ls public/backgrounds | grep -q "\.svg$" && ! grep -rnE "backgrounds/bg_[a-z_]+\.svg" src test scripts && test "$(git diff --name-only 97ce655 -- shared worker)" = "shared/game/bots.ts"</automated>
  </verify>
  <done>배경이 장면 목록(6)과 단계→장면 규칙표로 정해지고, 앱용 그림은 WebP 일곱 개(실측 합 약 248KB, 상한 260KB)이며 옛 SVG 는 public 에 없다. 장면이 바뀌면 같은 Backdrop 안에서 0.8초 크로스페이드(처음 마운트·instant 는 즉시, 새 그림 준비 뒤 시작, 헤더 막은 층과 함께)하고 아침·낮에는 헤더 위쪽 어두운 막이 있다. 프리로드는 첫 화면 그림(입구 약 99KB)과 게임 장면 셋(약 74KB)뿐이고 해질녘·투표·처형은 등록만 되어 지연 로딩이다. smoke 가 배포본의 WebP 헤더·크기를 보도록 준비됐다. RED/GREEN 커밋쌍이 있고 서버·shared 는 봇 이름 외 바뀌지 않았다.</done>
</task>

<task type="auto" tdd="true">
  <name>과제 4: 낮 시작 화면을 없애고 낮·밤 시작 문구를 한 부품으로 — 테이블 장면 위에서 배경만 바뀐다 — RED → GREEN (V-05)</name>
  <files>test/client/sceneIntro.test.tsx (test/client/nightIntro.test.tsx 를 git mv 해서 확장), test/client/phaseArrival.test.tsx, test/client/phaseScreens.test.tsx, test/client/discussion.test.tsx, test/client/testTools.test.tsx, test/client/roleCardFlow.test.tsx, test/client/roomScreen.test.tsx, test/client/dayScene.test.tsx, test/unit/scenes.test.ts, src/game/scenes.ts, src/components/SceneIntro.tsx (src/components/NightIntro.tsx 를 git mv), src/net/phaseArrival.ts, src/screens/DayScene.tsx, src/screens/RoomScreen.tsx, src/screens/Day.tsx (삭제), src/styles/night.css, src/styles/phase.css, src/styles/day.css, scripts/e2e/browser.mjs, scripts/e2e/flows.mjs, scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs (이름 바꾸기 범위만)</files>
  <read_first>design/screens/visual-v1/SPEC.md (4번), design/screens/visual-v1/Z1-morning·Z2-day·Z3-night.dc.html (문구 배치), src/screens/Day.tsx, src/components/NightIntro.tsx, src/styles/night.css (밤 시작 문구 절), src/styles/phase.css (S-06 낮 시작 절), src/styles/day.css, src/screens/DayScene.tsx (렌더 중 상태 조정·title·panel), src/screens/RoomScreen.tsx (sceneKey·renderPhase), src/components/Backdrop.tsx·src/game/scenes.ts (과제 3 결과), shared/game/phases.ts (DAY_ANNOUNCE_MS), test/client/nightIntro.test.tsx, test/client/phaseScreens.test.tsx (S-06 낮 시작 발표 단언: 235·282~320·367·462~476·539·616~618·663~673·752·780 줄 근처), test/client/testTools.test.tsx (낮 시작 발표 [테스트] 위치), test/client/roleCardFlow.test.tsx (낮 시작 상단 gap 규칙), scripts/e2e/flows.mjs·browser.mjs·lib.mjs (readNightIntro·nightIntroChecks·N6·N7)</read_first>
  <behavior>
    - 장면 문구 규칙표(src/game/scenes.ts): PHASE_INTRO 는 night → { 밤 톤, 제목 "밤이 되었습니다" }, dayAnnounce → { 낮 톤, 제목 "낮이 되었습니다", 보조줄 "토론 전에 먼저 직업을 공개해요" } 둘뿐이고 다른 모든 단계는 문구가 없다. SCENE_INTRO_MS 는 shared/game/phases 의 DAY_ANNOUNCE_MS 와 같다(2000). 4페이즈는 이 표에 행을 더한다
    - 낮 시작 전용 화면(Day.tsx)과 그 CSS 가 없다. RoomScreen 의 dayAnnounce 도 DayScene 이고 sceneKey 가 claim·discussion·night·morning 과 같은 키다: dayAnnounce → claim 에서 장면 바깥 래퍼(mf-phase-enter)가 같은 노드, roleReveal → dayAnnounce 에서는 새 노드
    - DayScene 의 dayAnnounce: 제목 `낮`, 안내 `N일차`(view.day.n), 서버 마감 타이머(헤더 높이가 claim 과 같다), [내 역할] 버튼, [테스트] 닻, claim 과 같은 위치의 테이블, 높이 157 의 하단 패널(살아 있는 사람은 비어 있음, 탈락자는 관전 하단). 자리는 누를 수 없다(기록 카드·밤 선택 없음). 배경 장면은 day
    - 문구(SceneIntro): 같은 epoch 에서 비밤 → 밤이면 밤 문구, 비dayAnnounce → dayAnnounce 면 낮 문구가 정확히 한 번 뜨고 2000ms 에 사라진다(1999ms 에는 있다). 처음 마운트(arrivedFrom 없음)·재접속(epoch 변화)·같은 단계 안 다시 그리기에는 없고 타이머가 연장·리셋되지 않는다. 단계가 바뀌면 즉시 사라진다. 역할 확인 → 낮 시작으로 DayScene 이 새로 마운트될 때는 arrivedFrom(직전 단계)으로 마운트 직후 낮 문구를 한 번 건다. 문구는 어떤 view 필드도 읽지 않고 일차 n 만 쓴다(역할 4종·탈락자가 같은 글자). pointer-events none, aria-hidden, 제목 요소(h1)가 아니다
    - 배경 전환: DayScene 의 Backdrop 은 scene = 그 단계의 장면. epoch 가 바뀐 렌더의 단계 변화는 instant(크로스페이드·문구 없음). arrivedFrom 이 있으면 fromScene = 직전 단계의 장면(lobby)으로 시작해 곧 day 로 크로스페이드한다. 아침·낮·밤이 서로 바뀔 때는 같은 DayScene 안에서 층만 바뀐다(테이블·헤더·패널 노드 유지)
    - usePhaseArrival(phase, epoch): 같은 epoch 에서 단계가 바뀐 뒤에는 직전 단계를, 처음 렌더·epoch 가 함께 바뀐 렌더에서는 null 을 돌려주고 다음 변화 전까지 값을 유지한다
    - 역할 무관: dayAnnounce 마크업은 경찰·의사·시민·역할 없음 view 에서 같고, 마피아 view 는 동료 후광·마름모만 다르다
    - CSS: .mf-sceneintro 는 position absolute·inset 0·z-index 40(DayTable 위, 닻·토스트 50 아래)·pointer-events none, 막은 같은 방사형 기하(70% 55% at 50% 38%)에 밤 톤 night-950 중앙 85%·낮 톤 70%, 제목 번짐 var(--dur-slow)·var(--ease-out), 퇴장 마지막 300ms(지연은 인라인 변수), 축소 모션 개별 규칙 없음(전역 규칙), # 색 없음. 낮 시작 전용 화면의 규칙(.mf-day 계열)과 .mf-day__sub 는 없고 .mf-dayscene 규칙은 그대로
    - 서버 규칙·시간·와이어는 바뀌지 않는다(서버 단계 dayAnnounce 는 그대로, 화면만 테이블 장면 위 덮는 층). 해·달은 배경 이미지에 맡기고 따로 그리지 않는다(이중 표시 없음)
  </behavior>
  <action>
    진행 순서는 가(RED) → 나(GREEN) → 다(부분 로컬 E2E)다.

    가. RED — `test(unr): 낮·밤 시작 문구 한 부품과 낮 시작 화면 제거 기준` 으로 커밋한다.
    - `git mv test/client/nightIntro.test.tsx test/client/sceneIntro.test.tsx` 로 옮기고 내용을 확장한다. 기존 밤 문구 항목 여덟 가지(같은 epoch 비밤 → 밤, 처음 마운트, 단계·epoch 동시 변화, 1999/2000ms, 1000ms 다시 그리기와 사라진 뒤 다시 그리기, 밤 → 아침 즉시 소멸과 다음 밤 일차, 역할 4종·탈락자 같은 글자, CSS 규칙)는 클래스 이름 `mf-sceneintro`·`SCENE_INTRO_MS` 로 옮겨 유지한다. 낮 문구를 같은 항목들로 더한다: morning → dayAnnounce(같은 epoch)에 `.mf-sceneintro--day` 가 있고 글자가 `[2일차, 낮이 되었습니다, 토론 전에 먼저 직업을 공개해요]`, 처음 마운트·epoch 변화에는 없음, arrivedFrom "roleReveal" 로 dayAnnounce 에 새로 마운트하면 마운트 직후 있음(1일차), arrivedFrom 없이 마운트하면 없음, 2000ms 에 사라지고 단계가 바뀌면 즉시 사라짐. dayAnnounce 의 DayScene: 제목 h1 한 개 `낮`·안내 `N일차`·타이머 있음·테이블·하단 패널·[내 역할] 버튼, 역할 4종·역할 없음의 html 비교(마피아만 동료 후광·마름모가 더 있음). 배경: DayScene 이 claim → night → morning → dayAnnounce 를 지나며 `.mf-backdrop__art` 의 current `data-scene` 이 night·morning·day 로 바뀌고(전환이 끝난 뒤 한 층), epoch 변화와 함께 바뀐 단계는 즉시 한 층, arrivedFrom 마운트는 lobby 가 current 였다가 day 로 바뀐다. CSS 규칙 테스트는 behavior 의 CSS 항목대로(night.css 를 `readFileSync` 로).
    - `test/unit/scenes.test.ts` 에 `PHASE_INTRO`(두 행, 나머지 단계 없음, 톤·제목·보조줄)와 `SCENE_INTRO_MS === DAY_ANNOUNCE_MS` 단언을 더한다.
    - 새 `test/client/phaseArrival.test.tsx`: behavior 의 훅 규칙을 `renderHook` 으로.
    - `test/client/phaseScreens.test.tsx` 의 낮 시작 발표 단언을 새 구조로 옮긴다(약하게 만들지 않는다): 「테이블·타이머 없음」 → 「테이블·타이머 있음」, 「제목 낮이 되었습니다 heading」 → 「문구는 aria-hidden 이고 제목 요소가 아님(장면 제목 h1 은 `낮` 하나)」, 「마크업 역할 무관」 → 「경찰·의사·시민·역할 없음 html 이 같고 마피아만 동료 표식이 더 있음」, 「dayAnnounce → claim 에서 래퍼가 새 노드」 → 「같은 노드, 새 노드는 roleReveal → dayAnnounce」, live region `2일차 낮이 되었습니다` 는 그대로, 옛 낮 시작 화면의 방사형 빛·`h1` 제목 클래스 단언은 문구 부품 단언으로. `test/client/testTools.test.tsx` 의 「낮 시작 발표에서 [테스트] 가 옛 상단 줄 안」 은 「장면 상자 안 닻」 으로, `test/client/roleCardFlow.test.tsx` 의 옛 낮 시작 상단 gap 규칙 단언은 지우고 dayAnnounce 를 지나도 시트가 유지되는 단언은 그대로, `test/client/discussion.test.tsx`·`roomScreen.test.tsx`·`dayScene.test.tsx` 는 필요한 만큼만 고친다.
    - 실행해 실패를 확인하고 커밋한다.

    나. GREEN — `feat(unr): 낮 시작 화면을 없애고 낮·밤 문구를 한 부품으로 — 배경만 바뀐다 (결정 0030)` 으로 커밋한다.
    - `src/game/scenes.ts`: `PHASE_INTRO`·`SCENE_INTRO_MS`(= `DAY_ANNOUNCE_MS` import)를 더한다.
    - `git mv src/components/NightIntro.tsx src/components/SceneIntro.tsx`: `SceneIntro({ n, intro, onDone })`(intro = PHASE_INTRO 한 행). 마크업은 루트 `div.mf-sceneintro.mf-sceneintro--{night|day}`(aria-hidden, 인라인 변수 `--mf-sceneintro-exit-delay` = SCENE_INTRO_MS − 300 ms), 막 `div.mf-sceneintro__veil`, 가운데 쌓기 `div.mf-sceneintro__center` 안에 `p.mf-t-heading`(`N일차`)·`p.mf-t-display.mf-sceneintro__title`(제목)·보조줄이 있으면 `p.mf-sceneintro__sub`. 해제 타이머는 마운트 때 한 번만 건다(onDone 은 ref 로 쥐어 부모가 다시 그려도 리셋·연장되지 않고, 언마운트 때 clear). 문구는 view 를 읽지 않는다.
    - `src/styles/night.css`: 밤 시작 문구 절의 선택자를 `mf-sceneintro*` 로 바꾸고 톤별 막 변수(밤 85%·낮 70%, 둘 다 night-950 토큰의 color-mix)와 보조줄 규칙(옛 낮 시작 보조줄의 16px/1.5·gray-100·text-shadow·같은 번짐)을 둔다. 키프레임 이름도 `mf-sceneintro-*`. 축소 모션 개별 규칙은 두지 않는다. `phase.css` 의 낮 시작(S-06) 절과 `day.css` 의 낮 시작 보조줄 규칙을 지운다(`.mf-dayscene*` 는 그대로).
    - `src/net/phaseArrival.ts`: `usePhaseArrival(phase, epoch)` — `{ phase, epoch, from }` 상태를 렌더 중 조정으로 갱신한다(단계가 바뀌면 `from` = 같은 epoch 이면 직전 단계 아니면 null, 값은 다음 변화까지 유지). `src/screens/RoomScreen.tsx`: 훅을 부르고 `DayScene` 에 `arrivedFrom` 을 넘긴다. `renderPhase` 의 dayAnnounce 를 claim·discussion·night·morning 과 같은 DayScene 분기로 합치고 `Day` import 를 지운다. `sceneKey` 가 dayAnnounce 를 `dayScene` 으로 묶는다. `PHASE_ANNOUNCE` 의 dayAnnounce 안내는 그대로.
    - `src/screens/DayScene.tsx`: props 에 `arrivedFrom?: PhaseId | null`. 이전 단계 상태의 초기값을 `arrivedFrom ?? view.phase` 로 한다(역할 확인 → 낮 시작으로 새로 마운트돼도 첫 렌더에서 단계 변화로 처리된다). `nightIntroN` 상태를 「지금 문구가 있는 단계(PHASE_INTRO 행이 있는 단계)」 상태로 일반화한다: 단계가 바뀌는 렌더에서 `PHASE_INTRO[view.phase]` 가 있고 epoch 가 바뀌지 않았을 때만 켜고, 그 밖의 단계 변화나 epoch 변화에서는 끈다. `SceneIntro` 를 Toast 다음에 렌더하고 `onDone` 에서 끈다. `Backdrop` 호출은 `scene={sceneOfPhase(view.phase)}`·`instant={epochChanged}`·`fromScene`(마운트 때 한 번 정한 `arrivedFrom` 의 장면, 없으면 생략). 제목·안내·타이머: dayAnnounce 면 제목 `낮`·안내 `${n}일차`·타이머(calm). `inspectable` 은 claim·discussion·morning 그대로(dayAnnounce 는 아님). 하단 패널은 dayAnnounce 에서 살아 있는 사람은 빈 면, 탈락자는 기존 관전 하단. 머리 주석에 해·달 결정 한 줄(이미지에 맡김, 이중 표시 없음)을 적는다.
    - `src/screens/Day.tsx` 를 `git rm` 하고 `Day` 를 쓰던 import·테스트·CSS 를 정리한다.
    - E2E 는 이름만 맞춘다: `browser.mjs` 의 `readNightIntro` → `readSceneIntro`(선택자 `.mf-sceneintro`, 톤 `kind` 도 읽는다), `lib.mjs` 의 `nightIntroChecks` → `sceneIntroChecks(intro, { kind })`(N6 은 night 그대로), `flows.mjs` 의 import·호출, `lib.test.mjs` 의 해당 테스트.
    - 실행: 위 vitest, `node --test scripts/e2e/lib.test.mjs`, `npm run typecheck`. dayAnnounce 가 DayScene 이 되면서 claim 과 같은 높이 헤더(타이머)가 필요함을 테스트가 확인한다.

    다. 부분 로컬 E2E(커밋 전, 코드 변경 없음). dev 서버를 띄워 `npm run e2e -- --url http://localhost:5173 --only citizen4 --sizes 390x664` 를 돈다. 낮 시작이 DayScene 위에서 지나가도 D7·D9·T1·K·N 이 통과해야 한다(밤 문구 N6·N7 은 새 클래스로). 실패하면 완화하지 말고 원인을 고친다. 끝나면 dev 서버를 종료한다.
  </action>
  <verify>
    <automated>npx vitest run test/client/sceneIntro.test.tsx test/client/phaseArrival.test.tsx test/client/phaseScreens.test.tsx test/client/dayScene.test.tsx test/client/discussion.test.tsx test/client/testTools.test.tsx test/client/roleCardFlow.test.tsx test/client/roomScreen.test.tsx test/client/morning.test.tsx test/client/nightScene.test.tsx test/unit/scenes.test.ts && node --test scripts/e2e/lib.test.mjs && npm run typecheck && test ! -e src/screens/Day.tsx && test ! -e src/components/NightIntro.tsx && test ! -e test/client/nightIntro.test.tsx && ! grep -rnE "mf-day__|mf-nightintro|NightIntro" src scripts/e2e && test "$(git diff --name-only 97ce655 -- shared worker)" = "shared/game/bots.ts"</automated>
  </verify>
  <done>낮 시작 전용 화면이 없고 dayAnnounce 도 테이블 장면(DayScene) 위에서 그려져 테이블·헤더·패널 위치가 claim 과 같다. 아침·낮·밤이 바뀔 때 같은 장면 위에서 배경만 0.8초 크로스페이드되고, 밤 진입·낮 시작에 같은 SceneIntro 가 2초 뜨며(재접속·처음 마운트 제외, 역할 확인 직후 새 마운트는 arrivedFrom 으로 처리) 터치를 막지 않고 역할 무관하다. 해·달은 이미지에 맡겨 이중으로 그리지 않는다. 서버 규칙·시간·와이어는 그대로이고 부분 로컬 E2E(citizen4)가 통과한다. RED/GREEN 커밋쌍이 있다.</done>
</task>

<task type="auto" tdd="true">
  <name>과제 5: E2E 새 규칙 — 헤더 글씨 대비 H1, 배경 장면 B1, 낮 시작 문구 N8·N9, 낮 시작 T1 포함, 오프라인 대비 증명 — RED → GREEN (V-06)</name>
  <files>scripts/e2e/lib.test.mjs, scripts/e2e/lib.mjs, scripts/e2e/browser.mjs, scripts/e2e/flows.mjs, test/unit/backdropContrast.test.ts, test/unit/scenes.test.ts</files>
  <read_first>scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs (상수 테스트·sceneIntroChecks·stageStable), scripts/e2e/browser.mjs (readStage·readSceneIntro·skipTo·settle), scripts/e2e/flows.mjs (gameFlow 상태 순서·dayState·grabLobbyStage·claimMine), src/game/scenes.ts (PHASE_SCENE·SCENES·HEADER_SCRIM_STOPS·headerScrimGradient), src/components/Backdrop.tsx (data-scene·data-state), src/styles/tokens.css (gray-50·night-900·scrim 값), design/backgrounds/v2/README.md (헤더 대비 표), 이 계획 context 의 「헤더 글씨 대비」 표</read_first>
  <behavior>
    - H1 「헤더 글씨 대비」: 측정(요소별 { 이름: 제목|타이머, 사각형, 계산된 글자색, 배경 p95 휘도 })로 각 글씨의 대비 (L글자 + .05)/(L배경 + .05) 가 HEADER_CONTRAST_MIN = 4.5 이상이다. 배경 p95 = 글씨를 투명하게 한 스냅숏에서 그 요소 사각형 안 픽셀 휘도의 95번째 백분위수(HEADER_BG_PERCENTILE 0.95; 별·해 같은 작은 밝은 점에 흔들리지 않게). 측정값이 없거나 타이머가 있어야 하는 상태에서 타이머 항목이 없으면 조용히 통과시키지 않고 실패. 4.5·0.95 는 상수로 단위 테스트가 고정한다
    - 대상 요소: 제목 = .mf-phasebar h1(낮 장면·역할 확인)·.mf-assign__bar h1(배정)·.mf-lobby__code(대기실), 타이머 = .mf-timer__num. 안내 줄(gray-300)은 사용자 지정 대상이 아니라 재지 않는다(확인 필요 5)
    - 측정 시점: 배경 크로스페이드가 끝나(`.mf-backdrop__art` 가 한 층) 있고 시작 문구가 없을 때. 대기실·토론·밤(문구가 사라진 뒤)·아침·다음 낮에서 잰다(주장 차례 상태는 시간이 빠듯해 재지 않는다)
    - B1 「배경 장면이 단계에 맞음」: 한 층만 남아 있고 그 층이 current, data-scene 이 단계의 기대 장면(lib.mjs 의 EXPECTED_SCENE = src/game/scenes.ts 의 PHASE_SCENE 와 같은 표 — 단위 테스트가 두 표가 같음을 확인), 계산된 background-image 가 bg_game_*.webp
    - N8·N9: 낮 시작 직후 문구가 `[N일차, 낮이 되었습니다, 토론 전에 먼저 직업을 공개해요]`, pointer-events none, aria-hidden(N8, 관찰자가 처음 본 값으로 판정해 시간 경쟁이 없다), 3.5초 안에 DOM 에서 사라짐(N9). N6·N7(밤)은 그대로
    - T1·D7·D9 는 대기실 → 배정 → 낮 시작(dayAnnounce) → 낮 → 밤 → 아침을 한 번에 비교한다(dayAnnounce 항목 추가). 기준 수치·허용 목록 불변
    - 오프라인(단위 테스트): 장면 그림 6장 × 폰 폭 360·390·430 × 헤더 글씨 구역(제목 x16~120·y16~45, 타이머 숫자 W−69~W−16·y78~100, 대기실 코드 가운데)의 p95 대비가 모두 ≥ 4.5 — 막이 있는 장면은 HEADER_SCRIM_STOPS 로 합성, lobby 의 타이머 구역은 역할 확인의 `--scrim` 60% 막 합성. 막 없는 아침·낮의 타이머 구역은 4.5 미만이다(막이 필요하다는 사실을 고정)
  </behavior>
  <action>
    진행 순서는 가(RED) → 나(GREEN) → 다(대비 보정) → 라(부분 로컬 E2E)다.

    가. RED — `test(unr): E2E 헤더 대비·배경 장면·낮 시작 문구 규칙과 오프라인 대비 증명` 으로 커밋한다.
    - `scripts/e2e/lib.test.mjs`: 상수 `HEADER_CONTRAST_MIN === 4.5`·`HEADER_BG_PERCENTILE === 0.95` 를 기존 불변 상수 테스트 옆에 고정한다. `relLuminance([r,g,b])` 는 흰색 1·검정 0·gray-50(241,242,245) ≈ 0.889. `headerContrastChecks(measure, { expectTimer })`(id H1): 제목 7.0·타이머 5.2 로 통과, 타이머 3.9 면 실패하고 내용 칸에 요소 이름과 숫자, 항목이 비면 `측정값 없음`, expectTimer 인데 타이머 항목 없음 실패, 제목만 있어도 expectTimer 가 거짓이면 통과. `backdropSceneChecks(info, { phase })`(id B1): 한 층·current·기대 장면·webp 이면 통과, 층이 둘·leaving 이 남음·장면 다름·그림이 webp 아님·info 없음이 각각 실패. `sceneIntroChecks(intro, { kind: "day" })`(N8)·낮 글자 세 줄, null·글자 다름·pointerEvents auto·aria-hidden 아님이 각각 실패. 옛 밤 문구 테스트는 유지.
    - `test/unit/scenes.test.ts`: `scripts/e2e/lib.mjs` 의 `EXPECTED_SCENE` 이 `PHASE_SCENE` 과 모든 단계에서 같다.
    - 새 `test/unit/backdropContrast.test.ts`: unit 환경에서 `sharp` 로 `public/backgrounds/bg_game_*.webp` 를 읽어 behavior 의 오프라인 항목을 계산한다(폭마다 `fit: "cover", position: "top"` 으로 W × round(W·2340/1080) 로 키운 뒤 위쪽 200행, 휘도는 WCAG 식, 막 합성은 `HEADER_SCRIM_STOPS` 의 구간 선형 알파를 night-900 색으로, 글자색은 `src/styles/tokens.css` 의 gray-50). 제한 시간 30초.
    - `node --test scripts/e2e/lib.test.mjs` 와 `npx vitest run test/unit/scenes.test.ts test/unit/backdropContrast.test.ts` 가 지금은 실패해야 한다(함수·상수·표가 없다). 실패 이유가 의도한 것인지 확인하고 커밋한다.

    나. GREEN — `feat(unr): E2E 헤더 대비·배경 장면·낮 시작 문구 규칙 (결정 0030)` 으로 커밋한다.
    - `scripts/e2e/lib.mjs`: 상수·`relLuminance`·`headerContrastChecks`·`backdropSceneChecks`·`EXPECTED_SCENE`(단계 → 장면 id 의 작은 표)·낮 문구를 받는 `sceneIntroChecks` 를 더한다. 기존 상수·허용 목록은 건드리지 않는다.
    - `scripts/e2e/browser.mjs`: `readHeaderContrast(page)` — (1) 제목·타이머 요소 사각형과 계산된 글자색을 읽고, (2) 임시 `<style>` 로 그 요소들의 `color: transparent !important; text-shadow: none !important` 를 걸고, (3) 머리 영역 `page.screenshot({ clip, scale: "css" })` 를 찍어 base64 로 페이지에 돌려보내 `createImageBitmap` + canvas `getImageData` 로 디코드하고(새 패키지·네이티브 모듈 없음) 요소 사각형 안 휘도의 p95 를 구하고, (4) 임시 스타일을 지우고 `{ items: [{ name, rect, color, bgLum }] }` 를 돌려준다(없으면 null). `readBackdropLayers(page)`(층마다 { scene, state, image }), `waitBackdropStable(page)`(`.mf-backdrop__art` 가 한 층이 되고 `.mf-sceneintro` 가 없어질 때까지, 상한 4초), `armIntroWatch(page)`·`readIntroWatch(page)`(MutationObserver 가 `.mf-sceneintro` 가 처음 보일 때의 글자·톤·pointerEvents·aria-hidden 을 `window` 에 남긴다 — 시간 경쟁 없이 N8 을 판정). 토큰·프레임은 싣지 않는다.
    - `scripts/e2e/flows.mjs`: (1) 상태 도우미 `stageChecks(ctx, flowId, state, phase)` — `waitBackdropStable` 뒤 B1 과 H1(대기실은 expectTimer 거짓, 나머지 참)을 기록하고, 측정 뒤 추적 단계가 `phase` 가 아니면 준비 실패(SetupError)로 한 번 다시 돈다. 대기실(첫 스냅숏 뒤)·토론·밤(N7 뒤)·아침·다음 낮에서 부른다. 아침은 5초뿐이라 `stageChecks` 를 `dayState` 보다 먼저(`settle` 직후, 크로스페이드가 끝난 뒤) 부른다. 마지막 검증 명령의 불변 가드(상수 줄이 안 바뀜)는 HEAD 에서도 통과하는 것이 정상이다. (2) 새 상태 `day-intro` 를 `morning` 다음, 역할 카드 상태 앞에 넣는다(경찰·시민·마피아·의사 흐름 네 개 모두): `armIntroWatch` → `skipTo(dayAnnounce)` → N8 기록 → 같은 시점의 `readStage` 를 `dayAnnounce` 항목으로 `ctx.dayStates` 에 더해(D7·D9·T1 이 함께 본다) → 3.5초 안에 `.mf-sceneintro` 가 DOM 에서 사라지는지 N9(`attempt` 사용). `grabLobbyStage` 를 `grabStageEntry(ctx, state)` 로 일반화해 재사용한다. `next-day` 는 그대로 claim(n ≥ 2)을 기다린다.
    - `package.json` 은 건드리지 않는다. 실행: `node --test scripts/e2e/lib.test.mjs`, `npx vitest run test/unit/scenes.test.ts test/unit/backdropContrast.test.ts`, `npm run typecheck`.

    다. 대비 보정(필요할 때만). 오프라인 테스트가 어떤 장면·폭에서 4.5 미만이면 임계값을 낮추지 말고 먼저 구역 좌표가 실제 요소(E2E H1 의 측정)와 맞는지 의심한다. 실제로 막이 모자라면 `HEADER_SCRIM_STOPS` 한 곳의 알파만 올린다(길이 150px 은 그대로, 후보: 60px 지점과 110px 지점을 .04~.08 씩). 바꾼 값은 결정 0030 과 HANDOFF 의 확인 필요 2 에 그대로 적는다. 시안 값(.66/.42/.18/0)이 이미 4.5 를 넘는다고 측정되면(계획 시점 계산은 3.5~4.1) 시안 값으로 되돌린다.

    라. 부분 로컬 E2E(커밋 전, 코드 변경 없음). dev 서버를 띄워 `npm run e2e -- --url http://localhost:5173 --only lobby` 와 `--only police5`, `--only doctor5` 를 돈다. H1·B1·N6~N9·T1·D7·D9 와 앞 과제의 K1·K4·W1 이 모두 통과해야 한다. 실패하면 완화하지 말고 원인(앱 결함 또는 새 측정 오류)을 고친다. H1 이 실제 렌더에서 4.5 미만이면 측정 숫자(장면·요소·p95·대비)를 SUMMARY 와 반환 메시지에 적고 다 → 보정을 따른다. 끝나면 dev 서버를 종료한다.
  </action>
  <verify>
    <automated>node --test scripts/e2e/lib.test.mjs && npx vitest run test/unit/scenes.test.ts test/unit/backdropContrast.test.ts && npm run typecheck && grep -c "headerContrastChecks" scripts/e2e/lib.mjs && grep -c "readHeaderContrast" scripts/e2e/browser.mjs && D=$(git diff 97ce655 -- scripts/e2e/lib.mjs) && test "$(printf '%s\n' "$D" | grep -cE '^[-+]export const (OVERLAP_EPS|ONE_LINE_FACTOR|FACE_RATIO|TAP_MIN|PANEL_H|TEXT_SIZE_ALLOW|DECORATIVE_ALLOW|TAP_ALLOW)')" = "0"</automated>
  </verify>
  <done>E2E 가 헤더 제목·타이머 글씨 대비(글씨를 감춘 스냅숏의 요소 뒤 픽셀 p95, ≥ 4.5)를 배경별로 재고, 배경 장면이 단계에 맞는지(B1)와 낮 시작 문구(N8·N9)와 낮 시작이 테이블·장면 상자를 움직이지 않는지(T1·D7·D9 에 dayAnnounce 포함)를 본다. 장면 그림 6장은 같은 기준의 오프라인 단위 테스트로도 닫혀 있고 기준 수치·허용 목록은 그대로다. 부분 로컬 E2E 가 통과한다. RED/GREEN 커밋쌍이 있다.</done>
</task>

<task type="auto">
  <name>과제 6: 결정 0030·UI-SPEC·HANDOFF → 전체 검증 → 배포 → 배포본 확인 → push (V-08·V-09)</name>
  <files>docs/decisions/0030-visual-bundle.md, docs/decisions/0024-test-room-bots.md, .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md, HANDOFF.md</files>
  <read_first>docs/decisions/0028-test-feedback-fixes.md (형식), docs/decisions/0029-background-set-v2.md, HANDOFF.md (맨 위 항목과 실기기 확인 목록, 135줄 근처 봇 이름 문장), .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md, design/screens/visual-v1/SPEC.md, scripts/prod-url.txt, wrangler.jsonc, .planning/quick/261025-qvx-test-feedback-fixes/261025-qvx-SUMMARY.md (SUMMARY 형식)</read_first>
  <precondition>과제 1~5 의 커밋이 모두 있고 `npx vitest run`·`node --test scripts/e2e/lib.test.mjs` 가 통과한다. 배포 단계에 들어가기 전 `npx wrangler whoami` 출력에 dhkim1522@naver.com 이 있고 `wrangler.jsonc` 의 name 이 minifia 이다 — 하나라도 아니면 배포하지 않고 멈춘다.</precondition>
  <action>
    가. 문서(`docs(unr): …` 한 커밋).
    - `docs/decisions/0030-visual-bundle.md` 를 쓴다(형식은 0028: 제목, 상태 채택, 날짜 2026-10-25, 배경, 결정, 결과). 배경: 17·18차 시안 승인(`design/screens/visual-v1/`)과 배경 에셋 v2(결정 0029), 서버 규칙·시간·와이어 불변(봇 이름 상수만 예외). 결정: (1) 발밑 원 전부와 이름표 반전 제거, 후광 값(안쪽 2px + 바깥 9px drop-shadow, 흰 = gray-50 / 진홍 = crimson-400, 색 규칙: 말하는 차례·밤에 고른 대상 흰, 마피아 동료·관전자의 모든 마피아 진홍, 내 표시는 이름표 테두리), 번짐 9px·한 화면 최대 3개·층 규칙 불변·이름표 위 겹침 알파 산술, E2E K1·K4. (2) '…' 말풍선(크기 48×26·꼬리 5·위 −26px 과 시안 −30 과 다른 이유, 대상 = 주장 차례 + 토론 빠른 메시지 3초, 이모티콘이 대신, 축소 모션 정지). (3) 방장 왕관은 대기실만(역할 배정 포함 게임 중 없음), E2E W1. (4) 배경: 장면 목록·단계→장면 규칙표(PHASE_SCENE, 4페이즈가 행을 더함)·WebP 7개와 용량 예산(실측 표·상한·합계)·프리로드(입구 약 99KB·게임 약 74KB)와 지연 로딩·캐시 규칙·헤더 막(시안 알파에서 .70/.58/.40/0 으로 올린 이유: 사용자 4.5:1 규칙에 시안 값은 타이머 구역 3.5~4.1:1)·옛 SVG 정리와 `design/backgrounds/A_cute` 보류 이유·set1 이 540×1170 이라는 사실. (5) 전환 연출: Day 화면 제거, dayAnnounce 는 서버 단계 그대로 테이블 장면 위 덮는 층, SceneIntro 한 부품(밤·낮, 2초, 재접속·처음 마운트 제외, `usePhaseArrival`), 크로스페이드 0.8초(새 그림 준비 뒤 시작), **해·달 처리 선택 B 와 A·C 의 장단·이유**(이미지에 이미 그려져 있고 위치가 다름 — 측정 표). (6) E2E: 새 규칙 H1(측정 방법: 글씨를 감춘 스냅숏의 요소 뒤 픽셀 p95)·B1·N8·N9·W1, 개정 K1·K4, 임계값·승인 완화 불변. (7) 봇 이름 5글자(8명판 5글자 이름표 최악 경우를 늘 시험). 결과: 되돌리기 비용(모두 화면 쪽; 막 값은 `HEADER_SCRIM_STOPS` 한 곳, 후광 값은 CSS 변수 두 개, 장면은 `scenes.ts` 한 곳), 사용자 확인이 필요한 기본값 목록(이 계획의 「확인 필요」 전부), 아티팩트 동기화 목록(화면설계서: 후광·말풍선·왕관 규칙, 배경 장면 6개와 전환, 낮·밤 시작 문구; 디자인 시스템: 후광 값·말풍선·장면 배경·헤더 막; 디자인 세션 몫).
    - `docs/decisions/0024-test-room-bots.md` 의 봇 이름 목록 문장을 새 5글자 목록으로 고치고 「(결정 0030)」 을 붙인다.
    - `03.1-UI-SPEC.md`: `grep -n "발밑\|링\|반전\|왕관\|말풍선\|\.mf-dt__spot\|\.mf-dt__turn\|Backdrop\|bg_game\|bg_entry\|낮 시작\|Day\b\|S-06\|K1\|K4\|N6\|N7\|Motion"` 로 관련 줄을 찾아 고친다 — 맨 위 개정 안내에 「결정 0030 개정」 문단을 더하고, B 절의 차례 링·배지·이름표 반전·내 링 문장을 후광·말풍선으로 바꾸고, 「이름표 층 순서」 표의 링 두 호 행을 후광 행(자리 안 그림의 filter, 바깥 값 불변)으로 바꾸고, 밝은 면·진홍 예약 문장(동료 링 → 동료 후광)과 시안 값 → 토큰 대응표의 링 행과 「말풍선 배지의 겹침」 절·숫자 검증표를 새 값(말풍선 −26px, 겹침 0, 후광 번짐 9px)으로, Component Inventory 의 DayTable·Backdrop 행과 Day 삭제·SceneIntro·`scenes.ts` 를 더하고, E 절의 「낮 시작 발표(Day)에서는 지금 위치」 문장을 고치고, E2E 표에 K1·K4 개정과 W1·H1·B1·N8·N9 행·T1 의 dayAnnounce 포함을 더하고, Motion 표의 차례 강조·밤 시작 문구 행을 후광·말풍선·장면 문구 행으로 바꾸고 배경 크로스페이드 행을 더하고, Color 의 `bg_game_day.svg`·`bg_game_night.svg` 언급을 장면 WebP 로 바꾸고, 확정된 결정에 F11(결정 0030)을, 확인 필요에 이 계획의 「확인 필요」를 옮기고, 참고 자료 표에 `design/screens/visual-v1/` 행들을 더하고, 아티팩트 동기화 목록을 갱신한다. 고친 뒤 같은 grep 으로 남은 옛 표현이 의도된 「폐기·대체됨」 표기뿐인지 확인한다. 승인 사본(`design/screens/`)은 고치지 않는다.
    - `HANDOFF.md`: 「현재 상태」 맨 위에 이번 quick 항목을 더한다(제목에 quick 261025-unr, 근거 결정 0030). 배포 결과 칸은 아래 마 단계에서 채운다. 3.1·qvx 항목의 발밑 링·이름표 반전·낮 시작 화면 언급을 「(unr 에서 대체)」 로 정리하고 135줄 근처 봇 이름 문장을 새 이름으로 고친다. 새 **실기기 확인 목록**: ① 후광 모양(흰·진홍, 캐릭터 윤곽을 따르는지, 이웃 이름표 위로 번지는 정도) ② '…' 말풍선(깜박임 속도·위치·이모티콘과 겹치지 않는지) ③ 배경 전환 속도(0.8초가 적당한지)와 처음 로드가 느린 망에서 어색하지 않은지 ④ 아침·낮(set1)과 밤·해질녘(set2)의 하늘 색 차이가 크로스페이드 때 튀지 않는지(어색하면 낮 하늘 색만 남색 쪽으로 보정, README 권고) ⑤ 이름표 5글자 경계(봇·방장 이름이 모두 5글자라 늘 시험됨, 칼날 경계 −0.5, 걸리면 이름표 여유 49 → 50) ⑥ 낮·밤 시작 문구 가독성과 2초 길이 ⑦ 헤더 막(알파 상향)이 아침·낮 하늘을 너무 가리지 않는지와 안내 줄(gray-300) 가독성 ⑧ 후광 성능(저사양 폰에서 끊기지 않는지) ⑨ 해가 떠오르는 움직임이 없어도 괜찮은지(확인 필요 1: 이미지에 맡김) ⑩ 대기실 → 낮 첫 전환(lobby → day 크로스페이드)과 재접속 시 문구·전환이 없는지. 아티팩트 동기화 목록(결정 0030 결과 절과 같은 내용), 새 스크립트 `npm run backdrops`(원본이 바뀌면 다시 돌린다)를 환경 메모에 적는다. `CLAUDE.md` 는 고치지 않는다.
    - 커밋 메시지 예: `docs(unr): 결정 0030 과 UI-SPEC·HANDOFF 를 시각 개선 묶음에 맞춘다`.

    나. 로컬 전체 검증(코드 변경 없음, 실패하면 원인을 고치고 해당 과제 방식으로 커밋).
    - `npm run typecheck`, `npx vitest run`(전체), `node --test scripts/e2e/lib.test.mjs` 가 모두 통과해야 한다. E2E 불변 상수 테스트(OVERLAP_EPS 0.5·ONE_LINE_FACTOR 1.6·FACE_RATIO 0.45·TAP_MIN 44·PANEL_H 157)와 TEXT_SIZE_ALLOW(.mf-journal__new·.mf-tt* 뿐) 테스트가 통과하는지 눈으로 확인하고 이 두 군데는 고치지 않는다. `git diff 97ce655 -- scripts/e2e/lib.mjs` 에서 `DECORATIVE_ALLOW`·`TAP_ALLOW`·`TEXT_SIZE_ALLOW` 와 상수 줄이 바뀌지 않았는지 확인한다.
    - 서버 불변: `git diff --name-only 97ce655 -- shared worker` 가 `shared/game/bots.ts` 한 줄뿐이어야 한다.
    - `npm run build` 를 돌려 `dist/` 에 WebP 일곱 개가 들어갔고 SVG 가 없으며 합계가 260KB 이하인지 `ls -l dist/backgrounds` 로 확인한다(`dist/` 는 git 에서 무시된다).
    - 로컬 E2E: `lsof -i :5173` 로 포트가 비었는지 확인하고 `npm run dev` 를 백그라운드로 띄워 응답을 기다린 뒤 `npm run e2e -- --url http://localhost:5173` 를 돌린다. 마지막 줄이 `E2E OK` 여야 한다(흐름 여섯 × 크기 셋, 새 규칙 K1·K4·W1·H1·B1·N6~N9 포함, D7·D9·T1 이 대기실·배정·낮 시작까지 포함). 준비 실패(`S4 단계 도달` 같은 SetupError 한 건)로 FAIL 이 나면 같은 명령을 한 번 다시 돌려도 되지만(직전 계획에서도 한 번 있었다) **검사 실패는 완화하지 말고 원인을 고친다**. D3a/D3b·D2·G2 가 5글자 이름표 때문에 실패하면 바닥·임계값을 낮추지 말고 멈춰 측정 숫자를 보고한다. 끝나면 dev 서버를 종료한다.
    - 사진 확인(`--shots`): dev 서버에서 `npm run e2e -- --url http://localhost:5173 --only mafia8 --sizes 390x664,360x640 --shots` 를 돌리고 `scripts/e2e/out/` 의 PNG 를 직접 열어 본다(이미지는 사람 눈이 아니라 내가 연 기록이다): 대기실 왕관, 역할 배정, 낮 차례의 흰 후광·'…' 말풍선, 밤 마피아의 진홍 후광 + 흰 후광(내 선택), 아침·낮 헤더 막과 밤 배경, 8명판 5글자 이름표가 폰 가장자리에 걸리는지. 눈에 띄는 문제는 SUMMARY·HANDOFF 에 사실만 적는다(고치기 전에 사용자 확인이 필요한 디자인 판단이면 확인 필요로).

    라. 배포본 확인: `node scripts/smoke.mjs --prod --stage full --players 4`, `--players 5 --previous-version V`, `--players 8` 이 모두 `SMOKE OK full` 이어야 한다(새 WebP 헤더·크기 검사 포함). 봇 UAT: `node scripts/uat-test-bots.mjs --prod --previous-version V`(`UAT TEST-BOTS OK`)와 `node scripts/uat-test-room.mjs --prod --previous-version V`, 그리고 `node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev` 마지막 줄이 `E2E OK` 여야 한다. 실패하면 로컬로 되돌려 원인을 고치고 다시 배포한다(준비 실패 한 건은 같은 명령 재시도 가능, 검사 실패는 불가).
    마. 마무리: `HANDOFF.md` 의 이번 항목에 새 배포 버전(스모크 출력의 version)·게이트 결과(vitest 파일/테스트 수, e2e 흐름/크기 통과, 스모크 3종 도착 편차, UAT)·실측 WebP 크기 표를 채우고 `docs(unr): 배포 결과와 인계를 갱신한다` 로 커밋한다. `git status` 로 추적 안 된 `.planning/milestone.lock` 외 불필요한 파일이 없는지, `git remote -v` 가 개인 원격(git@github.com:dhkim1522/minifia.git)인지 확인한 뒤 `git push origin main` 한다. 이 계획의 `261025-unr-SUMMARY.md`(형식은 qvx 의 SUMMARY — 완료한 과제 표와 커밋, 실측 크기, 측정 숫자, 확인 필요 결과, 배포·확인 표, 사진 확인)를 쓰고 함께 커밋·push 한다.
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run && node --test scripts/e2e/lib.test.mjs && test -f docs/decisions/0030-visual-bundle.md && test "$(git diff --name-only 97ce655 -- shared worker)" = "shared/game/bots.ts"</automated>
  </verify>
  <done>결정 0030·UI-SPEC·HANDOFF(실기기 확인 목록·아티팩트 동기화 포함)가 갱신됐고, 로컬 `npm run e2e -- --url http://localhost:5173` 와 배포본 `node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev` 가 모두 E2E OK, 배포본 smoke full 4·5·8명이 모두 SMOKE OK(WebP 헤더 검사 포함), 봇 UAT 가 통과한다. Worker minifia 만 개인 계정(dhkim1522@naver.com)으로 배포됐고 모든 커밋이 개인 원격 main 에 push 됐다.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 서버 view → 화면 | 화면은 받은 값만 그린다. 새 화면 요소(후광·말풍선·SceneIntro·dayAnnounce 의 테이블)는 역할 정보를 입력으로 받지 않는다. 동료 표시는 서버가 마피아에게만 보낸 me.allies(관전자는 spectate)에서 화면이 만든 값이다 |
| 공용 부품(DayTable) 입력 | 낮 시작 발표(dayAnnounce)가 이제 테이블을 그린다. 입력은 공개된 좌석·닉네임·연결·방장과 서버가 그 사람에게만 준 동료 표시뿐이다 |
| 배경 에셋 → 사용자 기기 | 새 WebP 7개가 정적 에셋으로 서빙된다. 파일 교체·누락·용량 폭증이 화면과 데이터 사용량에 영향 |
| 개발 PC → Cloudflare 계정 | `npm run deploy` 가 어느 계정·어느 Worker 에 올리는지 |
| 개발 PC → git 원격 | push 대상이 개인 원격이어야 한다 |
| E2E 실행기 → 배포본 | 테스트 방만 만들고 토큰은 출력하지 않는다. 새 측정 코드(스냅숏 디코드)는 페이지 안에서만 돈다 |

## STRIDE Threat Register

Threat IDs 는 이 quick 안에서만 고유하다(`T-unr-NN`). `T-unr-SC` 는 예약이며 모든 계획이 가진다.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-unr-01 | Information Disclosure | dayAnnounce 가 DayScene(테이블)이 되면서 마크업이 역할에 따라 달라질 수 있음 | medium | mitigate | 경찰·의사·시민·역할 없음 view 의 dayAnnounce html 이 같고 마피아 view 만 동료 후광·마름모가 더 있다는 단위 테스트(sceneIntro.test.tsx·phaseScreens.test.tsx). SceneIntro 문구는 일차 n 만 읽고 역할 4종·탈락자가 같은 글자. 프리로드 목록(rolePreloadList)은 역할과 무관하게 같다(assets.test.ts) |
| T-unr-02 | Denial of Service | SceneIntro(밤·낮 2초 문구)가 터치를 가림 | medium | mitigate | `pointer-events: none`(CSS 테스트) + E2E 밤 상태의 N5(모든 대상 자리 탭 가능)·N2/N3 이 문구가 떠 있을 때도 통과 + N6·N8 이 pointer-events 확인 + N7·N9 가 사라짐 확인. z-index 40 < [테스트] 닻·토스트 50 |
| T-unr-03 | Denial of Service | 후광 filter 비용·한 화면의 후광 수 | medium | mitigate | 그림 한 장(72×96)에 drop-shadow 두 겹, 값은 애니메이션하지 않고 transition 180ms 뿐(축소 모션은 전역 규칙이 끔), 한 화면 최대 3개를 단위 테스트(HALO_MAX_SIMULTANEOUS)와 E2E K4 가 확인. 실기기 확인 목록에 저사양 폰 성능 |
| T-unr-04 | Tampering | 배경 WebP 누락·손상·용량 폭증, 옛 SVG 참조 잔존 | medium | mitigate | scenes.test.ts: 파일 일곱 개·RIFF/WEBP 머리·장면별 상한·합계 ≤ 260KB·SVG 없음, `make-backdrops.mjs` 가 상한 초과면 실패, 옛 SVG 참조 grep 0 건, smoke 가 배포본에서 image/webp·max-age=86400·용량 상한 확인, E2E G5 가 실패한 요청을 잡는다 |
| T-unr-06 | Tampering | 잘못된 원격으로 push | medium | mitigate | `git remote -v` 가 git@github.com:dhkim1522/minifia.git 인지 확인 후 push. `gh auth setup-git`·`~/.gitconfig` 변경 금지. `.planning/milestone.lock` 은 커밋하지 않는다 |
| T-unr-07 | Information Disclosure | E2E 새 측정 코드(헤더 대비 스냅숏, 관찰자) | low | mitigate | 스냅숏은 머리 영역 픽셀을 페이지 안에서만 디코드하고 계산된 값·글자만 Node 로 돌려보낸다. 토큰·프레임 원문을 싣지 않고 출력은 기존 redact 경로만 쓴다 |
| T-unr-08 | Denial of Service | 아침·낮 하늘 위 헤더 글씨가 읽히지 않음(접근성) | medium | mitigate | 헤더 막(HEADER_SCRIM_STOPS)과 4.5:1 규칙을 E2E H1(렌더 결과)과 오프라인 단위 테스트(그림 6장 × 폰 3 폭)가 이중으로 지킨다. 안내 줄(gray-300)은 대상 밖이라 확인 필요 5 와 실기기 목록에 남긴다 |
| T-unr-09 | Repudiation | 이름표 반전 제거로 토론 중 '누가 방금 말했는지' 표시가 약해짐 | low | accept | 같은 사람이 빠른 메시지를 보내면 머리 위 '…' 말풍선 3초가 대신하고 채팅 줄은 그대로다(확인 필요 3). 실기기 확인 목록에 말풍선 |
| T-unr-SC | Tampering | npm/pip/cargo installs | high | accept | 이 계획은 패키지를 설치·추가하지 않는다(package.json 은 scripts 한 줄만, lock 불변). `sharp` 는 이미 devDependency(make-og.mjs 가 사용)다. 설치가 필요해지면 멈추고 보고한다 |
</threat_model>

<verification>
- `npm run typecheck`, `npx vitest run`(전체), `node --test scripts/e2e/lib.test.mjs` 통과
- 서버 불변: `git diff --name-only 97ce655 -- shared worker` 가 `shared/game/bots.ts` 한 줄뿐(봇 이름 상수)이다. 단계 길이·와이어·좌석 번호·낮 차례 순서 불변
- 발밑 원·이름표 반전·옛 배지 잔재 없음: `! grep -rnE "mf-dt__(spot|ring|sel|turn)|tag--(turn|spoke)" src`
- 옛 낮 시작 화면·옛 배경 형식 잔재 없음: `test ! -e src/screens/Day.tsx`, `! grep -rnE "mf-day__|mf-nightintro|NightIntro" src scripts/e2e`, `ls public/backgrounds` 가 WebP 일곱 개뿐, `! grep -rnE "backgrounds/bg_[a-z_]+\.svg" src test scripts`
- 용량: 장면 하나 ≤ 상한(set2 48KB·set1 24KB·entry 64KB), 합계 ≤ 260KB(`test/unit/scenes.test.ts`), `npm run build` 의 `dist/backgrounds` 도 같다
- 헤더 대비: 오프라인 `test/unit/backdropContrast.test.ts`(그림 6장 × 360·390·430) 와 E2E H1 이 모두 4.5 이상
- E2E 불변: `git diff 97ce655 -- scripts/e2e/lib.mjs` 에서 OVERLAP_EPS·ONE_LINE_FACTOR·FACE_RATIO·TAP_MIN·PANEL_H·TEXT_SIZE_ALLOW·DECORATIVE_ALLOW·TAP_ALLOW 줄이 바뀌지 않았다
- 로컬 `npm run e2e -- --url http://localhost:5173` → `E2E OK` (K1·K4·W1·H1·B1·N6~N9 포함, D7·D9·T1 이 대기실·배정·낮 시작·낮·밤·아침 포함)
- 배포본 `node scripts/smoke.mjs --prod --stage full` 4·5·8명 모두 `SMOKE OK full`(WebP 헤더·크기 검사 포함), 봇 UAT 통과, `node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev` → `E2E OK`
- `git log` 에 과제 1(봇 이름 커밋 + RED + GREEN)·2~5(각 RED → GREEN)·6(문서·인계 커밋)이 순서대로 보이고, 마지막에 push 된다
</verification>

<success_criteria>
- 사용자 지시 V-01~V-09 가 모두 구현되고, 금지된 변경(서버 규칙·시간·와이어, 서버 좌석 번호, 낮 차례 순서, 승인 시안 사본 수정, 새 패키지 설치)이 없다
- 모든 화면에서 발밑 원이 없고 후광·'…' 말풍선·대기실만 왕관이 보이며, 층 규칙(이름표 1~11·캐릭터 12~22·어둡게 30·유령 31·이모티콘 60+)과 D3a·D3b·D9 가 그대로 통과한다
- 배경은 장면 목록과 단계→장면 규칙표로 정해지고, 낮 시작 전용 화면 없이 테이블 장면 위에서 0.8초 크로스페이드되며, 4페이즈의 해질녘 투표·처형이 표에 행을 더해 끼울 수 있다
- E2E 기준 수치와 허용 목록은 낮아지지 않았고 승인 완화 M1·D3a/D3b·D4 외 완화가 없다. 헤더 글씨 대비는 모든 배경에서 4.5:1 이상으로 측정된다
- 로컬과 배포본에서 모든 자동 검사가 통과하고, 결정 0030·HANDOFF·UI-SPEC 이 현재 상태와 일치한다
- 실기기 확인 목록(후광 모양·말풍선·배경 전환 속도·색 차이·이름표 5자 경계 외)과 아티팩트 동기화 목록, 사용자 확인이 필요한 기본값(확인 필요)이 HANDOFF 와 결정 0030 에 남아 다음 세션이 이어서 확인할 수 있다
</success_criteria>

## 확인 필요 (사용자 확인이 필요한 새 결정 — 모두 기본값으로 진행한다)

1. **해·달 움직임.** 이미지에 이미 그려진 해·달에 맡기고(이중 표시 불가능, 최소 위험) 따로 움직이지 않는다. 연속적으로 '떠오르는' 해는 없다. 필요하면 해·달을 뺀 하늘과 해·달 PNG 를 데스크톱에서 받아 A 안(SVG 이동)으로 간다. 참고: 낮 해(755, 255)가 아침 해(841, 198)보다 아래·왼쪽에 그려져 있다.
2. **헤더 막 알파.** 시안 .66/.42/.18/0 → .70/.58/.40/0(150px 그대로). 사용자 규칙 4.5:1 에 시안 값은 타이머 구역이 3.5~4.1:1 로 못 미친다. 시안 값을 지키려면 H1 의 타이머 대상을 빼야 한다.
3. **토론 빠른 메시지(spoke 3초).** 이름표 반전이 없어지므로 머리 위 '…' 말풍선만(후광 없음)으로 바꾼다. 시안 Z4·Z5 는 주장 차례만 그렸다.
4. **방장 왕관.** 역할 배정에서도 없앤다(대기실만 유지, 사용자 문장 그대로).
5. **안내 줄(gray-300) 대비.** 아침·낮 하늘 위에서 막을 포함해도 약 3:1 이다(사용자 지정 대상은 제목·타이머뿐). 재지 않고 실기기 목록에 둔다. 필요하면 안내 색을 gray-100 으로.
6. **`design/backgrounds/A_cute` 보류.** 결정 0029-5 는 정리를 말하지만 CLAUDE.md 문서 지도가 그 폴더를 가리키고 이번 작업은 CLAUDE.md 를 고칠 수 없다. `public/backgrounds` 의 옛 SVG 만 지운다(원본 동일 확인).
7. **말풍선 위 −26px**(시안 −30). 8명판 이웃 얼굴 4.1px 겹침을 없애는 값이다.
8. **낮 시작 문구의 보조줄 `토론 전에 먼저 직업을 공개해요` 유지**, 낮 톤 막 중앙 불투명도 70%(밤 85%)와 헤더 `낮`·`N일차`·2초 타이머 표시는 디자인 재량이다(사용자가 실기기에서 보고 바꾸라 하면 값만 고친다).
9. **이미지 준비를 기다린 뒤 크로스페이드 시작**(상한 1.2초)과 후광 transition 180ms 는 구현 재량이다.

## 실행기 패스 경계 권고 (추정: 6과제, 약 630,000 토큰, 신뢰도 낮음 — 보정 표본 0)

| 패스 | 범위 | 예상 | 경계 이유 |
|------|------|------|-----------|
| A | 과제 1 (봇 이름 커밋 + 후광·말풍선·왕관, RED→GREEN) | 약 130k | 큰 테스트 파일(dayTable 1000줄)을 여러 개 고친다. 끝에서 vitest·typecheck 초록 |
| B | 과제 2 (E2E K1·K4·W1 + 부분 로컬 E2E) → 이어서 과제 3 (배경 장면·WebP·Backdrop) | 약 60k + 120k | 과제 2 끝에서 끊어도 된다(앱 초록, 5글자 8명판 확인이 이미 끝남). 과제 3 은 WebP 생성·삭제가 있어 한 번에 |
| C | 과제 4 (낮 시작 화면 제거·SceneIntro·크로스페이드 연결) | 약 120k | phaseScreens 테스트 대량 이전과 RoomScreen·DayScene 변경 |
| D | 과제 5 (E2E H1·B1·N8·N9 + 오프라인 대비) | 약 100k | 측정 코드와 flows 상태 추가, 대비 보정 가능성 |
| E | 과제 6 (문서 → 전체 검증 → 배포 → 배포본 확인 → push) | 약 100k | E2E 실행 시간이 길고 배포·계정 확인이 있어 코드 작업과 분리 |

각 패스는 시작할 때 `git status --short` 와 직전 커밋을 확인한다. 어떤 과제든 RED 커밋이 GREEN 보다 앞서야 하고, 패스 사이에 앱은 typecheck·vitest·`node --test scripts/e2e/lib.test.mjs` 가 초록이다(라이브 E2E 는 과제 2·4·5·6 에서 부분/전체로 돈다).

<output>
Create `.planning/quick/261025-unr-visual-bundle/261025-unr-SUMMARY.md` when done
</output>
