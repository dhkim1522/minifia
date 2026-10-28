---
phase: 04-execution-verdict
plan: 22
subsystem: verdict-screens-defense-chips
tags: [defense, DefenseChips, QuickMessageSheet, useSendLock, panel-tall, candidateCenter, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-21 verdictScene defense 분기·DefensePanel·후보 가운데 무대, 04-13 verdict.ts(VERDICT_TEXT·DEFENSE_SENT_MS·defenseSent), messageText(DEFENSE_TEMPLATE_ORDER·TEMPLATE_CHIP), QuickMessageSheet·useSendLock"
provides:
  - "DefenseChips — 후보 본인 변론 하단: 제목 `변론할 말을 고르세요` + 안내 + 칩 6개(2칸 × 3줄, DEFENSE_TEMPLATE_ORDER 번호 순). 대상·직업이 필요 없는 칩은 {t:'say', template} 즉시 전송, 필요한 칩은 QuickMessageSheet 를 templates=[그 칩] 으로 열어 고른 뒤 전송(QUICK_TEMPLATES 로 판단, 이름 하드코딩 없음). 보낸 직후 DEFENSE_SENT_MS(2초) 동안 안내 줄이 `보냈어요 · {문장}`, 칩 6개는 합산 쿨다운(useSendLock, 2초) 동안 disabled"
  - "verdict.css — `.mf-defchips` 2열 격자, `.mf-defchips__b`, `.mf-dayscene__panel.mf-dayscene__panel--tall`(높이 calc(236px + 안전 영역))"
  - "VerdictScene.panelClassName — DayScene 하단 <section> 에 더하는 클래스. 후보 본인 한 곳만 `mf-dayscene__panel--tall`"
  - "useSendLock.sendAndLock 이 보냈는지(boolean)를 돌려준다 — 연결이 끊겨 버려진 전송은 보냄 표시도 잠금도 만들지 않는다"
affects: [04-23 — 처형 단계가 같은 verdictScene·center 무대를 이어 쓴다, 04-30 — E2E 에 P-PANEL-236 한 줄(하단 157 단언 예외)과 변론 칩 흐름, 04-35 — 배포본 검증]

actuals:
  tokens: 6800
  tasks: 2
  commits: 5
plan_head_before: d6abf507b54c58160912d37fb23a347d97960664
plan_head_after: 2a1abc43965894e201425b8f4c2d110afc02a554

tech-stack:
  added: []
  patterns:
    - "장면이 DayScene 에 주는 값은 rootClassName·tableProps 에 이어 panelClassName 으로 늘린다(DayScene 은 이어 붙이기만)"
    - "대상·직업이 필요한지는 QUICK_TEMPLATES 가 정한다 — 칩 이름을 화면에서 하드코딩하지 않는다"
    - "보냄 표시는 상태 한 개와 타이머 하나, 새로 보내면 타이머를 갈아 끼운다. 언마운트하면 정리"

key-files:
  created:
    - src/components/DefenseChips.tsx
    - test/client/defenseChips.test.tsx
  modified:
    - src/styles/verdict.css
    - src/screens/verdictScene.tsx
    - src/screens/DayScene.tsx
    - src/components/QuickMessageSheet.tsx
    - src/net/useSendLock.ts
    - src/components/DefensePanel.tsx
    - src/components/DiscussionControls.tsx
    - src/components/TurnPanel.tsx
    - src/game/verdict.ts
    - test/client/defense.test.tsx
    - test/client/quickMessageSheet.test.tsx
    - test/unit/verdict.test.ts

key-decisions:
  - "P-8 기본값(사용자 확인 대기)을 그대로 구현: 시트 재사용(templates=[칩 하나]), 안내 줄 2초 `보냈어요 · {문장}`. 새 선택 UI 없음"
  - "시트가 문구 칩 하나로 열려 있어도 `보내기` 흐름은 기존 시트 그대로다. 시트가 닫히는 240ms 동안 칩은 이미 보냄 표시·쿨다운 상태다"
  - "안내 줄에 aria-live=polite 를 주어 `보냈어요 · …` 를 스크린리더가 읽는다(후보는 자기 채팅 줄을 패널에서 못 본다)"
  - "후보 발 y 여유 상수 34 → 38(이름표 상자 실제 높이 26 기준). 하단을 236 으로 키우자 360×640 에서 처음 드러난 오차"

requirements-completed: []  # COMM-03·VOTE-03 은 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: D1
    description: "후보 본인 하단(높이 236)은 제목·안내·변론 칩 6개(번호 순, 2칸 × 3줄, 각 44, 간격 8)다. 후보 본인 한 곳만 panel--tall 이고 남의 변론·관전·서버 이상·다른 단계에는 없다 (COMM-03, D-13, UI-SPEC 8.4)"
    requirement: "COMM-03"
    verification:
      - kind: unit
        ref: "defenseChips.test.tsx(모양·입력창 없음) + defense.test.tsx(RoomScreen: section panel--tall·칩 6개·클래스 비적용 4경우·CSS 236 규칙)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 5, testBotVote pick=host 로 방장이 후보) + 헤드리스 Chrome 390×844·360×640: 패널 높이 236, 칩 6개 175×44 격자(간격 8), 가로·세로 스크롤 없음, 칩 글자 14px 잘림 없음, 입력창 0, 콘솔 오류 0, 스크린샷 육안 확인"
        status: pass
    human_judgment: true
  - id: D2
    description: "즉시 전송 칩은 {t:'say', template} 이 한 번 나가고, 시트 칩은 문구 칩 하나로 열려 대상(나·탈락자 제외)/이번 판 직업을 고른 뒤 {template, target|claimedRole} 이 한 번 나간다. 자유 텍스트 없음 (COMM-04, T-04-59)"
    requirement: "COMM-03"
    verification:
      - kind: unit
        ref: "defenseChips.test.tsx(즉시 3종·시트 defSuspect/defTrust/defRole 페이로드·닫기만 하면 전송 없음·소스에 input/textarea 없음) + quickMessageSheet.test.tsx(직업만 필요한 문구 페이로드)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome: `저 아니에요` 즉시 전송, `[○○] 의심해 주세요` 시트(문구 칩 1개, 대상 5명)→보내기, `제가 [직업]입니다` 시트(직업 4개 = 이번 판 직업, 대상 줄 없음)→경찰→보내기"
        status: pass
    human_judgment: false
  - id: D3
    description: "보낸 직후 안내 줄이 2초 동안 `보냈어요 · {문장}` 으로 바뀌었다 돌아오고, 칩 전체는 합산 쿨다운(2초) 동안 꺼진다. 서버 BAD_MESSAGE 는 토스트. 언마운트하면 타이머·시트가 정리된다 (P-8, D-13, T-04-60)"
    requirement: "COMM-03"
    verification:
      - kind: unit
        ref: "defenseChips.test.tsx(가짜 타이머: 1999/2000ms 경계·연타 한 번만 전송·새 전송 시 2초 재시작·send false 시 표시·잠금 없음·canSend false·BAD_MESSAGE 토스트·언마운트 타이머 0·시트 열린 채 언마운트)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome 실시간: 직후 `보냈어요 · 저 아니에요`+disabled 6 → 1.15초 뒤 그대로 → 2.3초 뒤 원래 문구+disabled 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "후보가 칩으로 보내면 후보 머리 위 `…` 말풍선이 뜨고 후보 본인 화면의 가운데 이동·어둡게·후광·원뿔은 04-21 과 같다. defense → execution 이면 칩 패널과 열린 시트가 사라진다"
    requirement: "COMM-03"
    verification:
      - kind: unit
        ref: "defense.test.tsx(후보 본인 chat 이벤트 → mf-dt__bubble--spoke, 무대 클래스 유지, 후보 끊김 + BAD_MESSAGE 토스트, defense→execution 시 .mf-defchips·dialog 사라짐)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome: 칩 전송 직후 후보(나) 머리 위 말풍선 1개 확인, 후보 본인에게는 하단 채팅 줄(.mf-msglog) 없음"
        status: pass
    human_judgment: false
  - id: D5
    description: "다른 사람 화면에서 변론이 채팅 줄과 말풍선으로 보이는가, 실제 폰(iOS Safari 터치·시트 열림 애니메이션) 조작감, 두 번째 기기에서 후보 변론을 받는 장면"
    requirement: "COMM-03"
    verification:
      - kind: manual_procedural
        ref: "이 계획에서는 후보 본인 화면만 브라우저로 확인했다. 두 기기 동시 확인은 04-35 배포본(uat-vote·E2E)에서 한다"
        status: partial
    human_judgment: true
---

# Phase 4 Plan 22: 후보 본인 변론 칩(하단 236·칩 6개·시트 재사용·보냈어요) Summary

**최후 변론의 후보 본인이 하단의 변론 칩 6개로 실제로 말한다: 저 아니에요·저는 시민이에요·한 번만 믿어 주세요는 누르면 바로 나가고, 의심·믿어·직업 칩은 기존 빠른 메시지 시트를 그 칩 하나로 열어 대상·직업을 고른 뒤 나가며, 보낸 직후 2초 동안 안내 줄이 `보냈어요 · {문장}` 이 되고 칩 전체가 쿨다운 동안 꺼진다.**

## 한 일

**Task 1 — DefenseChips** — RED `c513302` → GREEN `0afb276`
- `DefenseChips`(props `{view, connection, showToast}`): 제목·안내는 `.mf-claimpanel__title`·`__guide` 재사용(문구는 `VERDICT_TEXT`), 칩은 `DEFENSE_TEMPLATE_ORDER`·`TEMPLATE_CHIP` 순서·글자, 모양은 `.mf-seg__b` + `.mf-defchips__b` 를 2열 격자에 담았다. 필요 여부는 `QUICK_TEMPLATES[template]`(target·role) 로 판단. 전송은 `useSendLock.sendAndLock`(DiscussionControls 와 같은 합산 쿨다운). 보냄 표시는 상태 한 개와 타이머 하나(`DEFENSE_SENT_MS`), 새로 보내면 타이머 교체, 언마운트 시 정리.
- `verdict.css`: `.mf-defchips`(2열, 간격 `--space-sm`), `.mf-defchips__b`, `.mf-dayscene__panel.mf-dayscene__panel--tall`(236 + 안전 영역). 새 색·글자 크기 없음(기존 알약 규칙·토큰만).

**Task 2 — 후보 본인 하단 연결** — RED `879e5af` → GREEN `c216e9a`
- `verdictScene` defense 분기가 후보 본인 하단을 `DefenseChips` 로 바꾸고 `panelClassName: "mf-dayscene__panel--tall"` 을 후보 본인일 때만 반환한다. `DayScene` 하단 `<section>` className 에 이를 잇는다(기본 클래스·`mf-dayscene__enter` 그대로).

**추가 수정(Rule 1)** — `2a1abc4`: 후보 발 y 여유 상수 34 → 38 (아래 편차 2).

커밋 5개: `c513302` `0afb276` `879e5af` `c216e9a` `2a1abc4`.

## 검증

- `npm test`: 95 파일 2479 통과(04-21 직후 2448 → +31). `npm run typecheck`(토큰 검사 + wrangler types + 두 tsc) 오류 0. `npm run build` 종료 코드 0.
- 수용 기준: `panel--tall` verdict.css 에 있음, `DEFENSE_TEMPLATE_ORDER` DefenseChips.tsx 에 있음, `DefenseChips` verdictScene.tsx 에 있음, `panelClassName` DayScene.tsx 에 있음, 새 파일 2개 존재.
- 기존 시험 변경: `defense.test.tsx` 의 후보 본인 케이스를 계획대로 갱신(칩 6개로)하고 케이스 5개를 더했다. `verdict.test.ts` 의 후보 발 y 한 줄(34 → 38)과 이름표 상자 단언 한 줄을 더했다. 그 밖의 기존 시험은 그대로 통과.

### 브라우저에서 실제로 그려지는지 (정직한 보고)

**확인했다.** `npm run dev`(내가 띄운 npm PID 54719·node PID 54745 만 종료, 5173 포트 해제 확인)와 일회용 스크립트 `verify-defense22.mjs`(스크래치패드, 저장소에 넣지 않음)로 테스트 방(봇 5, `testBotVote` pick=host 로 방장이 후보)을 만들고 헤드리스 Chrome 방장으로 변론 단계까지 가서 본인 하단을 조작했다.
1. **390×844**: 헤더 `낮 · 최후 변론`/`1일차 · 내 변론`, 하단 `<section>` 이 `mf-dayscene__panel--tall`, 높이 정확히 236(608→844), 제목·안내, 칩 6개가 175×44 로 2열 × 3줄(간격 8), 칩 글자 14px 잘림 없음, 입력창 0, 가로·세로 스크롤 없음, 콘솔 오류 0.
2. **즉시 칩**: `저 아니에요` 직후 안내 `보냈어요 · 저 아니에요`·칩 6개 disabled → 1.15초 뒤 그대로 → 2.3초 뒤 `한 번에 하나씩 보낼 수 있어요`·disabled 0. 같은 순간 후보(나) 머리 위 `…` 말풍선 1개, 후보 본인 하단에는 채팅 줄 없음.
3. **시트 칩**: `[○○] 의심해 주세요` → 시트 문구 칩 1개, 대상 5명(나 제외) → 고르고 보내기 → 시트 닫힘, 안내 `보냈어요 · 봇가나다라 의심해 주세요`. `제가 [직업]입니다` → 직업 칩 `마피아·경찰·의사·시민`(이번 판 직업), 대상 줄 없음 → 경찰 → 안내 `보냈어요 · 제가 경찰입니다`.
4. **360×640**: 처음에는 후보 이름표 알약 아래끝이 장면 아래와 같았다(404 = 404, 여유 0). 위 상수를 고친 뒤 알약 아래끝 400 = 장면 아래 − 4, 하단 236·칩 6개·스크롤 없음.
5. 스크린샷(`c22-390x844-1-sent.png`·`c22-360x640-1-sent.png`·`c22-390x844-4-role-sheet.png`)을 눈으로 읽었다: 후보가 원뿔 빛 안에서 말풍선을 띄우고, 하단 칩이 시안 DC 와 같은 3줄 × 2칸이다.

**확인하지 못한 것:** 다른 사람(두 번째 기기) 화면에서 이 후보의 변론이 채팅 줄·말풍선으로 보이는 장면(이 계획은 후보 본인 화면만 봤다. 남의 화면 수신 경로는 04-21 시험·브라우저 확인과 chat 이벤트 단위 시험으로만), iOS Safari 터치·시트 열림 조작감, 후보 끊김 상태의 실제 재접속 화면(단위 시험만), 서버가 실제로 변론 6종을 받아 방송하는지의 종단 확인(서버 시험은 04-05 에서 통과, 배포본 uat-vote·E2E 는 04-35), 쿨다운 중 서버 RATE_LIMITED 재잠금의 실제 소켓 재현.

## 편차(Deviations from Plan)

### 자동 수정

**1. [Rule 1 - Bug] QuickMessageSheet 가 직업만 필요한 문구의 `claimedRole` 을 버렸다**
- **Found during:** Task 1 GREEN (시험 `제가 [직업]입니다` → `{template:'defRole'}` 만 나감)
- **Issue:** 시트의 payload 조립이 `target` 이 있어야 `claimedRole` 을 담는 구조라, 대상 없이 직업만 필요한 변론 `defRole` 은 직업이 빠진 채 전송됐다(서버가 형식 검증으로 거부하거나 `제가 [직업]입니다` 가 그대로 노출). 기존 문구는 모두 대상+직업이거나 대상만이라 드러나지 않았다.
- **Fix:** 대상만·직업만·둘 다·둘 다 없음 네 경우를 모두 리터럴로 조립(입력 객체를 펼치지 않는 T-02-27 규칙 유지). 시트 시험 1개 추가.
- **Files modified:** src/components/QuickMessageSheet.tsx, test/client/quickMessageSheet.test.tsx
- **Commit:** 0afb276

**2. [Rule 1 - Bug] 후보 이름표가 360×640 에서 장면 아래에 닿았다**
- **Found during:** 브라우저 확인(360×640)
- **Issue:** `candidateCenter` 의 발 y 여유 34 는 이름표 높이를 22 로 센 값인데 실제 이름표 상자는 알약 22 + 인라인 줄 상자로 26 이다. 04-21 의 하단 157 에서는 `cy + 80` 쪽이 이겨 가려져 있다가, 하단을 236 으로 키우자 `sceneH − 34` 가 적용되어 알약 아래끝 = 장면 아래(여유 0, UI-SPEC 의 E2E P5 는 −4 이상 요구)가 됐다.
- **Fix:** 상수를 38(간격 8 + 상자 26 + 여유 4)로. 단위 시험의 기대값을 38 로 고치고, 이름표 상자(+4)도 장면 아래 − 4 이내임을 한 줄 더했다. 390 폭 이상에서는 `cy + 80` 이 이겨 값이 바뀌지 않는다(기존 `r1(c.footY) === 290` 시험 통과). UI-SPEC 8.4 의 문구 `sceneH − 34` 는 `sceneH − 38` 로 읽어야 한다(UI-SPEC 파일은 고치지 않았다).
- **Files modified:** src/game/verdict.ts, test/unit/verdict.test.ts
- **Commit:** 2a1abc4

**3. [Rule 3 - Blocking] `useSendLock.sendAndLock` 이 보냈는지를 돌려주도록 바꿨다**
- **Found during:** Task 1 (연결이 끊겨 `send` 가 false 면 `보냈어요` 표시가 거짓이 되는 문제)
- **Fix:** 반환 타입 void → boolean. 기존 호출 세 곳(DefensePanel·DiscussionControls·TurnPanel)은 `void` 반환 화살표가 boolean 을 받지 못해 중괄호 본문으로 고쳤다(동작 불변, 기존 시험 통과).
- **Files modified:** src/net/useSendLock.ts, src/components/DefensePanel.tsx, src/components/DiscussionControls.tsx, src/components/TurnPanel.tsx
- **Commit:** 0afb276

### 계획과 다르게 한 것

- `files_modified` 에 없는 파일(위 편차의 6개)을 더 고쳤다. 모두 위 자동 수정에 따른 것이다.
- 안내 줄에 `aria-live="polite"` 를 두었다(계획에 없음; 후보가 자기 전송을 화면 읽기로 알 수 있게).

## Known Stubs

- 없음. 이 계획의 범위(후보 본인 칩)는 연결까지 끝났다.
- 전체 흐름으로는 execution·ended 화면이 04-23 이후 범위라 변론 마감 뒤 여전히 `연결 중…` 이다 — 배포 금지 상태 유지(04-35 에서만 배포).

## Threat Flags

없음. 새 네트워크 경로·권한 경로·스키마 변경이 없다. T-04-59(칩이 임의 필드를 보냄)는 전송 페이로드가 `SayPayload` 세 키(template·target·claimedRole)뿐이고 입력창이 없음을 시험으로, T-04-60(연타)는 `useSendLock` 합산 쿨다운 + 서버 1.8초 한도로 막혀 있음을 시험(연타 시 한 번만 전송)으로 확인했다.

## 열린 항목(사용자 확인 대기)

- **P-8**: 시트 재사용 + 안내 줄 2초 `보냈어요 · {문장}` 은 기본값 그대로다. 인라인 선택 UI 나 후보 본인용 채팅 줄을 원하면 알려 달라.
- UI-SPEC 8.4 의 `sceneH − 34` 를 `− 38` 로 고친 것을 문서에도 반영할지(04-35 전 문서 정리 때 함께).

## Self-Check: PASSED

- 파일: `src/components/DefenseChips.tsx`, `test/client/defenseChips.test.tsx` 존재.
- 커밋: `c513302` `0afb276` `879e5af` `c216e9a` `2a1abc4` 5개가 모두 HEAD 의 조상(merge-base 확인).
