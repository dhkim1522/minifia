---
phase: 12-sound-polish
plan: "12"
subsystem: docs-verification
tags: [decision-record, audio-docs, team-test, regression, nightload, hygiene, tdd]
status: complete
requires:
  - phase: 12-sound-polish
    provides: "12-01~12-11 (정리·레시피·엔진·시험 페이지·단추·감독·밤·판결·결과 소리)"
provides:
  - "결정 기록 0070 (0070-1~8) + 0044-11 개정 표시"
  - "docs/audio.md 출처 기록·레시피 지도(56개)"
  - "test/unit/soundProtocol.test.ts (LS-9) · soundButtonSheet.test.ts"
  - "12-TEAM-TEST.md (모든 실기기·팀 칸 한 장, 표 A 자동 확인 기록, 위생 검사 결과, 사람용 TO-DO)"
  - "폰 6종 전 흐름 회귀 + 소리 흐름 + 소리 켠 nightload(양쪽 맵) 기록"
affects: []
key-files:
  created:
    - docs/decisions/0070-v2-sound-polish.md
    - docs/audio.md
    - test/unit/soundProtocol.test.ts
    - test/unit/soundButtonSheet.test.ts
    - .planning/phases/12-sound-polish/12-TEAM-TEST.md
    - .planning/phases/12-sound-polish/perf/ (nightload JSON·PNG 2쌍)
  modified:
    - docs/decisions/0044-v2-same-space.md
    - docs/product.md
    - docs/architecture.md
    - docs/screen-map.md
    - CLAUDE.md
    - HANDOFF.md
    - src/styles/v2.css
    - scripts/e2e/{flows,lib,sound,avatar}.mjs · scripts/e2e/lib.test.mjs
    - test/unit/soundNight.test.ts
    - .planning/phases/12-sound-polish/{12-UI-SPEC,12-CLEANUP-TABLE}.md
decisions:
  - "소리 단추는 시트(.mf-will-layer)가 열려 있는 동안 숨는다 (시트가 .mf-game 쌓임 맥락 안이라 z-modal 이어도 단추 위로 못 오름)"
  - "leaderShift 계열 유지 — 결정 0067 문구와의 충돌을 0070-6 에 기록, 제거는 사용자 판단"
  - "uat-day 외 uat 스크립트 삭제, uat-test-room 유지; 되살리려면 git 에서 꺼내 15초 단언 한 줄 수정"
metrics:
  duration: "약 2시간 40분 (E2E·성능 측정 대기 포함)"
  completed: 2026-11-06
actuals:
  tokens: 11000
  tasks: 3
  commits: 10
plan_head_before: aa4bb7ee51d788f98ec5c18b5ecd3646e6ac4570
plan_head_after: 70fa6f28a0a510bc13de366b4069953bb0c500bf
---

# Phase 12 Plan 12: 12페이즈·v2.0 개발 마무리 Summary

**결정 기록 0070·오디오 출처 문서·문서 지도·팀 테스트 한 장을 만들고, 폰 6종 전 흐름 회귀·소리 켠 nightload(양쪽 맵)·전체 시험·위생 검사를 돌려 회귀가 드러낸 결함 둘(소리 단추가 시트 [닫기]를 가림 등)을 고쳤다.**

`commits: 10` 은 `plan_head_before..plan_head_after` 로 잰 값이고, 이 SUMMARY 를 담는 마지막 문서 커밋은 더해지지 않았다.

## 한 일

- **Task 1**: 결정 0070(0070-1~7 + 실행 중 정한 값 0070-8, 이 결정이 정하지 않는 것), 0044-11 개정 표시, `docs/audio.md`(출처 기록·샘플 표·레시피 지도 56개·시험 페이지·iOS 메모), UI-SPEC 표시, 삭제 표 M-4~M-6 최종 집계, `soundProtocol.test.ts`(RED `1f104f7f` → GREEN `d0dcf450`).
- **Task 2**: product 소리 절, architecture(`src/audio/` 구조 표·감독 규칙·상태 공개 원칙 한 줄·iOS 절), screen-map(소리 단추·표식·E2E 흐름·시트 규칙), 프로젝트 `CLAUDE.md` 문서 지도, `12-TEAM-TEST.md`, HANDOFF 바꿔치기(4879 바이트, 머리 셋).
- **Task 3**: 타입·빌드·캐릭터·스크립트·전체 시험·웨이브 게이트·폰 6종 회귀·소리 켠 nightload·위생 검사, push.

