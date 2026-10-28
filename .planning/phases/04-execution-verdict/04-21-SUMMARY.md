---
phase: 04-execution-verdict
plan: 21
subsystem: verdict-screens-defense-stage
tags: [defense, DayTable, verdict, center, cone, backdrop-filter, DefensePanel, seatFloats, tdd]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-13 verdict.ts(candidateCenter·VERDICT_*·CONE_*·defenseStatus/defenseDisconnected/defenseInstruction/defenseAnnounce·VERDICT_TEXT), 04-18~04-20 verdictScene 분기 패턴·DayTable halo/layer 슬롯·capHalos"
provides:
  - "DayTable verdict·center — root `verdict?: {dimPercent, blurPx}` 는 어둡게+흐림 층(.mf-dt__dim--verdict, z 30, 수치는 CSS 변수 --mf-verdict-dim·--mf-verdict-blur 만)과 루트 클래스 mf-dt--verdict(좌석·이름표 left/top/transform 전이 600ms ease-in-out). 좌석 `center` 는 그 자리를 candidateCenter 한 곳의 가운데 자리(x=장면 폭/2, 발 y, 배율 1.7, 이름표 발 y+8, 그림 z 31·이름표 z 32, 이모티콘은 후보 머리 위)로 옮기고 원뿔(.mf-dt__cone 300×340, 아래끝=발 y+8, z 30, 어둡게 층 뒤) 하나를 그린다. 위치는 placeOf 한 함수를 지나므로 기본 좌석과 같은 경로다"
  - "verdict.css 무대 규칙 — 어둡게(backdrop-filter+-webkit- 접두어, 400ms 페이드)·원뿔(clip-path·그라데이션, 200ms 지연 500ms 페이드)·후보 이동 전이·`.mf-dayscene--verdict` 헤더·하단 패널 z 3·축소 모션(즉시 이동, 어둡게·원뿔 150ms 페이드)"
  - "DefensePanel — 후보가 아닌 사람의 변론 하단: MessageLog(후보 변론만, ^ 포함) + `{이름}님이 변론하는 중 · N초`(끊김이면 `{이름}님은 연결이 끊겨 있어요`) + 44×44 이모티콘 → 트레이 → {t:'emoji'}(useSendLock), 탈락 viewer 는 채팅(읽기) + 관전 알약. TurnPanel 의 클래스를 그대로 쓴다"
  - "seatFloats FLOAT_PHASES·CHAT_PHASES 에 defense 추가(공개·처형·종료·투표 단계는 그대로 없음)"
  - "verdictScene defense 분기 + VerdictScene.rootClassName·tableProps(verdict) — DayScene 은 값만 잇는다. RoomScreen defense 라우팅(sceneKey·case)·PHASE_ANNOUNCE.defense(후보 본인/남)"
affects: [04-22 — 후보 본인 하단(NightPanel 자리)에 칩 6개·전송·보냈어요 줄을 더한다, 04-23 — 처형 단계가 같은 center·verdict 무대를 이어 쓴다, 04-35 — 배포본에서 흐림(iOS)·가독성 실기기 확인]

actuals:
  tokens: 13300
  tasks: 3
  commits: 6
plan_head_before: a938ff4fadba9fc1bbbbd965c81ea13646c7d37a
plan_head_after: ac4dee7de310fd457304ffe52760408dc96bf951

tech-stack:
  added: []
  patterns:
    - "DayTable 은 45·3 같은 연출 수치를 모른다: 화면 조립(verdictScene)이 상수 VERDICT_DIM_PERCENT·VERDICT_BLUR_PX 를 prop 으로 주고 DayTable 은 CSS 변수로만 내린다. 후보 위치 공식은 candidateCenter 한 곳"
    - "단계 장면이 DayScene 에 주는 값은 `rootClassName`·`tableProps` 로 늘려 간다(DayScene 은 이어 붙이기만)"
    - "후보 이동은 같은 DOM 노드의 left/top/transform 이 바뀌는 CSS 전이다 — 루트 mf-dt--verdict 클래스가 같은 커밋에 붙어 전이가 돈다"

key-files:
  created:
    - src/components/DefensePanel.tsx
    - test/client/defense.test.tsx
  modified:
    - src/components/DayTable.tsx
    - src/styles/verdict.css
    - src/net/seatFloats.ts
    - src/screens/verdictScene.tsx
    - src/screens/DayScene.tsx
    - src/screens/RoomScreen.tsx
    - test/client/dayTable.test.tsx
    - test/client/seatFloats.test.tsx

