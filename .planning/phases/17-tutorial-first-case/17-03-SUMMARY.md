---
phase: 17-tutorial-first-case
plan: "03"
subsystem: tutorial
tags: [tutorial, script, tdd, tracer, static-guard, fake-view]
status: complete

requires:
  - phase: 15-errand
    provides: errandView(actablePlaceOf·placeCentersOf·startCardOn)·ERRAND_ACT_R·광장 장소 좌표
  - phase: 16-evidence
    provides: traceMark(sameOutfitSeats)·recordView(traceWindowOf)·MorningView·EvidenceView
provides:
  - "src/game/tutorialScript.ts: 장면 표 8행(TUTORIAL_SCENES)·사회자 문구 8키(TUTORIAL_LINES)·출연(TUTORIAL_CAST)·TUTORIAL_PICK·장면별 가짜 RoomView(tutorialView 2~6, tutorialStageView 1·7)·무대 모양(tutorialStageLook)·위치(TUTORIAL_START·TUTORIAL_SPOTS·tutorialSnap·SUSPECT_WALK·tutorialSuspectWalk)·로컬 send 어댑터(makeTutorialSend)·상수 4개"
  - "test/unit/tutorialStaticGuard.test.ts: 튜토리얼 소스(대본·TutorialScreen·감독 훅·Tutorial*/FocusRing*/OpeningFx* 부품)와 tutorial*.css 의 정적 가드 — 파일 이름 규칙이라 뒤 계획 파일이 자동으로 걸린다"
affects: [17-04, 17-05, 17-06, 17-07, 17-08, 17-09, 17-10, 17-11, 17-12]

actuals:
  tokens: 10000
  tasks: 2
  commits: 4
plan_head_before: 8c7eb7634b774378de3fce398c40d6b209699100
plan_head_after: 4b5e5b7b5e8c94996ff0583558565427f625f09f

tech-stack:
  added: []
  patterns:
    - "대본은 순수 데이터: 시각은 장면 시작부터 ms 로만 쓰고 now 는 인자 — 화면은 표를 읽어 실제 부품에 먹이기만 한다"
    - "가짜 view 는 출연 상수에서만 조립하고, 시험은 실제 판정 함수(actablePlaceOf·sameOutfitSeats·traceWindowOf·startCardOn)로 필드를 검증한다 — 이름표 표시를 하드코딩하지 않는다"
    - "위치는 shared/game/world.ts 의 구간 도우미(restSegment·snapFrame·moveFrame·MOVE_V)로 만들어 서버와 같은 고정소수점 단위를 쓴다"
    - "정적 가드의 금지 정규식과 위반 표본은 시험 파일에만 두고, 대상은 파일 이름 규칙으로 찾는다"

key-files:
  created:
    - src/game/tutorialScript.ts
    - test/unit/tutorialScript.test.ts
    - test/unit/tutorialStaticGuard.test.ts
  modified: []

key-decisions:
  - "TUTORIAL_SPOTS: 연단 둘레 반지름 2.6 에 여섯 좌석(민준 -2.6,0 · 도윤 1.3,-2.3 · 서연 -1.3,-2.3 · 지호 -1.3,2.3 · 하린 2.6,0 · 나 1.3,2.3). 모두 광장 마스크에서 걸을 수 있고(시험), 나는 카메라 쪽 아래, 도윤은 화면 오른쪽 위에 선다"
  - "SUSPECT_WALK: (5.6,-1.9) → (4.0,1.0), 길이 3.31 / MOVE_SPEED 1.8 = 약 1.84초. 선분이 광장 마스크에서 걸을 수 있음을 시험으로 고정. 화면 오른쪽 밖에서 나오는지는 카메라를 띄워야 알 수 있어 17-05 이후 화면 계획에서 확인한다"
  - "tutorialStageLook: 장면 1 의 서연은 victimGone 이면 opacity 0 으로 남겨(페이드 가능), 장면 7 에는 자리 자체를 두지 않는다. 낮 조명은 talk, 밤은 night, 카메라는 fixed (0,0) zoom 1"
  - "가짜 view 에는 me.chat 을 싣지 않았다(말할 수 없는 view). 장면 6 아래 패널의 입력줄이 '눌림 없음' 표시로 그려질지 숨겨질지는 화면 계획(17-06 이후)이 정한다"
  - "tutorialSnap(8) 은 첫 화면이라 자리가 없어 빈 snap 을 돌려준다(인터페이스는 TutorialSceneNo 전체를 받는다)"

patterns-established:
  - "장면 한 곳을 더하는 길: TUTORIAL_SCENES 한 행 + TUTORIAL_LINES(있다면) + tutorialView/tutorialSnap 분기 + 시험 한 단락"

requirements-completed: [TUT-03, TUT-05]

duration: 18 min
completed: 2026-11-09
---

# Phase 17 Plan 03: 첫 사건 대본 Summary

첫 사건의 장면 표 8행·사회자 문구·소리 큐 시각·포커스 창·넘어가는 방식과, 출연 상수만으로 만드는 장면별 가짜 RoomView·위치 snap·로컬 send 어댑터를 순수 모듈 `src/game/tutorialScript.ts` 하나로 만들고, 역할·저장된 닉네임·실제 연결·HTML 주입·진홍 사용처를 정적 가드로 고정했다.