## 검증 결과

| 검사 | 결과 |
|------|------|
| `npm run typecheck` | 오류 0 |
| `npm run build` | 성공, `grep -c data-sound-lab dist/client/assets/index-*.js` = 0 |
| `npm run check:character` | 68/68 |
| `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` | 370/370 |
| `npx vitest run`(전체) | **240 파일 · 7017 통과 · 1 건너뜀**(건너뜀은 이전 페이즈부터). 첫 실행은 5건 실패 — 낡은 기대값 3건(`soundNight` LS-7 신호표에 `result` 누락, 수정) + 알려진 간헐 2건(`bots` 「봇 chat: 밤에는…」, `continuity` 「옛 방장이 같은 토큰으로…」). 수정 뒤 재실행에서 전부 통과 |
| `check ui.safety-gate 12` · `check verify.schema-drift 12` | 둘 다 `"block": false` |
| 위생 검사(작업 트리 · 전체 이력) | 이 페이즈가 더한 것 0. 이력의 일치 29커밋은 모두 「쓰지 않는다」 선언·검사 패턴 인용·일반 용례·변수 이름 오탐이고 제품 코드 쪽 0, 커밋 메시지 0 (상세 `12-TEAM-TEST.md`) |

### E2E 묶음 (a)~(j) — 로컬 개발 서버, 폰 6종(extraSizes) + 고정 크기 흐름

| 묶음 | 흐름 | 결과 |
|------|------|------|
| (a) | lobby, world, chat-lobby, chat-ime(+360x560), chat-keyboard | OK (70초) |
| (b) | day, ghost, noexec | OK (172초) |
| (c) | night, night-sizes, chat-game | OK (202초) |
| (d) | politics-badge, politics-whisper, politics-pin, politics-verdict | OK (147초) |
| (e) | politics-runoff(+tie), politics-showdown(+tie) | OK (205초) |
| (f) | avatar-emote, avatar-dress, avatar-phases(+night) | OK (61초) |
| (g) | result, result-reveal, result-awards | OK (104초) |
| (h) | result, result-rematch, host-handoff | OK (39초) |
| (i) | map-select | OK (63초) |
| (j) | sound-render, sound-unlock(6종), sound-script, sound-night-parity, sound-result | OK (74초, 수정 뒤 연속 2회) |

흐름 × 크기 표(통과 수/전체 수)는 `12-TEAM-TEST.md` 표 A 에 있다. 요약: 6종 흐름(lobby 33~34, world 23, chat-lobby 23, chat-keyboard 22~23, day 181, ghost 35~42, night-sizes 47, politics-* 12~188, avatar-dress 32, avatar-emote 36, result-reveal 22, result-awards 20, map-select 26, sound-unlock 24) 모두 6개 크기에서 만점, 고정 크기 흐름(night 144, noexec 24, chat-game 13, chat-ime 10×2, result 25, host-handoff 8, result-rematch 19, avatar-phases 19/7, politics-*-tie 10/21, sound-render 8, sound-script 37, sound-night-parity 20, sound-result 18) 만점.

### 소리 켠 nightload (4배 스로틀, 390×844, 5분, 합격선 평균 55fps·끊김 5·draw call 120·점광원 3)

| 맵 | 평균 fps | 끊김(>50ms) | draw call(처음→끝) | 점광원 | `sound.state` · requests | 기준선(소리 끈, 11페이즈) |
|----|----------|-------------|--------------------|--------|--------------------------|----------------------------|
| 재즈 바 | 59.91 | 2 | 34→31 | 4 | running · 300 | 59.92 / 1 |
| 광장 | 59.93 | 1 | 34→31 | 4 | running · 300 | 59.93 / 1 |

