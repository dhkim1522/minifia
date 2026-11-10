---
phase: 18-quick-fixes
plan: "10"
subsystem: verification-docs-deploy
tags: [e2e, nightload, deploy, handoff, decision-0081]
requires:
  - phase: 18-quick-fixes
    provides: 18-01~18-09·18-11 구현(옷 해소·잠금, 낮 조명, 튜토리얼 스포트라이트·[다음]·고정 카메라, 증거·문구, E2E 판정)
provides:
  - 로컬 전체 검증(폰 6종 전 흐름 회귀 한 번·nightload)과 성능 JSON
  - minifia-v3 배포(version 2026-11-10T02:35:10Z+6ea0749c)와 배포본 tutorial-solo·avatar-dress 확인
  - docs/screen-map.md 튜토리얼·옷장 갱신, 결정 0081 "실행 중 달라진 곳 (18페이즈)", HANDOFF 갱신
affects: [19페이즈, v3.0 실테스트]
actuals:
  tokens: 70000
  tasks: 3
  commits: 4
plan_head_before: 2842e9b09344572793a7ddb2acd57f752bb7ed41
plan_head_after: PENDING
commits: 4
key-files:
  created:
    - .planning/phases/18-quick-fixes/perf/nightload-390x844-x4.json
    - .planning/phases/18-quick-fixes/perf/nightload-390x844-x4-run1.json
  modified:
    - docs/screen-map.md
    - docs/decisions/0081-v3-missions-flow-and-modes.md
    - HANDOFF.md
    - .planning/phases/18-quick-fixes/18-02-SUMMARY.md
    - .planning/phases/18-quick-fixes/18-03-SUMMARY.md
    - .planning/phases/18-quick-fixes/18-04-SUMMARY.md
    - .planning/phases/18-quick-fixes/18-09-SUMMARY.md
key-decisions:
  - "SUMMARY 에 적힌 위생 검사 패턴 원문은 공개 레포에 두지 않고 문구로 바꾼다(18-02·03·04·09 의 해당 줄 교체)"
  - "배포본 smoke full 이 망 지연 구간에서 통과하지 못해도 문턱·스크립트를 바꾸지 않고, 바뀐 흐름 배포본 E2E 로 확인한 뒤 HANDOFF 에 재확인을 남긴다"
requirements-completed: [SC-1, SC-2, SC-3, SC-4, SC-5]
status: complete
---

# Phase 18 Plan 10: 검증·배포·문서 Summary

18페이즈를 로컬 전체 검증(npm test 8012·폰 6종 전 흐름 회귀·nightload 평균 59.7fps)으로 확인하고 minifia-v3 에 배포했다(`2026-11-10T02:35:10Z+6ea0749c`). 배포본 tutorial-solo·avatar-dress 는 폰 6종 통과했지만 배포본 smoke full 은 망 지연 구간에서 6번 모두 통과하지 못해 HANDOFF 에 재확인을 남겼다. 화면 지도·결정 0081·HANDOFF 를 고치고 v3 를 push 했다.

## 진행` 에 한 줄씩 더한다.)

## 진행

(중단되면 이 절과 `git log --oneline --grep "(18-10)"` 로 끊긴 단계부터 다시 시작한다.)

- [x] 단계 1 로컬 검증: npm test 8012 통과(실패 0) · E2E 전 흐름 폰 6종 회귀 한 번(5797 중 5792 통과, 실패 5건 → 3건은 재실행 통과, perfbudget 3건은 13페이즈부터의 알려진 한계) · nightload 평균 59.7fps(두 번 측정, 끊김 5분당 5.0·7.1 — 아래 설명) · RULESET 불변 · 위생 통과(새 결과 0)
- [x] 단계 2 배포: minifia-v3 `2026-11-09T06:26:08Z+4858e54f` → `2026-11-10T02:35:10Z+6ea0749c` · 배포본 E2E tutorial-solo 폰 6종·avatar-dress 폰 6종 통과 · v1·v2 health 변화 없음 · 개인 계정 확인 · **배포본 smoke full 은 6번 모두 시간 편차·소켓·`.msg` 로 실패(망 지연 구간, 문턱 불변) — 재확인 필요**
- [x] 단계 3 문서·HANDOFF·push: 화면 지도(튜토리얼 18 표식·판정·옷장 `data-taken`·낮 조명) · 결정 0081 "실행 중 달라진 곳 (18페이즈)" · HANDOFF 6112바이트(≤6144)·머리 셋 · `git push origin v3`

