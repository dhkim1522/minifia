---
phase: 21-cause-effect-missions
plan: "04"
subsystem: errand-rules
tags: [errand, night, record, mafia-fake-place-removal, evening-persistence]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-01 의 확장판 하루 순서(저녁 → 밤 → 아침 → 토론), 21-02 의 확장판 위 초록 시험
provides:
  - 모든 역할이 같은 저녁 처리 규칙(마피아도 3곳 처리) — 16페이즈 가짜 장소 제거
  - 저녁 목록·진행·목격 줄이 밤·아침을 지나 토론까지 서버에 남고 다음 저녁 enterErrand 가 지움
  - 토론 view 의 me.record 가 확장판 실제 흐름에서 나온다(옮겨 심기 없음)
affects: [21-05, 21-06, 21-13]
requirements-completed: [D-05, D-06, D-09, D-19]
actuals:
  tokens: 15000
  tasks: 2
  commits: 5
plan_head_before: 8d81d2024365c77b93944ac8a306ecdb20268f0c
plan_head_after: c1c001034fde74ef16d37b873410b71949f6797a
commits: 5
tech-stack:
  added: []
  patterns:
    - "서버 상태에 남는 키와 view 에 싣는 단계는 따로 — 남은 키는 view.ts 의 단계 문이 막는다(T-21-08)"
    - "저녁 값의 수명: enterErrand 가 쓰고 → 밤·아침·토론까지 남고 → 다음 enterErrand 가 지운다(errandNear 만 밤 진입이 지움)"
key-files:
  created:
    - test/worker/eveningRecord.test.ts
  modified:
    - shared/game/errand.ts
    - shared/game/tick.ts
    - shared/game/night.ts
    - shared/game/room.ts
    - worker/room.ts
    - test/unit/errand.test.ts
    - test/unit/errandNear.test.ts
    - test/unit/errandView.test.ts
    - test/unit/viewRoles15.test.ts
    - test/worker/errand.test.ts
    - test/worker/errandLeak.test.ts
    - test/worker/errandNear.test.ts
    - test/worker/townErrand.test.ts
    - test/worker/helpers.ts
  deleted:
    - shared/game/errandFake.ts
    - test/unit/errandFake.test.ts
key-decisions:
  - "가짜 장소는 걷어 낸다(겹치지 않고 대체) — 결정 기록(21-17 의 0088)에 '16페이즈 가짜 장소(0079 A1)는 21페이즈 심지 자르기로 대체' 를 남긴다"
  - "enterNight 는 nightPick·errandNear 만 지운다 — errandPlaces·errandDone·errandSeen 은 남긴다"
  - "view.ts 는 고치지 않았다 — me.errand(errand)·me.record(discussion) 단계 문이 이미 있다"
metrics:
  duration: 약 1시간
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 04: 가짜 장소 제거 · 저녁 목격 기록 유지 Summary

**16페이즈 마피아 가짜 심부름 장소(errandFake)를 걷어 내 모든 역할이 같은 처리 규칙을 받게 하고, 밤 진입이 저녁 목록·진행·목격 줄을 지우지 않게 해 확장판 토론 view 의 me.record 가 실제 흐름(저녁 → 밤 → 아침 → 토론)에서 나오게 했다. `npm test` 8646 통과·실패 0, `npm run typecheck` 초록.**

## 한 일

### Task 1 — 가짜 장소 제거 (`45221840` RED · `378f42b5` GREEN)
- 지운 것: `shared/game/errandFake.ts`, `test/unit/errandFake.test.ts`(git rm), tick.ts 의 errand 진입 훅 호출·import, errand.ts 의 가짜 제외 조건·구조 분해·머리 주석 문장, room.ts Player 의 `errandFake` 키와 주석, night.ts 구조 분해의 그 키, errandView.test 의 불필요한 구조 분해.
- worker/room.ts 봇 `errandGo` 는 가장 가까운 미완료 장소 하나로 단순해졌다(2단 반복 제거).
- errand.ts 머리 주석: "21페이즈: 16페이즈 가짜 장소는 심지 자르기(21-05, D-06)로 대체됐다".
- 시험(새 규칙으로 고침, 약화 아님): unit errand 의 「마피아 가짜 장소」 묶음을 「모든 역할이 같은 처리 규칙」으로 바꿨다(가짜 키 없음·마피아가 3곳 각각 처리·역할만 뒤집은 두 방의 같은 처리 결과·enterErrand 가 이전 저녁의 목록·진행·근처·목격 줄을 지움). 워커 errand 의 응답 동일성은 가짜 곁 응답 단언을 빼고 마피아·시민이 같은 목록 `[0]·[1]` 로 같은 응답(8개가 한 모양)이 되게 했고 마피아 3곳 처리 시험을 더했다. 봇 트레이서는 마피아 봇도 3/3. errandLeak ⑧ 은 「마피아도 같은 처리 규칙」으로 바꿨다(서버 상태·프레임에 `errandFake` 없음, 마피아 3곳 처리, 반경 밖 응답은 보낸 소켓 한 프레임·다른 소켓 0).
- `view.test`·`leak.test`·errandLeak 의 서버 전용 키 목록에 남은 `errandFake` 는 plan 지시대로 두었다(없는 키를 찾는 무해한 목록).

