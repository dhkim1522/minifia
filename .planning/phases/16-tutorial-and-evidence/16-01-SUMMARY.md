---
phase: 16-tutorial-and-evidence
plan: "01"
subsystem: game-rules-evidence
tags: [durable-object, view-leak, vitest, react, evidence-card]
requires:
  - phase: 15-errand-and-record
    provides: 심부름 표본(sampleErrand)·아침 흔적(morning.trace)·흔적 카드 구간(traceWindowOf)
provides:
  - errandLast(서버 전용 마지막 관찰자 줄)와 morning.seen
  - 아침~처형 공개 view 필드 day.evidence = { trace?, seen? }
  - 증거 카드 부품 EvidenceCard(1행 흔적 + 2행 마지막 목격)와 GameMap 연결
  - 흔적 구간 5초·아침 상한 16초
  - 새 공개 경로를 덮는 누설 시험
affects: [16-03, 16-04, 16-09, 16-10]
actuals:
  tokens: 14450
  tasks: 3
  commits: 5
plan_head_before: 9652a0bb2e28c8cd725175bceb7ecf5f07fe0c34
commits: 5
plan_head_after: 13b4e5a84f3e4d7c35b5f73e0d485a380dcf44e7
tech-stack:
  added: []
  patterns:
    - "서버 전용 상태(errandLast)에서 공개 증거를 필드별 복사로 만들어 낮 끝까지 싣는다(day.chalk 선례)"
    - "표본 알람은 errandMarks 비교로 바뀔 때만 저장(결정 0076)"
key-files:
  created:
    - src/components/v2/EvidenceCard.tsx
    - src/styles/evidence.css
    - test/client/evidenceCard.test.tsx
  modified:
    - shared/protocol.ts
    - shared/game/room.ts
    - shared/game/errand.ts
    - shared/game/night.ts
    - shared/game/view.ts
    - shared/game/phases.ts
    - worker/room.ts
    - src/screens/GameMap.tsx
    - src/styles/game.css
    - scripts/e2e/lib.mjs
    - scripts/smoke.mjs
    - test/worker/trace.test.ts
    - test/worker/errandLeak.test.ts
    - test/worker/leak.test.ts
    - test/unit/errand.test.ts
    - test/unit/trace.test.ts
    - test/unit/view.test.ts
    - test/unit/traceView.test.ts
    - test/client/recordTrace.test.tsx
key-decisions:
  - "P-1: seen 은 day.morning.seen(morning 단계)과 day.evidence.seen(아침~처형) 두 곳에 같은 값으로 싣고 클라이언트 새 코드는 day.evidence 만 읽는다"
  - "P-2: 증거 카드 구간은 15 흔적 구간을 그대로 쓴다(표시 조건은 trace 유무)"
  - "P-3: 1행은 15 흔적 카드의 글·클래스(.mv-trace__name·.mv-trace__note)를 그대로 둔다(E2E trace 흐름 유지)"
  - "P-4: TraceCard.tsx 와 그 시험은 남긴다(16-09 이 지운다)"
  - "증거 카드 스타일은 v2.css 가 아니라 evidence.css 로 분리한다(v2.css 에 걸린 ellipsis·놋쇠 금지 시험 때문)"
requirements-completed: [EVID-02, DEPLOY-04]
status: complete
---

# Phase 16 Plan 01: 마지막 목격 증거 트레이서 Summary

심부름 표본(errandLast)에서 아침(morning.seen)을 거쳐 낮 끝까지 모두에게 같은 day.evidence 와 증거 카드 2행까지 한 줄로 잇고, 흔적 구간을 5초·아침 상한을 16초로 늘렸으며 누설 시험을 새 경로로 넓혔다.

## 한 일

- **Task 1 (트레이서)**: sampleErrand 가 산 사람 B 마다 반경 안에서 가장 가까운 사람(같으면 낮은 좌석)과 B 곁 장소를 errandLast 에 덮어쓴다. enterErrand 가 비우고, enterNight 는 남기며, enterMorning 이 피해자 줄만 morning.seen 으로 옮긴 뒤 모든 분기에서 지운다. buildDay 가 아침~처형 10개 단계에 day.evidence 를 필드별 복사로 싣는다. worker errandMarks 가 errandLast 변화도 비교한다. EvidenceCard 와 GameMap 연결, E2E VIEW_DAY_KEYS 갱신.
- **Task 2**: errandLast 동률·유지·사망·역할 무관·입력 불변·수명, day.evidence 수명, 상수(MORNING_TRACE_MS 5초, MORNING_MAX_MS 16초, E2E TRACE_WINDOW_MS 5초). 유언·쪽지·흔적이 모두 있는 최악의 아침이 정확히 16초라 흔적 구간이 줄지 않는다.
- **Task 3**: errandLeak·leak 허용 목록에 새 경로를 이유와 함께 추가, errandLast 를 서버 전용 이름으로 등록, 같은 아침의 증거가 모든 소켓에서 같은 JSON 인지 비교, 역할 다섯 시점 비교, 밤·끝·대기실 프레임의 evidence 와 아침 밖 seen 을 실패로 판정, 음성 시험.