## Accomplishments

- **장면 표 8행**: n 1~8, id·render(stage·map·home)·dot(1~7 참, 8 거짓)·beats·focus·advance(auto·next·act·pick·end). 시각은 시안 `Main.dc.html` `enter()` 와 UI-SPEC 장면 계약 그대로(오프닝 lampOff 800·1300, scream 2600, 4600 자동 / 아침 2600 `[다음]` / 심부름 [처리] 0.7초 뒤 / 목격 step 5번·eye 1900·문구 2250·`[다음]` 3400 / 증거 link 400·900·문구 1300 / 투표 pick 공개 1100 / 직업 flip 4번·문구 1500 / 마무리 warm). 오프닝 램프 소리는 `OPENING_LAMPS` 로 만든다.
- **문구 8키**(`TUTORIAL_LINES`)가 UI-SPEC 표와 한 글자도 다르지 않고(키마다 시험 한 줄), 소리 큐 13개(tut.* 12 + ui.tap)만 쓴다.
- **가짜 view**: 장면 3 은 phase `errand`·`phaseEndsAt` null·`me.errand {mail, fountain, lamp}`, 장면 5 는 `morning`·`phaseEndsAt = now + 4000`·`day.morning`·`day.evidence` {redCloth, seen 도윤@lamp}. 시험이 실제 `sameOutfitSeats` = [도윤] 과 `traceWindowOf(...).on = true`, `startCardOn = false`, `actablePlaceOf(시작 자리) = mail` 을 확인한다. 어느 view 에도 `.me.role`·`.me.allies`·`.players[].role` 키가 없다(키 경로 순회 시험).
- **무대·위치**: `tutorialStageView`(1·7)·`tutorialStageLook`(카메라 fixed, 조명 night 여부, 서연 불투명도 0/없음), `tutorialSnap` 전 장면(1 여섯·2·5·6·7 다섯·3·4 나 하나), `tutorialSuspectWalk`(move 프레임, 1.84초). 모든 자리·걷는 선분이 광장 마스크에서 걸을 수 있음을 시험으로 고정.
- **로컬 어댑터**: `errand` → `onErrand`, `point` → `onPoint`, 그 밖(move·typing·emote…)은 아무 일 없이 `true`.
- **정적 가드**: 대본·`TutorialScreen`·감독 훅·`Tutorial*/FocusRing*/OpeningFx*` 부품에서 실제 연결 훅·내 역할·동료 목록·플레이어 항목 역할·저장된 닉네임·innerHTML 계열·fetch/WebSocket 금지, `tutorial*.css` 의 `--crimson-` 사용처는 `.tut-opening`·`.tut-reveal`·`.tut-role`(와 같은 이름 키프레임)로 시작하는 선택자뿐. 위반 표본 12개와 진홍 표본 10개로 가드가 실제로 잡는지 함께 본다. 지금은 CSS·화면 소스가 없어 그 부분은 0건으로 통과한다.

## Task Commits

1. **Task 1 RED:** `416b7f21` — `test(17-03): 대본 장면 3·어댑터 실패 시험`
2. **Task 1 GREEN (tracer):** `49c2276f` — `feat(17-03): 첫 사건 대본 장면 3·로컬 어댑터`
3. **Task 2 RED:** `a19d47d9` — `test(17-03): 대본 전 장면·정적 가드 실패 시험`
4. **Task 2 GREEN:** `4b5e5b7b` — `feat(17-03): 첫 사건 대본 전 장면·정적 가드`

## TDD Gate Compliance

- **Task 1 RED** (`416b7f21`): `npx vitest run test/unit/tutorialScript.test.ts` — 15개 전부 실패, 이유는 `"src/game/tutorialScript.ts 모듈이 있어야 한다: expected null not to be null"`(동적 import 로 import 오류 대신 단언 실패).
- **Task 1 GREEN:** 15개 통과, `tsc -p tsconfig.app.json` 오류 0.
- **트레이서 게이트:** Task 1 의 `<verify>` 는 자동 항목뿐이라 재실행해 통과를 확인하고 `Tracer verified end-to-end — expanding` 으로 Task 2 에 들어갔다.
- **Task 2 RED** (`a19d47d9`): `tutorialScript.test.ts` 47개 중 21개 실패(`tutorialStageView/tutorialStageLook/tutorialSuspectWalk is not a function`, `tutorialView(2·5·6) 는 아직 없다`, `tutorialSnap(1) 는 아직 없다`, 장면 1·2·4~8 beats 가 `[]`, `TUTORIAL_PICK` undefined). 정적 가드 시험은 대본 소스를 지키는 시험이라 대본이 이미 규칙을 지켜 통과한다(가드 자체의 실패 증거는 아래 참고).
- **정적 가드의 RED 성격:** 가드는 새 생산 코드가 없는 시험 전용 도구라 RED 가 따로 없다. 작성 중 가드 표본 시험이 한 번 실패했다(`view.players.find((x) => x.seat === 1)?.role` 표본을 "플레이어 항목의 역할" 규칙이 놓침 — 괄호가 겹친 호출) → 정규식을 겹 괄호까지 보게 고치고 RED 커밋 전에 통과시켰다.
- **Task 2 GREEN:** vitest 2파일 64개 통과(대본 47 + 가드 17), `npm run typecheck`(tokens·placeart·wrangler types·tsc app·worker) 종료 코드 0.
- REFACTOR: 없음.