### Task 2 — 저녁 목격 기록을 토론까지 (`5b297f0e` RED · `96088778` GREEN · `c1c00103` 시험 정리)
- `enterNight` 가 지우는 키를 `nightPick`·`errandNear` 로 줄였다. 주석은 "21페이즈 D-09" 로 시작한다(night.ts 머리·enterNight 두 곳). room.ts Player 키 주석의 수명도 고쳤다.
- 새 `test/worker/eveningRecord.test.ts`(역할 citizen·mafia 각 3 it): 근처 표본 → A 가 errand 메시지로 3곳, B 가 2곳 처리 → 밤(마피아가 시민 X 선택) → 아침 → 토론: A 의 me.record = `[{seat:B, place:"glass"}]`, B 와 다른 사람은 키 없음 · me.errand/me.record 는 밤·아침 view 에 없고 errand/discussion 에만 · 다음 저녁 진입 뒤 서버의 A 에 errandSeen·errandNear 없음, errandDone `[]`, me.record 키 없음.
- 임시 옮겨 심기 걷어 냄: `eveningRowsOf`·`regraftEvening`(helpers.ts) 삭제, errandLeak `recordGame`·errandNear 「목격 기록」·townErrand 「벽 너머」는 실제 흐름으로, `viewRoles15` 의 `stateOf("discussion")` 는 저녁 상태에 값을 쓰고 `tick` 으로 밤을 지나 토론에 닿게 했다.

## RED 증거

1. `expected '[2,3]' to be '[]'` — 진입 직후 마피아 좌석 2·3 에 errandFake 키가 남음 (unit)
2. `expected '{"place":"glass","ok":false}' to be '{"place":"glass","ok":true}'` — 마피아가 가짜 장소를 처리하지 못함 (unit)
3. `expected '["glass","stool"]' to be '["glass","stool","piano"]'` — 워커: 마피아가 3곳 중 2곳에서 멈춤
4. `expected undefined to be '[{"seat":0,"place":"glass"}]'` — 밤 진입이 저녁 목격 줄을 지워 토론 me.record 가 없음 (eveningRecord)
5. `expected 'false:false' to be 'false:true'` — 토론 단계에서 hasKey errand:record 가 둘 다 false (eveningRecord)

## 밤 진입 규칙 변화

| 키 | 이전 | 지금 |
|----|------|------|
| nightPick | 밤 진입이 지움 | 같음 |
| errandNear | 밤 진입이 지움 | 같음 |
| errandPlaces·errandDone·errandSeen | 밤 진입이 지움 | **남김** — 토론 me.record 재료, 다음 저녁 enterErrand 가 지움 |
| errandFake | 밤 진입·저녁 진입이 지움 | 키 자체가 없다 |

## 시험 결과

- `npm test`: 293 파일 통과 · 6 건너뜀, 시험 8646 통과 · 262 건너뜀 · 실패 0. `npm run typecheck` 초록.
- `npm run typecheck`·task verify 는 각 단계 끝에 초록이었다(Task 1: 7개 파일 250 통과, Task 2: eveningRecord·night·view 194 통과).

## 위협 대응

- T-21-08(me.errand·me.record 단계 문): 서버에 키가 남아도 view 는 errand·discussion 에서만 싣는다 — eveningRecord 가 밤·아침 view 에 두 키가 없음과 두 키의 프레임 단계 집합(`["errand"]`·`["discussion"]`)을 단언한다.
- T-21-09(처리 응답 오라클): 처리 규칙에 역할 분기가 없다 — 워커 errand 가 마피아·시민 응답 8개가 한 모양임을, errandLeak ⑧ 이 마피아 응답이 한 프레임·다른 소켓 0 임을 단언한다.

## 21-05 에 넘기는 것

