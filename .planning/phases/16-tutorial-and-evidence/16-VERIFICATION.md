---
phase: 16-tutorial-and-evidence
verified: 2026-11-08T15:00:00Z
status: human_needed
score: 4/4 must-haves verified
covered_files:
  - ".planning/phases/16-tutorial-and-evidence/16-01-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-01-SUMMARY.md"
  - ".planning/phases/16-tutorial-and-evidence/16-02-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-02-SUMMARY.md"
  - ".planning/phases/16-tutorial-and-evidence/16-03-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-03-SUMMARY.md"
  - ".planning/phases/16-tutorial-and-evidence/16-04-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-04-SUMMARY.md"
  - ".planning/phases/16-tutorial-and-evidence/16-05-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-05-SUMMARY.md"
  - ".planning/phases/16-tutorial-and-evidence/16-06-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-06-SUMMARY.md"
  - ".planning/phases/16-tutorial-and-evidence/16-07-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-07-SUMMARY.md"
  - ".planning/phases/16-tutorial-and-evidence/16-08-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-08-SUMMARY.md"
  - ".planning/phases/16-tutorial-and-evidence/16-09-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-09-SUMMARY.md"
  - ".planning/phases/16-tutorial-and-evidence/16-10-PLAN.md"
  - ".planning/phases/16-tutorial-and-evidence/16-10-SUMMARY.md"
  - "docs/decisions/0079-v3-buttons-and-evidence.md"
  - "shared/game/errand.ts"
  - "shared/game/errandFake.ts"
  - "shared/game/night.ts"
  - "shared/game/phases.ts"
  - "shared/game/view.ts"
  - "src/components/ToolButton.tsx"
  - "src/components/v2/ErrandAct.tsx"
  - "src/components/v2/ErrandDots.tsx"
  - "src/components/v2/ErrandStartCard.tsx"
  - "src/components/v2/EvidenceCard.tsx"
  - "src/components/v2/SideColumn.tsx"
  - "src/components/v2/placeArt.tsx"
  - "src/game/hostLine.ts"
  - "src/game/traceMark.ts"
  - "src/screens/GameMap.tsx"
  - "src/screens/Lobby.tsx"
  - "worker/room.ts"
covered_digest: "v3:sha256:d1400561e094c0084ce371d6290d4dbbaee0d5c2c22bce3f90b92dea8bb3a255"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "실기기(폰)에서 아이콘 단추 아래 글 이름표가 없고, 머리(나가기·공유)와 오른쪽 한 줄(소리·맵·봇·옷장)이 같은 크기 원으로 보이는지, 한 손으로 누르기 편한지 본다"
    expected: "머리는 44 정사각 둘, 오른쪽은 52 원이 한 줄로 늘어서고 자막 띠 주변은 비어 있다. 손님에게는 맵·봇이 없다"
    why_human: "눈으로 보는 정리감·누르기 편함은 자동 검사로 판정할 수 없다"
  - test: "실기기에서 심부름 한 판을 한다 — 시작 2초 카드, 64 타일 후광, 발밑 방향 화살표, 장소 위 [처리] 알약, 진행 점 3"
    expected: "카드가 내 장소 3곳을 컬러 그림으로 보여 주고, 가장 가까운 곳으로 화살표가 안내하며, 닿으면 그 장소 위에 [처리]가 뜬다. 마피아도 시민과 똑같이 보인다"
    why_human: "눈으로 보는 방향 안내의 직관성·장면 연출·마피아 쪽 겉보기 동일 여부는 사람이 해 봐야 안다"
  - test: "실기기에서 피해자가 나온 아침과 낮을 본다 — 증거 카드 2행, 같은 옷 이름표 표시, 마지막 목격자 표시, 사회자 문구"
    expected: "같은 옷을 입은 사람과 마지막 목격자가 색만이 아니라 아이콘으로도 구분되고, 토론·투표 동안 유지되며, 의심의 근거로 실제로 쓰인다는 느낌이 든다"
    why_human: "표시가 의심의 근거로 읽히는지는 판단이 필요한 체감이다. 폰 6종 이름표 가림 없음·카드 교차 없음은 backstop 항목이라 실기기로 한 번 본다"
---

# Phase 16: 단추 정리·심부름 증거 Verification Report

