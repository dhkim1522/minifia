---
phase: 13-basic-day-flow
verified: 2026-11-07T04:30:00Z
status: human_needed
score: 5/5 로드맵 성공 기준 코드·시험으로 확인 (실기기·팀 확인은 v3.0 끝 실테스트로 미룬 항목)
covered_files:
  - ".planning/phases/13-basic-day-flow/13-01-PLAN.md"
  - ".planning/phases/13-basic-day-flow/13-01-SUMMARY.md"
  - ".planning/phases/13-basic-day-flow/13-02-PLAN.md"
  - ".planning/phases/13-basic-day-flow/13-02-SUMMARY.md"
  - ".planning/phases/13-basic-day-flow/13-03-PLAN.md"
  - ".planning/phases/13-basic-day-flow/13-03-SUMMARY.md"
  - ".planning/phases/13-basic-day-flow/13-04-PLAN.md"
  - ".planning/phases/13-basic-day-flow/13-04-SUMMARY.md"
  - ".planning/phases/13-basic-day-flow/13-05-PLAN.md"
  - ".planning/phases/13-basic-day-flow/13-05-SUMMARY.md"
  - ".planning/phases/13-basic-day-flow/13-06-PLAN.md"
  - ".planning/phases/13-basic-day-flow/13-06-SUMMARY.md"
  - "docs/decisions/0072-v3-basic-day-flow.md"
  - "scripts/e2e/flows.mjs"
  - "scripts/e2e/lib.mjs"
  - "scripts/smoke.mjs"
  - "shared/game/bots.ts"
  - "shared/game/nomination.ts"
  - "shared/game/phases.ts"
  - "shared/game/room.ts"
  - "shared/game/ruleset.ts"
  - "shared/game/testTools.ts"
  - "shared/game/tick.ts"
  - "shared/game/view.ts"
  - "src/game/badgeView.ts"
  - "src/game/dayView.ts"
  - "src/game/resultText.ts"
  - "src/net/useDayFx.ts"
  - "src/screens/GameMap.tsx"
  - "src/world/presence.ts"
  - "worker/room.ts"
covered_digest: "v3:sha256:62fc3a369289e18305cd388fd258c6088d3d26583790e771776b08fd09385f71"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "투표 이름표를 실제 폰 손가락으로 누르기, 선두·과반 연출(배지 맥박·유력 도장·실내등·카메라 8%) 체감"
    expected: "15초 안에 이름표를 눌러 고르고 바꿀 수 있고, 선두·과반 연출이 눈에 띈다"
    why_human: "실기기 손가락 조작·연출 체감은 자동 검사로 알 수 없다. 사용자 결정으로 v3.0 끝 실테스트에서 한 번에 확인한다 (deferred, 갭 아님)"
  - test: "8명 동시 투표(사람 8명) 성능·가독성"
    expected: "이름표가 읽히고 CPU 4배 스로틀 폰에서도 끊기지 않는다"
    why_human: "실기기·팀 확인. v3.0 끝 실테스트로 미룸 (deferred, 갭 아님)"
  - test: "투표 15초가 첫 사용자에게 충분한지 체감"
    expected: "처음 하는 사람이 따라갈 수 있다. 모자라면 shared/game/phases.ts 한 줄(NOMINATION_MS)로 조정"
    why_human: "체감 길이는 팀 플레이에서만 판단 가능. 미룸 (deferred, 갭 아님)"
---

# Phase 13: 기본판 낮 흐름 Verification Report