- **`errandDone` 이 밤·아침에도 남는다.** 가로등 공개 값(lampsShownOf·lampsLitOf)은 이것에서 파생한다. 다음 저녁의 `enterErrand` 가 `[]` 로 다시 쓴다. 죽은 사람의 값도 남지만 view 는 산 사람만 싣는다.
- **`errandNear` 는 밤 진입이 지운다**(어떤 view 에도 없는 서버 전용). 밤에는 근처 집합이 없다.
- 가짜 장소가 없어졌으니 마피아는 `[켜기]` 단추·진행 점이 시민과 같다 — 심지 자르기는 이 위에 선택 행동으로 얹는다(D-06). 봇 `errandGo` 는 가장 가까운 미완료 장소 하나로 걷는다(심지 자르기 봇 행동은 21-05 에서).
- 워커 시험 요령: 표본 알람이 누름과 겹치면 응답 프레임 수가 달라진다 — `writeRoomEdit` 으로 `errandTickAt` 을 멀리 미룬다(errandLeak ⑧ 에 같은 줄을 더했다).

## 21-13 에 넘기는 것

- `me.record` 는 토론 단계에서만 실린다(3곳을 모두 처리한 산 본인, 줄이 0개여도 빈 배열). 의심 보드의 목격 칩 재료다. 지금 줄은 `{seat, place}` 뿐이고 이 계획은 그 모양을 바꾸지 않았다.
- 확장판 토론은 밤·아침 뒤라 그 판의 아침 피해자가 이미 탈락한 상태에서 목격 줄이 나온다(줄에는 탈락자 좌석이 남을 수 있다 — 표시 규칙은 21-13 이 정한다).

## day.evidence 수명 (errandLeak ⑦ 검토)

- 이 계획은 `state.morning`·`errandLast` 수명을 건드리지 않아 ⑦ 의 단계 집합(`morning·discussion·nomination·errand`)은 그대로 초록이다. `enterNight` 는 여전히 `errandLast` 를 지우지 않고 다음 저녁 `enterErrand` 가 지운다. 21-06 현장·21-13 의심 보드가 증거 수명을 다르게 정하면 그때 같이 고친다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 새 규칙에 맞춘 시험] errandNear 의 enterNight 시험**
- **Found during:** Task 2 (npm test 전에 단위 묶음 실행에서)
- **Issue:** `test/unit/errandNear.test.ts` 「enterNight 은 둘 다 지운다」가 옛 기본판 규칙(밤이 errandSeen 을 지움)을 단언했다.
- **Fix:** 「errandNear 만 지우고 errandSeen·진행은 남기며 다음 enterErrand 가 지운다」로 고침(약화 아님 — 새 규칙 단언 + 다음 저녁 청소 단언 추가). GREEN 커밋에 합쳤다.
- **Files modified:** test/unit/errandNear.test.ts
- **Commit:** 96088778

**2. [Rule 3 - 계획 파일 목록 밖] 임시 옮겨 심기 시험 파일**
- **Found during:** Task 2
- **Issue:** 21-02 이월 항목(`eveningRowsOf`·`regraftEvening`·errandNear/townErrand/viewRoles15 의 옮겨 심기)이 plan 의 files 에 없었다. 호출자 지시로 이 계획에서 실제 흐름으로 바꿨다.
- **Files modified:** test/worker/helpers.ts, test/worker/errandNear.test.ts, test/worker/townErrand.test.ts, test/worker/errandLeak.test.ts, test/unit/viewRoles15.test.ts
- **Commit:** c1c00103

**3. [Rule 1 - 시험 안정화] errandLeak ⑧ 의 표본 알람 미루기**
- **Found during:** Task 1 GREEN
- **Issue:** 마피아가 3곳을 처리하는 동안 실제 시간 표본이 누름과 겹쳐 다른 소켓에 프레임 1개가 가 `others:1` 이 됐다(20-03 과 같은 원인).
- **Fix:** 시험 시작에서 `errandTickAt` 을 멀리 미뤘다.
- **Commit:** 378f42b5

## Known Stubs

None.

## Threat Flags

None — 새 네트워크 경로·권한 경계 없음. 서버 상태에 남는 키가 늘었으나(errandPlaces·errandDone·errandSeen 의 수명) view 단계 문이 그대로라 새 경로는 없다.

## Self-Check: PASSED

- 파일: `test/worker/eveningRecord.test.ts` 있음, `shared/game/errandFake.ts`·`test/unit/errandFake.test.ts` 없음, `grep -c "21-05" shared/game/errand.ts` = 1, `grep -c "21페이즈 D-09" shared/game/night.ts` = 3.
- 커밋: 45221840·378f42b5·5b297f0e·96088778·c1c00103 모두 HEAD 의 조상.
