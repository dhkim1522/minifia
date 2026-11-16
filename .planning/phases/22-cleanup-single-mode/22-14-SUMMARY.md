---
phase: 22-cleanup-single-mode
plan: "14"
subsystem: docs, decisions, handoff
tags: [docs, product, architecture, screen-map, decisions, handoff, phase-gate]
requires:
  - phase: 22-13
    provides: 바뀐 낮 흐름 로컬 E2E, vote-count·will-flow, P22-3 찬반 장면
provides:
  - docs/product.md 진행 흐름 표 = 낮 시작 → 토론 → 찬반 → 지목 → 유언 → 처형 → 밤 → 아침, 소통·정치 장치·끝난 뒤 문단 새 흐름
  - docs/architecture.md 에서 판 종류·마을·심부름·옛 튜토리얼·시상 서술 삭제, RULES 한 곳·옛 방 정규화·찬반 공개 원칙 다시 씀
  - docs/screen-map.md 에서 확장판·마을·심부름·튜토리얼 절 삭제, "판 하나·낮 투표·유언 (22페이즈)" 절과 새 E2E 흐름 항목
  - 폐기 표시 7(0074·0078·0080·0081·0086·0087·0088)·개정 표시 4(0063·0066·0072·0084)
  - 결정 0090(22페이즈 위임 선택 17줄)
  - HANDOFF.md(22 완료, 5.1KB)
affects: [23, 24]
tech-stack:
  added: []
  patterns:
    - "검사 패턴 원문을 문서에 옮겨 적지 않고 '저장소 위생 금지어 git grep' 으로 부른다"
key-files:
  created:
    - docs/decisions/0090-v3-single-flow-day-vote-will.md
    - .planning/phases/22-cleanup-single-mode/22-14-SUMMARY.md
  modified:
    - docs/product.md
    - docs/architecture.md
    - docs/screen-map.md
    - docs/decisions/0063-v2-play-feedback-b.md
    - docs/decisions/0066-v2-politics-tension-devices.md
    - docs/decisions/0072-v3-basic-day-flow.md
    - docs/decisions/0074-v3-errand-and-trace.md
    - docs/decisions/0078-tutorial-first-case.md
    - docs/decisions/0080-v3-tutorial-first-case.md
    - docs/decisions/0081-v3-missions-flow-and-modes.md
    - docs/decisions/0084-v3-ghost-3d-and-pick-check.md
    - docs/decisions/0086-v3-game-modes.md
    - docs/decisions/0087-v3-town-map.md
    - docs/decisions/0088-v3-cause-effect-day.md
    - HANDOFF.md
    - scripts/e2e/flows.mjs
    - .planning/phases/22-cleanup-single-mode/22-05-SUMMARY.md
    - .planning/phases/22-cleanup-single-mode/22-06-SUMMARY.md
    - .planning/phases/22-cleanup-single-mode/22-07-SUMMARY.md
    - .planning/phases/22-cleanup-single-mode/22-08-SUMMARY.md
    - .planning/phases/22-cleanup-single-mode/22-09-SUMMARY.md
decisions:
  - "결정 0090 으로 22-01~22-13 의 위임 선택을 한 곳에 모은다(옛 방 정규화는 옛 표시가 있을 때만, pickTurn 은 22-09 에서 켬, 찬반 판정식, verdictCount·day.voted 미공개, voteLog 최소, 유언 final·채팅 잠금·자동 저장, 처형 시간표 상수, 유령 훅 등)"
  - "0074 는 '폐기' 로 표시하되 밤 얼굴 목록 통일(0074-4)은 지금 판의 밤에 남아 있다고 적는다(코드가 그렇다)"
  - "screen-map 의 방장 줄 폰 6종 표는 22페이즈에서 단추가 최대 둘이 되어 실측하지 않고 식으로 계산한 값으로 바꿔 그렇게 밝혔다"
metrics:
  duration: "약 1시간 20분(문서 3종 재작성·결정·게이트)"
  completed: 2026-11-16
  tasks: 3
  files: 22
status: complete
estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low
actuals:
  tokens: 18930   # chars/4 over the realized diff (git diff cf42739a..HEAD 의 추가·삭제 줄, 이 SUMMARY 제외)
  tasks: 3
  commits: 5   # MEASURED: git rev-list --count cf42739a..ac3a0276 (SUMMARY 커밋 제외)
plan_head_before: cf42739a55593cc7dbb7b7173a0fcf753c5a2184
plan_head_after: ac3a027699ba83cdc41c2aec4b737d6b3941546e
commits: 5
---

# Phase 22 Plan 14: 문서·결정·페이즈 끝 게이트 Summary

기획서·구조 문서·화면 지도를 "판 하나, 토론 → 찬반 → 순차 지목 → 유언 → 처형" 흐름으로 다시 쓰고, 폐기·개정 결정 11개에 표시를 붙이고, 22페이즈의 위임 선택을 결정 0090 으로 모은 뒤 페이즈 끝 게이트(전체 시험·typecheck·스크립트 시험·위생)를 실제로 돌렸다.

