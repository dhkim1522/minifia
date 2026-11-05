---
phase: 10-character-motion-costume
plan: "09"
subsystem: docs-verification
tags: [decision-record, e2e-regression, perf, device-checks, handoff]
requires:
  - phase: 10-character-motion-costume
    provides: "10-01~10-08 구현(emote·dress 와이어, 장면 look, 동작 판, 꾸미기 시트, 단계 가드)"
provides:
  - "결정 기록 0068(10페이즈 계획 값 0068-1~12)과 0047 개정 표시"
  - "10-DEVICE-CHECKS.md(표 A 자동 기록 + 표 B 실기기 12항목)"
  - "폰 6종 전체 회귀·nightload·8명 의상 x 동시 동작 측정 기록"
affects: [11-result-rematch, 12-sound-polish]
tech-stack:
  added: []
  patterns: ["E2E 후보 칸은 가려진 칸을 먼저 빼고 순위를 매긴다", "동작 길이 >= 서버 최소 간격을 시험으로 고정"]
key-files:
  created:
    - docs/decisions/0068-v2-character-motion-costume.md
    - .planning/phases/10-character-motion-costume/10-DEVICE-CHECKS.md
    - .planning/phases/10-character-motion-costume/perf/nightload-390x844-x4.json
    - .planning/phases/10-character-motion-costume/perf/desktop-talk-dpr2-x4-mix-burst4.json
  modified:
    - docs/decisions/0047-v2-3d-characters-and-gather-devices.md
    - docs/architecture.md
    - docs/screen-map.md
    - docs/product.md
    - HANDOFF.md
    - .planning/phases/10-character-motion-costume/10-UI-SPEC.md
    - scripts/e2e/flows.mjs
    - scripts/e2e/browser.mjs
    - test/unit/characterBudget.test.ts
    - test/unit/emote.test.ts
key-decisions:
  - "높이 밴드 상한 1.9 -> 1.92 (기자 모자 x 여자 머리 1.918), 하한과 다른 문턱 그대로 (0068-9)"
  - "동작 판 칸 폭 360 에서 55.6px 유지, 실기기 확인 뒤 재검토 (0068-10)"
  - "서버 최소 간격 1000ms 는 모든 EMOTE_MS(>=1060ms)가 덮어 화면 비활성 시간 변경 불필요, 시험으로 고정 (0068-11)"
  - "O-12 밤 시민 편 버튼 부재·얼굴 목록 의상 얼굴·암살 쓰러지는 동작은 열린 것으로 둠 (0068-12, 정하지 않는 것)"
requirements-completed: [AVTR-01, AVTR-02, AVTR-03, AVTR-04, AVTR-05]
duration: ~2h (측정 대기 포함)
completed: 2026-11-05
status: complete
commits: 6
plan_head_before: cdaf28d3f12bc0fd89f09f0c04435bb3f07183d2
plan_head_after: 414ea148b17d4ecf422a72fdd3f208f67030cfb0
actuals:
  tokens: 6500
  tasks: 3
  commits: 6
---

# Phase 10 Plan 09: 결정 0068·지도 문서·인계·전체 검증 Summary

10페이즈의 계획 값을 결정 기록 0068 한 장(0068-1~12)에 모으고, 폰 6종 전체 E2E 회귀·nightload 5분·8명 의상 x 동시 동작 측정을 한 번 돌려 기록했으며 origin/v2 에 push 했다(배포 없음).

`commits: 6` 은 측정값이다(`rev-list --count`). 이 중 2개(11·12페이즈 계획 문서)는 병렬 에이전트의 커밋이고 이 계획의 커밋은 4개다.

## 수행한 일

| Task | 내용 | 커밋 |
|------|------|------|
| 1 | 결정 0068, 0047 개정 표시, UI-SPEC 표시, 10-DEVICE-CHECKS 뼈대 | e5309d4c, 414ea148 |
| 2 | architecture·screen-map·product 바뀐 곳만, HANDOFF 바꿔치기(5503 바이트) | e5309d4c |
| 3 | 타입·빌드·check:character·node --test·npm test·E2E 회귀·성능·게이트·위생·push | a4b9fc6b, ebe31a0a, 414ea148 |

## 검증 결과

| 명령 | 결과 |
|------|------|
| `npm run typecheck` / `npm run build` | 통과 |
| `npm run check:character` | 68 통과 (높이 상한 1.92) |
| `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` | 305/305 |
| `npm test` | 192 파일 5587/5590 통과(건너뜀 1). 실패 2건은 알려진 간헐(`test/worker/bots.test.ts` 찬반, `test/worker/testTools.test.ts` ended), 두 파일만 다시 돌려 64/64 통과 |
| `ls public/outfits \| wc -l` | 9 (10-06 manifest 패턴과 일치) |
| 웨이브 게이트 | `ui.safety-gate 10`·`verify.schema-drift 10` 모두 `"block": false` |