기준선 대비 0.01fps 이내라 `--sound off` 대조는 돌리지 않았다. 점광원 4>3 은 10페이즈 이전부터 있는 `perfbudget` B2 알려진 항목(후속). 문턱은 낮추지 않았다.

## 결정 0070 요약

0070-1 방식(전부 Web Audio 합성 56개, 외부 자산·라이브러리 0, 3겹 시험) · 0070-2 구조·누설(감독 한 곳, 서버는 소리를 모름, 밤 소리 모두 같음, 암살음 피해자만, 도착 기준 예외) · 0070-3 켜기·끄기·잠금(단추 기하·z 51, 기본 켜짐, 동기 잠금 해제, `ambient`, 시트가 열리면 숨김) · 0070-4 믹스·성능(위 nightload) · 0070-5 계획이 추가로 정한 규칙(신호 일곱 종, 사건 기반 결과 소리, grace 250ms, 찬반 기록 시 `ui.card`, 시각 큐 갈림, 시험 페이지 게이트) · 0070-6 마무리 정리(삭제 10·유지 7·이미 없음 3·처리 3, uat 처분, leaderShift 유지와 0067 충돌 기록, 쓰기 경합 원인과 수정, `npm audit` 표 6건 운영 0건, 7페이즈 경고 3 수정·8페이즈 Info 7 수용) · 0070-7 분담 · 0070-8 실행 중 정한 값 (a)~(i).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 소리 단추가 시트 [닫기]를 가림 (night-sizes LT0, 360×560)**
- **Found during:** Task 3 폰 6종 회귀 (묶음 c)
- **Issue:** 시트(`.mf-will-layer`, z-modal)는 `.mf-game`(`isolation: isolate`) 안이라 방 루트의 소리 단추(z 51) 위로 올라가지 못해 폭 360×높이 560 에서 시트 [닫기]가 클릭 불가였다. 4번 재시도 모두 같은 실패(결정적).
- **Fix:** `.mf-room:has([data-sheet-layer]) > .mv-sound { visibility: hidden; pointer-events: none; }` — 시트가 열린 동안 단추는 비켜서고 닫히면 돌아온다. 정적 시험 `soundButtonSheet.test.ts`, 결정 0070-3·screen-map 에 기록.
- **Files:** `src/styles/v2.css`, `test/unit/soundButtonSheet.test.ts`, `docs/screen-map.md`, 결정 0070 · **Commit:** 77354ce8

**2. [Rule 1/3 - E2E 도우미] avatar-emote 360×640 걷기 목적지 (S4)**
- **Issue:** 소리 단추가 먼 칸을 덮어(단추를 숨기면 통과로 확인) 도우미가 순위를 먼저 매기고 덮인 칸을 나중에 걸러 목적지를 못 찾았다.
- **Fix:** `worldFlow` 와 같은 순서(덮인 칸을 먼저 빼고 순위)로 맞췄다. 3 단위/낮은 스테이지 1.5 단위 문턱은 그대로. · **Commit:** 77354ce8

**3. [Rule 1 - E2E 시점 경합] 소리 흐름 간헐 실패 정리 (sound-script SC4·SC6·V5, sound-night-parity NP1)**
- **Issue/원인:** (SC4·SC6) 상태 프레임이 도착한 순간과 감독이 처리한 순간 사이 어긋남을 곧바로 읽음. (V5) 첫 심장 박동과 같은 틱의 `pin.on` 이 로그 시각 1ms 차이로 판마다 앞머리에 들고 빠짐. (NP1) 밤 카메라가 마피아를 따라가 피해자 이름표가 화면 밖(x<0, 디버그로 확인)에 있으면 클릭 불가 — 소리 단추와 무관한 이 페이즈 이전부터의 밤 이름표 위치.
- **Fix:** 로그에 id 가 찍히길 기다린 뒤 판정(`readLogWith`), 판결 핀이 올라온 뒤 로그를 비움, V5 비교에 같은 틱 묶음(첫 박동 ±50ms 는 id 순, 직전 100ms 포함 — 한 판에만 있으면 여전히 실패, 단위 시험 추가), 화면 안에 있는 손님을 피해자로 바꿈. 판정 기대·문턱은 그대로. · **Commits:** 02d8ce8c, 2484dfca