## 작업별 결과

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 | `ed7a6896` | product.md 진행 흐름 표·소통·투표 공개·정치 장치·끝난 뒤·튜토리얼·소리·미결정 정리. architecture.md 낮 단계 흐름·순차 지목·판 하나(옛 방 정규화)·찬반 공개 원칙, 마을·튜토리얼 절과 심부름·시상·찬반 기록 서술 삭제. screen-map.md 방장 줄·유령·표식 행 정리, 심부름·튜토리얼·마을·확장판 절 삭제, 22 절 신설, 자동 검사 절의 19~21 흐름 삭제와 22 흐름 추가 |
| 2 | `26d4ed36` | 폐기 7·개정 4 표시, 결정 0090(17줄) |
| 3 | `3749302d` · `b5d77a18` · `ac3a0276` | 잔재 점검에서 찾은 E2E 필터 1건 정리, 22 계획 SUMMARY 5개의 위생 문구 정리, HANDOFF 갱신 |

## 검증 결과 (실제로 돌린 것)

| 명령 | 결과 |
|------|------|
| Task 1 verify(옛 낱말 합계 ≤ 2 · `will-flow` · 유언) | 통과 — 옛 낱말 합계 0 |
| Task 1 acceptance: `will-flow` 개수, 찬반·지목·유언·처형 한 줄, architecture 의 town/errand | screen-map 1 이상, product 2, architecture 0 |
| Task 2 verify(0090 파일 + 11개 파일 모두 0089 포함) · 0090 줄 수 | 통과 · 17줄(요구 12 이상) |
| `npm test`(vitest run 전체) | **238 files passed · 5 skipped, 7190 tests passed · 238 skipped, 실패 0**(약 70초) |
| `npm run typecheck`(tokens:check · wrangler types · tsc 앱·워커) | 오류 없음(exit 0) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | **622 tests, pass 622, fail 0** |
| HANDOFF 시험 + e2eContract(flows.mjs 수정 뒤 다시) | 2 파일 88 tests 통과, HANDOFF.md 5153 B(≤ 6144) |

`--project worker` 의 간헐 부하 실패는 이번 전체 실행에서 나지 않았다(재실행 필요 없었다).

### 잔재 점검(RESEARCH Pitfall 4)

`git grep -nE '"errand"|"tutorial"|"town"|"extended"|"basic"|GameMode|rulesetOf|modeOf|lockCause|openTown|award|ballots|voteLog' -- src shared worker scripts test` 는 301줄이고, `voteLog`(남기는 최소 기록) 178줄을 빼면 123줄이다. 123줄을 전부 읽어 분류했다.

- **옛 방 정규화 키·옛 방 시험 고정물**: `shared/game/room.ts`(옛 표시 표 `tutorial`·`errand`·`town`), `test/unit/legacyRoom.test.ts`, `test/unit/schemas.test.ts`(옛 메시지 거절 고정).
- **"0건" 단언·감시선**: E2E 의 `data-ballots`·`data-card="ballots"`·`data-award`·`day.ballots`·`phase:errand|tutorial`·`result.awards` 부재 판정(`lib.mjs`·`day.mjs`·`politics.mjs`·`result.mjs` 와 그 시험), 단위·worker 시험의 `award.*` 소리 0건·`awards` 키 0건·`ballots` 키 0건, `smoke.mjs` 의 `day.ballots` 등 부재 단언, 옛 `ballots` 채팅 레코드 폐기 시험(`chatLog.test.ts`).
- **지운 기능을 말하는 주석**: `smoke.mjs`·`leak.test.ts`·`showdown.test.ts` 등.
- **조치한 것**: `scripts/e2e/flows.mjs` 의 `SV7`·`MM5` 아침 카드 세기 필터 `c.kind !== "ballots"` 2곳(서버가 더는 만들지 않는 종류를 거르던 죽은 필터)을 지웠다(`3749302d`). 구문 검사·e2eContract 시험·스크립트 시험 통과.
- **남긴 것(해가 없는 잔재)**: `test/worker/whisper.test.ts` 의 허용 채팅 종류 집합에 든 `"ballots"` 한 낱말, `test/worker/morningCards.test.ts` 의 같은 종류를 거르는 필터 두 곳, `test/client/mapInsetsPanelless.test.tsx` 의 프로브 이름 `"errand"`(훅의 둘째 인자 이름 `panelless` 를 시험하는 라벨일 뿐). 모두 "있으면 틀리다"를 잡는 방어 쪽이라 지우지 않았다.

### 위생 검사