### E2E 폰 6종 회귀 (로컬 `npm run dev`, 항목 통과/실패)

| 묶음 | 흐름 | 결과 |
|------|------|------|
| a | lobby 33~34 · world 23 · chat-lobby 23 · chat-keyboard 22~23 · chat-ime 10(+ `chat-ime-360x560` 10) | 실패 0 (처음 실행 때 실패 13, 아래 편차 1·2 로 고친 뒤 재실행 통과) |
| b | day 181 · ghost 41~42 · noexec 24 | 통과 |
| c | night-sizes 47 · night 144 · result 22 · chat-game 13 | 통과 |
| d | politics-badge 92 · whisper 64~75 · pin 12~13 · verdict 33 | 통과 |
| e | politics-runoff 55 · runoff-tie 10 · showdown 188 · showdown-tie 20 | 통과 |
| f | avatar-emote 36 · avatar-dress 32 (각 6종) · avatar-phases 19 · avatar-phases-night 14 | 통과 |
| 보충 | reconnect 35 · pc 7 · wakelock 2 · perfbudget 11 통과/2 실패(편차 3) | 통과 / 실패는 사전 존재 |

크기별 표(lobby·world·chat-*·day·ghost·night-sizes·politics-*·avatar-*)는 `10-DEVICE-CHECKS.md` 표 A 에 있다. 모든 크기에서 실패 0.

### 성능 (로컬 헤드리스 Chrome, CPU 4배, 390x844, 폰 합격 근거 아님)

| 측정 | 평균 fps | 끊김(>50ms) | p95 | draw call | 점광원 | 비고 |
|------|---------|-------------|-----|-----------|--------|------|
| nightload 5분 (최종) | 59.9 | 4 (마피아 판 3·시민 판 1, 처형 구간) | 16.7ms | 31~33 | 4 | 최장 66.7ms, 299초 17938프레임 |
| nightload 5분 (앞선 두 번) | 59.8 | 7 · 10 | 16.7ms | — | 4 | 다른 세션이 CPU 를 쓰던 때(load average 3~5) |
| nightload 5분, 10페이즈 이전 커밋 `4b58fbe9` | 59.9 | 2 | 16.7ms | — | 4 | 같은 조건 비교 |
| 8명 서로 다른 의상 x 동시 동작 4개 (2분) | 60.0 | 0 | 16.7ms | 61 (최대 67) | 4 | 삼각형 95,246, 첫 동작 직후 간격 16.7ms (합격선 50ms) |

합격선(평균 55fps, 끊김 5회, draw call 120, 점광원 3, 첫 동작 직후 간격 50ms)은 낮추지 않았다. 점광원 4 는 10페이즈 이전부터다(편차 3). nightload 최종 4회는 선 안이지만 앞의 두 번(7, 10)은 선 밖이었다. 원인 가설(표정 병합 선행 prewarm)을 켬/끔으로 가려 봤으나(3분 2회 대 1회, node 에서 병합 1회 < 1ms) 구분되지 않았고 이전 커밋도 같은 조건에서 1~2회 나와, 공유 머신의 CPU 경쟁으로 판단한다. iPhone 5분 측정(B1)이 판단 근거다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] chat-keyboard KB2 가 동작 버튼을 행동 줄 버튼으로 셌다**
- **Found during:** Task 3 E2E 묶음 a (chat-keyboard 6종 x 2항목 = 12 실패)
- **Issue:** `scripts/e2e/browser.mjs` 의 `actionButtons` 가 채팅 패널의 보내기·새 줄 점 외 모든 버튼을 센다. 10-05 가 입력줄에 동작 버튼을 더한 뒤 키보드 열림에서 "행동 줄 없음"이 깨졌다(제품은 정상, 검사가 낡음).
- **Fix:** 선택자에서 `[data-emote-button]`·`[data-emote]` 를 뺐다. 문턱은 그대로.
- **Files modified:** `scripts/e2e/browser.mjs`
- **Commit:** ebe31a0a

