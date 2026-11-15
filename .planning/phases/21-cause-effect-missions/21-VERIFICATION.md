---
phase: 21-cause-effect-missions
verified: 2026-11-15T22:15:00Z
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - ".planning/phases/21-cause-effect-missions/21-01-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-01-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-02-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-02-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-03-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-03-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-04-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-04-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-05-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-05-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-06-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-06-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-07-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-07-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-08-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-08-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-09-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-09-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-10-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-10-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-11-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-11-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-12-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-12-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-13-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-13-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-14-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-14-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-15-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-15-SUMMARY.md"
  - ".planning/phases/21-cause-effect-missions/21-16-PLAN.md"
  - ".planning/phases/21-cause-effect-missions/21-16-SUMMARY.md"
  - "shared/game/lamps.ts"
  - "shared/game/night.ts"
  - "shared/game/phases.ts"
  - "shared/game/ruleset.ts"
  - "shared/game/scene.ts"
  - "shared/game/skip.ts"
  - "shared/game/view.ts"
  - "src/components/v2/SuspectBoard.tsx"
  - "src/screens/GameMap.tsx"
  - "worker/room.ts"
covered_digest: "v4:sha256:4f22ec79002038ed6826e5bb37314f8b39644f410ffd7c15cffa02542781c0ce"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Mac 에서 `node scripts/perf-run.mjs --mode nightload --map town` 을 재측정한다(390×844, CPU 4배, 5분)"
    expected: "끊김(>50ms) 5분 환산 ≤ 5, 평균 fps ≥ 55, renderer.calls ≤ 120, 점광원 ≤ 3 (LH12)"
    why_human: "이 Windows PC 측정은 끊김 107~117회(5분 환산 약 78~86)로 게이트를 넘었고, 같은 PC 의 재즈 바(21 이 거의 안 건드린 맵)도 88회라 21 탓인지 PC 부하 탓인지 단정할 수 없다. 결과를 통과로 쓸 수 없어 사용자의 Mac 측정이 필요하다(DEPLOY-06 의 '성능 게이트' 절반)"
  - test: "실기기(폰)로 minifia-v3 에서 확장판 한 판: 저녁 등불 길게 누르기 → 밤 집 문패 누르기 → 아침 [살펴보기] → 의심 보드 토론"
    expected: "각 단계가 3초 규칙(글 최소)으로 읽히고, 마피아 심지 자르기가 시민 화면과 겉보기 같으며 밤에 꺼진 등불이 아침에 보인다"
    why_human: "시각·손맛·몰입감은 코드로 판정할 수 없다. 계획·결정 0088 도 실기기 확인은 v3.0 끝 실테스트로 미뤘다"
---

# Phase 21: 원인→결과 하루 흐름과 등불·집 찾기·현장 조사 검증 보고서

**Phase Goal:** 확장판의 하루를 원인→결과 순서(처형 → 저녁 등불 당번 → 밤 집 찾기 → 아침 증거와 현장 조사 → 모여서 의심 보드 토론 → 투표)로 바꾸고, 결과가 다음 단계의 근거가 되며, 마피아에게도 할 일과 들킬 위험이 생기게 한다.
**Verified:** 2026-11-15
**Status:** human_needed
**Re-verification:** 아니오 — 최초 검증

**한 줄 요약:** 6개 성공 기준 모두 코드·테스트로 확인됐고(자동 검증 통과, 차단 결함 없음), 다만 성능 끊김 게이트(LH12 ≤ 5)가 이 PC 에서 미판정이라 Mac 재측정과 실기기 확인이 남아 `human_needed`.

## 목표 달성

### 관찰 가능한 사실 (ROADMAP 성공 기준)

