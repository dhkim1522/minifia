---
phase: 09-night-morning
plan: "18"
subsystem: client-night-morning-announce
tags: [announce, morning, night, police-card, tdd, tracer, wire-cleanup]
status: complete

requires:
  - phase: 09-night-morning
    provides: 채팅 카드와 addLocalCard (09-11), 지도 밤 마피아 화면 (09-13), 밤 얼굴 목록 (09-15), 누설 시험 (09-16), 유언·쪽지 화면 (09-17), 서버가 phrase 를 안 채움 (09-07)
provides:
  - src/game/eliminationText.ts — MORNING_TEXT·morningText(morning, nicknameOf) (세 문장 + 피해자 본인 문장). v1.0 표·함수 전부 삭제
  - src/game/dayView.ts — 밤·아침 알림 시간표 상수, AnnounceIcon, DayEvents.localCards, policeResultOf(prev, cur)
  - src/net/useDayFx.ts — announce 가 { text, icon? }, 경찰 로컬 카드를 later 로 addLocalCard
  - src/components/ResultAnnounce.tsx — 아이콘 56 (target 진홍, heal·ghost gray-300)
  - shared/protocol.ts — MORNING_PHRASE_COUNT·MorningView.phrase 삭제 (MorningView 는 eliminated·saved 둘)
  - dayStaticGuard 에 결정 0061-17 삭제 이름과 MorningView 필드 검사
affects: [09-19, 09-20, 09-22]

actuals:
  tokens: 17400
  tasks: 3
  commits: 6
plan_head_before: bee4eed69ca5f8c615d3ba319741aa4ad84a3570
plan_head_after: 31e73e46e48ac909755c7459508837b67f6b0699

tech-stack:
  added: []
  patterns:
    - "알림 문장·아이콘·시각은 순수 모듈 dayEvents 가 정하고 useDayFx 는 시계로 띄울 뿐이다. 경찰 결과는 본인 me.records 의 새 줄(policeResultOf)에서만 만든다"
    - "36px 알림은 한 번에 하나: 피해자 본인 0.7초가 경찰 2.6초·보통 0.4초보다 우선 (가정 A2)"

key-files:
  created: []
  modified:
    - src/game/eliminationText.ts
    - src/game/dayView.ts
    - src/net/useDayFx.ts
    - src/components/ResultAnnounce.tsx
    - src/screens/GameMap.tsx
    - src/screens/RoomScreen.tsx
    - src/styles/game.css
    - src/styles/phase.css
    - shared/protocol.ts
    - test/unit/eliminationText.test.ts
    - test/unit/dayView.test.ts
    - test/unit/dayStaticGuard.test.ts
    - test/client/nightMap.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/client/atmosphere.test.tsx

key-decisions:
  - "경찰 화면의 채팅 hot 줄도 알림과 같은 2.6초에 남긴다(보통 화면은 0.4초). 피해자 본인의 hot 줄은 다른 사람과 같은 문장을 0.4초에 남긴다"
  - "RoomScreen aria-live 의 피해자 본인 판정은 view 하나로 한다: day.morning.eliminated 가 내 seat 이면 '암살당했습니다'. 처형으로 이미 유령인 사람은 세 문장을 읽는다"
  - "경찰 결과 문구('마피아'/'마피아 아님')는 dayView 의 모듈 상수 POLICE_TEXT 로 두고 policeResultOf 가 null 이 아닌 분기 안에서만 쓴다(DAY_COPY 에 넣지 않음)"
  - "밤 진입 '밤이 되었습니다' 는 이전 단계가 무엇이든(첫 스냅샷·reset 제외) 뜬다. 처형 없음으로 온 밤은 그 알림 1.4초 뒤에 이어진다"

requirements-completed: []
---

# Phase 9 Plan 18: 밤·아침 알림 연출 Summary

**아침에 세 문장(당했습니다 / 누군가 살아났습니다 / 아무 일도 없었습니다)을 0.4초에 아이콘과 함께 띄우고, 밤 진입·피해자·경찰 순서를 정했으며, 서버·와이어에 남은 v1.0 아침 문구 번호를 화면과 함께 지웠다.**

## 한 일

