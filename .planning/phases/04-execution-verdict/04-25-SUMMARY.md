---
phase: 04-execution-verdict
plan: 25
subsystem: verdict-screens-result
tags: [ResultScreen, result.css, ended, summaryLines, Backdrop-fromScene, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-13 verdict.ts(winnerText·summaryLines·endedSubtitle·VERDICT_TEXT·UNKNOWN_NAME), 04-14 PHASE_SCENE.ended = night, 04-24 usePhaseArrival 을 RoomScreen 에서 계산해 장면에 넘기는 방식(arrivedFrom)"
provides:
  - "ResultScreen — props {view(result 있는 ended), onExit, arrivedFrom?}. 헤더 바·타이머·하단 패널이 없는 세로 스크롤 본문 하나: 제목 `게임 종료`+부제(`{n}일차 밤|낮`) → 승리 배너(시민/마피아, data-winner) → 3열 직업 카드 격자(탈락은 그림 흐림+`탈락`, 마피아 글자만 마피아 클래스, 내 이름표 테두리) → `이번 판 기록` 요약 카드 → [처음으로]+`이 방은 30분 뒤에 닫혀요`. 직업은 result.seats 에서만 읽는다"
  - "result.css — 토큰 변수만, 글자 14·16·24·36, 진홍은 마피아 승 배너 띠·제목·위쪽 번짐(.mf-result__glow, 본문 밖 형제라 스크롤해도 고정)과 카드의 `마피아` 글자에만. 스크롤 본문 overflow-y auto·overflow-x hidden·overscroll-behavior contain"
  - "RoomScreen — case ended: result 가 있으면 ResultScreen(onExit(\"left\"), arrivedFrom), 없으면 connecting(). PHASE_ANNOUNCE.ended 는 result 가 있으면 winnerText 의 읽기 문구. 판이 끝나면 역할 카드·테스트 시트를 닫는 효과"
  - "Backdrop fromScene — 같은 접속에서 execution/morning → ended 로 오면 직전 장면(dusk·morning)에서 night 로 크로스페이드, 재접속·처음 마운트는 night 한 장"
affects: [04-26 — 공개 연출(neutral → flip → done)이 같은 파일·같은 arrivedFrom 위에 얹힌다(카드 neutral 인물은 figureSrc(seat) 로 이미 Figure 가 그릴 수 있다), 04-30 — E2E 에 결과 화면, 04-35 — 배포본 smoke 에서 ended 확인]

actuals:
  tokens: 9900
  tasks: 2
  commits: 5
plan_head_before: 7a7864440cb7ebc41c03e9c8d2212d444f5e1124
plan_head_after: 73c068057019527673b2e0e8e735bef6d62b5bcc

tech-stack:
  added: []
  patterns:
    - "결과(직업)를 받는 화면은 하나: src 전체를 읽는 grep 시험이 `result.seats` 를 읽는 소스가 ResultScreen 하나이고 src/components 에 GameResult 를 props 로 받는 파일이 없음을 단언한다(02-07 선례)"
    - "result 가 있음을 타입으로 보증: ResultScreenProps.view 는 `RoomView & { result: NonNullable<RoomView[\"result\"]> }` 라 RoomScreen 이 `view.result ?` 로 좁혀 넘기는 분기가 곧 `연결 중…` 폴백이다"
    - "happy-dom 은 레이아웃을 재지 못하므로 가로 스크롤·카드 폭은 CSS 정적 단언(overflow 규칙·repeat(3, minmax(0, 1fr))·폭 산식 99 ≤ 104 − 2)으로, 실제 scrollWidth 는 헤드리스 Chrome 으로 확인한다"

key-files:
  created:
    - src/screens/ResultScreen.tsx
    - src/styles/result.css
    - test/client/resultScreen.test.tsx
  modified:
    - src/screens/RoomScreen.tsx

key-decisions:
  - "결과 화면에 instant 를 두지 않았다: Backdrop 은 마운트 뒤 장면이 바뀌지 않아(ended 는 night 고정) 재접속에서 즉시 처리할 전환이 없다. 재접속은 arrivedFrom 이 null 이라 fromScene 도 없어 night 한 장이 바로 보인다"
  - "판이 끝나면 테스트 시트도 닫는다(계획에는 역할 카드 시트만): 시트가 열린 채 종료되면 모달이 [처음으로] 를 가려 누를 수 없음을 헤드리스 Chrome 에서 확인했다"

requirements-completed: []  # END-01·END-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "판이 끝나면(ended + result) 모든 viewer(살아 있던 사람·탈락자·끊겼다 돌아온 사람)가 같은 결과 화면을 본다: 제목 `게임 종료`, 승리 팀 배너와 한 줄 이유, 모든 사람의 직업 카드 격자(탈락자는 흐림 + `탈락`), `이번 판 기록`, [처음으로] (END-01, D-17)"
    requirement: "END-01"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(시민·마피아 배너 문구와 data-winner, 카드 data-seat·직업 그림 경로·이름표·ROLE_TEXT 이름, 마피아 클래스는 마피아 카드에만, 탈락 카드 흐림 클래스·`탈락`·산 카드엔 없음·연결 끊김 표시 없음, 내 이름표만 내 표시, 살아 있던·탈락(spectate)·끊긴·마피아 viewer 의 카드 집합·문구·읽기 안내 동일, 헤더 바·타이머·하단 패널·낮 테이블 없음)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 5·7, testBotVote exec=yes pick=other) + 헤드리스 Chrome(playwright-core, 390×844·360×640): 테스트 도구로 단계를 넘겨 실제 서버가 보낸 ended 프레임을 그림. 마피아 승(6명)·시민 승(8명) 둘 다 확인: h1 `게임 종료`, 부제 `2일차 밤`·`3일차 낮`, 배너 문구, 카드 6·8장(3열, 8명은 3·3·2), 탈락 카드에만 `탈락`, 마피아 글자만 진홍(crimsonEls = 띠·배너 제목·마피아 글자뿐), 요약 행이 서버 summary·voteLog 의 `(n표)` 와 일치, 읽기 안내 `게임이 끝났습니다. 마피아 팀 승리`, 헤더 바·타이머·패널 없음, 콘솔 오류 0. 스크린샷 육안 확인"
        status: pass
    human_judgment: true
  - id: C2
    description: "[처음으로] 를 누르면 방을 떠나 입장 정보를 지우고 처음 화면으로 간다. 같은 사람들로 다시 하기는 없다 (END-02, D-18)"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx([처음으로] 클릭 → onExit(\"left\") 정확히 1회, 보조 문구 `이 방은 30분 뒤에 닫혀요`, 테스트 방 방장도 [테스트]·[역할 카드] 없이 [처음으로] 만, 종료 때 열린 역할 카드·테스트 시트 닫힘)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome: [처음으로] 클릭 뒤 localStorage `minifia:session` 이 null, 화면이 처음 화면(`방 코드 / 참가 / 방 만들기`), .mf-result 사라짐. 새로고침(재접속)은 같은 방 ended 의 최종 화면을 다시 그리고 배경은 night 한 장"
        status: pass
    human_judgment: false
  - id: C3
    description: "결과 화면은 세로 스크롤 본문 하나이고 8명·긴 요약에서도 가로 스크롤 없이 [처음으로] 에 스크롤로 닿는다. 배경은 night 한 장으로 고정된다 (P-2)"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(8장 카드·요약 6행·[처음으로] 가 .mf-result 안, CSS 정적 단언: overflow-y auto·overflow-x hidden·overscroll-behavior contain, repeat(3, minmax(0, 1fr))·간격 8·min-width 0, 글자 14·16·24·36 만·# 색 없음·진홍은 banner/band/role--mafia/glow 규칙에만, 이름표 말줄임 없음·폭 99 ≤ 360 폰 카드 폭 104 − 2, 아래 여백 24 + 안전 영역, 글로우 position absolute, 요약 카드 규칙)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 360×640·8명: 본문 scrollWidth 360 = clientWidth 360(문서 가로 넘침 없음), scrollHeight 1092 > clientHeight 640, 맨 아래로 스크롤하면 [처음으로] 가 top 536~588(뷰포트 640 안)이고 elementFromPoint 가 버튼 자신(도달 가능). 카드 폭 104, 5글자 이름표가 카드 안(tagFits true), 계산된 글자 크기 {14,16,24,36}, 스크롤 방식 overflow-y auto·overscroll-behavior contain"
        status: pass
    human_judgment: false
  - id: C4
    description: "모든 사람의 직업은 result.seats[].job 에서만 읽고 ResultScreen 하나가 그 입력을 받는다. 다른 부품 props 에 결과·직업 필드가 없다 (D-17, D-09, T-04-64)"
    requirement: "END-01"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(src/components 전 파일에 GameResult·`result: GameResult` props 없음, src 전체에서 `result.seats` 를 읽는 소스가 src/screens/ResultScreen.tsx 하나)"
        status: pass
    human_judgment: false
  - id: C5
    description: "`ended` 인데 `result` 가 없는 프레임(옛 서버 등)이면 `연결 중…` 으로 폴백하고 읽기 안내는 `게임이 끝났습니다`"
    requirement: "END-01"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(result 없는 ended → `연결 중…`·.mf-result 없음·읽기 안내 `게임이 끝났습니다`, result 있으면 `게임이 끝났습니다. 시민|마피아 팀 승리`)"
        status: pass
    human_judgment: false
  - id: C6
    description: "판 요약 카드 `이번 판 기록`(일차 오름차순 낮 → 밤, UI-SPEC 7.2 문구 전부)과 부제, 닉네임·요약 문장의 마크업 비삽입 (D-27, T-04-65)"
    requirement: "END-01"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(`도현님 처형 (2표)`·`처형 없음 (찬성 1 · 반대 2)`·`처형 없음 (동률)`·`처형 없음 (던진 표 없음)`·`{이름}님 사망`·`…님을 노렸지만 의사가 지켰어요`·`아무 일도 없었어요`, 요약 행 없으면 카드·부제 없음, 부제 `{n}일차 밤|낮`, `<b>굵게</b>` 닉네임이 카드 이름표와 요약 문장 모두 평문)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome: 서버가 만든 summary·voteLog 로 그려진 요약 행 4~5줄(`1일차 낮 봇가나다라님 처형 (6표)`, `1일차 밤 … 사망`, `2일차 밤 검증방장님 사망` 등) 육안 확인. 처형 없음·의사가 지킴·지목 없음 문구는 실서버로 만들지 못해 단위 시험으로만 확인"
        status: partial
    human_judgment: false
  - id: C7
    description: "ended 로 올 때 배경이 직전 장면(dusk 또는 morning)에서 night 로 크로스페이드하고, 재접속·처음 마운트는 즉시 night 한 장이다"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(execution → ended 의 배경 층 {dusk, night}, morning → ended 의 층 {morning, night}, 처음 마운트·epoch 가 바뀐 재접속은 {night})"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome rAF 기록: 결과 화면 첫 프레임 층 `morning:leaving:1 / night:current:0`(마피아 승 판)과 `dusk:leaving:1 / night:current:0`(시민 승 판), 300ms 에 night .89~.90 → 600ms .99 → 약 900ms 에 night 한 장. 새로고침 뒤 층 `night:current` 하나"
        status: pass
    human_judgment: false
  - id: C8
    description: "실제 폰의 스크롤 감촉·iOS Safari 의 overscroll·safe-area 아래 여백, 마피아 승 위쪽 진홍 번짐의 보기 좋음, 카드 흐림(탈락) 가독성, 모션 줄이기 분기, 실제 서버에서 처형 없음·동률·지목 없음 줄이 나오는 판, 헤더 없는 화면에서 재접속 띠 위치"
    requirement: "END-02"
    verification:
      - kind: manual_procedural
        ref: "헤드리스 Chrome(데스크톱 렌더링)만 확인했다. 실기기·iOS·재접속 띠·모션 줄이기는 확인하지 못했다(이 계획은 공개 연출이 없어 모션 줄이기 분기가 없다 — 04-26 이 더한다). 04-35 배포본에서 한다"
        status: partial
    human_judgment: true
---

# Phase 4 Plan 25: 결과 화면 ResultScreen(최종 상태)과 ended 라우팅 Summary

**판이 끝나면(ended + result) 모든 viewer 가 같은 결과 화면을 본다. 헤더 바·타이머·하단 패널 없이 세로 스크롤 본문 하나에 승리 팀 배너, 모든 사람의 직업 카드 격자(탈락은 흐림 + `탈락`), 이번 판 기록, [처음으로] 가 있고, [처음으로] 는 입장 정보를 지우고 처음 화면으로 보낸다. 직업은 `result.seats` 에서 ResultScreen 하나만 읽고, result 없는 ended 프레임은 `연결 중…` 으로 안전하게 폴백한다.**

## 한 일

**Task 1 — 핵심 화면과 ended 라우팅** — RED `b3ef801` → GREEN `de34946`
- `ResultScreen.tsx`: `Backdrop layout="game" scene={sceneOfPhase("ended")}` 안의 `.mf-result`(스크롤 본문) 하나. 직업 카드 격자는 `result.seats` 를 자리 순으로 그리고 닉네임·탈락은 `view.players` 에서 자리 번호로 찾는다. 이름표는 낮 이름표와 같은 모양을 `.mf-result__tag` 로 따로 두었다(낮 이름표 CSS 는 DayTable 좌표에 묶여 있음). 마피아 승이면 위쪽 진홍 번짐을 본문 밖 형제(`.mf-result__glow`)로 둬 스크롤해도 움직이지 않는다.
- `result.css`: UI-SPEC 4 의 변환값(격자 간격 8, 세로 간격 16, 카드 안쪽 8·4, 아래 24 + 안전 영역)과 5 의 글자 4종만 쓴다.
- `RoomScreen.tsx`: `case "ended"` — result 가 있으면 ResultScreen, 없으면 `connecting()`. `PHASE_ANNOUNCE.ended` 는 result 가 있으면 `winnerText(...).announce`. 판이 끝나면 열린 역할 카드 시트를 닫는 효과.
- 시험: 위 coverage C1·C2·C4·C5 와 아래 grep 게이트.

**Task 2 — 판 요약·부제·배경 크로스페이드** — RED `00ccc90` → GREEN `5a03bce`
- `summaryLines(result.summary, view.day.voteLog, nicknameOf)` 로 요약 카드(행 key = 일차 + 낮/밤), `endedSubtitle` 로 부제. `arrivedFrom` 을 마운트 때 한 번 읽어 `fromScene` 으로 `Backdrop` 에 준다.
- 시험: 요약 문구 전부, 부제 두 갈래, 8명·요약 6행, CSS 정적 단언(스크롤·격자·폰트·진홍 허용 규칙·이름표 폭 산식), 배경 층(dusk·morning·재접속).

**고침 — 종료 때 테스트 시트 닫기** — `73c0680`
- 브라우저 검증에서 발견(아래 편차 1).

## 검증

- `npm test` 99 파일 2582 통과, `npm run typecheck`(tokens 검사·wrangler types·app·worker tsc) 오류 없음, `npm run build` 성공.
- 헤드리스 Chrome 실행 방법과 수치는 coverage C1~C3·C7 의 manual_procedural 에 적었다. 스크립트는 `scratchpad/verify25.mjs`(저장소 밖). `npm run dev` 는 이 세션이 띄웠고 끝에 내가 띄운 PID(npm·vite·자식)만 종료했다. 배포하지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 테스트 방장이 시트를 연 채 판이 끝나면 결과 화면과 [처음으로] 가 시트에 가려짐**
- **Found during:** 브라우저 검증(첫 실행에서 `dialog[open]` 1개, 맨 아래 스크롤 뒤 [처음으로] 의 elementFromPoint 가 버튼이 아님)
- **Issue:** 계획은 열린 역할 카드 시트만 닫게 했지만 테스트 도구 시트(`testOpen`)도 단계가 바뀌어도 열려 있는 설계라(대기실 때문에), 종료 뒤에도 모달이 남아 결과 화면을 가렸다. 결과 화면에는 [테스트] 버튼이 없어 방장이 닫기 전엔 [처음으로] 가 눌리지 않는다.
- **Fix:** `phase === "ended"` 효과에서 `setTestOpen(false)` 도 호출. 시험 한 건 추가(테스트 시트를 열고 ended 로 가면 `dialog` 가 사라지고 [처음으로] 가 있다).
- **Files modified:** src/screens/RoomScreen.tsx, test/client/resultScreen.test.tsx
- **Commit:** 73c0680
- 이 수정의 시험은 고침과 같은 커밋에 있어 RED 단계를 따로 두지 않았다(브라우저에서 실패를 먼저 확인).

### 계획과 다르게 구현한 점(편차는 아님, 판단 기록)

- 계획 Task 2 (1)의 `instant`: ResultScreen 에는 넘기지 않았다. 마운트 뒤 장면이 바뀌지 않아 즉시 처리할 전환이 없고, 재접속은 `arrivedFrom` 이 null 이라 `fromScene` 이 없어 이미 night 한 장이다(브라우저 새로고침으로 확인).
- 계획 `files_modified` 의 `test/client/phaseScreens.test.tsx` 는 고치지 않았다(기존 시험이 ended 를 `연결 중…` 으로 단언하지 않았다). 라우팅 시험은 `resultScreen.test.tsx` 에 있다.
- 닉네임 말줄임 없음을 정적으로만 단언했다(레이아웃 불가). 브라우저에서 한글 5글자 봇 이름표가 폭 약 80~95 로 카드(104·114) 안에 들었다. 설계 값 99 보다 좁게 렌더링됐다(헤드리스 Chrome 폰트 차이일 수 있음).

## Known Stubs

없음. 새 코드에 하드코딩 빈 값·자리표시 문구는 없다.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-64(결과가 다른 부품으로 흐름)는 grep 시험으로, T-04-65(마크업 삽입)는 `<b>` 닉네임 시험으로 mitigate 했다. 새 패키지 설치 없음(T-04-SC).

## Self-Check: PASSED

- 파일: src/screens/ResultScreen.tsx, src/styles/result.css, test/client/resultScreen.test.tsx — 존재 확인
- 커밋: b3ef801, de34946, 00ccc90, 5a03bce, 73c0680 — `HEAD` 의 조상 확인