## 단계 1: 로컬 전체 검증

### 빠른 검사

| 검사 | 결과 |
|---|---|
| `npm run typecheck` (tokens:check·placeart:check 포함) | 통과(종료 0) |
| `npm run build` | 통과 |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 571 통과 / 실패 0 |
| `npm test` | 8012 통과 · 261 skip(기존) · 실패 0(간헐 실패 한 건도 나오지 않음) |
| `git diff --quiet 4a5dabea -- shared/game/ruleset.ts` | 변경 없음(RULESET 불변) |
| 위생 검사 | 통과(새 결과 0) — 아래 "위생" 참고 |

누설 시험(`leak`·`tutorialLeak`)은 위 `npm test` 안에서 통과했다.

### 폰 6종 E2E 전 흐름 회귀(로컬 `npm run dev`, `--url http://localhost:5173`, 1391초)

크기: 360x640 · 390x664 · 430x932 · 360x560 · 390x844 · 402x874(고정 크기 흐름 포함). 흐름×크기 항목 5797개 중 5792 통과, 5 실패(아래 표).

| 흐름 | 결과 |
|---|---|
| avatar-dress | 폰 6종 모두 35/35 |
| tutorial-solo | 360x640 218/219(TB2 한 건 → 재실행 통과) · 390x664 217/217 · 430x932 217/217 · 360x560 219/219 · 390x844 218/218 · 402x874 217/217 |
| tutorial-together | 390x844 30/30 |
| errand | 360x640·390x664·430x932·360x560·402x874 22/22 · 390x844 26/27(HS3 한 건 → 재실행 통과) |
| witness | 폰 6종 모두 13/13(360x640·390x844 에서 첫 시도 시간 초과 → 자동 재시도 통과) |
| trace | 폰 6종 모두 53/53 |
| emcee-band | 폰 6종 모두 31/31 |
| night | 390x844 143/143 |
| night-sizes | 폰 6종 모두 48/48 |
| result · result-reveal · result-awards · result-rematch | 25/25 · 폰 6종 22/22 · 폰 6종 20~21/20~21 · 360x560 19/19(첫 시도 `page.goto` 8초 초과 → 자동 재시도 통과) |
| lobby · chat-lobby · chat-keyboard · chat-ime · world | 폰 6종 전부 통과(lobby 39~40 · chat-lobby 23 · chat-keyboard 22~23 · world 21~23) |
| day · ghost · map-select · basic-vote · politics-verdict · avatar-emote · sound-unlock | 폰 6종 전부 통과(day 111 · ghost 35~43 · map-select 51 · basic-vote 14~15 · politics-verdict 33 · avatar-emote 36 · sound-unlock 24) |
| 그 밖의 단일 크기 흐름(avatar-phases·avatar-phases-night·basic-off·chat-game·emcee-leak·emcee-sound·emcee-tools·host-handoff·noexec·reconnect·sound-night-parity·sound-render·sound-result·sound-script·pc·wakelock) | 전부 통과 |
| perfbudget | 390x844 10/13 — 알려진 한계 |

### 실패 5건의 분류

| 실패 | 분류 |
|---|---|
| tutorial-solo 360x640 scene2 TB2(`data-speaking` 거짓, 말하는 막대 0/5) | 여러 흐름이 함께 도는 전체 회귀의 시간 경쟁. 같은 크기 `--only tutorial-solo --sizes 360x640` 재실행 218→219/219 통과(34초). 17페이즈에서도 같은 판정이 한 번 흔들렸다 |
| errand 390x844 HS3(`ui.host -1번 ≠ 0`, 낮 시작 → 심부름 0번) | 읽는 시점 간격의 간헐(알려진 errand 간헐 계열). `--only errand --sizes 390x844` 재실행 통과(35초) |
| perfbudget talk·vote B2(동적 점광원 4 > 3)·reopen M1(geometries 35 > 25) | **알려진 한계**: 13페이즈부터 지속(15·16·17페이즈 SUMMARY·HANDOFF 기록). `--only perfbudget` 단독 재실행도 같은 3건. 판정 문턱은 그대로 |

판정 문턱을 낮추지 않았고 코드도 고치지 않았다(진행에 지장 없는 작은 화면 가장자리 문제 없음).

### 성능(nightload, 390x844 DPR 2, CPU 4× 감속, 5분, 로컬)

