---
phase: 18-quick-fixes
verified: 2026-11-10T11:20:00Z
status: human_needed
score: 4/5 must-haves verified
covered_files:
  - ".planning/phases/18-quick-fixes/18-01-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-01-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-02-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-02-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-03-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-03-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-04-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-04-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-05-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-05-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-06-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-06-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-07-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-07-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-08-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-08-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-09-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-09-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-10-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-10-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-11-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-11-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-12-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-12-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-13-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-13-SUMMARY.md"
  - ".planning/phases/18-quick-fixes/18-14-PLAN.md"
  - ".planning/phases/18-quick-fixes/18-14-SUMMARY.md"
  - "scripts/perf-run.mjs"
  - "scripts/smoke.mjs"
  - "scripts/smoke.test.mjs"
  - "shared/game/look.ts"
  - "shared/game/room.ts"
  - "src/components/v2/DressSheet.tsx"
  - "src/components/v2/EvidenceCard.tsx"
  - "src/components/v2/FocusRing.tsx"
  - "src/components/v2/TutorialNext.tsx"
  - "src/game/hostLine.ts"
  - "src/world/maps/bar.ts"
  - "src/world/maps/plaza.ts"
  - "test/unit/e2eContract.test.ts"
  - "test/unit/lighting.test.ts"
covered_digest: "v3:sha256:bac2796587a422af924df4ca321ac347d7e40b930f0907033ca25757cf04b81c"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "G-18-3 배포본 smoke full 이 통과한다 (검증자가 배포본에서 직접 1회 통과 확인)"
    - "WR-01·WR-02 처리 방향 (사용자 결정: 알려진 한계로 기록, 결정 0081 에 기재됨)"
  gaps_remaining:
    - "G-18-1 조명 — 측정 판정과 PNG 는 통과, 사람 눈 확인은 v3.0 실기기 시험으로 이월(사용자 결정)"
  regressions: []
human_verification:
  - test: "SC-2·G-18-1 낮·밤 조명을 실기기(또는 배포본 화면)에서 눈으로 본다 — 광장·재즈 바의 talk·morning·vote 를 night 와 번갈아"
    expected: "talk·morning 이 night 와 장면만 보고 구분되고, 광장 talk 가 흐린 낮으로 읽히며, 저녁 지목(vote)이 밤과 헷갈리지 않는다. 낮이 마피아 분위기(낮은 채도)를 잃을 만큼 밝고 흐릿하지 않다"
    why_human: "렌더 휘도·채도 판정은 모두 통과했지만 UAT 에서 사용자가 눈으로 '낮이 전혀 안 느껴진다'고 보고한 항목이다. 낮다움·구분은 지각 판단이라 코드로 확정할 수 없다. 사용자 결정으로 v3.0 실기기 시험에 이월했다"
  - test: "조명 세부 확인(18-12 가 남긴 손잡이) — 광장 talk 가 너무 밝고 흐릿한지, 광장 talk·morning 이 밝기가 거의 같아(0.2096 vs 0.1987) 색온도로만 구분되는 게 충분한지, 바 morning 창 블라인드의 파랑이 튀는지"
    expected: "문제가 보이면 다음 손잡이: 광장 talk hemi·mix 하향, 광장 morning hemi 하향 또는 mix 0.4 대, 바 창 빛 묶음 분리. 문제가 없으면 닫는다"
    why_human: "취향·분위기 판단. 값 조정은 결정 0081-1-2(낮은 채도 유지)와 맞물려 사람이 정한다"
---

# Phase 18: 바로 고칠 것 — 증거·조명·튜토리얼 손보기 재검증 보고서

**Phase Goal:** 실테스트 전에, 미션 방향과 무관하게 증거·화면이 제대로 읽히게 고친다(결정 0081-1). 흔적이 한두 명으로 좁혀지고, 낮과 밤이 장면만으로 구분되며, 튜토리얼에서 눌러야 할 곳과 [다음]이 바로 눈에 들어온다.
**Verified:** 2026-11-10T11:20:00Z
**Status:** human_needed
**Re-verification:** Yes — gap closure 18-12·18-13·18-14 뒤 (18-UAT.md G-18-1·G-18-3)
**요구사항 ID:** 없음(ROADMAP `Requirements: TBD`). 대조할 ID·고아 요구사항 없음.

## Goal Achievement

