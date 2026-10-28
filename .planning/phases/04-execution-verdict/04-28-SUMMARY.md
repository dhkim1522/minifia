---
phase: 04-execution-verdict
plan: 28
subsystem: verdict-screens-state-table-css-gate
tags: [verdictStates, verdictViews, verdictCss, state-table, css-static-gate, reduced-motion, CONN-02, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-16~04-27 의 처형 구간 일곱 화면(execVote·candidateVote·candidateVoteReveal·defense·execution·ended·처형 무효 밤), verdict.css·result.css, 04-18 의 후광 상한 capHalos"
provides:
  - "test/helpers/verdictViews.ts — 단계(7) × 보는 사람(6) × 인원(4·8) 으로 RoomView 와 연결 모킹 값을 만드는 테스트 전용 도우미(`verdictFixture`·`previousView`·`viewAt`·`overOf`). 서버 규칙 흉내 없이 필드만 채우고, 닉네임은 모두 5글자, 투표 줄은 고정 배열"
  - "test/client/verdictStates.test.tsx — `describe.each` 표 시험 92건: RoomScreen 한 경로에서 모든 칸이 `연결 중…` 이 아니고, 테이블 안 찬성/반대 글자 없음(D-02), 살아 있는 칸에 직업 그림 없음(D-09), 후광 3개 이하, 콘솔 오류·경고 0, 이름표·결과 카드 수 = 인원. 보는 사람별: 관전 입력 0·읽기 전용 줄, 내 연결 끊김 모든 입력 disabled, 남의 끊김 흐림·후보 선택 가능·변론 후보 끊김 문구, 마피아 동료 마름모, 재접속 연출 없음. 재접속 대조(같은 접속이면 연출이 켜진다)와 후보 본인 변론 칩 6개(끊기면 전부 disabled)"
  - "test/unit/verdictCss.test.ts — verdict.css·result.css 정적 게이트 39건(CSS 를 규칙 단위로 파싱): 글자 크기 14·16·24·36·굵기 400·700, 직접 색 값 없음·color-mix 모양, 진홍은 결과 배너·번짐·`마피아` 글자에만, z-index 허용 값, 헤더·패널 z 3, @keyframes 안 움직이는 속성, 모션 줄이기 분기, backdrop-filter 짝, transition: all 없음, 터치 통과 층의 pointer-events 가 모두 none, 찬성·반대·변론 칩 높이 44 이상"
  - "result.css 모션 줄이기 분기 — 연출 애니메이션(배너 팝·번짐·카드 뒤집기·요약 떠오름)과 전이를 끈다"
affects: [04-29~04-33 — E2E 는 폰 폭별 겹침을 본다(이 표는 레이아웃을 재지 못한다), 04-35 — 배포본 검증]

actuals:
  tokens: 9900
  tasks: 2
  commits: 3
plan_head_before: 08b93ac129a9b561105dfef936fdd1b700e44642
plan_head_after: 827949161f3e919573628ece1e2763108561d55c

tech-stack:
  added: []
  patterns:
    - "상태 조합은 단계별 시험에 흩어 두지 않고 도우미 + 표(describe.each)로 모든 칸에 같은 불변식을 건다. 어긋난 것을 한 줄씩 모아 `단계/상태/인원` 이름표와 함께 한 번에 단언한다"
    - "CSS 계약은 `readFileSync` + 얇은 규칙 파서(주석 제거 → 중괄호 깊이 분리)로 규칙 단위 단언. 파서 자체 점검과 비공허 점검(읽힌 규칙·키프레임 수)을 같이 둔다"

key-files:
  created:
    - test/helpers/verdictViews.ts
    - test/client/verdictStates.test.tsx
    - test/unit/verdictCss.test.ts
  modified:
    - src/styles/result.css

key-decisions:
  - "표 시험이 드러낸 화면 결함은 없었다. 84칸 모두 첫 실행에서 통과해 src/screens·src/components 는 건드리지 않았다. 시험이 의미 있는지는 변이로 확인했다(아래 검증)"
  - "z-index 허용 값은 UI-SPEC 12 의 {3,30,31,32,40,46,70} 이고 `.mf-figure--exec-out` 의 z-index 1 한 곳만 예외로 시험에 적었다. 좌석 한 칸 안에서 사람 층이 유령 층 위에 겹치는 순서이지 장면 층이 아니고, 지우면(DOM 순서 변경 필요) 처형 전환 연출이 바뀔 위험이 있어 CSS 는 그대로 뒀다"
  - "터치 통과는 `.mf-dt__dim--verdict` 와 `.mf-morningcard--amber/--scene` 에 한해 기본 클래스(daytable.css `.mf-dt__dim`, night.css `.mf-morningcard`)의 pointer-events: none 을 상속으로 인정한다. 한 선택자에 pointer-events 규칙이 여럿이면 전부 none 이어야 통과한다(나중 규칙이 되살리는 회귀를 막는다)"

requirements-completed: []  # CONN-02·VOTE·END 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "처형 구간 7개 화면 × 보는 사람 6 상태 × 4·8명 전부에서 `연결 중…` 이 아닌 화면이 나오고 개인 여부 표시·직업 노출·후광 4개 이상·콘솔 오류가 없다 (D-02, D-05, D-09, D-35, D-36)"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "verdictStates.test.tsx(84칸 표 + 재접속 대조 3건 + 후보 본인 변론 칩 4건 + 도우미 1건 = 92건 통과). 변이 확인: 후광 상한 제거(capHalos 상한 99)로 관전·동료 8명 칸 6건이 후광 개수로 실패, 투표/이모티콘 disabled 제거로 내 연결 끊김 칸 4건이 실패해 시험이 실제로 잡음을 확인한 뒤 되돌렸다"
        status: pass
    human_judgment: false
  - id: C2
    description: "연결이 끊긴 사람은 투표 화면에서 기존 흐림으로 보이고 내 연결이 끊겨 보낼 수 없으면 모든 입력이 꺼진다(찬성·반대, 후보 선택 좌석, 이모티콘, 후보 본인 변론 칩 6개). 남이 끊긴 자리는 흐리게 보이지만 후보 선택에서 여전히 고를 수 있고, 변론 후보가 끊기면 상태 줄이 끊김 문구다 (CONN-02, D-36, D-05)"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "verdictStates.test.tsx(execVote·candidateVote·defense × selfOffline/otherOffline, 후보 본인 변론 칩 disabled/enabled)"
        status: pass
    human_judgment: false
  - id: C3
    description: "새 CSS(verdict.css·result.css)는 정적 시험이 지킨다: 글자 크기 14·16·24·36, 직접 색 값 없음, 진홍은 결과 화면 팀 표시에만, z-index 는 UI-SPEC 12 의 값만, 크기·위치 키프레임 애니메이션 없음, 터치 통과 층은 pointer-events none, 모션 줄이기 분기 존재 (UI-SPEC 4·5·6·12)"
    requirement: "CONN-02"
    verification:
      - kind: unit
        ref: "verdictCss.test.ts 39건 통과. 변이 확인: 25px 글자·#fff·rgba·진홍 참조·z-index 99·transition: all·top 키프레임·pointer-events: auto·backdrop-filter 짝 없음·높이 30px 를 verdict.css 에 일부러 넣으면 10건이 실패했고(터치 통과는 시험 강화 뒤 재확인) 되돌렸다"
        status: pass
    human_judgment: false
  - id: C4
    description: "실제 폰 폭(360·390·430)에서 겹침, 8명 판 후보 이름표 배치와 칩 위치의 시각적 확인, 실기기 모션"
    requirement: "CONN-02"
    verification:
      - kind: manual_procedural
        ref: "이 표는 DOM 에서 레이아웃을 재지 못한다. 8명 칸은 칩 위치·후보 이름표 배치가 예외 없이 그려지는 것(이름표 수, 콘솔 오류 0)까지만 본다. 폰 폭별 겹침은 E2E(04-29~04-33), 실기기는 04-35 배포본에서 한다. 이 계획은 브라우저로 화면을 직접 열어 보지 않았다(CSS 는 모션 줄이기 분기 추가뿐)"
        status: not_run
    human_judgment: true
---

# Phase 4 Plan 28: 단계 × 보는 사람 상태 표 시험과 새 CSS 정적 게이트 Summary

**처형 구간 화면 일곱을 보는 사람 상태 여섯 × 4·8명 84칸에 한 표로 걸어 `연결 중…`·익명·직업 비노출·후광 상한·연결 규칙을 고정하고(결함 없음), verdict.css·result.css 의 글자·색·진홍·층·모션·터치 통과 계약을 CSS 파서 기반 정적 시험으로 고정했다. 시험이 result.css 의 모션 줄이기 분기 누락을 잡아 고쳤다.**

## 한 일

**Task 1 — 단계 × 보는 사람 상태 표 시험** — 시험만 추가 `7ee38a7`
- `test/helpers/verdictViews.ts`: 서버 view 모양만 만든다(규칙 흉내 없음). 후보는 1번 자리, 8명 판은 7번이 이미 탈락, 처형·종료에서는 후보도 탈락, 마피아 동료는 4명 판 `[2]`·8명 판 `[2,5,6]`(후광 상한이 실제로 걸리는 조합). 후보 선택 중 마피아 동료가 동료 아닌 사람을 골라 둬 흰 후광 + 진홍 후광 3개가 겹치게 했다. 재접속은 직전 단계(epoch 1) 마운트 뒤 이 단계(epoch 2)로 넘어온 렌더로 그린다.
- `test/client/verdictStates.test.tsx`: 계획 behavior 의 모든 항목. 공개 단계는 시간표를 2초 돌려 칩·화살표·후광이 실제로 그려진 상태에서 검사한다. 재접속 대조(같은 접속의 같은 전환에서는 인트로 카드·무효 카드·결과 연출이 켜진다)를 두어 재접속 칸의 "없음"이 공허하지 않게 했다. 후보 본인 변론 칩 6개는 별도 칸(끊기면 전부 disabled, 멀쩡하면 전부 enabled, 직업 그림 없음).
- 결과: 84칸이 첫 실행에서 통과해 화면 코드에 결함이 없었다. TDD 의 RED 는 없었다(이 계획은 결함 탐지 시험이고 드러난 결함이 없었다).
- 시험 작성 중 오류 하나: `rerender` 에 같은 요소 객체를 재사용해 React 가 다시 그리지 않아 재접속 칸과 대조 4건이 실패했다. 요소를 렌더마다 새로 만들도록 시험을 고쳤다(화면 결함 아님).

**Task 2 — 새 CSS 정적 게이트** — RED `bf93f1d` → GREEN `8279491`
- `test/unit/verdictCss.test.ts`: 주석 제거 → 중괄호 깊이 분리의 얇은 파서(자기 점검과 비공허 점검 포함) 위에서 글자·색·진홍·z-index·키프레임·모션 줄이기·backdrop-filter 짝·터치 통과·탭 대상 높이를 단언.
- RED: result.css 에 `@media (prefers-reduced-motion: reduce)` 분기가 없어 2건 실패.
- GREEN: result.css 끝에 모션 줄이기 분기를 추가했다 — 배너 팝·번짐 페이드인·카드 뒤집기·요약 떠오름 애니메이션과 그림·직업·탈락 전이를 끈다. 연출 여부는 마운트 때 JS(`data-reveal`)가 한 번 정하므로 마운트 뒤 설정이 바뀌어도 움직임이 곧 멈추도록 CSS 가 같은 쪽으로 끈다. 보이는 최종 상태나 디자인 값은 바뀌지 않는다.
- GREEN 커밋에서 터치 통과 시험을 한 단계 강화했다(변이 확인에서 `pointer-events: auto` 를 뒤에 덧붙여도 앞 규칙의 none 때문에 통과하는 약점을 발견): 그 선택자의 pointer-events 규칙이 하나 이상이고 모두 none 이어야 한다.

## 검증

- 게이트: `npm test` 102 파일 2765 통과, `npm run typecheck`(토큰 점검·wrangler types·tsc 둘) 종료 코드 0, `npm run build` 성공. 배포하지 않았다.
- 변이 확인(시험이 실제로 잡는지): 후광 상한 제거, 투표·이모티콘 버튼 disabled 제거, CSS 위반 일괄 주입을 각각 일부러 넣어 실패를 본 뒤 `git checkout`/복사로 되돌렸다(작업 트리에 변이가 남지 않음을 `git status` 로 확인).
- 확인하지 못한 것: 폰 폭(360·390·430)별 겹침과 8명 판 이름표·칩의 실제 배치(DOM 시험은 레이아웃을 못 잰다), 실기기 모션·iOS Safari, 브라우저로 화면을 직접 연 확인(이 계획에서는 하지 않았다 — 변경된 CSS 는 모션 줄이기 분기 한 블록).

## Deviations from Plan

None - plan executed exactly as written. 다음은 편차가 아닌 판단 기록이다.

- 표가 드러낸 결함이 없어 계획 Task 1 (3) 의 "고친 곳" 은 없다. 고친 곳은 Task 2 의 result.css 모션 줄이기 분기 하나다.
- `.mf-figure--exec-out` 의 `z-index: 1`(좌석 안 사람/유령 층 순서)은 계획의 "UI-SPEC 12 의 값만" 에서 벗어나지만 장면 층이 아니라 한 좌석 박스 안의 겹침 순서라 시험에 한 곳 예외로 적었다(위 key-decisions). 값을 없애려면 DayTable `ExecutedFigures` 의 DOM 순서를 바꿔야 하는데 처형 전환 연출을 눈으로 확인할 수 없어 하지 않았다.
- 터치 통과의 `.mf-dt__dim--verdict`·`.mf-morningcard--*` 는 두 CSS 파일 밖(daytable.css·night.css)의 기본 클래스 규칙을 상속으로 인정한다. 계획은 두 파일만 읽도록 적었으나 그 요소들의 pointer-events 는 기본 클래스에 있다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-68(특정 보는 사람 상태에서만 새는 직업·개인 표)은 표 시험이 모든 조합에서 `/characters/roles/` 부재(살아 있는 칸)와 `.mf-dt` 안 찬성/반대 글자 부재를 단언해 mitigate, 관전 칸은 같은 탐지기가 직업 그림을 실제로 찾는지 점검한다. T-04-69(진홍 번짐)는 정적 시험이 verdict.css 의 진홍 참조 0과 result.css 의 진홍을 배너 띠·제목·번짐·`마피아` 글자에만 허용해 mitigate. 새 패키지 설치 없음(T-04-SC).

## Self-Check: PASSED

- 파일: test/helpers/verdictViews.ts, test/client/verdictStates.test.tsx, test/unit/verdictCss.test.ts, src/styles/result.css — 존재 확인
- 커밋: 7ee38a7, bf93f1d, 8279491 — `HEAD` 의 조상 확인