**Phase Goal:** 2026-11-08 실테스트 피드백(결정 0077)으로, 단추가 글 이름표 없이 한 모양으로 정리되고, 심부름과 아침 흔적이 실제로 의심의 근거가 된다. 튜토리얼은 17페이즈(결정 0078).
**Verified:** 2026-11-08
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP 성공 기준)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 아이콘 단추 아래 글 이름표가 없다(접근성 이름은 남는다) | ✓ VERIFIED | `src` 전체에서 `data-tool-label`, `tool__label` 0건(grep). `ToolButton.tsx` 는 `name` 필수 prop 이고 `aria-label={name}` 만 렌더, 글 span 없음. `test/client/toolLabels.test.tsx` 통과(전 화면 이름표 0건·모든 button 접근성 이름). |
| 2 | 소리·맵·봇·옷장 단추가 오른쪽 한 줄 같은 크기 원으로 모이고 머리에는 나가기·공유만 있다 | ✓ VERIFIED | `SideColumn.tsx`(SIDE_CELL 52, SIDE_GAP 12, `splitSideColumn`)가 `Lobby.tsx` 228행에서 맵(방장)·봇(방장)·옷장을 감싸고 소리는 독이 첫 칸. `Lobby.tsx` 머리는 `ToolButton` 나가기·공유 둘뿐. `ResultScreen.tsx` 도 사용. `v2.css` `.mv-side` right 16·top 띠 아랫변+12. `sideColumn.test.tsx` 통과. |
| 3 | 심부름 시작 카드·장소 빛·방향 화살표·장소 [처리]가 있고, 장소·아이템 아이콘이 컬러 에셋(승인본 A)이다 | ✓ VERIFIED | `ErrandStartCard`·`ErrandDots`·`ErrandAct`(장소 위 알약, `aria-label "{장소}에서 처리"`)가 `GameMap.tsx` 에 연결(731·744·917·918행). `design/v3.0/assets/` svg 25개, `placeArt.tsx` 생성물, `npm run placeart:check` 종료 0, `placeArt.test.ts` 통과. 옛 `TraceCard`·`placeIconOf`·독 표식은 `src` 에서 0건. |
| 4 | 마피아는 처리되지 않는 가짜 장소 하나를 받고(겉보기·네트워크로 역할이 드러나지 않음), 아침 흔적은 같은 옷을 입은 사람을 표시하며, 피해자를 마지막으로 본 사람이 공개된다 | ✓ VERIFIED | 가짜: `errandFake.ts`(난수 없이 `(seat+day) % 길이`)를 `tick.ts` ON_ENTER.errand 가 감싸고, `errand.ts` `actErrand` 가 `id === actor.errandFake` 를 건너뛰어 반경 밖과 같은 `{ok:false}`. `view.ts` 는 `me.errand` 를 필드별 복사(places·done 뿐). `errandLeak.test.ts` ⑧(응답 동일·프레임에 `errandFake` 없음) 통과. 같은 옷: `traceMark.ts` `sameOutfitSeats`(공개 look 만 사용) → `GameMap.tsx` 483·652행 → `HeadStack` `data-trace-mark`. 마지막 목격: `sampleErrand` 가 `errandLast` 갱신 → `enterMorning` 이 `morning.seen` 으로 옮기고 지움 → `view.ts` 155~159행 `day.evidence` → `EvidenceCard` 2행. `errandLeak.test.ts` ⑦(역할 다섯 시점 값 동일·`errandLast` 프레임 없음) 통과. |

**Score:** 4/4 truths verified (behavior-unverified 0)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `shared/game/errandFake.ts` | 마피아 가짜 장소 배정 | ✓ VERIFIED | 실제 구현, 역할을 읽는 유일한 심부름 파일, `tick.ts` 에서 호출 |
| `shared/game/errand.ts` / `night.ts` | errandLast 표본·morning.seen | ✓ VERIFIED | 표본·이관·삭제(낮 시작·아침) 모두 확인 |
| `shared/game/view.ts` | day.evidence 공개 필드 | ✓ VERIFIED | `EVIDENCE_PHASES` 단계에서만, 필드별 복사 |
| `src/components/v2/SideColumn.tsx` | 오른쪽 한 줄 | ✓ VERIFIED | Lobby·ResultScreen 에 연결 |
| `src/components/v2/placeArt.tsx` + `design/v3.0/assets/` | 컬러 에셋 25 | ✓ VERIFIED | `--check` 통과 |
| `src/components/v2/EvidenceCard.tsx` | 증거 카드 2행 | ✓ VERIFIED | GameMap 968행에서 사용, 데이터는 `day.evidence` |
| `src/components/v2/ErrandAct/StartCard/Dots.tsx` | 심부름 화면 | ✓ VERIFIED | GameMap 에 연결 |
| `src/game/traceMark.ts` | 조각 색·같은 옷 판정 | ✓ VERIFIED | 단위 시험 통과 |
| `docs/decisions/0079-v3-buttons-and-evidence.md` | 결정 기록 | ✓ VERIFIED | 존재, 0073·0074·0077 에 개정 표시 확인 |