key-decisions:
  - "candidateCenter 는 {x, footY, scale, tagTop} 만 주므로 그림 상자·이모티콘 좌표(figLeft/figTop/emojiLeft/emojiTop)는 DayTable 의 placeOf 가 그 값에서 같은 규칙(발 기준 72×96, EMOJI_LIFT)으로 만든다. 공식 자체(cy+80, sceneH−34)는 candidateCenter 에만 있고 시험이 DayTable 에 그 숫자가 없음을 확인한다"
  - "verdict 와 아침 dim 을 함께 주면 verdict 층 하나만 그린다(층이 둘이면 이중으로 어두워진다)"
  - "서버 이상(day.candidate 없음)이면 center·verdict·rootClassName 없이 NightPanel(`최후 변론` + 기존 문구 `곧 다음으로 넘어가요`)로 그린다. VERDICT_TEXT 에 키를 더하지 않았다(test/unit/verdict.test.ts 가 모든 값을 UI-SPEC 문서에서 찾는다)"
  - "verdict.css 의 무대 규칙을 파일 끝이 아니라 '과반 확정 두근' 구역 앞에 두었다 — 04-20 의 축소 모션 시험이 파일의 마지막 @media 를 읽는다(그 시험은 그대로 둠)"
  - "마피아 동료 진홍 후광은 capHalos 한 곳: 후보 흰 1 + 진홍 합이 3 을 넘으면 번호가 큰 진홍부터 꺼지고 마름모는 남는다"

requirements-completed: []  # VOTE-03·COMM-03·CONN-02 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: D1
    description: "최후 변론에서 후보 캐릭터가 테이블 가운데로 600ms ease-in-out 이동·1.7배, 나머지는 한 값(45%)으로 어두워지고 3px 흐려지며 원뿔 하나만 위에서 내려온다. 후보 좌석 z 31·이름표 32, 어둡게·원뿔 30, 다른 좌석 ≤ 22, 이모티콘 60+, 헤더·하단 패널 z 3 (VOTE-03, D-15·D-29·D-38)"
    requirement: "VOTE-03"
    verification:
      - kind: unit
        ref: "dayTable.test.tsx(verdict·center 11개: 변수·원뿔 크기/위치·좌표·z·폰 폭 4종×높이 2종 이름표 ≤ 장면−4·CSS 규칙) + defense.test.tsx(RoomScreen 한 경로)"
        status: pass
      - kind: manual_procedural
        ref: "npm run dev + 테스트 방(봇 5, 봇 투표 other/host) + 헤드리스 Chrome 390x844·360x640·축소 모션: rAF 프레임 기록(후보 x 69→195, 폭 68→122, 어둡게 400ms·원뿔 200ms 지연 500ms 페이드), 계산 스타일(backdrop-filter blur(3px), 배경 night-900 45%), 스크린샷 육안 확인"
        status: pass
    human_judgment: true
  - id: D2
    description: "후보가 아닌 생존자 하단: 후보 변론만 보이는 채팅 3줄 + `{이름}님이 변론하는 중 · N초` + 44×44 이모티콘. 탈락 viewer 는 채팅 3줄 + 관전 알약. 후보가 끊겨 있으면 `{이름}님은 연결이 끊겨 있어요` + 이모티콘만 (COMM-03, D-05·D-13·D-35·D-36)"
    requirement: "COMM-03"
    verification:
      - kind: unit
        ref: "defense.test.tsx(DefensePanel 16개: 구조·상태 줄·초·줄·^·끊김·마감 없음·이스케이프·이모티콘 전송/잠금/BAD_MESSAGE 토스트/언마운트·관전·직업 비공개 T-04-57)"
        status: pass
      - kind: manual_procedural
        ref: "헤드리스 Chrome: 하단 `봇가나다라님이 변론하는 중 9초` + 이모티콘 버튼, 이모티콘 트레이 열기→전송(머리 위 이모티콘이 층 위로 표시)"
        status: pass
    human_judgment: false
  - id: D3
    description: "변론 중 chat·emoji 이벤트가 말풍선·이모티콘·채팅 줄로 나타난다. 공개·처형·종료 단계에는 수집하지 않는다 (FLOAT_PHASES·CHAT_PHASES)"
    requirement: "COMM-03"
    verification:
      - kind: unit
        ref: "seatFloats.test.tsx(defense 수집·열쇠 변경으로 비움·다른 단계 무시·defense→execution 정리) + defense.test.tsx(말풍선·채팅 줄·z 60+·공개 단계 무시)"
        status: pass
    human_judgment: false
  - id: D4
    description: "흐림(backdrop-filter)이 배경 그림까지 흐리게 하는가, 어둡게 45%·흐림 3px 의 가독성 — 실제 폰(iOS Safari 포함)"
    requirement: "VOTE-03"
    verification:
      - kind: manual_procedural
        ref: "헤드리스 Chrome(데스크톱 엔진)에서는 배경 창 그림·다른 좌석·이름표가 모두 흐려지고 어두워지며 후보·헤더·패널은 선명하다(스크린샷 확인). iOS Safari 는 확인하지 못했다 — 04-35 배포 뒤 사용자 실기기"
        status: partial
    human_judgment: true