- **Task 1 (트레이서)**: `morningText` 로 문장 표를 바꾸고 dayEvents 아침 분기(0.4초, 2.4초, 같은 문장 hot 줄 범위 all), useDayFx 의 옛 임시 알림 삭제, ResultAnnounce 아이콘 56. 36px 글자는 그대로 keep-all 로 감긴다.
- **Task 2**: 밤 진입 '밤이 되었습니다' 1.6초(처형 없음 뒤로 밀기), 피해자 본인 '암살당했습니다'(ghost, 0.7초 2초), `policeResultOf`, 경찰 화면 알림 2.6초·카드 2.4초(`addLocalCard`, 그 화면에만). 의사가 살린 사람의 알림은 다른 시민과 같다.
- **Task 3**: protocol 의 문구 수 상수·`MorningView.phrase` 삭제, RoomScreen aria-live 개정, dayStaticGuard 목록(결정 0061-17)과 MorningView 필드 검사 추가.

## 커밋 (6)

| 순서 | 해시 | 내용 |
|------|------|------|
| RED 1 | e4769c8 | 아침 알림 실패 시험 |
| GREEN 1 | c7c97de | 아침 알림 세 문장·아이콘·시각 |
| RED 2 | b509da7 | 밤 진입·피해자·경찰 실패 시험 |
| GREEN 2 | e8d9d97 | 밤 진입·피해자·경찰 로컬 카드 |
| RED 3 | 5570145 | 삭제 가드·aria 실패 시험 |
| GREEN 3 | 31e73e4 | 와이어 문구 번호 삭제·aria 개정 |

## 검증

- `npm run typecheck` 통과. 전체 `npx vitest run`: 4060 통과·1건 실패(`test/worker/testTools.test.ts` ended 시험, 알려진 부하 불안정) — 그 파일만 다시 돌리면 31건 통과.
- `grep -c PHRASE shared/protocol.ts` = 0, `git grep .skip(/.todo( -- test` 0건.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 에서 RoomScreen aria 와 phaseScreens 시험을 함께 고침**
- **Found during:** Task 1 GREEN
- **Issue:** `morningCardText` 를 지우자 RoomScreen 의 aria-live 가 호출해 화면이 터졌다
- **Fix:** Task 1 에서 `morningText` 로 바꾸고, 피해자 본인 분기는 Task 3 에서 더했다
- **Commit:** c7c97de, 31e73e4

**2. [Rule 3 - Blocking] 진홍 규칙을 game.css 가 아닌 phase.css 에 둠**
- **Issue:** `verdictScreen.test` 가 game.css 의 "crimson" 글자를 금지하고 v2.css 는 crimson-300 만 허용
- **Fix:** `.mf-announce__icon.is-death { color: var(--crimson-400) }` 를 진홍 예약 규칙이 모인 `src/styles/phase.css` 에 둠
- **Files modified:** src/styles/phase.css

**3. [Rule 1 - Bug] 옛 시험이 새 동작과 어긋나 고침**
- `dayView.test` 의 "밤 → 아침 줄이 없다"·"처형 → 밤 알림 없음", `nightMap.test` 의 옛 아침 임시 틀 시험, `atmosphere.test`·`phaseScreens.test` 의 `phrase` 필드

**4. [계획과 다른 파일] aria 시험 위치**: 계획은 `roomScreen.test.tsx` 와 `view.test.ts` 를 적었으나, aria-live 아침 시험은 `phaseScreens.test.tsx` 에 있고 `view.test.ts` 는 문구 수 상수를 import 하지 않았다(수정 없음). `roomScreen.test.tsx` 도 수정 없음.

## Known Stubs

없음.

## Threat Flags

없음 (T-09-40·T-09-41 은 시험으로 닫음: 시민 view addLocalCard 0회·결과 문구 DOM 0건, 구출된 사람과 다른 시민의 알림 동일).

## 이월

- 경찰 eye 카드는 로컬 줄이라 채팅 저장소 순서상 서버 카드(2.8초 공개)보다 뒤에 놓인다 — 시간순 겹침의 육안 확인은 실기기 이월.
- `scripts/smoke.mjs`·`scripts/uat-night.mjs` 의 `phrase`·`MORNING_PHRASE_COUNT` 단언은 09-19 가 고친다(가드 범위 밖).
- 요구사항: MORN-02·MORN-03 은 이미 완료 표시(09-14·09-07). NIGHT-11 은 암살 번쩍임·베기(09-20)가 끝나야 하므로 이 계획에서 완료 처리하지 않음.

## Self-Check: PASSED

- 수정 파일 15개 존재, 커밋 6개 모두 HEAD 의 조상.