### Observable Truths (ROADMAP SC-1~SC-5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 한 판 안에서 두 사람이 같은 옷을 입지 않는다(시작 때 겹침 해소, 옷장 잠금) → 흔적의 같은 옷 표시는 많아야 한 사람 | ✓ VERIFIED (알려진 한계 2건) | 이전 검증 그대로(`resolveLookConflicts`·`lockedOutfits`·`DressSheet taken`). 이번에 `look.test.ts` 포함 5개 파일 210건 재실행 통과, 회귀 없음. WR-01·WR-02 는 사용자가 "고치지 않고 알려진 한계로 기록"으로 결정했고, `docs/decisions/0081-…md` "알려진 한계 (18페이즈 UAT)" 절(67~70행)에 실제로 기재되어 있다. 한 판 안 옷 유일성에는 영향 없음 |
| 2 | 낮(talk·morning 등)과 밤 조명이 장면만 보고 구분된다. 낮도 낮은 채도. 튜토리얼 낮 장면도 같다 | ? UNCERTAIN (사람 판단, 사용자 결정으로 v3.0 실기기 이월) | 측정 근거는 모두 통과하나 사용자 눈 확인은 없음 — 아래 SC-2 상세 |
| 3 | 튜토리얼 포커스 밖 어두워짐·[다음] 알약·채팅 숨김·장면 5 선·시민 문구 | ✓ VERIFIED | 이전 검증 그대로. 18-12·13·14 는 이 영역 소스를 바꾸지 않았다(`git diff 6ea0749c..HEAD -- src shared worker` = `src/world/maps/bar.ts`·`plaza.ts` 2개뿐). 배포본 `tutorial-solo`(18-14 단계 1, 폰 6종 통과)로 재확인 |
| 4 | 낡은 문구 정리 | ✓ VERIFIED | 이전 검증 그대로, 해당 소스 변경 없음 |
| 5 | 바뀐 흐름의 E2E 가 통과하고 minifia-v3 에 배포된다 | ✓ VERIFIED | `/api/health` → `2026-11-10T10:31:13Z+722eb565`(18-14 SUMMARY 값과 일치, 18-12 코드 커밋 `a3f369d0`·`a1e9eb1e` 가 이 커밋 조상). 배포본 smoke full 을 검증자가 직접 1회 실행해 `SMOKE OK full code=7460 players=5 serverSpread=0ms/0ms` 통과(도착 편차 1437ms/584ms 는 정보용). 18-14 가 기록한 반복 결과는 5회 중 4회 통과, 실패 1회는 HTTP `fetch failed`(서버 응답 없음, 서버 결함 증거 없음) |

**Score:** 4/5 truths verified (0 behavior-unverified, 1 uncertain → 사람 판단 이월)

### SC-2 / G-18-1 상세 (조명)

**원인 대응 확인(코드).** UAT 근본 원인은 "talk 바닥·건물이 남색 재질이라 조명 값만으로는 낮이 안 된다 / vote 가 night 보다 어둡다 / 바 morning 1.53배". 18-12 는 `PhaseTune.albedo`(`albedoGrader`)를 도입해 단계가 바뀔 때만 정점 색·연장 판 색을 tint 쪽으로 섞는다. 검증자가 확인: `plaza.ts`·`bar.ts` 에 `ALBEDO_NONE`·`albedoGrader`·`gradedFor !== phase → grade(t.albedo)` 가 있고, 밤 쪽 네 행은 `ALBEDO_NONE`(mix 0)이며 talk·morning·vote 에만 tint 가 있다(plaza 72·87·162행, bar 141·155·236행). `lighting.test.ts`·`plazaScene`·`barScene`·`e2eContract`·`look` 5개 파일 210건 통과.

**렌더 측정(검증자가 `perf/light-390x844.json` 직접 확인, 390x844 dpr 2).**

| 맵 | talk | morning | vote | night | L4a 순서 | L4b talk/night | L4c morning/night |
|----|------|---------|------|-------|----------|----------------|-------------------|
| 광장 | 0.2096 | 0.1987 | 0.0188 | 0.0069 | 통과 | 30.4배(문턱 2) | 28.8배(문턱 1.6) |
| 바 | 0.1243 | 0.0714 | 0.0182 | 0.0069 | 통과 | 18.0배 | 10.4배 |

이전 검증의 실패(vote < night 두 맵, 바 morning 1.53배)는 모두 해소됐다. 색: 광장 talk 채도 0.152·blueLead -21.6(남색 벗어남), 광장 morning 채도 0.251(문턱 0.30), 바 talk blueLead -32.4. night 평균은 18-07 대비 0.1%·0.3% 변화(5% 안, 밤 불변).

