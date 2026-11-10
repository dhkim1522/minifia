---
phase: 18-quick-fixes
verified: 2026-11-10T12:30:00Z
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
  - "shared/game/look.ts"
  - "shared/game/room.ts"
  - "src/components/v2/DressSheet.tsx"
  - "src/components/v2/EvidenceCard.tsx"
  - "src/components/v2/FocusRing.tsx"
  - "src/components/v2/TutorialNext.tsx"
  - "src/game/hostLine.ts"
  - "src/world/maps/bar.ts"
  - "src/world/maps/plaza.ts"
covered_digest: "v3:sha256:c6faa2280397564b6a02823733d60304e5173c36c0a4551b7388f6ad5a9752ad"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "SC-2 낮·밤 조명을 실기기(또는 배포본 화면)에서 눈으로 비교한다 — 광장·재즈 바의 talk·morning·vote 를 night 와 번갈아 본다"
    expected: "talk·morning 이 night 와 장면만 보고 구분되고, 광장 talk 가 짙은 남색 저녁이 아니라 흐린 낮으로 읽힌다. 저녁 지목(vote)이 밤과 헷갈리지 않는다"
    why_human: "렌더 평균 휘도 판정(L4a 두 맵, 바 L4c 1.53배)이 계획이 정한 문턱에 못 미쳤고 계획이 사람 판단으로 넘겼다. 낮다움·구분은 지각 판단이라 코드로 확정할 수 없다"
  - test: "WR-01·WR-02 처리 방향 결정 — 기본 옷(coat)을 눌러 둔 사람이 시작 때 몰래 옷이 바뀌는 문제, 다시 하기 뒤 쉬던 사람 합류 때 결과 화면에서 같은 옷이 다시 보이는 문제"
    expected: "코드로 고치거나(18-REVIEW.md 의 Fix 안) 결정 0081-1 의 알려진 한계로 기록한다. 한 판 안의 옷 유일성에는 영향이 없다"
    why_human: "SC-1 의 괄호 문구('이미 누가 입은 옷을 잠근다')를 기본 coat 까지 확장할지는 제품 판단이다"
  - test: "배포본 smoke full 재확인: node scripts/smoke.mjs --prod --stage full --players 5 --previous-version 2026-11-09T06:26:08Z+4858e54f"
    expected: "통과(도착 편차 500ms 미만, .msg 읽기 오류 없음, 소켓 유지)"
    why_human: "18-10 이 6번 모두 실패했고 원인(망 지연 대 .msg 읽기 오류)을 확정하지 못했다. DO 하루 쓰기 한도(결정 0076)와 망 상태가 걸려 있어 검증자가 반복 실행하지 않았다"
---

# Phase 18: 바로 고칠 것 — 증거·조명·튜토리얼 손보기 검증 보고서

**Phase Goal:** 실테스트 전에, 미션 방향과 무관하게 증거·화면이 제대로 읽히게 고친다(결정 0081-1). 흔적이 한두 명으로 좁혀지고, 낮과 밤이 장면만으로 구분되며, 튜토리얼에서 눌러야 할 곳과 [다음]이 바로 눈에 들어온다.
**Verified:** 2026-11-10T12:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification
**요구사항 ID:** 없음(ROADMAP `Requirements: TBD`, PLAN frontmatter 의 `requirements-completed` 는 SC-1~SC-5 라벨이며 REQUIREMENTS.md 항목이 아니다). 대조할 ID·고아 요구사항 없음.

## Goal Achievement