## Acceptance Criteria

| 기준 | 결과 |
|------|------|
| `test -f src/game/tutorialScript.ts && grep -c "export" src/game/tutorialScript.ts` ≥ 8 | PASS (24) |
| `npx vitest run test/unit/tutorialScript.test.ts` 통과 (Task 1·2) | PASS |
| SUMMARY 에 RED 증거 | PASS (위) |
| `grep -c "tutorial\.\(morning\|errand\|witness\|link\|vote\|roles\)" src/game/tutorialScript.ts` ≥ 8 | PASS (24) |
| `test -f test/unit/tutorialStaticGuard.test.ts` | PASS |
| `npx vitest run test/unit/tutorialScript.test.ts test/unit/tutorialStaticGuard.test.ts` 통과 · `npm run typecheck` 통과 | PASS (64 통과, 종료 코드 0) |
| 계획 `<verification>`: Task 1·2 automated 초록, typecheck 초록 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 가드 정규식이 겹 괄호 호출 뒤의 `.role` 을 놓침**
- **Found during:** Task 2 RED(가드 자기 시험)
- **Issue:** `players.find((x) => …)?.role` 에서 `\([^)]*\)` 가 첫 `)` 에서 끊겨 위반 표본을 못 잡음.
- **Fix:** 한 단계 겹 괄호까지 허용하는 `\((?:[^()]|\([^()]*\))*\)` 로 교체.
- **Files modified:** test/unit/tutorialStaticGuard.test.ts
- **Commit:** a19d47d9

### 절차 메모

- 위치 후보 자리를 확인하려고 `npx tsx` 로 임시 스크립트를 돌렸는데, `tsx` 가 설치돼 있지 않아 npx 가 내려받아 실행했다(프로젝트 의존성·package.json·lock 은 바뀌지 않았고 npx 캐시에만 들어갔다. 이후로는 쓰지 않고 vitest 시험으로 같은 확인을 했다). 앞으로 이런 확인은 vitest 시험이나 이미 설치된 도구로 한다.

**Total deviations:** 1 auto-fixed (Rule 1) + 절차 메모 1. **Impact:** 범위 확장 없음.

## Issues Encountered

- 없음. 장면 3 시작 자리 (4.4, 3.0) 는 `actablePlaceOf` 가 `mail` 로 판정하고(거리 0.72 < 1.2), 도윤 걷기 길이는 1.84초로 1.6~2.0초 안이다.
- 도윤이 "화면 오른쪽 밖"에서 들어오는지는 카메라·줌 값을 화면에서 봐야 확정된다 — 대본은 카메라 오른쪽 방향(+x, −z)으로 나를 향해 걷는 길을 정했고, 눈으로 확인은 화면 계획(17-05 이후)과 끝 실테스트에서 한다.
- `git grep` 위생 검사: 이 계획이 건드린 파일 세 개에서 새 히트 없음.

## Known Stubs

없음. 모든 export 가 실제 값으로 채워져 있다. 화면 계획이 아직 이 표를 읽지 않을 뿐이다(계획이 명시한 의도된 연결).

## Threat Flags

없음. 새 표면은 로컬 상수와 순수 함수뿐이고 계획의 위협 모델에 있다: T-17-08(역할·닉네임 누설)은 키 경로 시험과 정적 가드로, T-17-09(이름 → DOM)는 innerHTML 계열 금지 가드로, T-17-SC(패키지 설치)는 설치 없음으로 닫았다.

## Next Phase Readiness

17-04 이후 화면 계획이 `TUTORIAL_SCENES`·`tutorialView`·`tutorialStageView/Look`·`tutorialSnap`·`tutorialSuspectWalk`·`makeTutorialSend` 만으로 장면을 재생할 수 있다. 소리 큐 id 13개와 소리 모듈 `SFX_IDS` 의 대조 시험은 17-04 몫이다. 화면 소스·CSS 를 새로 만들 때는 이름 규칙(`Tutorial*`·`FocusRing*`·`OpeningFx*`, `src/styles/tutorial*.css`, `src/screens/TutorialScreen.tsx`, `src/net/useTutorialDirector.ts`)만 지키면 정적 가드가 자동으로 걸린다. 진홍은 `.tut-opening`·`.tut-reveal`·`.tut-role` 로 시작하는 선택자(또는 같은 이름 키프레임)에서만 쓴다.

## Self-Check: PASSED

- 파일 존재: src/game/tutorialScript.ts, test/unit/tutorialScript.test.ts, test/unit/tutorialStaticGuard.test.ts — FOUND
- 커밋: 416b7f21, 49c2276f, a19d47d9, 4b5e5b7b — 현재 브랜치(v3) 조상으로 확인