**Phase Goal:** 처음 하는 사람이 따라가기 쉬운 단순한 낮 흐름 하나로 판이 돈다 — 토론 → 동시 투표(15초) → 최후 변론 → 찬반 → 처형, 동점·0표는 밤, 정치 장치(배지·귓속말·순차 지목·결선·3인 결전)는 `shared/game/ruleset.ts` 설정으로 끔. 요구사항 FLOW-01..05.
**Verified:** 2026-11-07
**Status:** human_needed (자동 검증 가능한 목표는 모두 달성, 갭 없음. 남은 것은 사용자가 v3.0 끝 실테스트로 미룬 실기기·팀 확인뿐)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 낮이 토론(90초) → 투표(nomination 15초) → 변론 → 찬반(10초) → 처형 순서로만 돈다 (FLOW-01) | VERIFIED | `shared/game/phases.ts` PHASE_DEFS: `discussion.next = nomination`, `nomination` 길이 `RULESET.pickTurn ? NOMINATION_GATHER_MS : NOMINATION_MS`(`NOMINATION_MS = 15_000`), `next: defense`, `verdict.next = execution`. `test/worker/basicDay.test.ts` 첫 시험(토론 끝내기 → 동시 투표 → 변론 → 찬반 → 처형 → 밤)이 DO 끝까지 통과(직접 재실행) |
| 2 | 투표는 산 사람 모두가 동시에 한 명을 고르고 마감까지 바꿀 수 있다. 최다 득표 1명이 변론에 선다 (FLOW-02) | VERIFIED | `shared/game/nomination.ts` `castPoint`(단계·행위자·대상·자기 지목 검사, 같은 값은 무변화, 마감 미접촉), `worker/room.ts` `applyPoint` 가 `pickTurn === undefined` 일 때 `castPoint` 호출·250ms 간격 제한. `resolveNomination` 이 `leader` 가 있으면 표의 기본 next(defense) |
| 3 | 동점·0표는 결선 없이 처형 없는 밤 (FLOW-02) | VERIFIED | `tallyPoints` 가 최다 동률이면 `leader` 없음 → `resolveNomination` 이 `next: "night"`; `RULESET.runoff` 꺼짐이라 runoff 분기 미진입. `basicDay.test.ts` 의 2:2 동점(reason tie)·0표(noVotes)·산 셋도 토론(showdown 프레임 0) 시험 통과 |
| 4 | 배지·귓속말·순차 지목·결선·3인 결전이 화면과 서버 흐름에 나타나지 않고, 코드는 지우지 않고 한 곳의 설정으로 끈다 (FLOW-03) | VERIFIED | `shared/game/ruleset.ts` 한 파일에 다섯 값 모두 false(`BASIC_RULESET` frozen, `RULESET = BASIC_RULESET`). 읽는 곳: tick 표(`RULESET.pickTurn`·`showdown`), phases, nomination(`RULESET.runoff`), room 정규화, worker `badge`·`whisper` 메시지 거절(`rejectDisabled`), view 게이트(`view.ts` 의 badge·pickTurn·runoff·showdown·whisperUsed·ballot 모두 `RULESET.*` 조건), 화면(`badgeView.floatVisible`·`whisperView`·`resultText`·GameMap). 처리기 본체는 남아 있음. `basicOff.test.ts`·`leak.test.ts`(꺼진 장치 키 0건) 통과 |
| 5 | 찬반 기록 카드는 그대로 모두에게 공개된다 (FLOW-04) | VERIFIED | `basicDay.test.ts` 가 처형 단계에서 모든 소켓이 `chat k === "ballots"` 한 장씩 받는지 확인(직접 재실행 통과). 누설 허용 경로에 찬반 기록은 유지 |
| 6 | 테스트 방 봇이 새 낮 흐름으로 한 판을 자동 완주한다 (FLOW-05) | VERIFIED | `shared/game/bots.ts` 투표 분기(`POINT_BASE_MS + randInt(POINT_SPAN_MS)`, `botPointTarget`)가 worker `actAsBot → applyPoint → castPoint` 를 지남. `testTools.ts` `botsVoteNow` 가 `castPoint` 로 안 던진 봇 표를 채움. `test/worker/bots.test.ts` "기본판 봇 방 자동 완주" 통과(방장 + 봇 7, ended 까지, runoff·showdown·day.turn 0) |
| 7 | 투표 화면: 이름표 버튼 직접 누르기, 득표 배지·선두·과반 연출, 위 알림, 차례 알약 없음 | VERIFIED (정적·시험) | `dayView.ts` 제목 `nomination: "투표"`, `pointsTally`; `presence.ts` `ZOOM_MAJORITY` 과반+스테이지 높이 조건 확대(`view.day?.turn === undefined`); `GameMap.tsx` `group: ... voting ? "투표"`, `blockModeOf(view)` 로 알약·링 분기; `useDayFx` 의 toasts. `test/client/gameMap.test.tsx` 통과(직접 재실행). 실기기 체감은 아래 human 항목 |
| 8 | 저장 방 재기동이 투표를 처음부터 다시 시작시키지 않는다 | VERIFIED | `shared/game/room.ts` `isLegacyNomination = RULESET.pickTurn && ...` — 기본판은 정규화 대상 아님(`normalizeStoredRoom` 이 같은 객체 반환). 단위 시험은 `gameRoom.test.ts` 통과 |
| 9 | 8자 이름 봇 8명판 투표 이름표 겹침 | ACCEPTED LIMIT | 사용자 선호(과몰입 경계)로 수용된 알려진 한계. 결정 0072 와 HANDOFF 에 기록됨. 갭 아님 |