### Observable Truths (ROADMAP SC-1~SC-5)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 한 판 안에서 두 사람이 같은 옷을 입지 않는다(시작 때 겹침 해소, 대기실 옷장 잠금) → 흔적의 같은 옷 표시는 많아야 한 사람 | ✓ VERIFIED (경고 2건) | `shared/game/look.ts` 의 `resolveLookConflicts`(2패스, seat·look 만 읽음)가 `shared/game/room.ts:448` `beginGame` 에서 호출됨(startGame·rematch 공통). `TRACE_OF_OUTFIT`(trace.ts)이 9종 전부 서로 다른 조각이라 옷이 유일하면 조각도 한 사람에게만 붙는다. 서버 `setLook` 이 남이 직접 고른 옷을 거절(`lockedOutfits`), `DressSheet`·`Lobby`·`ResultScreen` 이 같은 함수로 `data-taken` 잠금 표시. 검증자가 `look.test.ts`·`dress.test.ts`·`gameRoom.test.ts`·`lighting.test.ts` 147건 통과를 직접 재확인. 경고: WR-01·WR-02(아래) |
| 2 | 낮(talk·morning 등)과 밤 조명이 장면만 보고 구분된다. 낮도 낮은 채도. 튜토리얼 낮 장면 2~6 도 같다 | ? UNCERTAIN (사람 판단 요청) | 값·허용 범위 시험(`lighting.test.ts`) 통과, `moonColor` 단계별 갱신 배선 확인. 렌더 측정(`perf/light-390x844.json`): talk/night 광장 2.48배·바 2.92배 통과, morning/night 광장 1.71배 통과·**바 1.53배(문턱 1.6 미달)**, **vote 가 두 맵 모두 night 보다 어두움(L4a 실패)**. 검증자가 PNG 를 직접 봄: 광장 talk 는 밤과 구분되나 짙은 남색이라 "낮"이 약하고, 광장 vote 는 거의 검정이라 night 와 휘도로는 구분이 약하다(창문·가로등은 둘 다 켜짐). 계획이 허용한 "남은 문제" 경로이고 HANDOFF 확인 대기에 기록됨 |
| 3 | 튜토리얼 포커스 밖 어두워짐(흐림 없음), [다음]은 아래 가운데 넓은 글 단추, 튜토리얼 동안 채팅 칸·입력줄·내 역할 단추 숨김, 장면 5 선이 화면 안, 시민 문구 = 실제 판 | ✓ VERIFIED | `FocusRing.tsx`: 화면 전체 svg mask, `TUTORIAL_DIM_ALPHA=0.5`, `blur` 없음(grep 0). `TutorialNext.tsx`: `.tut-next` bottom 28px·`min(240px, 100% - 48px)` 알약, 글 "다음". `GameMap` `panelless` prop 으로 패널·[내 역할] DOM 제거. `TutorialRoleCards` 가 `ROLE_TEXT` 를 읽음(시민 "대화와 투표로 마피아를 찾아요"). 검증자가 `tutorialScreen`·`tutorialGate`·`tutorialScript` 등 183건 통과, 배포본에서 `tutorial-solo` 390x844 218/218 을 직접 재실행해 통과(TD·TN·TH·EV 판정 포함) |
| 4 | 낡은 문구 정리: 역할 확인 "밤 대화가 공개돼요" 삭제, 밤 띠 "이름표"→"얼굴", 아침 증거 "눈 0"→목격자 없음 아이콘 | ✓ VERIFIED | `RoleReveal.tsx` 에 공개 예고 줄 없음(빈 칸만). `hostLine.ts` night.* 네 줄이 "…얼굴을 눌러 주세요". `EvidenceCard` 가 `witness === null` 이면 `V2Icon eyeOff`(label "목격자 없음") 하나, `mv-evidence__zero` 참조 0. 남은 `resultText.ts:21 preNotice` 는 결과 화면 기록 시트(LineSheet) 문구이고 역할 확인이 아니다 |
| 5 | 바뀐 흐름의 E2E 가 통과하고 minifia-v3 에 배포된다 | ✓ VERIFIED (경고: smoke full) | 검증자가 `https://minifia-v3.dhplay.workers.dev/api/health` 로 version `2026-11-10T02:35:10Z+6ea0749c` 확인(SUMMARY 값과 일치). `node --test scripts/e2e/*.test.mjs scripts/perf-run.test.mjs` 523 통과. 배포본 `tutorial-solo` 직접 통과. SUMMARY: 로컬 폰 6종 회귀 5792/5797(실패 3건 재실행 통과, 나머지는 13페이즈부터의 알려진 perfbudget 3건), 배포본 avatar-dress 폰 6종 통과. 경고: 배포본 smoke full 6/6 실패 |