**4. [Rule 1 - 낡은 시험 기대값] `soundNight` LS-7 대표 신호표에 `result` 누락**
- 12-11 이 닫힌 신호에 `result` 를 더했지만 표를 갱신하지 않아 전체 vitest 에서 3건 실패. 밤(ended 밖)에 `result` 신호가 무음임을 표에 더했다. · **Commit:** 02a77640

**5. [계획 해석] `sound-unlock` 폰 6종** — 계획대로 `extraSizes: LOBBY_EXTRA_SIZES` 로 합치고 `sound-unlock-360x560` 별도 항목을 지웠으며 `lib.test.mjs` 목록 단언에 `sound-unlock` 을 더했다. · **Commit:** 63d255f3

**6. [범위] REQUIREMENTS.md·ROADMAP.md 편집은 하지 않았다** — 오케스트레이터가 처리하라는 지시에 따라 계획의 Task 2 5)(SOUND-01~03 체크, 백로그 이관 줄)는 건드리지 않았다. STATE.md·milestone.lock·state.json·`Claude outputs/` 도 스테이징하지 않았다.

### 알려진 간헐 항목 (이 페이즈 변경과 무관, 재실행 통과)

- worker `continuity` 「옛 방장이 같은 토큰으로…」: 이 환경(Spotlight 색인으로 부하가 높음)에서 파일 단독 실행의 약 절반이 5초 시험 시간 초과로 실패하고 재실행에서 통과한다(통과할 때 2초 안팎). 이 계획에서 고치지 않았다 — 원인 후보는 시험 안의 DO 퇴출 뒤 대기. 12-03 이월 메모의 「재현 안 됨」과 달리 이번 환경에서는 자주 보였으므로 후속 점검이 필요하다.
- worker `bots` 「봇 chat: 밤에는…」: 12-03 이월 메모의 시간 기반 간헐(별도 원인). 재실행 통과.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면이 없다. `soundProtocol.test.ts` 가 T-12-47(서버가 소리를 모름)을 고정하고, 위생 검사(T-12-45)는 통과했다.

## 이월 (오케스트레이터)

- 배포 → 배포본 smoke full + 새 소리 흐름. 이 Mac 의 망이 느릴 때(상태 확인 1.3~1.9초) smoke 타이밍이 흔들렸으니 망이 좋을 때 한 번 더 돌린다.
- REQUIREMENTS.md(SOUND-01~03 체크·추적표)와 ROADMAP.md(백로그 999.1~999.6 「→ 12-TEAM-TEST.md 로 이관」 줄, 999.5 정리 후보 줄)는 오케스트레이터가 갱신한다.
- 위생 검사 이력 결과: 이 페이즈가 더한 것은 통과, 이력의 일치는 선언·오탐뿐이라 재생성이 필요하다는 증거는 없다. 최종 판단은 사용자.

## Self-Check: PASSED

- 파일 확인: `docs/decisions/0070-v2-sound-polish.md` · `docs/audio.md` · `test/unit/soundProtocol.test.ts` · `test/unit/soundButtonSheet.test.ts` · `.planning/phases/12-sound-polish/12-TEAM-TEST.md` · `perf/nightload-390x844-x4{,-plaza}.json` 존재.
- 커밋 10개(1f104f7f, d0dcf450, 63d255f3, f56bab4e, 77354ce8, 02d8ce8c, 2484dfca, 02a77640, db7f9331, 70fa6f28)가 HEAD 의 조상이다.
- `wc -c HANDOFF.md` = 4879 ≤ 6144.