---

# Phase 4 Plan 21: 최후 변론 무대(후보 가운데·어둡게+흐림·원뿔·남의 하단) Summary

**최후 변론 단계가 `연결 중…` 이 아니라 무대로 그려진다: 후보가 600ms 에 걸쳐 테이블 가운데로 나와 1.7배로 커지고, 나머지는 한 값으로 어두워지고 3px 흐려지며, 위에서 내려오는 원뿔 하나가 후보를 비춘다. 후보가 아닌 사람은 후보의 변론 채팅·`변론하는 중 · N초`·이모티콘을, 탈락자는 관전 알약을 본다.**

## 한 일

**Task 1 — DayTable verdict·center** — RED `380998a` → GREEN `b245364`
- `verdict` prop → `.mf-dt__dim--verdict`(z 30, `color-mix(night-900 var(--mf-verdict-dim))` + `backdrop-filter`·`-webkit-backdrop-filter: blur(var(--mf-verdict-blur))`, 위·아래 넉넉히 뻗어 `.mf-dayscene` 의 잘림에 맡김). 루트에 `mf-dt--verdict`. 좌석 `center` → `placeOf` 가 `candidateCenter` 값으로 좌표·z 를 덮고 원뿔 하나(`CONE_W×CONE_H`, 아래끝 = 발 y + 8)를 어둡게 층 뒤에 그린다. center 가 없는 좌석은 기존 좌표와 문자열까지 같다(시험).
- CSS: 400ms 어둡게 페이드, 원뿔 200ms 지연 500ms 페이드(`clip-path: polygon(41% 0, 59% 0, 100% 100%, 0 100%)`·`--cone-light` 55%→20%), `.mf-dt--verdict` 아래 좌석·이름표 600ms ease-in-out 전이, `.mf-dayscene--verdict` 아래 헤더 래퍼·하단 패널 `position: relative; z-index: 3`, 축소 모션(전이 없음·150ms 페이드, 전역 0.01ms 규칙을 이긴다).

**Task 2 — 수집과 DefensePanel** — RED `b0e6a29` → GREEN `9478951`
- `FLOAT_PHASES`·`CHAT_PHASES` 에 `defense` 추가(머리 주석 갱신). `DefensePanel` 신설(TurnPanel 클래스 그대로, 문구는 verdict.ts 함수, 카운트다운 `useCountdown`, 합산 쿨다운 `useSendLock`, 닉네임·숫자는 React 텍스트).

**Task 3 — 단계 연결** — RED `c6b66d4` → GREEN `ac4dee7`
- `verdictScene` defense 분기: 제목 `낮 · 최후 변론`, 안내 `defenseInstruction`, 후보 좌석 `center` + 흰 후광(`capHalos`, 진홍 동료와 합 3 상한), `verdict` 상수 전달, 루트 클래스 `mf-dayscene--verdict`, 하단은 후보 본인이면 `NightPanel`(제목·안내), 아니면 `DefensePanel`(탈락 viewer 는 readOnly). 좌석에 `onPick`·`onInspect` 없음. `DayScene` 은 `rootClassName`·`tableProps` 를 이을 뿐(`chatLines` 를 `lines` 로 넘기는 값 하나 포함). `RoomScreen` 은 `sceneKey`·`case "defense"`·단계 안내(`{이름}님의 최후 변론` / `내 최후 변론. 변론할 말을 고르세요`).