**Score:** 4/5 truths verified (0 behavior-unverified, 1 uncertain → 사람 판단)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/game/look.ts` | resolveLookConflicts·lockedOutfits·setLook 잠금 | ✓ VERIFIED | 역할·난수·시각을 읽지 않음, room.ts 가 호출 |
| `src/components/v2/DressSheet.tsx` | taken 잠금 카드 | ✓ VERIFIED | Lobby·ResultScreen 이 서버 view.players 로 계산 |
| `src/components/v2/FocusRing.tsx` | mask 스포트라이트 | ✓ VERIFIED | TutorialScreen 에서 마운트 |
| `src/components/v2/TutorialNext.tsx` | [다음] 알약 | ✓ VERIFIED | |
| `src/components/v2/EvidenceCard.tsx`·`V2Icon.tsx` | eyeOff | ✓ VERIFIED | |
| `src/world/maps/plaza.ts`·`bar.ts` | PhaseTune.moonColor·새 낮 값 | ✓ VERIFIED(값) / ? (지각) | SC-2 참고 |
| `scripts/perf-run.mjs` `--mode light` | 휘도 측정 | ✓ VERIFIED | 단위 시험 통과, 측정 JSON·PNG 존재 |
| `perf/light-*.json`·PNG | 측정 근거 | ✓ VERIFIED | 파일 존재, 값이 SUMMARY 와 일치 |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `beginGame` | `resolveLookConflicts` | room.ts:448 | WIRED |
| `setLook` | `lockedOutfits` | look.ts 잠금 검사 | WIRED |
| `Lobby`/`ResultScreen` | `DressSheet taken` | `lockedOutfits(view.players − 나)` | WIRED |
| `TutorialScreen` | `GameMap panelless/camera` | prop 전달 | WIRED |
| `TutorialScreen` | `FocusRing`·`TutorialNext` | 마운트 | WIRED |
| `applyLook` | `moon.color.set(t.moonColor)` | plaza.ts:474 | WIRED |
| `TRACE_OF_OUTFIT` | 옷 → 흔적 조각 | 9종 일대일 | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| DressSheet taken | 남이 고른 옷 | 서버 view.players[].look | 예 | ✓ FLOWING |
| EvidenceCard 2행 | witness | 서버 흔적 view | 예 | ✓ FLOWING |
| TutorialRoleCards | 문구 | 정적 ROLE_TEXT(실제 카드와 같은 표) | 예 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 옷 해소·잠금·누설 | `npx vitest run test/unit/look.test.ts test/worker/dress.test.ts test/unit/lighting.test.ts test/unit/gameRoom.test.ts` | 147 통과·1 skip | ✓ PASS |
| 튜토리얼·증거·옷장 화면 | `npx vitest run` 6개 파일 | 183 통과 | ✓ PASS |
| E2E·측정 스크립트 단위 | `node --test scripts/e2e/*.test.mjs scripts/perf-run.test.mjs` | 523 통과 | ✓ PASS |
| 배포 버전 | `curl …/api/health` | `2026-11-10T02:35:10Z+6ea0749c` | ✓ PASS |
| 배포본 튜토리얼 | `npm run e2e -- --url https://minifia-v3.dhplay.workers.dev --only tutorial-solo --sizes 390x844` | 218/218 | ✓ PASS |

### Probe Execution

해당 없음(이 페이즈는 `probe-*.sh` 를 선언하지 않았다). Step 7c: SKIPPED.

### Requirements Coverage

PLAN 들이 선언한 요구사항 ID 는 없고(`phase_req_ids` null) REQUIREMENTS.md 에 18페이즈로 매핑된 항목도 없다. 고아 요구사항 없음.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `shared/game/look.ts` | 28 | 같은 값 검사가 잠금 검사보다 앞 — look 키 없는 사람이 coat 를 눌러도 저장 안 됨(WR-01) | ⚠️ Warning | 다른 사람이 coat 를 직접 고르면 앞선 사람이 시작 때 몰래 옷이 바뀜. 한 판 옷 유일성은 유지 |
| `shared/game/rematch.ts` | 88-98, 143-149 | 쉬는 사람(bench) 합류 때 겹침 해소 없음(WR-02) | ⚠️ Warning | 결과 화면에서 같은 옷이 잠시 보임. 다음 beginGame 이 다시 풂 |
| `shared/game/look.ts` | 52-54 | 빈 옷 없으면 조용히 continue(IN-01) | ℹ️ Info | 옷 9 > 자리 8 이라 현재는 닿지 않음 |
| 기타 | — | IN-02~IN-05(주석 불일치·빈 hints 칸·E2E 매직 넘버·clampPoint export) | ℹ️ Info | 18-REVIEW-DISPOSITION.md 에 open 으로 기록됨, 차단 없음 |

TBD·FIXME·XXX 부채 표식: 검증 파일에서 발견하지 못함. 위생 검사: 18페이즈 문서·결정 0081·HANDOFF 에서 회사·조직 관련 표현 없음(일반 용례 "공식 조직 패키지"만 기존 파일에 있음).

### Human Verification Required

### 1. 낮·밤 조명 눈 확인 (SC-2)

**Test:** 배포본 또는 실기기에서 광장·재즈 바의 낮 토론·아침·저녁 지목·밤 화면을 번갈아 본다.
**Expected:** 낮과 밤이 장면만으로 구분되고, 광장 낮이 남색 저녁이 아니라 흐린 낮으로 읽히며, 지목(vote)이 밤과 헷갈리지 않는다.
**Why human:** 평균 휘도 판정이 vote < night(두 맵)·바 morning 1.53배로 문턱 미달이고, 값을 더 올리면 낮 분위기 방향(결정 0081-1-2, 낮은 채도 유지)이 바뀌어 사람이 정해야 한다. 이 미달을 합격으로 포장하지 않는다. 사람이 "구분 안 됨"으로 판단하면 gaps_found 로 바꾸고 vote moonColor·sky 조정 또는 재질 변경 계획을 만든다.

### 2. WR-01·WR-02 처리 방향 (SC-1 경계)

**Test:** `18-REVIEW.md` 의 Fix 안을 적용할지, 알려진 한계로 기록할지 정한다.
**Expected:** 기본 coat 포함 "이미 누가 입은 옷은 잠금"이 필요하면 후속 계획으로, 아니면 결정 0081-1 에 한계 기록.
**Why human:** 한 판 안 유일성이라는 SC-1 결과는 코드·시험으로 충족되나, 괄호 문구를 기본 coat 까지 읽을지는 제품 판단이다.

### 3. 배포본 smoke full 재확인

**Test:** `node scripts/smoke.mjs --prod --stage full --players 5 --previous-version 2026-11-09T06:26:08Z+4858e54f`
**Expected:** 통과.
**Why human:** 6번 연속 실패(시간 편차·소켓 1006·`.msg` undefined 읽기)의 원인이 확정되지 않았다. 기능 판정은 일부 시도에서 통과했고 SC-5 문구(바뀐 흐름 E2E 통과 + 배포)는 충족되지만, 배포본 방 흐름 건강도가 확인되지 않은 상태다. 또한 nightload 끊김 5.0·7.1/5분(합격선 5)은 17페이즈에서 이어진 처형 장면 현상이라 SC 범위 밖이나 실기기 확인 대기다.

### Gaps Summary

차단(BLOCKER) 항목은 없다. SC-1·3·4·5 는 코드·시험·배포본 재실행으로 확인되었다. SC-2 는 계획이 스스로 정한 렌더 문턱 일부(vote > night 두 맵, 바 morning 1.6배)를 넘지 못했고, 로드맵 문구("장면만 보고 구분")가 지각 기준이라 사람 판단으로 넘긴다 — 눈으로 구분이 안 되면 gaps_found 로 전환해야 한다. SC-1 은 결과(한 판 옷 유일·흔적 ≤ 1명)가 충족되지만 기본 옷 coat 의 잠금 누락(WR-01)과 쉬는 사람 합류(WR-02)가 열려 있어 사용자 결정이 필요하다. 배포본 smoke full 6/6 실패는 SC-5 문구 밖이나 재확인이 필요하다.

---

_Verified: 2026-11-10T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