**2. [Rule 1 - Bug] world 360x640 S4: 꾸미기 버튼이 가린 칸이 목적지로 뽑혔다**
- **Found during:** Task 3 E2E 묶음 a
- **Issue:** 3 단위 이상 먼 후보 3개가 모두 로비 꾸미기 버튼(오른쪽 아래) 또는 이름표 밑이라 `hitsInputSurface` 가 거짓이었다. 후보 상위 40개만 검사한 뒤 "목적지 없음"으로 중단.
- **Fix:** 보이는 칸 전부에 먼저 가림 검사를 해서 덮인 칸을 후보에서 뺀 뒤 `worldTapRanking` 에 넘긴다. 먼 칸이 없어지면 기존 낮은 스테이지 규칙(1.5 단위·0.8초)이 적용된다(W5 에 "낮은 스테이지 기준"으로 표시됨). 문턱 값은 그대로.
- **Files modified:** `scripts/e2e/flows.mjs`
- **Commit:** ebe31a0a

**3. [사전 존재 - 범위 밖] perfbudget B2 점광원 4 > 3**
- **Found during:** Task 3 보충 실행
- **Issue:** 로비 8명·vote 스파이크에서 동적 점광원 4개(`bar.ts` 의 stage·pendantA·pendantB·self). 10페이즈 이전 커밋 `4b58fbe9` 의 임시 워크트리에서도 같은 2개가 실패했다. 10페이즈는 광원을 더하지 않았다(`new PointLight` 는 `bar.ts` 한 곳).
- **조치:** 고치지 않음. 후속 과제로 기록한다(9페이즈 이후 `self` 광원 또는 예산 값 재검토).

### 계획이 요청한 결정 반영

- **오케스트레이터 결정 (a)**: 높이 밴드 상한 1.92. `characterBudget.test.ts` 의 `KNOWN_TALL` 예외 표를 지우고 `HEIGHT_MAX = 1.92` 로 바꿨다(문턱 그대로, 하한 1.5). UI-SPEC 의 검사 줄에 "1.92(결정 0068)" 표시. (커밋 a4b9fc6b, e5309d4c)
- **(b)** 칸 폭 55.6px 유지, 0068-10 에 기록.
- **(c)** 서버 간격은 마지막 수락부터 세고 모든 `EMOTE_MS` >= 1060 > 1000 이라 UI 비활성 시간을 바꿀 필요가 없다. `test/unit/emote.test.ts` 에 "모든 EMOTE_MS >= EMOTE_MIN_GAP_MS" 시험을 더해 고정, 0068-11 에 기록.
- **(d)** 얼굴 목록 의상 얼굴(`faceSrc` 임시 그림)·암살 쓰러지는 동작·O-12·채널별 `n` 이유를 0068 "정하지 않는 것"과 0068-2 에 기록.
- **(e)** 위 6종 회귀 목록 그대로. `avatar-phases` 는 접두라 `avatar-phases-night` 도 같이 돌았다.

## Authentication gates

없음.

## Known Stubs

없음. (경찰·의사 얼굴 목록의 `faceSrc` 임시 그림은 10페이즈 이전부터 있던 것이며 0068 "정하지 않는 것"에 열린 항목으로 기록했다.)

## Threat Flags

없음. 이 계획은 문서·E2E·시험만 바꿨고 새 네트워크·인증·파일 접근 표면이 없다. 공개 저장소 위생 검사(`git grep -nIiE "torder|티오더|조직|회사|~/project"`)로 이 계획이 더한 줄에 걸리는 것이 없음을 확인했다.

## 이월 메모 (11·12페이즈, 오케스트레이터)

- 배포는 하지 않았다. 오케스트레이터가 배포한 뒤 `/api/health` 확인, 배포본 smoke, 새 흐름 `avatar-emote`·`avatar-dress`·`avatar-phases` 를 돌려 `10-DEVICE-CHECKS.md` 표 A "배포본" 칸을 채운다.
- 실기기 12항목은 `10-DEVICE-CHECKS.md` 표 B (전부 미확인, 999.6 묶음에 추가됨).
- 후속: 동적 점광원 4 > 3 (사전 존재, `perfbudget` B2). 처형 구간 끊김은 공유 머신에서 변동이 크므로 iPhone 5분 측정(B1)으로 판단.
- 11페이즈: 결과 화면 직업 의상·동작 통계·다시 하기 look 유지·방장 맵 탭(DressSheet 에 탭).
- 10-06 이월 중 "전체 실행 시 실패 2건(tokensV2 모션 줄이기 배지, backdrop 경로 정규식)"은 이번 `npm test` 에서 나타나지 않았다.

## Self-Check: PASSED

- 생성 파일 4개(0068, 10-DEVICE-CHECKS, perf JSON 2개) 존재 확인.
- 커밋 a4b9fc6b·ebe31a0a·e5309d4c·414ea148 이 HEAD 의 조상임을 확인.