커밋 6개(RED 3 + GREEN 3): `380998a` `b245364` `b0e6a29` `9478951` `c6b66d4` `ac4dee7`.

## 검증

- `npm test`: 94 파일 2448 통과(04-20 직후 2405 → 새 시험 43개). `npm run typecheck`(토큰 검사 + wrangler types + 두 tsc) 종료 코드 0. 범위 tsc 통과. `npm run build` 종료 코드 0.
- 수용 기준: `mf-dt__cone` DayTable.tsx 1·verdict.css 2, `candidateCenter` DayTable.tsx 2, `backdrop-filter` verdict.css 6, `defense` seatFloats.ts 3, `case "defense"` RoomScreen.tsx 1, `DefensePanel` verdictScene.tsx 2, `VERDICT_DIM_PERCENT` verdictScene.tsx 있음, 새 파일 `DefensePanel.tsx`·`defense.test.tsx` 존재.
- 기존 시험 변경: `seatFloats.test.tsx` 의 두 집합 단언(CHAT_PHASES·FLOAT_PHASES)에 defense 를 더했다(계획이 요구한 변경). 그 밖의 기존 시험은 그대로 통과.

### 브라우저에서 실제로 그려지는지 (정직한 보고)

**확인했다.** `vite dev`(내가 띄운 npm PID 38604·vite PID 38628·그 자식 PID 38696 만 종료함)와 스크래치패드의 일회용 스크립트 `verify-defense21.mjs`(`verify-arrow20.mjs` 를 고쳐 만듦, 저장소에 넣지 않음)로 테스트 방(봇 5 + 방장, 봇 투표 `exec: yes`·`pick: other`/`host`)을 만들고 헤드리스 Chrome 방장으로 낮 토론 → 처형 여부 → 후보 선택 → 공개 → 변론까지 갔다.
1. **남의 변론(390×844)**: 헤더 `낮 · 최후 변론`/`1일차 · 봇가나다라님의 변론`, 루트 `mf-dayscene--verdict`, 어둡게 층 하나(계산된 배경 `night-900` 45%, `backdrop-filter: blur(3px)`, z 30), 원뿔 하나(`clip-path` polygon, 300×340, 위쪽이 헤더 영역으로 올라감), 후보 그림 `z-index 31`·`scale(1.7)`, 흰 후광 하나, 헤더·패널 `z-index 3`, 하단 `봇가나다라님이 변론하는 중 9초`+이모티콘 버튼, 가로·세로 스크롤 없음, 콘솔 오류 0. 스크린샷을 눈으로 읽었다: **배경의 창 그림·다른 캐릭터·이름표가 모두 어둡고 흐리며(배경 그림까지 흐려짐), 후보와 헤더·타이머·하단 패널은 선명하고, 후보가 원뿔 빛 한가운데 서 있다**.
2. **이동·페이드 타이밍(rAF 프레임 기록)**: 후보 그림 가운데 x 69 → 195(= 폭/2), 폭 68 → 122, 발 y 379 → 409 가 약 600ms 동안 ease-in-out 으로 변했고, 어둡게 층 불투명도는 0 → 1(약 400ms), 원뿔은 약 200ms 뒤부터 0 → 1(약 500ms).
3. **축소 모션**: 첫 프레임부터 후보가 가운데에 있고(전이 없음) 어둡게·원뿔이 각 150ms 에 0 → 1 로 같이 페이드.
4. **360×640**: 장면 높이 364 에서 후보 이름표 아래끝 443 ≤ 장면 아래 483 − 4, 가로 스크롤 없음.
5. **후보 본인(host 후보)**: `1일차 · 내 변론`, 하단은 제목 `변론할 말을 고르세요` + 안내 `한 번에 하나씩 보낼 수 있어요`(칩 자리는 04-22).
6. **이모티콘**: 하단 버튼 → 트레이 → 칸 선택 시 머리 위 이모티콘이 어둡게 층 위(z 60+)로 떠 후보 위에 그려졌다.