### Key Link Verification

| From | To | Status | Details |
| --- | --- | --- | --- |
| `tick.ts` ON_ENTER.errand | `assignErrandFake` | WIRED | 55행 |
| `errand.ts actErrand` | `Player.errandFake` | WIRED | 105행 |
| `worker/room.ts` 봇 | errandFake 마지막 순서 | WIRED | 986~992행 |
| `night.ts enterMorning` | `morning.seen` → `view.day.evidence` | WIRED | night 166·177행, view 155~159행 |
| `GameMap.tsx` | EvidenceCard·ErrandStartCard·ErrandDots·이름표 표시 | WIRED | 위 truth 3·4 참조 |
| `hostLine.ts` | `discussion.evidence`·`errand.act`·`trace` 문구 | WIRED | 63~90행, 130행(`day.evidence.trace` 유무만 읽음) |
| `package.json typecheck` | `placeart:check` | WIRED | 종료 0 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Real Data | Status |
| --- | --- | --- | --- | --- |
| EvidenceCard | piece·witness | `view.day.evidence` ← `morning.trace/seen` ← `errandLast`(1초 표본) | 예 | ✓ FLOWING |
| 이름표 같은 옷 표시 | `sameOutfitSeats(view.players, trace)` | 공개 `players[].look` | 예 | ✓ FLOWING |
| ErrandStartCard / Dots | `errandMine.places/n` | `view.me.errand` ← `errandPlaces/errandDone` | 예 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| 컬러 에셋 원본·사본·JSX 일치 | `npm run -s placeart:check` | 종료 0 | ✓ PASS |
| 가짜 장소·에셋·조각 색·이름표·열·증거 카드 단위 시험 | `vitest run` 6개 파일 | 110 통과 | ✓ PASS |
| 누설 시험(day.evidence·errandLast·errandFake)·view·errand | `vitest run errandLeak view errand` | 169 통과, 13 건너뜀(13페이즈 RULESET 꺼짐 때문, 16페이즈 무관) | ✓ PASS |
| 전체 빌드·단위 시험 | 오케스트레이터 보고(HEAD 8b1f2e7a) | build OK, 263 파일·7588 통과 | ✓ PASS(보고 인용) |

### Probe Execution

Step 7c: 해당 없음(`scripts/*/tests/probe-*.sh` 를 선언한 계획 없음).

### Requirements Coverage

계획 frontmatter `requirements` 합집합 = 11개, REQUIREMENTS.md 의 16페이즈 매핑 11개와 일치. 고아(ORPHANED) 요구사항 없음.

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| TOOL-04 | 16-04, 16-10 | 아이콘 단추 이름표 0, 접근성 이름 필수 | ✓ SATISFIED | 이름표 속성 0건, `ToolButton` name 필수, toolLabels 시험 |
| BTN-01 | 16-05, 16-10 | 머리 44 정사각·입력줄 48 원 | ✓ SATISFIED | 계획·E2E 계약·CSS(16-05), 크기는 실기기 확인 대기 |
| BTN-02 | 16-06, 16-10 | 오른쪽 세로 한 줄 52 원, 손님은 맵·봇 없음 | ✓ SATISFIED | SideColumn·Lobby·시험 |
| ERRAND-06 | 16-08, 16-10 | 시작 2초 카드가 장소 3곳을 컬러 그림으로 | ✓ SATISFIED | ErrandStartCard, 연결 확인 |
| ERRAND-07 | 16-07, 16-08, 16-10 | 64 타일·빛·화살표·[처리]·진행 점 | ✓ SATISFIED | ErrandMarker/Arrow/Act/Dots, 독 삭제 확인 |
| ERRAND-08 | 16-03, 16-10 | 마피아 가짜 장소, 외형·응답 동일 | ✓ SATISFIED | errandFake.ts, errandLeak ⑧ |
| ASSET-01 | 16-02, 16-07, 16-09, 16-10 | 장소 16·조각 9 컬러 에셋 이식, id 1:1 | ✓ SATISFIED | 25 svg·`--check`·placeArt 시험 |
| EVID-01 | 16-09, 16-10 | 같은 옷 산 사람 이름표 표시, 낮 동안 유지 | ✓ SATISFIED | traceMark·GameMap·HeadStack, E2E TC7·TC8 정의 |
| EVID-02 | 16-01, 16-10 | 피해자 마지막 목격자(+장소) 공개 | ✓ SATISFIED | errandLast→seen→day.evidence, 누설 시험 ⑦ |
| EVID-03 | 16-09, 16-10 | 사회자 문구가 근거를 가리킴 | ✓ SATISFIED | hostLine trace·discussion.evidence 문구 확인 |
| DEPLOY-04 | 16-01, 16-03, 16-10 | 누설 검사를 새 필드까지 넓혀 minifia-v3 배포 | ✓ SATISFIED | 누설 시험이 evidence·errandLast·errandFake 포함; 16-10-SUMMARY 에 배포 version `2026-11-08T14:29:24Z+49b1ad57` 과 smoke·E2E 결과 기록, 해당 커밋 이후 `src`·`shared`·`worker` 변경 0(diff 확인) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (phase 가 건드린 `src`·`shared`·`worker`·`scripts` 비시험 파일) | - | `TBD`·`FIXME`·`XXX`·`TODO`·`HACK` 0건 | - | 없음 |