| # | 사실 | 상태 | 근거 |
|---|------|------|------|
| 1 | 첫날 roleReveal → 저녁 → 첫 밤 → 첫 아침 → 토론, 이후 처형 → 저녁 → 밤 → 아침 → 토론 | ✓ VERIFIED | `shared/game/phases.ts` `nextPhaseOf`: `rules.cause` 일 때 roleReveal→errand, errand→night, morning→discussion, execution→errand. `afterDayOf` 가 처형 없는 낮도 errand 로. `ruleset.ts` 는 extended 만 `cause:true`(basic 은 옛 순서 그대로). `tick.ts` 훅에서 errand 진입은 `enterErrand(enterDayAnnounce(clearSkip))`(dayAnnounce 를 아침 앞머리로 합침). 시험 `phases.test.ts`·`causeFlow.test.ts` 통과 |
| 2 | 저녁 등불 당번: 모두 켜고 마피아는 같은 단추로 심지 자름(겉보기 같음, 밤에만 꺼짐), 꺼진 등불은 아침에 공개 | ✓ VERIFIED | `lamps.ts` `withCut`(hold + 산 마피아 + cause 일 때만 서버 전용 `errandCut` 기록, 시민 hold 는 그냥 켜기), `houseLitOf`(자르기가 이김, 안 켠 것과 자른 것 구별 불가). `night.ts:53` 밤 진입 때 `lamps` 계산 → 뷰 `day.lamps`(boolean 여덟). `view.ts:172` 가 `errandCut` 을 읽지 않음. `lampErrand`·`lampLeak`·`lampView` 시험 통과 |
| 3 | 밤 집 찾기: 모든 역할 같은 화면·같은 `pick`; 아침에 발자국 수와 켜진 등불 곁 이웃에게만 창문 목격 | ✓ VERIFIED | `GamePanel.tsx:140` 밤 얼굴 목록 대신 지도 `HouseTag` 문패(역할 무관 같은 높이), `scene.ts` `buildScene`: 발자국 = 후보 수, 창문은 `windowLit`(짝집 `neighborOf`)일 때만 조각, 아니면 `dark`. 서버 메시지 `pick` 그대로. `houseView`·`nightHouse`·`scene`·`sceneLeak` 시험 통과 |
| 4 | 아침 현장: 단서 지점을 살피면 나만 보는 단서, 마피아가 만진 지점은 흐려져 "먼저 손댄 흔적", 구출된 밤은 미수 현장 | ✓ VERIFIED | `scene.ts` `inspectSpot`: 반경 `ERRAND_ACT_R` 안 가장 가까운 안 살핀 지점, 결과 계산 **뒤** 산 마피아면 `touched` 표시, 실패는 사유 구별 없는 `{ok:false}`. `night.ts:197-199` `sceneHouse = eliminated ?? (saved ? target : undefined)` 로 구출 = 미수 집 앞 현장. `GameMap.tsx` `[살펴보기]`→`{t:"inspect"}`, `ClueCard` 표시. `sceneLeak.test.ts` 가 마피아·시민 응답 모양 동일(`{spot:"cloth",r:"touched"}`) 확인 |
| 5 | 토론이 시작되면 모두 모이고 흔적·목격·발자국이 의심 보드 한 곳에, 처형자 정체는 비공개 | ✓ VERIFIED | `gather.ts:146` cause 판 `${day}:board` 모이기, `worker/room.ts:1463` cause 분기, `GameMap.tsx` `SuspectBoard`(`boardModel`)·`boardView.test`·`suspectBoard.test`·`boardDiscussion.test` 통과. `view.ts:298` `me.scene` 은 본인 것만. `causeLeak.test.ts (5)` 산 사람 프레임에 남의 role·job 없음, 처형자 정체 다음 저녁까지 비공개 검증 |
| 6 | 튜토리얼이 새 흐름("정체는 판이 끝나야 알아요" 포함), 누설 검사 통과, 배포됨 | ✓ VERIFIED | `tutorialScript.ts:103` `"tutorial.hidden"`, `TutorialReveal.tsx`(카드 안 뒤집힘+자물쇠+도장 "처형"). `tutorialTogether`·`tutorialScenes`·`tutorialLeak` 통과. 누설 전수 `causeLeak`·`sceneLeak`·`lampLeak`·`leak` 통과. 배포: `https://minifia-v3.dhplay.workers.dev/api/health` → `{"ok":true,"version":"2026-11-15T13:03:01Z+e3cb26fa"}`(SUMMARY 기재 값과 일치) |

**점수:** 6/6 성공 기준 코드·시험으로 확인(행동 의존 사실은 모두 행동 시험이 있음, PRESENT_BEHAVIOR_UNVERIFIED 0). 단 DEPLOY-06 의 "성능 게이트" 절반은 아래 사람 확인 항목.

### 요구사항 커버리지

| 요구사항 | 상태 | 근거 |
|---|---|---|
| DAYFLOW-01 | ✓ 충족 | `nextPhaseOf`·`afterDayOf`·tick 훅, 현장 없는 밤은 아침 길이 0 |
| LAMP-01 | ✓ 충족 | `lampErrand.test`(단위·워커) 통과, 모든 역할 같은 목록 |
| LAMP-02 | ✓ 충족 | `lamps.ts` 와 `lampLeak.test` |
| HOUSE-01 | ✓ 충족 | HouseTag + `pick`, 밤 순간이동 `teleportHome` |
| HOUSE-02 | ✓ 충족 | `houseLitOf`·`neighborOf` 고정 표, `townScene`·`houseView` 시험 |
| SCENE-01 | ✓ 충족 | `buildScene`·`inspectSpot` |
| SCENE-02 | ✓ 충족 | `touched`, 응답 모양 동일 시험, 미수 현장 |
| BOARD-01 | ✓ 충족 | SuspectBoard·gather board |
| SKIP-01 | ✓ 충족 | `skip.ts`(과반 `majorityOf`, 공개 값 `day.skipCount`), `skip.test`·`causeSkip.test`·`skipPill.test` 통과 |
| TUT-06 | ✓ 충족 | 튜토리얼 시험 통과 |
| LEAK-02 | ✓ 충족 | `causeLeak.test.ts` 서버 전용 이름 17개 키 검사·원문 검사·새 view 경로 허용 목록 |
| DEPLOY-06 | ? 일부 | 로컬 검증·배포·smoke 는 확인(배포본 version 일치). "성능 게이트 통과"는 미판정 — 사람 확인 |