**Score:** 로드맵 성공 기준 5/5 확인 (FLOW-01..05 전부), 행동 의존 truth 중 시험이 없는 것 0건.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/game/ruleset.ts` | RULESET 한 곳 | VERIFIED | 다섯 값 false, 다른 모듈 import 없음 |
| `shared/game/nomination.ts` | castPoint·enterVote·끈 결선 | VERIFIED | `castPoint`·`enterVote` 존재, 실제 규칙 구현(스텁 아님), worker·testTools 에서 호출 |
| `shared/game/phases.ts` | NOMINATION_MS 15초 | VERIFIED | `NOMINATION_MS = 15_000` |
| `shared/game/view.ts` | 꺼진 키 게이트 | VERIFIED | `RULESET.*` 조건 6곳 |
| `shared/game/bots.ts`·`testTools.ts` | 동시 투표 봇 | VERIFIED | 위 FLOW-05 |
| `src/game/dayView.ts`·`src/world/presence.ts`·`src/screens/GameMap.tsx` | 투표 화면 | VERIFIED | 위 7번 |
| `scripts/e2e/lib.mjs`·`flows.mjs` | basic-off·basic-vote, 꺼진 장치 흐름 skipByDefault | VERIFIED | `OFF_DEVICE_SELECTORS`, `basic-off`·`basic-vote` 등록, politics-* 7개 `skipByDefault: true` |
| `scripts/smoke.mjs` | 새 낮 흐름 smoke | VERIFIED | 파일 존재·`NOMINATION_MS` 사용(실행은 executor 보고, 배포본 smoke OK 보고) |
| `docs/decisions/0072-v3-basic-day-flow.md` | 0072-1..6 | VERIFIED | 0072-1~6 번호 존재, 0063-1·0066-1·2·4·5·6 에 개정 표시 확인 |
| `HANDOFF.md` | 6144B 이하, 13 완료·다음 14 | VERIFIED | 4041 바이트, 다음 할 일이 14페이즈 |
| 테스트 `basicDay`·`basicOff`·`leak`·`bots` | 존재·통과 | VERIFIED | 직접 재실행 통과 |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `tick.ts` | `ruleset.ts` | `RULESET.pickTurn ? enterNomination : enterVote`, `RULESET.showdown ? {dayAnnounce}` | WIRED |
| `worker/room.ts` | `nomination.ts` | `applyPoint` → `castPoint(` | WIRED |
| `shared/game/room.ts` | `ruleset.ts` | `RULESET.pickTurn` 정규화 조건 | WIRED |
| `bots.ts` | `nomination.ts`(→worker) | `POINT_BASE_MS + randInt(POINT_SPAN_MS)` → `applyPoint` | WIRED |
| `testTools.ts` | `nomination.ts` | `castPoint(` | WIRED |
| `worker/room.ts` | `ruleset.ts` | `RULESET.badge`·`RULESET.whisper` 거절 | WIRED |
| `badgeView.ts` | `ruleset.ts` | `if (!RULESET.badge) return false` | WIRED |
| `resultText.ts` | `ruleset.ts` | `RESULT_TABS_SHOWN` 이 whisper 탭 제외 | WIRED |
| `presence.ts` | `dayView.ts` | `pointsTally(view)` | WIRED |
| `GameMap.tsx` | WorldStage | `group: voting ? "투표"` | WIRED |
| 0072 문서 | 0066·0063 | `0072-N` 개정 표시 | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
|----------|------|--------|-----------|--------|
| 투표 득표 배지·선두·과반 | `day.points` | `view.ts` `pointLinesOf(state)`(서버 `Player.nominate` 에서 집계) → `pointsTally` | 예 | FLOWING |
| 위 알림 | `toasts` | `dayEvents(prev,cur)` 가 `day.points` 변화에서 생성 | 예 | FLOWING |

### Behavioral Spot-Checks (직접 실행)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 규칙·tick·view·bots·testTools·dayView·phases 단위 시험 | `npx vitest run` (8개 파일) | 502 passed, 50 skipped(꺼진 장치 켜짐 전용) | PASS |
| DO 끝까지 시험 + 누설 + 봇 완주 + 화면 + E2E 계약 | `npx vitest run` basicDay·basicOff·leak·bots·gameMap·e2eContract | 178 passed, 10 skipped | PASS |
| 타입 검사 | `npx tsc --noEmit -p .` | 오류 없음 | PASS |
| 배포본 | `curl /api/health` | `{"ok":true,"version":"2026-11-06T19:07:24Z+5d855a5f"}` — executor 보고 버전과 일치 | PASS |
| nightload 증거 | `perf/nightload-390x844-x4.json` | avgFps 59.83, jank 4(합격선 55fps·5회), issues [] | PASS |

전체 E2E·`npm test` 전체는 지시대로 다시 돌리지 않았다(executor 보고: npm test 6855 통과, 알려진 간헐 continuity 1건, 폰 6종 E2E 통과, 배포본 smoke full 및 day·basic-off·basic-vote·noexec 통과).

### Probe Execution

해당 없음(PLAN 이 `probe-*.sh` 를 선언하지 않음). Step 7c SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| FLOW-01 | 13-01·03·05·06 | SATISFIED | 진실 1, 7 |
| FLOW-02 | 13-01·03·05·06 | SATISFIED | 진실 2, 3 |
| FLOW-03 | 13-01·04·05·06 | SATISFIED | 진실 4 (설정 한 곳, 서버·view·화면·E2E 부재 검사) |
| FLOW-04 | 13-01·06 | SATISFIED | 진실 5 |
| FLOW-05 | 13-02·05·06 | SATISFIED | 진실 6 |

REQUIREMENTS.md 의 FLOW-01..05 는 모두 Phase 13 에 매핑되어 있고 어느 PLAN 에도 빠지지 않음. ORPHANED 요구사항 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| phase 13 이 수정한 구현 파일 전체 | - | TBD/FIXME/XXX 마커 | - | 0건 |
| `git grep` 위생 검사 | - | `.planning/milestones/...` 옛 계획 문서의 일반 용례 몇 건 | Info | 13페이즈 변경 아님, 이전 마일스톤 보관본(공식 조직 패키지 등 무관 용례 포함) |

### Warnings / Notes (갭 아님)

- `perfbudget` B2(점광원 4 > 3)·M1(재열기 geometries 35 > 25)은 13페이즈 이전부터 있던 수치로 HANDOFF 에 기록되어 있고 nightload 합격선은 통과. 후속 정리 대상.
- `continuity` "옛 방장이 돌아오면" 시험이 단독 실행 때 간헐적으로 5초 초과(알려진 한계, 후속).
- 8자 이름 봇 8명판 이름표 겹침: 사용자 선호로 수용된 한계(결정 0072 기록).
- 배포본 smoke 는 망 지연으로 간헐 실패한다고 HANDOFF 에 있으나 executor 가 통과 확인.

### Human Verification Required (v3.0 끝 실테스트로 미룸 — 사용자 결정, 갭 아님)

1. **투표 이름표 손가락 누르기·선두/과반 연출 체감** — 실기기. 기대: 15초 안에 고르고 바꾸고, 선두·유력 연출이 보인다.
2. **8명 동시 투표 성능·가독성** — 실기기·팀. 기대: 이름표가 읽히고 끊기지 않는다.
3. **투표 15초 체감** — 팀 플레이. 모자라면 `phases.ts` 한 줄로 조정.

### Gaps Summary

갭 없음. 로드맵 성공 기준과 FLOW-01..05 가 코드(설정 한 곳, 서버 규칙·봇·view 게이트·화면 게이트), 시험(직접 재실행 통과), 배포본(health 버전 일치)에서 모두 확인됐다. 상태가 `human_needed` 인 것은 사용자가 의도적으로 미룬 실기기·팀 확인이 남아 있기 때문이며, 차단 항목은 아니다.

---

_Verified: 2026-11-07_
_Verifier: Claude (gsd-verifier)_