**확인하지 못한 것(사용자 실기기·배포 뒤):** **iOS Safari 에서 `backdrop-filter` 가 배경 그림까지 흐리게 하는가** — 헤드리스 Chrome 은 흐리게 했지만 UI-SPEC 12.3 이 경고한 iOS 의 조상 `isolation`·`opacity` 애니메이션 문제는 재현할 수 없다. 안 되면 대체안(`Backdrop` 에 `mf-backdrop--blur`, 좌석 `img`·이름표에 같은 filter) 또는 `VERDICT_BLUR_PX = 0` 폴백을 쓴다. 어둡게 45%·흐림 3px 의 실제 가독성(D-38), 8명판 프레임 드랍, 실제 폰에서 600ms 이동의 부드러움, 후보 연결 끊김 화면(끊김 흐림+흰 후광은 단위 시험으로만, 브라우저에서는 만들지 못함), 탈락 viewer 의 변론 화면, 마피아·관전자 진홍 후광 합 3 초과(단위 시험으로만), 배포본.

## 관찰·남은 확인

- **내 자리가 테이블 앞(아래 가운데)에 있으면 후보의 가운데 자리(`cy + 80`)와 겹쳐 내 캐릭터는 후보 뒤에 가려진다**(4~6명 판에서 내 자리 slot 0 이 아래 가운데). 내 이름표도 후보 이름표(z 32)·그림(31) 아래라 거의 안 보이고, 내가 보낸 이모티콘은 후보 얼굴 위에 뜬다(스크린샷). UI-SPEC 8.4 의 공식을 그대로 구현한 결과이고 시안 DB 도 같은 위치지만, 의도인지 사용자가 확인하면 좋다(내 자리 가림이 거슬리면 후보 발 y 오프셋·내 이름표 처리를 04-23 이전에 조정).
- 후보 이름표 높이가 브라우저에서 26(테두리 포함)으로 측정됐다 — 기존 이름표 규칙(`height 22` + 글자)과 같은 부품이라 이 계획에서 바꾸지 않았다. 아래끝 여유는 충분하다.
- 04-20 열린 항목(첫 표 선두 큰 칩·느린 박동 주기)은 변경 없음. **사용자 결정(첫 표 선두 동작 유지)은 그대로 따른다.**
- 이 계획은 `main` 에서 사용자 지시대로 순차 실행해 `main` 에 직접 커밋했다(보호 브랜치 점검은 사용자 지시가 우선). 배포하지 않았다.

## Deviations from Plan

### 자동 수정

없음 — 계획대로 진행했다.

### 계획과 다르게 한 것

- `candidateCenter` 가 `figLeft·figTop·tagLeft·emojiTop` 을 주지 않아(`{x, footY, scale, tagTop}` 만) DayTable 의 `placeOf` 가 같은 규칙으로 파생했다(계획 문구의 괄호 목록과 다른 점). 공식은 여전히 verdict.ts 한 곳이다.
- 서버 이상 대체 하단의 문구를 새 키로 만들지 않고 리터럴 `최후 변론` + 기존 `executionDoneHint` 를 썼다(unit 시험이 모든 VERDICT_TEXT 값을 UI-SPEC 에서 찾기 때문).
- 무대 CSS 를 verdict.css 끝이 아니라 확정 두근 구역 앞에 두었다(위 key-decisions).

## Known Stubs

- 후보 본인 하단은 제목·안내뿐이다(칩 6개·전송·`보냈어요` 줄 없음) — 계획이 04-22 로 넘긴 범위다. 하단 높이도 157 그대로(236 은 04-22). 이 상태로는 후보 본인이 변론할 수 없으므로 04-22 전에는 배포하지 않는다(04-35 에서만 배포).
- execution·ended 화면은 04-23 이후 범위라 변론 마감 뒤 여전히 `연결 중…` 이다 — 배포 금지 상태 유지.

## Threat Flags

없음. 새 네트워크 경로·권한 경로·스키마 변경이 없다. T-04-57(후보의 직업 노출)은 DefensePanel 입력에 역할 필드가 없고 직업 문구 표를 읽지 않음을 시험(소스·props)으로, T-04-58 은 비후보에게 칩 UI 가 없음으로 확인했다.

## Self-Check: PASSED

- 파일: `src/components/DefensePanel.tsx`, `test/client/defense.test.tsx` 존재.
- 커밋: `git log --oneline a938ff4..ac4dee7` 6개가 모두 HEAD 의 조상.
