---
phase: 04-execution-verdict
plan: 26
subsystem: verdict-screens-result-reveal
tags: [ResultScreen, result.css, reveal-stage, neutral-flip-done, reduced-motion, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-25 ResultScreen 최종 상태와 arrivedFrom prop, 04-13 verdict.ts 의 RESULT_FLIP_AT_MS(300)·RESULT_SUMMARY_AT_MS(900), 04-20 useReducedMotion, 04-24 RoomScreen 의 usePhaseArrival 연결"
provides:
  - "ResultScreen 공개 연출 상태기계 — stage neutral(0~300ms) → flip(300~900ms) → done. 같은 접속에서 execution·morning 으로부터 넘어온 마운트이고 모션 줄이기가 아닐 때만 neutral 로 시작하고(useState 초기값 한 번), 그 밖(재접속·처음 마운트·다른 단계·모션 줄이기)은 곧바로 done. 타이머 둘(RESULT_FLIP_AT_MS·RESULT_SUMMARY_AT_MS)은 마운트 효과 하나가 걸고 언마운트에서 정리한다"
  - "마크업 표시 — `.mf-result[data-stage][data-reveal]`, 카드 안 `.mf-result__figs`(직업 그림 + neutral·flip 동안만 `.mf-result__neutral` 중립 인물 층), 뒤집히기 전 직업 이름·`탈락` 은 aria-hidden, 요약 카드·[처음으로] 는 `.mf-result__rise` + 900ms 전 aria-hidden·버튼 disabled, 마피아 승 번짐 `.mf-result__glow[data-reveal]`"
  - "result.css 단계 규칙 — 배너 팝(scale .92 → 1, 360ms), 번짐 페이드인(600ms, 마피아 승·연출 시작만), neutral 동안 직업 그림·이름 opacity 0, flip 에 그림 crossfade 300ms + 카드 scale 1 → 1.06 → 1(개별 속성 scale, 360ms, 지연 없이 모든 카드 동시), done 에 요약·버튼 opacity + translateY 8px → 0 (300ms). 전이·애니메이션은 opacity·transform·scale 만이고 자리는 항상 차지해 레이아웃이 움직이지 않는다"
affects: [04-30 — E2E 가 결과 화면을 볼 때 연출이 도는 동안 [처음으로] 가 900ms 뒤에야 눌린다, 04-35 — 배포본에서 실기기 연출 확인]

actuals:
  tokens: 5700
  tasks: 2
  commits: 2
plan_head_before: 3a262f927bdae8fe33c02c63799d9e246250ecff
plan_head_after: cf05fd61d711084fc1d036e4b0f325799a87499b

tech-stack:
  added: []
  patterns:
    - "연출 여부는 마운트 때 한 번 정하는 상태(`reveal`)로 두고 CSS 는 `[data-reveal=\"true\"]` 일 때만 움직인다 — 재접속·모션 줄이기는 reveal false + stage done 이라 CSS 규칙이 아무것도 하지 않아 별도 모션 줄이기 분기가 필요 없다"
    - "숨김은 display 가 아니라 opacity·visibility 로: 단계가 바뀌어도 카드·요약·버튼 자리가 그대로라 레이아웃 이동이 없고, 보이지 않는 동안 aria-hidden·disabled 로 읽기 도구·눌림에서도 뺀다"
    - "타이머 시험은 setTimeout 의 지연값(300·900)을 스파이로 모아 구분한다 — 배경 크로스페이드 등 다른 타이머가 getTimerCount 에 섞이기 때문"

key-files:
  created: []
  modified:
    - src/screens/ResultScreen.tsx
    - src/styles/result.css
    - test/client/resultScreen.test.tsx

key-decisions:
  - "RoomScreen 은 고치지 않았다(계획 Task 2 (1) '필요한 방어만'): ResultScreen 이 `arrivedFrom === execution|morning` 두 값만 연출로 인정하므로 다른 단계 값은 예외 없이 done 이 된다. 시험으로 고정(밤에서 ended 로 와도 최종 상태)"
  - "모션 줄이기는 계획대로 시간표를 돌리지 않고 처음부터 done 이다(UI-SPEC 11.2 의 '160ms 페이드로 한 번에' 대신 base.css 의 전역 축소 규칙에 맡김). 160ms 페이드를 원하면 RESULT_REDUCED_FADE_MS 를 쓰는 별도 규칙이 필요하다"
  - "연출 중에는 [처음으로] 를 숨길 뿐 아니라 disabled 로 둔다(계획: 900ms 이후 눌림): visibility hidden 은 클릭을 막지만 키보드·읽기 도구 경로까지 닫으려 aria-hidden 과 disabled 를 함께 쓴다"

requirements-completed: []  # END-01·END-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: C1
    description: "처형·아침 마감으로 판이 끝나 결과 화면에 들어오는 순간(같은 접속의 전환)에만 공개 연출이 돈다: 0ms 배너 팝 + 중립 인물·이름표만, 300ms 모든 카드가 한꺼번에(순서·지연 없음) 직업 그림으로 바뀌며 직업 이름·탈락이 같은 순간 나타나고, 900ms 요약 카드와 [처음으로] 가 아래에서 떠오른다 (D-17, UI-SPEC 11.2)"
    requirement: "END-01"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(가짜 타이머로 t=0 neutral·중립 그림 `/table/`·직업 이름 aria-hidden·요약·버튼 숨김, t=299 neutral, t=300 flip·카드에 지연 스타일 없음·직업 이름 노출·중립 층 유지, t=899 flip 에서 버튼 클릭이 onExit 을 부르지 않음, t=900 done·중립 층 제거·버튼 눌림, done 의 카드 구성이 04-25 최종 상태와 같음, morning → ended 도 동일)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 5, testBotVote exec=yes pick=other) + 헤드리스 Chrome(playwright-core, 390×844, 모션 보통): 테스트 도구로 단계를 execution → 밤 → 아침 → ended 로 넘기고 결과 화면 첫 프레임부터 rAF 로 매 프레임(약 33ms 간격 108샘플) 계산된 스타일을 기록. stage 전환 neutral 0~283ms → flip 300~883ms → done 898ms. 배너 opacity 0 → 1·scale .92 → 1 이 약 360ms 에 끝남. 마피아 승 번짐 opacity 0 → 1 이 약 600ms 에 끝남. neutral 동안 직업 그림·이름 opacity 0·중립 층 opacity 1, flip 300→598ms 에 중립 1 → 0 과 직업 0 → 1 이 같은 곡선으로 교차(crossfade 300ms), 모든 카드의 scale 이 같은 값(카드별 값이 `|` 로 갈리지 않음)으로 최대 1.0600 까지 올랐다 1 로 복귀(약 360ms), done 898ms 에 중립 층 제거·[처음으로] disabled 해제, 요약·버튼 opacity 0 → 1 과 translateY 8 → 0 이 약 300ms 에 끝남. 가로 스크롤 없음, 콘솔 오류 0"
        status: pass
    human_judgment: true
  - id: C2
    description: "재접속·새로고침·처음 마운트(arrivedFrom 없음)는 연출 없이 최종 상태를 곧바로 그린다. 모션 줄이기 설정에서도 곧바로 최종 상태다 (UI-SPEC 11.2, 13.4)"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(처음 마운트 stage done·reveal false·연출 지연 300/900 의 setTimeout 없음, 에포크가 바뀐 재접속 done, matchMedia 스텁(reduce) 에서 같은 접속 전환이어도 done·300/900 타이머 없음, 밤 단계에서 ended 로 와도 예외 없이 done·카드 5장)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome: 새로고침 직후 stage done·reveal false·중립 층 0·[처음으로] 눌림. emulate reducedMotion=reduce(360×640, 봇 5): 같은 접속 전환인데도 첫 샘플부터 stage done·reveal false, neutral·flip 샘플 0개, 카드 scale 최대 1"
        status: pass
    human_judgment: false
  - id: C3
    description: "연출 중에도 [처음으로] 는 900ms 이후 눌리고 스크롤 본문은 항상 세로로만 움직인다. 타이머는 언마운트 때 정리되어 늦은 상태 갱신이 없다 (T-04-66)"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(900ms 전 [처음으로] disabled·클릭해도 onExit 호출 없음, 900ms 뒤 onExit(\"left\") 1회, 연출 중 같은 result 가 다시 와도 stage 가 되돌아가지 않고 300/900 타이머가 새로 걸리지 않음, 언마운트 뒤 getTimerCount 0·2초 진행해도 console.error 없음, 판이 끝나면 테스트 시트 닫힘 시험은 900ms 진행 뒤 버튼을 찾도록 갱신)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 샘플 108개 전부에서 본문 scrollWidth ≤ clientWidth(가로 스크롤 없음). 연출 중 [처음으로] 는 898ms 전까지 disabled(btnDisabled true)이고 898ms 에 해제. 이어서 [처음으로] 클릭 뒤 localStorage `minifia:session` null"
        status: pass
    human_judgment: false
  - id: C4
    description: "ended 화면은 낮 장면과 다른 DOM 노드로 새로 마운트되어 이전 투표 카드·층이 남지 않는다 (D-10, D-37)"
    requirement: "END-01"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(execution 의 .mf-dayscene 노드가 ended 로 오면 제거돼 isConnected false, 처형·변론 카드 클래스 없음)"
        status: pass
    human_judgment: false
  - id: C5
    description: "result.css 의 연출 규칙이 UI-SPEC 11.2 시간표·원칙(opacity·transform·scale 만, 색 직접 지정 없음, 진홍은 번짐·배너·마피아 글자에만)을 지킨다"
    requirement: "END-02"
    verification:
      - kind: unit
        ref: "resultScreen.test.tsx(키프레임 4종 mf-result-banner-pop·glow-in·card-pop·rise, data-stage neutral·flip 선택자, 360·600·300ms, scale 1.06, translateY(8px), transition 에 레이아웃 속성 없음, # 색 없음. 기존 정적 단언(글자 크기 4종·진홍 허용 규칙)도 연출 규칙 추가 뒤 통과)"
        status: pass
    human_judgment: false
  - id: C6
    description: "실제 폰에서 공개 순간의 느낌(모든 카드가 한꺼번에 뒤집히는 타이밍, 팝 크기, 번짐 페이드, 요약 떠오름), iOS Safari 의 scale·crossfade 부드러움, 모션 줄이기에서 160ms 페이드가 필요한지, 실제 방에서 아침 마감(morning → ended) 종료 경로"
    requirement: "END-02"
    verification:
      - kind: manual_procedural
        ref: "헤드리스 Chrome(데스크톱 렌더링)에서 morning → ended 경로(이번 판은 처형 뒤 밤·아침을 거쳐 ended 로 넘어왔다)만 실서버로 확인했다. 처형 직후 execution → ended 경로와 사람이 보는 체감·iOS·실기기는 확인하지 못했다(execution 경로는 단위 시험으로만 확인). 스크린샷은 캡처 지연(수백 ms)이 커서 연출 시각의 근거로는 rAF 샘플을 썼다. 04-35 배포본 + 실기기에서 한다"
        status: partial
    human_judgment: true
---

# Phase 4 Plan 26: 결과 공개 연출 neutral → flip → done Summary

**같은 접속에서 처형·아침 마감으로 판이 끝나 결과 화면에 들어오면 0ms 배너 팝(마피아 승은 위쪽 진홍 번짐 페이드인) + 중립 인물·이름표만, 300ms 모든 카드가 한꺼번에 직업 그림으로 뒤집히며(scale 1 → 1.06 → 1) 직업 이름·탈락이 나타나고, 900ms 요약 카드와 [처음으로] 가 아래에서 떠오른다. 재접속·새로고침·모션 줄이기는 연출 없이 곧바로 최종 상태다.**

## 한 일

**Task 1 — 공개 상태기계와 카드·배너·요약 전이** — RED `427d594` → GREEN `cf05fd6`
- `ResultScreen.tsx`: `reveal = !reduced && (arrivedFrom === "execution" || "morning")` 를 `useState` 초기값으로 한 번 정하고, `stage` 는 reveal 이면 `neutral` 시작·아니면 `done`. 효과 하나가 reveal 일 때만 300·900ms 타이머 둘을 걸고 정리 함수로 둘 다 지운다. 시간 값은 `RESULT_FLIP_AT_MS`·`RESULT_SUMMARY_AT_MS`. 카드는 직업 그림(자리 잡는 층) 위에 neutral·flip 동안만 중립 인물 층(`figureSrc(seat)`)을 겹친다.
- `result.css`: 단계별 규칙과 키프레임. neutral 동안 직업 그림·이름·탈락은 opacity 0, flip 에 중립 층이 투명해지고 직업 그림이 나타나며(300ms) 모든 카드에 같은 카드 팝, done 에 요약·버튼이 떠오른다. 숨김은 opacity·visibility 라 레이아웃이 움직이지 않는다.
- 시험(RED 먼저, 12건 실패 확인): t=0·299·300·899·900, 재접속·에포크 재접속·모션 줄이기 즉시 done, 타이머 정리, 시민 승 번짐 없음, CSS 정적 단언.

**Task 2 — RoomScreen 도착 정보와 전체 게이트** — 같은 커밋 두 개
- RoomScreen 은 04-25 가 이미 `arrivedFrom` 을 넘기고 있고 ResultScreen 이 두 값만 연출로 인정하므로 코드를 고치지 않았다. 시험을 RoomScreen 수준(`renderRoom` → `rerenderRoom`)으로 더했다: execution·morning 두 경로 연출, 재접속(에포크 변경) 꺼짐, 밤 단계에서 와도 예외 없이 최종 상태, 낮 장면 노드 교체.
- `npm test` 99 파일 2598 통과, `npm run typecheck` 종료 코드 0, `npm run build` 성공.

## 검증

- 위 게이트 + 헤드리스 Chrome(playwright-core) 실서버(`npm run dev`) 확인: 390×844 모션 보통(연출 샘플), 360×640 모션 줄이기, 새로고침, [처음으로]. 스크립트 `scratchpad/verify26.mjs`(저장소 밖). `npm run dev` 는 이 세션이 띄웠고 끝에 내가 띄운 PID(npm 과 5173 리스너 자식)만 종료했다. 배포하지 않았다.
- 확인하지 못한 것: 실기기·iOS Safari 의 체감, 처형 직후 execution → ended 경로의 실서버(이번 판은 아침을 거쳐 종료), 시민 승 판의 연출(번짐 없음은 단위 시험으로만). 스크린샷은 캡처 지연이 커서 연출 시각의 근거가 되지 못했고 rAF 샘플이 근거다.

## Deviations from Plan

None - plan executed exactly as written. 다음은 편차가 아닌 판단 기록이다.

- 기존 시험 한 건(`판이 끝나면 열려 있던 테스트 시트도 닫는다`)이 같은 접속 전환으로 ended 에 들어가 연출이 켜지면서 [처음으로] 가 900ms 동안 aria-hidden 이 되어 찾지 못했다. 기대 동작이 바뀐 것이라 시험에서 900ms 를 진행한 뒤 버튼을 찾도록 고쳤다(Rule 1 범위의 시험 갱신).
- 계획 Task 2 의 RED 는 Task 1 의 RED 와 한 커밋에 묶었다(둘 다 `resultScreen.test.tsx` 이고 RoomScreen 코드 변경이 없어 별도 GREEN 이 없다).

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-66(타이머가 언마운트 뒤에도 남음)은 정리 함수와 시험(언마운트 뒤 타이머 0, 이후 console.error 없음)으로 mitigate. 새 패키지 설치 없음(T-04-SC).

## Self-Check: PASSED

- 파일: src/screens/ResultScreen.tsx, src/styles/result.css, test/client/resultScreen.test.tsx — 존재 확인
- 커밋: 427d594, cf05fd6 — `HEAD` 의 조상 확인