## 시험 결과

- `npm run typecheck` 통과(tsc 앱·워커 오류 0).
- `npm test` 전체: 257 파일 통과 / 7381 시험 통과 (6 파일·261 건은 기존 skip).
- 로컬 E2E `--only trace` (390x664, 개발 서버, 폰 한 크기): **23/23 통과**(TC·TR0~TR6 포함). 전체 6폰 회귀·nightload·배포는 하지 않았다(16-10).
- 위험 확인: `git diff --quiet 9d6dba72 -- shared/game/ruleset.ts` 변경 없음(RULESET 새 스위치 없음).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 증거 카드 스타일을 v2.css 가 아닌 새 파일 evidence.css 로 분리**
- **Found during:** Task 2 전체 시험
- **Issue:** v2.css 에 `ellipsis` 가 어디에도 없어야 하고(v2parts), 파일 끝(.mv-errand 이후)에 놋쇠 토큰이 없어야 한다(errandParts, v2parts)는 기존 계약이 있어, UI-SPEC V-30 의 눈 아이콘 `brass-200` 과 피해자 이름 4em 말줄임을 v2.css 에 넣으면 세 시험이 깨졌다.
- **Fix:** `.mv-evidence*` 규칙을 `src/styles/evidence.css` 로 옮기고 EvidenceCard 가 함께 불러온다. 기존 계약 시험은 건드리지 않았다. 증거 카드 시험은 `.mv-trace`(면·테두리·폭)는 v2.css, `.mv-evidence*` 는 evidence.css 를 읽는다.
- **Files modified:** src/styles/evidence.css(신규), src/styles/v2.css, src/components/v2/EvidenceCard.tsx, test/client/evidenceCard.test.tsx
- **Commit:** f0795d8d

**2. [Rule 1 - Bug] 새 값과 어긋난 기존 시험 기대 갱신**
- **Found during:** Task 2
- **Issue:** 상수·MorningView 키·day 키가 의도대로 바뀌어 기존 기대가 틀렸다: phases.test(상한 15000→16000), discussion.test, tick.test(흔적 3000 하드코딩 → MORNING_TRACE_MS), dayStaticGuard(MorningView 키에 seen), view.test(morning 의 day 키에 evidence), trace.test(dayAnnounce 의 day 에도 trace 가 day.evidence 로 남음, R-4 의도).
- **Fix:** 모두 새 값으로 갱신하고 기대를 느슨하게 하지 않았다.
- **Commit:** 90e4715d, f0795d8d

**3. [Rule 3 - Blocking] scripts/smoke.mjs 의 MORNING_MAX_MS 사본 15초→16초**
- **Issue:** 계획 files_modified 에 없지만 shared/game/phases.ts 상수의 사본이라 그대로 두면 smoke 가 새 상한보다 짧은 대기를 쓴다.
- **Fix:** 사본과 주석을 16초로 맞췄다.
- **Commit:** f0795d8d

## Known Stubs

없음. 2행의 장소 칸은 지금 있는 장소 아이콘(placeIconOf)을 쓰며 컬러 그림으로 바꾸는 일은 16-09 이 한다(P-3, 구조 변경 없음 — 계획된 이월이지 스텁이 아니다).

## Threat Flags

없음. 새 표면은 계획의 T-16-01~04 가 다룬 day.evidence·morning.seen·errandLast 뿐이고 모두 시험으로 고정했다.

## Self-Check: PASSED

- 신규 파일(EvidenceCard.tsx, evidence.css, evidenceCard.test.tsx) 존재, 5개 커밋(4dfc7047, 4a390190, 90e4715d, f0795d8d, 13b4e5a8) 모두 HEAD 의 조상.
- 인수 기준 grep 전부 충족(errandLast 6/5/2, evidence 5, EvidenceView 2, EvidenceCard 2, 상수 3종, dangerouslySetInnerHTML 0).