| 항목 | 첫 측정(`-run1`) | 재측정(최종) |
|---|---|---|
| 전체 평균 fps | 59.7 | 59.7 |
| 끊김(>50ms) | 7회/419초(5분당 5.0) | 10회/420초(5분당 7.1) |
| p50 / p95 | 16.7ms / 16.8ms | 16.7ms / 16.8ms |
| 최장 프레임 | 116.6ms | 116.7ms |
| 끊김이 몰린 장면 | `execution`(처형) 장면 mafia 4·citizen 3 | `execution` 장면 mafia 5·citizen 5(그 밖 장면 0) |

- 평균 fps 합격선(55)은 크게 넘는다. 끊김은 두 번 모두 합격선 5회/5분 근처이거나 그 위(5.0·7.1)다. 이 숫자를 합격으로 포장하지 않는다.
- 끊김은 두 번 모두 처형 장면 한 곳(12초)에 몰리고 그 밖 장면은 0이다. 17페이즈 측정에서도 같은 장면에 3~5회씩 있었다(17 첫 측정 9회/419초, 재측정 6회/419초, 최장 프레임 116.7ms 로 같다). 18페이즈는 조명 색 표(광장·바 맵)와 `FocusRing` 스포트라이트만 바꾸고 처형 장면 렌더 경로는 건드리지 않았다. 측정 중 이 Mac 의 부하 평균은 약 6(다른 세션 동시 실행)이었다.
- 따라서 "환경 편차 + 처형 장면의 기존 끊김"으로 판단한다(원인이 이 페이즈라는 증거 없음 → 고치지 않음). 합격선은 낮추지 않았고, 이 한 줄을 HANDOFF 확인 대기에 둔다(v3.0 실기기 확인에서 처형 장면 끊김을 본다).
- 결과 JSON: `.planning/phases/18-quick-fixes/perf/nightload-390x844-x4.json`(재측정, 최종)·`nightload-390x844-x4-run1.json`(첫 측정).

### 위생

- 바뀐 파일(`git diff --name-only 4a5dabea..HEAD` 의 남은 파일 101개)에 `~/personal/CLAUDE.md` 위생 검사를 돌렸더니, 18-02·18-03·18-04·18-09 SUMMARY 에 검사 명령 문장 자체(금지 표현을 나열한 패턴)가 적혀 있어 걸렸다. 공개 레포라 그 줄을 "개인 작업 공통 지침의 위생 검사 명령"으로 바꿨다(`fix(18-10)`). 이후 새 결과 0. 기존 시험 파일의 변수 이름이 부분 일치로 걸리는 것은 이 페이즈가 바꾼 파일이 아니라 그대로다.
- 이 SUMMARY 에는 패턴 문자열을 적지 않는다.

## 단계 2: minifia-v3 배포

- 개인 계정 확인(배포 가드 `scripts/check-account.mjs` 통과, 계정 식별자 적지 않음).
- 배포 전 version: minifia-v3 `2026-11-09T06:26:08Z+4858e54f` · v1 `2026-10-29T14:52:03Z+cb6979c` · v2 `2026-11-06T13:49:18Z+e51942c6`.
- 배포: `npm run deploy`(계정·배포 대상 가드 통과, 우회 없음) → 약 12초 뒤 minifia-v3 `2026-11-10T02:35:10Z+6ea0749c`. v1 `...+cb6979c`·v2 `...+e51942c6` 는 배포 전과 같다(변화 없음).
- **배포본 E2E `--only tutorial-solo,avatar-dress`: 통과(126초)** — avatar-dress 폰 6종 35/35, tutorial-solo 360x640 219/219 · 390x664 217/217 · 430x932 217/217 · 360x560 219/219 · 390x844 218/218 · 402x874 217/217.
- `node scripts/smoke.mjs --prod --stage create`: 통과(방 코드 발급, 새 version 확인).
- **배포본 smoke full(`--stage full --players 5 --previous-version 2026-11-09T06:26:08Z+4858e54f`): 6번 돌아 한 번도 통과하지 못했다.**