**PNG 눈 확인(검증자가 직접 봄).** 광장 talk 는 회갈색 한 톤의 흐린 낮으로 짙은 남색 밤(light-plaza-night)과 장면만으로 확실히 구분된다. 광장 morning 은 서늘한 회청 하늘·건물이라 talk(따뜻한 회갈)와 색온도로 구분된다(밝기는 거의 같다). 바 morning 은 회청 마루·벽에 벽등과 촛불이 보이고 night(거의 깜깜한 보랏빛)와 구분된다. 다만 이것은 휘도·색 측정과 검증자의 PNG 열람일 뿐이고, UAT 가 지적한 것은 사람이 실제 판에서 느끼는 시간감이다. 광장 talk 가 꽤 밝고 흐릿해 "마피아 분위기" 면에서 너무 밝다고 느낄 여지가 있고(18-12 가 스스로 남긴 손잡이), 바 morning 은 실내 장면이라 낮이 확 느껴지는 정도는 약할 수 있다.

**판정.** 측정 가능한 gap(G-18-1 근본 원인 세 가지)은 닫혔다. 그러나 G-18-1 의 원 제보는 사용자 눈 판단이었고 그 재확인은 사용자가 v3.0 실기기 시험으로 미뤘다. 따라서 SC-2 는 FAILED 가 아니라 UNCERTAIN(사람 확인 대기)로 둔다. 눈 확인에서 "여전히 낮이 안 느껴진다"가 나오면 gaps_found 로 바꾸고 다음 손잡이(바 창 빛 분리, 광장 talk·morning hemi/mix, 필요하면 배경 에셋 변경 — 사용자가 UAT 에서 질문한 방향)로 계획한다.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/world/maps/plaza.ts`·`bar.ts` | `AlbedoGrade`·`albedoGrader`·시간대별 albedo·sky·moonColor | ✓ VERIFIED(값·배선) / ? (지각) | 위 SC-2 |
| `scripts/perf-run.mjs` | `colorStats`·`readLowerHalfColor`·light JSON colors | ✓ VERIFIED | `node --test scripts/perf-run.test.mjs` 통과, JSON 에 colors 존재 |
| `scripts/smoke.mjs` | 가져오기 가능·순수 판정 export·처형 대기 전원·서버 시각 편차·연결 보고 | ✓ VERIFIED | `node --check` 통과, `node --test scripts/smoke.test.mjs scripts/perf-run.test.mjs` 36건 통과 |
| `scripts/smoke.test.mjs` | roleStringAllowed·morningProblems·serverSpread·linkReport 시험 | ✓ VERIFIED | 13건 통과(전체 36건에 포함) |
| `test/unit/e2eContract.test.ts` | smoke 허용 키·경로를 서버 buildView 와 묶음 | ✓ VERIFIED | 80건대 통과(5파일 210건에 포함) |
| `perf/light-390x844.json`·PNG 8장 | 측정 근거 | ✓ VERIFIED | 파일 열람, 값이 SUMMARY 와 일치 |
| `docs/decisions/0081-…md`·`HANDOFF.md` | 한계·조명 이월·smoke 결과 갱신 | ✓ VERIFIED | 한계 절·HANDOFF 7·26행에 반영 |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `applyLook`(plaza) | `grade(t.albedo)` | `gradedFor !== phase` 때만(plaza.ts 476~478) | WIRED |
| `applyLook`(bar) | `grade(t.albedo)` | bar.ts 696~698 | WIRED |
| plaza | `albedoGrader`·`ALBEDO_NONE` | `./bar` import(plaza.ts 38) | WIRED |
| smoke 흐름 단언 | `roleStringAllowed`·`morningProblems`·`serverSpread` | 같은 함수를 시험도 호출 | WIRED |
| smoke 사본 상수 | shared `OUTFIT_IDS` 등 | `e2eContract` 가 같은지 묶음 | WIRED |

(옷·튜토리얼·문구 링크는 이전 검증에서 WIRED 확인, 해당 소스 변경 없음.)

### Data-Flow Trace (Level 4)

조명: `PhaseTune.albedo` 표 → `grade()` → 정점 색 buffer·plate material → 렌더 휘도·색 측정(JSON)으로 실제 값이 화면 픽셀까지 흐르는 것을 확인. smoke: 서버 `view.serverNow`(방송마다 한 번 `Date.now()`) → `serverSpread` — 검증자 실행 결과 0ms/0ms 로 실제 프레임에서 값이 나옴. 그 외는 이전 검증 그대로.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 조명·장면·옷·계약 시험 | `npx vitest run test/unit/lighting.test.ts plazaScene barScene e2eContract look` | 5 파일 210 통과 | ✓ PASS |
| smoke·perf-run 단위 | `node --test scripts/smoke.test.mjs scripts/perf-run.test.mjs` | 36 통과 0 실패 | ✓ PASS |
| smoke 문법 | `node --check scripts/smoke.mjs` | ok | ✓ PASS |
| 배포 버전 | `curl …/api/health` | `2026-11-10T10:31:13Z+722eb565` | ✓ PASS |
| 배포본 smoke full | `SMOKE_STACK=1 node scripts/smoke.mjs --prod --stage full --players 5 --previous-version 2026-11-10T02:35:10Z+6ea0749c` | `SMOKE OK full … serverSpread=0ms/0ms arrivalSpread=1437ms/584ms`, exit 0 | ✓ PASS |

### Probe Execution

해당 없음(`probe-*.sh` 선언 없음). Step 7c: SKIPPED.

### Requirements Coverage

선언된 요구사항 ID 없음. 고아 요구사항 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `shared/game/look.ts`·`rematch.ts` | — | WR-01·WR-02 | ℹ️ Info(사용자 결정으로 한계 기록) | 결정 0081 에 기재, 21페이즈에서 유지 여부 재결정 |
| smoke `fetch failed` | — | 배포본 반복 1/5 | ℹ️ Info | 서버 판정 도달 전 HTTP 전송 실패, 원인(`cause`) 미출력. 반복되면 `cause` 출력을 더한다(18-14 기록). 이번 검증자 실행은 통과 |
| 18-12·13·14 변경 파일 | — | TBD·FIXME·XXX | — | 변경 소스·스크립트에서 부채 표식 없음(전체 grep 은 하지 않고 변경 범위 확인) |

위생: 18-12~14 SUMMARY·결정 0081 한계 절에서 회사·조직 관련 표현 없음.

### Human Verification Required

### 1. 낮·밤 조명 눈 확인 (SC-2 · G-18-1) — v3.0 실기기 시험으로 이월

**Test:** 배포본 또는 실기기에서 광장·재즈 바의 낮 토론·아침·저녁 지목·밤을 번갈아 본다.
**Expected:** 낮·아침이 밤과 장면만으로 구분되고 낮이 낮답게 느껴지며, 지목이 밤과 헷갈리지 않고, 낮이 마피아 분위기를 잃을 만큼 밝지 않다.
**Why human:** 측정은 통과했으나 원 제보가 눈 판단이었고 사용자가 재확인을 실기기 시험으로 미뤘다. 이월은 실패가 아니다.

### 2. 조명 세부 손잡이 확인

**Test:** 광장 talk 의 밝기·흐림, 광장 talk·morning 의 구분, 바 morning 창 블라인드 파랑을 본다.
**Expected:** 문제가 있으면 18-12 SUMMARY "남은 문제 / 다음 손잡이" 를 후속 조정 계획으로 만든다.
**Why human:** 분위기 취향이며 결정 0081-1-2 와 맞물린다.

### Gaps Summary

차단(BLOCKER)은 없다. G-18-3(smoke)은 서버 결함이 아니라 smoke 의 낡은 단언 문제였고 smoke 쪽 수정(옷 look·seen 허용, 처형 대기 전원, 서버 시각 편차 판정, 연결 보고)과 시험·계약 묶음으로 닫혔으며, 검증자가 배포본에서 직접 통과를 확인했다. WR-01·WR-02 는 사용자 결정으로 알려진 한계에 기록되어 해결됐다. G-18-1(조명)은 근본 원인 세 가지가 측정과 PNG 로 해소됐지만 사람 눈 확인이 남아 SC-2 는 UNCERTAIN 이다. 사용자 결정에 따라 이 항목은 v3.0 실기기 시험으로 이월하는 human-needed 로 기록하며, 눈 확인에서 낮이 여전히 안 느껴지면 gaps_found 로 전환해 바 창 빛 분리 또는 배경 에셋 변경 계획을 만든다.

참고: 18-14 결과에 `npm test` 첫 실행 2건 실패(재실행 통과, 원인 미확정)와 smoke `fetch failed` 1건이 있으나 코드 결함 증거는 없고 위에 기록했다.

---

_Verified: 2026-11-10T11:20:00Z_
_Verifier: Claude (gsd-verifier)_
