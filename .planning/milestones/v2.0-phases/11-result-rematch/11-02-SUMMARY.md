---
phase: 11-result-rematch
plan: "02"
subsystem: shared/game
tags: [awards, result, tdd, leak]
requires: [11-01]
provides: [computeAwards, AwardLine, result.awards]
affects: [11-09]
tech-stack:
  added: []
  patterns: [칭호 표(데이터) 훑기 배정, Proxy 읽기 키 시험, 합성 판 속성 시험]
key-files:
  created:
    - shared/game/awards.ts
    - test/unit/awards.test.ts
    - test/unit/awardsProps.test.ts
    - test/helpers/awardsState.ts
    - test/worker/awards.test.ts
  modified:
    - shared/protocol.ts
    - shared/game/view.ts
    - test/unit/view.test.ts
    - test/unit/endgame.test.ts
    - test/worker/leak.test.ts
decisions:
  - "칭호 한 개는 한 사람만 받는다(후보 정렬 첫째). 점수 최소값은 AWARD_MIN 한 곳."
status: complete
commits: 5
plan_head_before: 24e52f4ad8246da0f24a51eb6c2da435b96e09f5
plan_head_after: f5782785e5282cdd6a4e7830f6dfb3e1fe47fc97
actuals:
  tokens: 12000
  tasks: 3
  commits: 5
completed: 2026-11-05
requirements: [END-04]
---

# Phase 11 Plan 02: 시상 칭호 computeAwards Summary

ended view 의 `result.awards` 로 서버가 정렬까지 끝낸 칭호 패 목록(참가자 한 명에 한 장, 난수 없음, 공개 사실만 읽음)을 모든 신분에게 같게 싣는다.

## 한 일

- Task 1 (tracer): protocol 에 `AWARD_IDS`·`AwardId`·`AwardLine`·`GameResult.awards?`, `shared/game/awards.ts`(`eliminationOf`, 대체 칭호, 팀·좌석 정렬), `buildView` ended 분기에서만 `awards: computeAwards(state)`. 워커 4명 판에서 모든 소켓이 같은 목록을 받는다.
- Task 2: 칭호 열 개(actor detective angel whiff target firstVictim talker swapper whisperer mood)를 데이터 표 `SPECS` 로 두고 배정 루프가 큰 → 중간 → 작은 순으로 훑는다. 비교 함수 하나가 점수 → 생존자 → 더 늦은 탈락(밤이 낮보다 늦음) → 낮은 좌석을 맡는다. 최소 점수는 `AWARD_MIN`.
- Task 3: 합성 판 300개 속성 시험(한 사람에 한 장, 결정성, 좌석 중복 없음, 마지막 패는 이긴 팀, 정렬 단조, 대체 칭호 대상, 12개 칭호가 모두 실제로 나옴), Proxy 읽기 경로 시험(L37), 6명 판 전수 검사에 awards 0건/동일/재접속 단언(L35·L36).
- 제품 코드는 Task 1·2 에서 끝났고 Task 3 시험이 결함을 찾지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막는 이슈] result 키 목록을 고정한 기존 시험 갱신**
- **Found during:** Task 1·3 (view.test 의 `result keys`, endgame.test 의 `Object.keys(result)`)
- **Fix:** 기대 키를 `awards,seats,summary,winner` 로. view.test 에는 awards 줄 키 허용 목록(`award,seat` / `award,k,seat` / `at,award,k,seat`)과 길이 == 참가자 수 단언을 더했다(계획의 "허용 경로 `.result.awards[].seat|award|k|at`" 에 해당). 값 집합 허용표(ALLOWED_ROLE_VALUE_PATHS)는 칭호 id 가 직업 단어가 아니라 넓히지 않았다.
- **Commits:** d1c1275c, f5782785

**2. [시험 설계 정정] Task 1 시험의 "대체 칭호만" 기대값**
- 실제 규칙상 마피아를 셋이 가리키면 target(k=3), 첫 밤 사망자는 firstVictim 이라 "대체 칭호만" 인 판은 만들기 어렵다. 기대값을 실제 규칙에 맞게 고쳤다(워커: 마피아가 target k=3 으로 맨 앞). Commit 4d30e860.

## Known Stubs

없음.

## Threat Flags

없음 (새 엔드포인트·저장 없음. T-11-04/05/06 은 Proxy 읽기 키 시험·6명 판 전수 검사·결정성 속성 시험으로 닫음).

## 검증

- `npx vitest run` 대상: awards(단위 35), awardsProps(2), worker awards(3), leak, view, endgame(단위·워커) 모두 초록. worker endgame 은 병렬 실행에서 한 번 흔들렸고 단독 재실행에서 통과(알려진 흔들림).
- `npm run typecheck`: 이 계획 파일 오류 없음. 12페이즈 작업 트리의 `test/unit/soundRecipes.test.ts`(src/audio/recipes 없음)만 오류 — 이 계획 범위 밖, 건드리지 않음. 전체 회귀·nightload·웨이브 게이트는 지시대로 돌리지 않음.

## 이월 메모

- `AwardLine { seat: number; award: AwardId; k?: number; at?: "day" | "night" }`, `AWARD_IDS` 순서: actor detective angel whiff target firstVictim talker swapper whisperer mood survivor spectator (shared/protocol.ts). `GameResult.awards?` 는 서버가 항상 채운다.
- 패 순서는 서버가 이미 정렬해 싣는다: 진 팀 → 이긴 팀, 대체 → 작은 → 중간 → 큰, 낮은 좌석. 화면(11-09)은 재정렬하지 않고 순서대로 재생하며 마지막 패가 이긴 팀의 가장 큰 칭호다.
- k 의미: actor=거짓 주장 일수, detective=적중 지목 수, angel=구출 수, whiff=헛다리 수, target=받은 지목 수, firstVictim=죽은 일차, talker=say, swapper=말 바꿈 수, whisperer=보낸 귓속말 수, mood=emote, spectator=탈락 일차(+at), survivor=k 없음. 이유 문구는 화면 몫.
- 칭호 한 개는 한 사람만 받는다. 한 사람은 한 장. 후보가 없으면 그 칭호는 목록에 없으니 화면은 "열 개가 다 있다" 고 가정하지 않는다(패 수 == 참가자 수).
- 위치: `computeAwards`·`eliminationOf`·`AWARD_MIN`(최소 점수 표, 플레이 뒤 조정은 여기 한 곳)·`SPECS`(칭호 표) 모두 shared/game/awards.ts. 시험 도우미는 test/helpers/awardsState.ts(`endedState`, `execDay`).
- result 키는 이제 `awards,seats,summary,winner`. 화면 시험 리터럴은 awards 가 optional 이라 안 바뀐다. 허용 경로 추가분: `.view.result.awards[].seat|award|k|at`(leak.test·view.test 에 줄 키 단언).
- 판 번호가 오르는 다시 하기(11-08)는 stats·badgeLog·whispers 를 버리므로 칭호도 새 판 기록만 읽는다.

## Self-Check: PASSED

- 파일 존재: shared/game/awards.ts, test/unit/awards.test.ts, test/unit/awardsProps.test.ts, test/helpers/awardsState.ts, test/worker/awards.test.ts 확인.
- 커밋 5개(c0998159, d1c1275c, dc1735c5, 4d30e860, f5782785) 존재, HEAD 의 조상.