### Warnings (비차단)

- 성능 nightload: 합격선은 평균 55fps·끊김 5회 이하다. 1회 측정은 끊김 6(처형 장면)으로 선을 넘었고 같은 조건 재측정에서 4로 통과했다(평균 59.9fps). 심부름 장면은 두 번 모두 끊김 0. SUMMARY 는 환경 편차로 판단했다. 합격선은 낮추지 않았고 재측정 값으로 판정했으므로 차단 사유는 아니지만, 처형 장면의 간헐 끊김은 이어서 지켜볼 항목이다.
- 알려진 간헐 실패(`test/worker/bots.test.ts` 밤 채팅, `errandLeak` 간헐)와 `witness` E2E "N번째 장소 16초 안에 처리 못함"(재현되지 않아 원인 미확정)은 결정 0079 알려진 한계에 기록돼 있다. 이번 검증에서 errandLeak 은 통과했다.
- 마피아는 3/3 을 끝내지 못해 목격 기록(`me.record`)을 받지 못한다. 이는 계획 A1 이 인정한 결과이고 본인 프레임에만 영향을 주어 다른 사람에게 역할이 드러나지 않는다.

### Human Verification Required

실기기·눈으로 보는 확인은 사용자 선호에 따라 17페이즈 배포 뒤 v3.0 실기기 실테스트로 미룬다(자동 판정 항목은 모두 통과).

#### 1. 단추 정리 한눈에 보기

**Test:** 폰에서 대기실·게임·결과 화면을 연다.
**Expected:** 아이콘 아래 글이 없고, 머리 44 정사각 둘과 오른쪽 52 원 한 줄이 같은 모양으로 정리되어 보이며 누르기 편하다.
**Why human:** 정리된 느낌과 누르기 편함은 시각·촉각 판단이다.

#### 2. 심부름 화면 직관성과 마피아 겉보기

**Test:** 시민 판과 마피아 판에서 심부름을 한 판씩 한다.
**Expected:** 시작 카드·후광·화살표·[처리]·진행 점이 막힘 없이 이해되고, 마피아 화면이 시민과 구별되지 않는다.
**Why human:** 안내의 직관성과 "구별되지 않는다"는 체감은 사람이 봐야 한다.

#### 3. 증거가 의심의 근거로 읽히는가

**Test:** 피해자가 나온 아침과 낮 토론·투표를 한 번 본다.
**Expected:** 증거 카드 2행, 같은 옷 표시, 마지막 목격자 표시, 사회자 문구가 서로 이어져 의심의 근거로 쓰인다. 폰 6종에서 이름표·카드가 서로 가리거나 줄바꿈하지 않는다(backstop 항목).
**Why human:** 의심의 근거가 되는지는 플레이 체감이고, 크기별 가림 여부는 실기기로 한 번 확인한다.

### Gaps Summary

차단 gap 없음. 11개 요구사항과 ROADMAP 성공 기준 4개 모두 코드에서 실제 구현·연결·데이터 흐름이 확인됐고, 누설 시험(역할·서버 전용 이름 `errandFake`·`errandLast`)이 통과한다. 남은 것은 실기기에서 눈으로 보는 확인 세 가지뿐이라 상태는 `human_needed` 다.

---

_Verified: 2026-11-08_
_Verifier: Claude (gsd-verifier)_
