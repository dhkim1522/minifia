---
phase: 04-execution-verdict
plan: 23
subsystem: verdict-screens-execution
tags: [execution, MorningCard, amber, executed, usePhaseArrival, stageHalos, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-21~22 verdictScene defense 분기·center 무대·원뿔·어둡게 층, 04-13 verdict.ts(VERDICT_TEXT 처형 문구·GHOST_FADE_MS·capHalos), eliminationText.executionTitle, 03-10 MorningCard·exitDelayOf"
provides:
  - "MorningCard `tone=\"amber\"`·`anchor=\"scene\"` 선택 인자 — 클래스 mf-morningcard--amber·--scene 만 더한다(기본 호출의 마크업·클래스 불변). verdict.css: 앰버 테두리 1px·위 띠 8px(::before)·그림자 `0 10px 28px` + 앰버 24px 30%, scene 변형은 장면 상자 안 top 8px"
  - "DayTable 좌석 `executed?: boolean` — dead 와 함께면 사람 층(mf-figure--exec-out)과 유령 층(mf-figure--exec-in)을 겹쳐 400ms 전환(투명 1→.35 / 0→.9 + 개별 속성 translate 18px→0), GHOST_FADE_MS 뒤 사람 층 제거(타이머 하나·언마운트 정리), 후광은 유령 층에만. 축소 모션은 크로스페이드만"
  - "verdictScene execution 분기 — 제목 `낮 · 처형`/`{n}일차`, calm, 변론과 같은 center·어둡게·원뿔, 앰버 카드(sceneOverlay), 모든 viewer 하단 NightPanel `처형이 끝났어요`/`곧 다음으로 넘어가요`. 서버 이상(처형 자리 없음)은 무대·카드 없이 같은 하단"
  - "VerdictScene.sceneOverlay — DayScene 이 `.mf-dayscene__scene` 안 DayTable 뒤에 그리는 덧그림"
  - "RoomScreen — execution 을 DayScene 으로 라우팅(장면 키 dayScene 공유), 안내 `executionAnnounceOf`(카드 제목과 같은 문장, 자리 없으면 `처형`)"
affects: [04-24~04-29 — 종료·결과 화면이 같은 verdictScene 을 이어 쓴다, 04-30 — E2E 에 처형 카드·유령 전환·직업 비노출(P4·P6 진홍 검사), 04-35 — 배포본 검증]

actuals:
  tokens: 12300
  tasks: 2
  commits: 4
plan_head_before: 59f8001c6f976ad64051886497f64cb413d001a0
plan_head_after: 08a5ec2dcce827190d852768a02bb693b5f9171b

tech-stack:
  added: []
  patterns:
    - "같은 부품의 변형은 선택 prop 이 클래스만 더하고 기본 호출을 건드리지 않는다(MorningCard tone·anchor)"
    - "이 접속이 직접 본 전이만 연출한다: usePhaseArrival(phase, epoch) 를 useVerdictScene 에서 불러 defense → execution 일 때만 executed. 재접속·중간 합류는 곧바로 유령 한 장"
    - "카드 퇴장 지연은 마감 시각이 바뀔 때 렌더 중 상태 조정으로 한 번 정해 쥔다(DayScene 아침 카드와 같은 방식)"
    - "변론·처형이 후광 상한 규칙을 helper(stageHalos) 한 곳에서 공유"

key-files:
  created:
    - test/client/execution.test.tsx
  modified:
    - src/components/MorningCard.tsx
    - src/components/DayTable.tsx
    - src/styles/verdict.css
    - src/screens/verdictScene.tsx
    - src/screens/DayScene.tsx
    - src/screens/RoomScreen.tsx
    - test/client/morning.test.tsx
    - test/client/dayTable.test.tsx

key-decisions:
  - "P-10(사용자 확인 대기) 기본값 그대로: 하단 안내 `곧 다음으로 넘어가요`. 이 시점 클라이언트는 승패를 몰라 밤을 단정하지 않는다"
  - "처형된 본인·탈락 viewer 의 하단도 같은 NightPanel 두 줄이다(ReadOnlyRow 없음) — 계획의 `모두` 를 따랐다(UI-SPEC 12.4 표의 `탈락 viewer → ReadOnlyRow` 보다 8.5·계획이 우선)"
  - "MorningCard 가 verdict.css 를 직접 import — 앰버 규칙이 verdict.css 에 있어 MorningCard 단독 사용에도 스타일이 따라온다(선택자는 `.mf-morningcard.mf-morningcard--amber` 로 night.css 기본 규칙을 이긴다)"

requirements-completed: []  # VOTE-04·END-01 은 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: D1
    description: "처형 5초 동안 후보는 변론과 같은 가운데 자리에 그대로 있고(이동 없음) 같은 어둡게+흐림+원뿔 아래에서 사람 그림이 유령 그림으로 바뀌며(400ms) 이름표는 탈락 표시가 된다 (VOTE-04, D-06, D-16)"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "execution.test.tsx(헤더·z31·흰 후광 하나·어둡게/원뿔 하나·이름표 dead·defense→execution 에서 같은 좌석 DOM 노드·좌표 불변·두 층→400ms 뒤 한 장·처음부터 execution/재접속은 한 장) + dayTable.test.tsx(executed 두 층·후광 하나·399/400ms 경계·타이머 정리·키프레임 CSS)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 5, testBotVote pick=host/other) + 헤드리스 Chrome 390×844·360×640·모션 줄이기: defense→execution 에서 후보 x 좌표 최소=최대(이동 0), rAF 기록 첫 프레임 `H1.00 / G0.00 translate 0 18px` → 중간 `H0.39 / G0.85` → `H0.35 / G0.90 translate 0`, 24프레임(≈400ms) 뒤 유령 한 장, 이름표 mf-dt__tag--dead(gray-500), 모션 줄이기에서는 translate 없이 크로스페이드만"
        status: pass
    human_judgment: true
  - id: D2
    description: "앰버 처형 카드가 `{이름}님이 {꼬리}`와 부제 `처형이 집행됐어요` 로 뜨고 단계 끝 300ms 전에 사라진다. 테두리·띠는 앰버, 진홍이 아니다 (D-11, D-33)"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "execution.test.tsx(제목 phrase 2·범위 밖 번호는 첫 문구·부제·장면 상자 안·앰버 클래스·퇴장 지연 4700/1700ms·같은 마감 재그리기에 값 불변) + morning.test.tsx(기본 호출 마크업 불변·tone/anchor 클래스·verdict.css 앰버 테두리/띠/그림자·진홍·hex 없음·글자색 앰버 없음)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome: 계산된 테두리 rgb(242,184,75)=#f2b84b, ::before 띠 같은 앰버, pointer-events none, 폭 252, 장면 상자 top+8(127 = 119+8), 퇴장 지연 변수 4685~4695ms, 스크린샷 육안: 위 앰버 띠·후보가 원뿔 아래 유령"
        status: pass
    human_judgment: true
  - id: D3
    description: "처형된 사람의 직업·역할 이름·직업 그림이 살아 있는 viewer 화면 어디에도 없다. 처형된 본인에게는 기존 관전 규칙(결정 0021)대로 다른 사람의 직업 그림이 올 수 있다 (D-09, T-04-61)"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "execution.test.tsx(살아 있는 viewer defense·execution 의 innerHTML 에 /characters/roles/ 0·직업 단어 0, 마피아 viewer 도 후보 직업 없음, 처형된 본인은 spectate 직업 그림 허용, 카드·장면 소스가 roleText 를 읽지 않음)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 살아 있는 viewer(390·360·모션 줄이기 세 번): 처형 단계 DOM 에 roles/ 그림 0·직업 단어 0. 처형된 본인(방장이 후보)은 roles/ 그림 15(관전 규칙, 허용)"
        status: pass
    human_judgment: false
  - id: D4
    description: "하단은 모두 `처형이 끝났어요`/`곧 다음으로 넘어가요`이고 이 단계에는 메시지·이모티콘 입구가 없다. 마피아 viewer 의 진홍 동료 후광은 유지되되 합이 3 을 넘으면 진홍부터 꺼진다 (VOTE-04, P-10, 결정 0030)"
    requirement: "VOTE-04"
    verification:
      - kind: unit
        ref: "execution.test.tsx(살아 있는·탈락·처형된 본인 세 경우 h2/guide·버튼·입력·.mf-ro 0·panel--tall 없음·`밤이 시작` 글자 없음, chat 이벤트가 말풍선을 만들지 않음, 후광: 흰 2 + 진홍 1·3 만, 마름모 3)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome: 하단 h2/guide 일치, 하단 안 버튼 0, 높이 157, 가로 스크롤 없음, 콘솔 오류 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "카드 위치·가독성(제목 3줄이면 후보 머리 위를 덮음), 두 번째 기기에서 보는 처형 장면, iOS Safari 에서의 두 층 전환·흐림, 5초 끝 카드 퇴장 모양, 처형 뒤 night/ended 로 넘어가는 순간"
    requirement: "VOTE-04"
    verification:
      - kind: manual_procedural
        ref: "처형 단계 안 장면만 헤드리스 Chrome 으로 확인했다. 퇴장 페이드(4.7초 시점)·두 기기 동시·iOS·ended 화면(아직 없음, `연결 중…`)은 확인하지 못했다. 04-35 배포본에서 한다"
        status: partial
    human_judgment: true
---

# Phase 4 Plan 23: 처형 단계(앰버 카드·사람→유령 전환·직업 비노출) Summary

**처형 5초가 그려진다: 후보는 변론과 같은 가운데 자리·같은 어둡게+원뿔 아래에서 사람 그림이 400ms 만에 유령으로 바뀌고, 위에서 앰버 띠 카드(`{이름}님이 {꼬리}` + `처형이 집행됐어요`)가 뜨며, 하단은 모두에게 `처형이 끝났어요 / 곧 다음으로 넘어가요`이고, 살아 있는 viewer 화면에는 직업 그림도 직업 단어도 없다.**

## 한 일

**Task 1 — 앰버 카드 변형과 사람→유령 전환** — RED `8c88881` → GREEN `c1c85d5`
- `MorningCard`: 선택 인자 `tone="amber"`·`anchor="scene"`. 클래스(`mf-morningcard--amber`·`--scene`)만 더하고 기본 호출은 클래스 `mf-morningcard` 하나 그대로다. `verdict.css`: 앰버 테두리·위 띠 8px(`::before`, 모서리에 잘리게 `overflow: hidden`)·그림자(`0 10px 28px` + 앰버 24px 30%)·바탕 `night-900` 94%, scene 변형은 `top: 8px`. 앰버는 선·면·그림자에만 쓰고 글자색에는 쓰지 않는다.
- `DayTable`: 좌석 prop `executed`. `dead && executed` 이면 `ExecutedFigures`(사람 층 `mf-figure--exec-out` + 유령 층 `mf-figure--exec-in`, 후광 클래스는 유령 층에만)를 그리고 `GHOST_FADE_MS` 뒤 사람 층을 제거한다(타이머 하나, 언마운트 정리). 키프레임 `mf-exec-out`(투명 1→.35)·`mf-exec-in`(투명 0→.9, 개별 속성 `translate` 18px→0), 축소 모션은 `mf-exec-in-fade`(떠오름 없음).

**Task 2 — execution 단계 연결** — RED `67bf13d` → GREEN `08a5ec2`
- `verdictScene` execution 분기: 처형 자리 = `day.execution.seat`(없으면 `day.candidate`), 변론과 같은 `center`·`verdict`·`mf-dayscene--verdict`, 후보 좌석에 흰 후광, `executed`(= `usePhaseArrival` 이 직전 단계 defense 로 알려 줄 때만), 카드(`executionTitle`·`VERDICT_TEXT.executionCardSub`·퇴장 지연 = 마감 시각이 바뀔 때 한 번 정한 `exitDelayOf(남은 시간)`)를 `sceneOverlay` 로 돌려준다. 하단은 모든 viewer 에게 `NightPanel`. 후광 규칙은 변론과 `stageHalos` 한 helper 로 공유.
- `DayScene`: `verdict.sceneOverlay` 를 `.mf-dayscene__scene` 안 DayTable 뒤에 그린다. `RoomScreen`: `execution` 을 DayScene 으로 라우팅하고 장면 키를 변론과 같은 `dayScene` 으로(테이블 재마운트 없음), 안내 문구는 카드 제목과 같은 문장.

커밋 4개: `8c88881` `c1c85d5` `67bf13d` `08a5ec2`.

## 검증

- `npm test`: 96 파일 2511 통과(04-22 직후 2479 → +32). `npm run typecheck`(토큰 검사 + wrangler types + 두 tsc) 오류 0. `npm run build` 종료 코드 0. 계획의 개별 명령 2종(`morning`·`dayTable` / `execution`·`defense`·`morning`·`dayScene`)과 scoped tsc 모두 통과.
- 수용 기준: `mf-morningcard--amber` MorningCard.tsx 1·verdict.css 2, `executed` DayTable.tsx 2 이상, `case "execution"` RoomScreen.tsx 1, `executionTitle` verdictScene.tsx 2·RoomScreen.tsx 2.
- 기존 시험 변경 없음(추가만). 단 `verdict.css` 에서 새 규칙의 위치는 아래 편차 1.

### 브라우저에서 실제로 그려지는지 (정직한 보고)

**확인했다.** `npm run dev`(내가 띄운 npm PID 26439·vite 26465·workerd 26554 만 종료, 5173 해제 확인)와 일회용 스크립트 `verify-exec23.mjs`(스크래치패드, 저장소에 넣지 않음)로 테스트 방(봇 5, `testBotVote` pick=host 로 방장이 후보 / pick=other 로 살아 있는 방장이 봇 후보를 봄)을 만들고 헤드리스 Chrome 에서 변론 → 처형(`testSkip`)까지 갔다.
1. **이동 없음·전환(390×844)**: 후보 좌석 좌표가 변론과 처형 전 구간에서 같다(x 최소=최대 134). rAF 로 기록한 첫 프레임은 사람 층 `opacity 1`·유령 층 `0 / translate 0 18px`, 중간 `0.39 / 0.85`, 끝 `0.35 / 0.90 / translate 0`, 24프레임(≈400ms) 뒤 유령 한 장만 남고 후광(흰)은 유령 층에만 있다.
2. **카드**: 계산된 테두리 `rgb(242, 184, 75)`(#f2b84b)·`::before` 띠 같은 값, `pointer-events: none`, 폭 252, 카드 top 127 = 장면 상자 top 119 + 8, 퇴장 지연 변수 4685~4695ms(5000 − 300 − 지연된 렌더 시간). 제목은 방 안 닉네임을 그대로 쓴다(`봇가나다라님이 처형대에 올랐습니다`, `검증방장님이 잔혹하게 처형되었습니다` 등).
3. **하단**: h2 `처형이 끝났어요`·안내 `곧 다음으로 넘어가요`, 하단 안 버튼 0, 높이 157, 이름표는 `mf-dt__tag--dead`(글자 rgb(107,113,128) = gray-500).
4. **직업 비노출**: 살아 있는 viewer(390·360·모션 줄이기)의 처형 단계 DOM 에서 `/characters/roles/` 0·직업 단어 0. 처형된 본인(방장이 후보)은 `roles/` 그림 15개(관전 규칙, 허용).
5. **360×640**: 같은 결과(후보 x 119 고정, 카드 top 127, 가로 스크롤 없음). **모션 줄이기**: translate 없이 크로스페이드만(`G0.00 → G0.90`, translate `none`).
6. 콘솔 오류 0(네 번 모두). 스크린샷(`ex-host-390x844-300.png` 등)을 눈으로 읽었다: 후보가 원뿔 빛 안의 유령, 위에 앰버 띠 카드, 배경은 어둡고 흐림.

**확인하지 못한 것:** 카드 퇴장 페이드(4.7초 시점)·`night` 로 넘어가는 순간의 모양(헤드리스 확인은 3초 시점까지), 승패가 나서 `ended` 로 가는 경로(결과 화면이 아직 없어 `연결 중…`, 04-24~29 범위), 두 번째 기기에서 보는 처형 장면, iOS Safari 에서의 두 층 전환·`backdrop-filter` 흐림, 실제 폰 터치.

## 편차(Deviations from Plan)

### 자동 수정

**1. [Rule 3 - Blocking] 새 CSS 를 verdict.css 맨 아래에 두자 기존 시험 2개가 깨졌다**
- **Found during:** Task 2 의 `npm test` 전체 실행
- **Issue:** `reveal.test.tsx` 의 확정 두근 시험이 `css.lastIndexOf("@media (prefers-reduced-motion: reduce)")` 로 "마지막 축소 모션 블록 = 과반 확정 구역" 이라고 가정한다. 처형 카드·전환 규칙(자체 축소 모션 블록 포함)을 파일 끝에 붙이면 그 가정이 깨졌다.
- **Fix:** 새 규칙을 `과반 확정 두근과 느린 박동` 구역 앞으로 옮겼다(시험은 고치지 않았다). 내용 변화 없음.
- **Files modified:** src/styles/verdict.css
- **Commit:** 08a5ec2

### 계획과 다르게 한 것

- `files_modified` 에 없는 `verdict.css` import 를 `MorningCard.tsx` 에 더했다(앰버 규칙이 `verdict.css` 에 있어 단독 사용에도 스타일이 따라오게). 번들에서 같은 CSS 는 한 번만 들어간다.
- `dayTable.test.tsx` 의 키프레임 시험이 처음에 조잡한 정규식으로 한 번 실패해 중괄호 짝 맞추기 helper 로 고쳤다(RED 커밋 뒤 GREEN 안에서 고침, 시험 내용 같음).

## 알아 둘 점(사용자 확인 대기에 올림)

- 전환의 끝 상태 유령 투명도 `.9`(UI-SPEC 8.5·계획 값 그대로)는 처형 5초 동안 유지되다가 밤에서 일반 유령(투명도 지정 없음 = 1)으로 바뀐다. 실기기에서 튀어 보이면 `mf-exec-in` 끝 값을 1 로 바꾸면 된다(한 줄).
- 사람 층에는 후광이 없다(계획: 후광은 보이는 유령 층 하나에만). 변론 중 있던 흰 후광이 전환 순간 사라졌다가 유령 층이 투명 0→.9 로 올라오며 같이 돌아온다 — 400ms 동안 후광이 옅어 보인다. 헤드리스 스크린샷으로는 거슬리지 않았으나 실기기 확인 대상이다.
- 제목이 3줄이면(4~5자 이름 + 긴 꼬리) 카드 아래(top 127 + 148 = 276)가 후보 머리(top 246)를 약 30px 덮는다. UI-SPEC 8.5 가 허용한 경우다.

## Known Stubs

- 없음. 이 계획의 범위(처형 5초)는 연결까지 끝났다.
- 전체 흐름으로는 `ended`(결과) 화면이 04-24 이후 범위라 승패가 나는 처형 뒤 여전히 `연결 중…` 이다 — 배포 금지 상태 유지(04-35 에서만 배포).

## Threat Flags

없음. 새 네트워크 경로·권한 경로·스키마 변경이 없다. T-04-61(처형자 직업이 살아 있는 viewer 화면에 나옴)은 입력에 직업이 없고, 시험(innerHTML 에 직업 그림 경로·직업 단어 0)과 실제 브라우저 확인으로 닫았다.

## 열린 항목(사용자 확인 대기)

- **P-10**: 하단 안내 `곧 다음으로 넘어가요`(밤을 단정하지 않음)는 기본값 그대로다. 시안의 `곧 밤이 시작돼요` 를 원하면 알려 달라.
- 위 `알아 둘 점` 둘(유령 끝 투명도 .9, 전환 중 후광 옅어짐)은 04-35 배포 뒤 실기기에서 보고 정한다.

## Self-Check: PASSED

- 파일: `test/client/execution.test.tsx`, 이 SUMMARY 존재.
- 커밋: `8c88881` `c1c85d5` `67bf13d` `08a5ec2` 4개가 모두 HEAD 의 조상(merge-base 확인).