고아 요구사항 없음(REQUIREMENTS.md 의 Phase 21 매핑 12개 모두 계획에 있음).

### 자동 검증 결과(이 검증에서 직접 실행)

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | 종료 0 |
| `npx vitest run` 핵심 29파일(lamps·scene·skip·phases·lampErrand·e2eContract·boardView·houseView·sceneView·lampView·tutorial·tutorialScript, worker causeLeak·sceneLeak·lampLeak·causeFlow·causeSkip·causeBots·causeMove·tutorialLeak·leak, client suspectBoard·morningScene·lampEvening·nightHouse·boardDiscussion·skipPill·tutorialTogether·tutorialScenes) | 29 파일 통과, 463 통과·4 건너뜀·실패 0 |
| `test/worker/night.test.ts`·`test/unit/night.test.ts` | 단위 통과, 워커 19개 중 3개가 "Test timed out in 5000ms"(알려진 간헐 실패, 부하 의존) — 21 의 결함 아님으로 판정 |
| 배포본 `/api/health` | version `2026-11-15T13:03:01Z+e3cb26fa` (SUMMARY 와 일치) |
| 부채 표지(TBD/FIXME/XXX) | 21 이 바꾼 src·shared·worker 78개 파일에서 0건 |

전체 `npm test`·폰 6종 E2E 8묶음은 이 검증에서 다시 돌리지 않았고 21-16-SUMMARY 의 기록(9,062 통과, E2E 전 흐름 통과, perfbudget 알려진 3건 제외)을 신뢰하지 않은 채 "핵심 시험 직접 재현 + 코드 읽기"로 대체했다. E2E 흐름 `cause-evening/night/morning/skip/basic/phones` 는 `scripts/e2e/flows.mjs` 에 등록돼 있다.

### 안티패턴

없음(🛑 차단 0). 알려진 사항은 아래.

### 차단 결함 / 경고

- **WARNING — 성능 끊김 게이트 미판정(LH12 ≤ 5).** nightload 마을, 이 Windows PC: 끊김 117·107회(5분 환산 약 86·78), 평균 124fps(132Hz 화면), renderer.calls 87(≤120 통과), 점광원 3(≤3 통과). 재즈 바 대조도 88회라 원인 단정 불가. 게이트를 낮추거나 통과로 적지 않은 처리는 적절하다. 사용자 Mac 재측정이 남았다(HANDOFF·결정 0088 "알려진 한계"에 기록됨). REQUIREMENTS.md 의 DEPLOY-06 이 `[x]` 이지만 이 성능 절반은 미확인이므로 Mac 결과가 5 초과면 gap 으로 돌려야 한다.
- **INFO — 알려진 간헐 실패.** `test/worker/night.test.ts` 5초 시간 초과(부하 의존, 단독 재실행 시 통과 기록 있음).
- **INFO — 하루 후반 smoke 부재.** 배포 smoke 는 확장판 첫날(저녁 → 밤 → 토론)까지이고 투표·처형·다음 저녁은 확장판 smoke 가 없다(21-13 한계). 그 부분은 워커 시험(`causeFlow`)이 덮는다.
- **INFO — 알려진 E2E perfbudget B2·M1 3건**(13페이즈부터 같은 숫자, 21 과 무관).

### 사람 확인 필요

1. **성능 게이트 Mac 재측정** — `node scripts/perf-run.mjs --mode nightload --map town`, 끊김 ≤ 5 / fps ≥ 55 / calls ≤ 120 / 점광원 ≤ 3.
2. **실기기 한 판(minifia-v3)** — 저녁 등불 길게 누르기·밤 문패·아침 살펴보기·의심 보드의 읽힘과 몰입(글 최소 원칙).

### 결론

차단 결함은 없고 목표(원인→결과 하루, 마피아의 위험과 할 일, 누설 방지, 튜토리얼, 배포)는 코드와 시험으로 달성됐다. 자동 확인 불가능한 항목(성능 게이트, 실기기 체감)이 남아 상태는 `human_needed` 이다. Mac 에서 끊김이 5 를 넘으면 DEPLOY-06 만 gap 으로 재개한다.

---

_Verified: 2026-11-15T22:15:00Z_
_Verifier: Claude (gsd-verifier)_