- **이 계획이 만든·바꾼 문서**(product·architecture·screen-map·결정 12·HANDOFF): 금지어 git grep 결과 **없음**.
- **저장소 전체**: 비어 있지 않다. 남은 줄은 모두 이 계획 이전부터 있던 것이다 — 보관된 이전 마일스톤·페이즈 계획·요약·검증 문서(`.planning/milestones/*`, `.planning/phases/08~20`)가 위생 검사 규칙을 서술하는 줄(규칙 문구 자체가 금지어를 담는다), `.planning/milestones/v1.0-phases/01-walking-skeleton/01-01-PLAN.md` 의 "공식 패키지" 일반 용례 한 줄, `docs/portfolio-request.md:21` 의 금지 규칙 문장. 특정 이름·계정·경로를 가리키는 줄은 없다. 보관 문서를 일괄 고치는 일은 이 계획 범위 밖이라 하지 않았다. 다만 22-05~22-09 SUMMARY 5곳은 이번 페이즈 문서이면서 검사 패턴 원문을 적어 두었기에 문구만 바꿨다(`b5d77a18`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 문서 사실 정정] 소리 개수 56/57 → 54, 효과음 49 → 47**
- **Found during:** Task 1 (architecture·product 소리 문단을 새 흐름에 맞추다 `docs/audio.md`·`soundProtocol` 계약과 어긋남을 확인)
- **Fix:** architecture.md·product.md 의 소리 개수를 현재 코드 값(배경음 7 + 효과음 47 = 54)으로 고쳤다.
- **Commit:** `ed7a6896`

**2. [Rule 1 - 문서 사실 정정] product.md 소통 문단**
- **Found during:** Task 1 — "빠른 메시지 템플릿·이모티콘 6~8개·자유 채팅은 MVP 에 없다" 는 현재 코드(자유 채팅 100자소, 결정 0044)와 정반대였다.
- **Fix:** 자유 채팅·몸동작·"누가 말하나"(유언 단계 잠금 포함) 로 다시 썼고, 미결정의 "자유 채팅을 넣을지" 를 지웠다.
- **Commit:** `ed7a6896`

**3. [Rule 2 - 연쇄 수정] screen-map 방장 줄 표 교체**
- 판 종류·튜토리얼 단추가 없어져 줄 단추가 최대 둘이다. 폰 6종 실측 표(확장판·기본 마피아 단추 3 열)는 의미가 없어져 지웠고, 식으로 계산한 값만 남기며 "실측 아님" 을 적었다.

**4. [Rule 2 - 범위 밖 파일] `scripts/e2e/flows.mjs`(죽은 필터 2곳)·22-05~09 SUMMARY(위생 문구)**
- 위 "잔재 점검"·"위생 검사" 참고. 계획 files_modified 밖이지만 계획 Task 3 의 "있으면 지우고 다시 1" 과 T-22-30 이 요구한다.

**5. 0074 폐기 표시에 예외 문장** — 계획은 "폐기" 한 줄이지만 0074-4(밤 얼굴 목록 통일)는 코드에 남아 있어(`night.ts` 의 `pickTarget`, 22-CONTEXT D-05) 그 사실을 한 문장 덧붙였다. 0086 에도 "방장 줄([맵]·[봇])은 남았다" 를 덧붙였다.

### 인증 게이트

없음.

## 돌리지 못한 검증

- 배포본(원격) E2E·smoke, 폰 6종 전체 회귀, 실기기 확인은 0089-25 에 따라 24 끝으로 미뤘다. 22 는 배포하지 않았다.
- screen-map 의 방장 줄 폰 6종 크기 계산은 식 값이다(E2E 로 다시 재지 않았다). 다음 로컬 `map-select` 실행에서 HR 판정이 보면 된다.
- 문서 안의 새 숫자(유언 시트 236/212·스테이지 표·처형 시간표 등)는 22-UI-SPEC·코드 상수에서 옮겼고 문서 내용 자체를 자동 검사하는 시험은 없다.

## Known Stubs

없음. 이 계획은 문서·결정·인계만 바꿨다(코드 변경은 죽은 E2E 필터 제거 한 건).

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면이 없다. T-22-30(공개 원격 위생)은 변경 문서의 금지어 git grep 결과 없음으로 확인했다.

## 이월

- 보관된 이전 마일스톤·페이즈 문서에 위생 검사 규칙을 서술하는 줄 약 40줄이 남아 있다(위 위생 검사). 일괄 정리가 필요하면 별도 작업으로 한다.
- 알려진 한계 셋(360×560 찬반 투표자 스테이지, 처형자 키보드 열림 시 자기 캐릭터, 유령 이름표 틈)은 HANDOFF·screen-map 22 절·결정 0090-17 에 적었다.
- 유언 10초에 몸동작을 살릴지는 사용자 결정 거리다(0090-8).

## Self-Check: PASSED

- 파일: `docs/decisions/0090-v3-single-flow-day-vote-will.md`·`docs/product.md`·`docs/architecture.md`·`docs/screen-map.md`·`HANDOFF.md`·`22-14-SUMMARY.md` 존재.
- 커밋: `ed7a6896`·`26d4ed36`·`3749302d`·`b5d77a18`·`ac3a0276` 모두 HEAD 의 조상(`git merge-base --is-ancestor`).
- `commits: 5` 는 원장(`gsd-plan-head-before-22-14`)에서 측정한 값이다.