| 시도 | 실패 지점 |
|---|---|
| 1 | `Cannot read properties of undefined (reading 'msg')`(재접속 복원 로그 뒤, 스택 미수집) |
| 2 | 스모크1 소켓이 예상 밖으로 닫힘(code 1006), 판 끝 뒤 |
| 3 | `.msg` 읽기 오류(1과 같음, 재접속 복원 로그 뒤) |
| 4 | 로비 채팅 줄이 10초 안에 모두에게 오지 않음(`SMOKE_STACK=1`, 판 시작 전) |
| 5 | dayAnnounce 도착 편차 5378ms ≥ 500ms(판 끝 뒤) |
| 6 | dayAnnounce 도착 편차 610ms ≥ 500ms(판 끝 뒤) |

  - 기능 판정(심부름 5명 같은 마감·처형·밤 누설 0·재접속 복원·판 끝 winner)은 시도 2·5·6 에서 모두 통과했고, 실패한 것은 시간 편차·소켓·`.msg` 읽기다. `.msg` 읽기 실패는 15-10 에서 한 번 있었고 HANDOFF 에 "원인 미확정" 으로 기록된 그 간헐이다.
  - 시도 당시 이 Mac 에서 workers.dev 로의 연결이 평소보다 느렸다(`curl` 측정: TCP 0.15초·TLS 0.5초·첫 바이트 0.9초, 같은 시각 `www.cloudflare.com` 은 0.04초). 17-10 의 같은 smoke 는 첫 실행에 편차 7ms 로 통과했다. 다만 시도 1·3 의 `.msg` 원인은 스택을 못 얻어 망 때문이라고 단정하지 못한다.
  - 판정 문턱(500ms 등)은 낮추지 않았고 스크립트도 고치지 않았다. DO 하루 쓰기 한도(결정 0076)를 아끼려 6번에서 멈췄다. 망이 풀린 뒤 `node scripts/smoke.mjs --prod --stage full --players 5 --previous-version 2026-11-09T06:26:08Z+4858e54f` 를 한 번 더 돌려 확인하라고 HANDOFF 확인 대기에 적었다.
  - 배포 자체(health version 변경·v1/v2 불변)와 바뀐 흐름 배포본 E2E 는 확인되었다.

## 단계 3: 문서·HANDOFF·push

- `docs/screen-map.md`: 튜토리얼 절(장면 표 2~7·[다음] 알약 240×56·`data-tutorial-dim`/`data-tutorial-hole`·판정 TD·TN·TH·EV6~EV8·TC5·알려진 한계를 18-08 측정대로 정정), 옷장 줄(`data-taken`·시작 때 해소), 낮 조명 줄(흐린 보랏빛 회색 + 따뜻한 햇빛).
- `docs/decisions/0081-v3-missions-flow-and-modes.md`: `## 실행 중 달라진 곳 (18페이즈)` 절 — 조명 시작값 대비 조정, 도윤 자리 (1.3, −1.5), 스포트라이트 선택자·z, 잠금 거절 `BAD_MESSAGE`, 남은 조명 문제. 본문 결정은 그대로.
- `HANDOFF.md`: 지금 상태를 13~18페이즈 완료·배포로 줄이고, 확인 대기에 P18-1~11·남은 조명/도윤 자리/끊김 숫자·smoke 재확인을 더했으며, 다음 할 일을 19페이즈(`/gsd-discuss-phase 19`)로 바꿨다. `npx vitest run test/unit/handoff.test.ts` 통과.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 공개 레포 위생] 이전 계획 SUMMARY 에 위생 검사 패턴 원문이 적혀 있음**
- **Found during:** Task 1 위생 검사
- **Issue:** 18-02·18-03·18-04·18-09 SUMMARY 가 위생 검사 명령 문장(금지 표현 나열) 자체를 적어 검사에 걸렸다. 위협 T-18-24 의 완화는 패턴을 저장소에 적지 않는 것이다.
- **Fix:** 그 줄을 "개인 작업 공통 지침의 위생 검사 명령"으로 교체
- **Files modified:** 18-02·18-03·18-04·18-09-SUMMARY.md
- **Commit:** 4b4e9a3d

**2. 계획 기대와 다른 결과(문턱·코드는 그대로)**
- nightload 끊김이 5분당 5.0·7.1 로 합격선(5회) 근처·초과다 — 두 번 모두 처형 장면에 몰리고 17페이즈 측정에도 같은 장면에 있어 환경 편차로 보되 합격으로 적지 않았다.
- 배포본 smoke full 이 6번 모두 통과하지 못했다 — 단계 2 에 시도별 실패와 근거를 적었고 HANDOFF 에 재확인을 남겼다.

**Total deviations:** 1 auto-fixed, 2 기대 미충족 기록. **Impact:** 제품 코드 변경 없음.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크·인증·파일 접근 표면 없음(검증·문서·배포만). T-18-23(배포 계정 가드 통과·우회 없음), T-18-24(패턴 원문 교체, 새 결과 0), T-18-25(큰 회귀는 로컬, 배포본은 smoke·바뀐 흐름만 — 다만 smoke 재시도 6번이 DO 쓰기를 썼다)를 지켰다.
