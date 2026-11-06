---
phase: 13-basic-day-flow
plan: "06"
subsystem: docs-regression-deploy
tags: [docs, decision-0072, regression, e2e, nightload, deploy, minifia-v3, flow-01, flow-02, flow-03, flow-04, flow-05]

requires:
  - phase: 13-01
    provides: RULESET(다섯 값 모두 꺼짐), 15초 동시 투표 nomination
  - phase: 13-02
    provides: 봇 동시 투표, 테스트 방 넘기기가 봇 표를 채움
  - phase: 13-03
    provides: 동시 투표 화면
  - phase: 13-04
    provides: 꺼진 장치 view·화면 게이트
  - phase: 13-05
    provides: basic-off·basic-vote E2E, 장치 흐름 skipByDefault
provides:
  - 결정 기록 0072(기본판 설정·동시 투표 값·꺼진 장치 처리·화면·검사·달라진 곳·알려진 한계)와 0063-1·0066-1·2·4·5·6 개정 표시
  - architecture·product·screen-map 의 낮 흐름·E2E 절 갱신
  - 로컬 전체 회귀 결과(폰 6종), nightload 5분 측정
  - minifia-v3 첫 배포(Worker 생성)와 배포본 smoke·E2E 확인
  - HANDOFF 갱신(13페이즈 완료, 다음 14페이즈)
affects: [14-host-flow]

requirements-completed: [FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05]

actuals:
  tokens: 19300
  tasks: 3
  commits: 5

plan_head_before: 87c0fbc7b04c2df7ae0f531a644c04941304f62b
plan_head_after: 5015f51c289b318cca98b0034345ad81e4e32434

tech-stack:
  added: []
  patterns:
    - "기본판 검사 함수는 옵션(whisper·floatsOn, 기본 false)으로 기본판 기대를 쓰고 정통 판 기대는 옵션 켜짐 시험으로 고정"

key-files:
  created:
    - docs/decisions/0072-v3-basic-day-flow.md
    - .planning/phases/13-basic-day-flow/perf/nightload-390x844-x4.json
    - .planning/phases/13-basic-day-flow/perf/nightload-390x844-x4.png
  modified:
    - docs/decisions/0063-v2-play-feedback-b.md
    - docs/decisions/0066-v2-politics-tension-devices.md
    - docs/architecture.md
    - docs/product.md
    - docs/screen-map.md
    - .planning/REQUIREMENTS.md
    - HANDOFF.md
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/result.mjs
    - scripts/e2e/result.test.mjs
    - scripts/e2e/avatar.mjs

key-decisions:
  - "결정 0072 한 장에 0072-1~6 과 실행 중 달라진 곳·알려진 한계를 남긴다"
  - "회귀에서 드러난 result-reveal·avatar-phases 의 옛 기대(탭 다섯·떠 있는 버튼 존재)는 문턱을 낮추지 않고 기본판 계약(탭 넷·버튼 0개 확인)으로 고쳤다"

status: complete
---

# Phase 13 Plan 06: 문서·전체 회귀·배포·인계 Summary

13페이즈를 닫았다: 결정 0072 와 지도 문서, 로컬 폰 6종 전체 회귀(회귀가 드러낸 옛 기대 두 흐름 보정), nightload 5분(평균 59.8fps·끊김 4), minifia-v3 첫 배포와 배포본 확인, HANDOFF 갱신, `v3` push.

## 수행한 일

**Task 1 — 결정 0072·개정 표시·지도 문서 (커밋 `2eaad95a`)**
- `docs/decisions/0072-v3-basic-day-flow.md`: 0072-1~6, 계획이 실행 중 달라진 곳(13-01~13-05 편차), 알려진 한계, 정하지 않는 것.
- 0063-1 에 `(개정: 0072-2 …)`, 0066 의 1·2·4·5 에 `(개정: 0072-1 …)`, 6 에 `(개정: 0072-5 …)`. 다른 문장은 그대로.
- architecture(기본판 안내 한 줄, 처형 단계 줄 동시 투표, 순차 지목 `RULESET.pickTurn` 한정, 공개 키 줄), product(기본판 낮 흐름 문단), screen-map(투표 표기, 꺼진 장치 행 표시, TopToast, `data-lead`·`data-sure`, E2E 절 basic-off·basic-vote), REQUIREMENTS FLOW-04 완료 표시.
- 인수 기준: `^0072-[0-9]` 6, 0066 의 `0072` 5, 0063 의 `0072` 1, architecture `ruleset` 1 이상, `[x] **FLOW-0` 5.

**Task 2 — 로컬 전체 검증**

| 항목 | 결과 |
|---|---|
| `npm run typecheck` | 통과 (rc 0) |
| `npm run build` | 통과 (rc 0) |
| `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` | 381 통과·0 실패 (`scripts/e2e/result.test.mjs` 포함 따로 394 통과) |
| `npm test` | 6855 통과·1 실패·261 skip. 실패는 `continuity` "옛 방장이 돌아오면…" 5초 시간 초과(기존 간헐) — 단독 재실행 두 번 중 한 번 통과·한 번 같은 시험이 5초 초과로 실패해 이 페이즈와 무관한 기존 간헐임을 확인 |
| E2E 묶음 | 폰 6종 전 흐름, 아래 표 |
| nightload 5분 | 아래 표 |
| 위생 검사 | 작업 트리의 이 계획 변경분에 금지 표현 없음(`git grep` 결과 중 기존 `.planning/milestones/*` 문서의 위생 규칙 설명 문구와 `gameRoom.test.ts` 의 `seatOrdered` 부분 일치·`docs/portfolio-request.md` 지침 문구는 13페이즈 이전부터 있음). 13페이즈 커밋 메시지 32개에 결과 없음 |

E2E 묶음 결과(개발 서버 `http://localhost:5173`, `--only` 가 앞부분 일치라 `result`·`avatar-phases` 가 하위 흐름을 함께 돌렸다):

| 묶음 | 흐름 | 결과 |
|---|---|---|
| (a) | lobby, world, chat-lobby, chat-ime(+360x560), chat-keyboard | OK (72초) |
| (b) | day, ghost, noexec | OK (131초) |
| (c) | night, night-sizes, result(+result-reveal·awards·rematch), chat-game | 실패 42건 전부 `result-reveal` → 아래 편차 1 로 고침 |
| (d) | politics-verdict, basic-vote, basic-off | OK (110초) |
| (e) | avatar-emote, avatar-dress, avatar-phases(+night) | 실패 6건 `avatar-phases` AP1-FT1~3 → 아래 편차 2 로 고침 |
| (f) | result-reveal, result-awards, result-rematch, host-handoff | 실패 42건 전부 `result-reveal`(위와 같음), 나머지 OK |
| (g) | map-select, reconnect, perfbudget, pc, wakelock | 실패 3건 `perfbudget` B2·M1 — 아래 알려진 간헐 |
| (h) | sound-render, sound-unlock, sound-script, sound-night-parity, sound-result | OK (92초) |
| 재실행 | result-reveal, avatar-phases | OK (수정 뒤, 실패한 흐름만 `--only`) |

nightload(390×844, CPU 4배, 5분): 평균 **59.8fps**, 끊김(>50ms) **4회**, p95 16.8ms, 최장 66.7ms, draw call 34(전)→31(후), 점광원 4. 합격선(평균 55fps·끊김 5회)은 낮추지 않았고 통과. 투표(nomination) 구간 평균 59.7~59.8fps 끊김 0, 처형 구간만 끊김 2씩. 점광원 4 는 `perfbudget` B2(≤3)와 같은 기존 수치다.

**Task 3 — 배포·HANDOFF·push**

| 항목 | 결과 |
|---|---|
| 배포 전 minifia-v3 health | Worker 없음(`error code: 1042`) — 이번이 첫 배포 |
| `npm run deploy` | 계정 가드 통과(개인 계정 확인), 대상 `minifia-v3` 생성(Durable Object `Room` 생성), 179 파일 업로드, rc 0 |
| 배포 후 version | `2026-11-06T19:07:24Z+5d855a5f` (workers.dev 응답은 배포 직후 약 10초 뒤부터) |
| 배포본 smoke | `node scripts/smoke.mjs --prod --stage full --players 5` → `SMOKE OK full code=2406 players=5 spread=15ms discSpread=9ms` (첫 배포라 `--previous-version` 없음) |
| 배포본 E2E `day,basic-off,basic-vote,noexec` | 첫 실행 실패 1건(`basic-off` OFF5 `[data-end-discussion] 0개`, 로컬은 통과), `basic-off` 재실행 OK → 편차 3 으로 시험의 경합 수정 뒤 `basic-off` 한 번 더 OK, 나머지 흐름은 첫 실행 통과 |
| v1·v2 health | 배포 전후 동일: v2 `2026-11-06T13:49:18Z+e51942c6`, v1 `2026-10-29T14:52:03Z+cb6979c` |
| HANDOFF | 4041 바이트(6144 이하), `## ` 머리 셋, `0072` 2회. `handoff.test.ts` 2 통과 |
| push | `git push origin v3` → `640b58db..5015f51c`, `git rev-list --count origin/v3..HEAD` = 0 |

## 편차

### 자동 보정한 문제

**1. [Rule 1 - 버그] result-reveal 이 귓속말·탭 다섯 개를 전제**
- **발견:** Task 2 묶음 (c)·(f) — 13-05 가 "그 밖의 흐름은 이번에 돌리지 않았다"고 넘긴 흐름.
- **문제:** `RT1·2·8·11·12·13` 이 탭 다섯·귓속말 점 셋을 기대하고, 귓속말 탭 클릭이 4초 시간 초과로 흐름이 중단됐다. 제품은 기본판 계약대로 탭이 넷이다(`RESULT_TABS_SHOWN`).
- **수정:** `resultTabChecks(m, { whisper })` 옵션과 `RESULT_TAB_IDS_BASIC` 을 더하고(기본 false) 흐름이 귓속말을 보내지 않으며, `RT16` 이 귓속말 탭·머리줄 0개를 확인한다. 정통 판 기대는 `{ whisper: true }` 시험으로 그대로 고정했고 기본판 시험 두 개를 더했다. 문턱은 낮추지 않았다.
- **커밋:** `854d9182`

**2. [Rule 1 - 버그] avatar-phases FT1~FT3 가 떠 있는 버튼 존재를 전제**
- **발견:** 묶음 (e).
- **문제:** 기본판에는 `.mf-float` 가 없어 "하나도 없음(공허한 통과 금지)"로 세 줄이 실패했다.
- **수정:** `floatTrayChecks(obs, { floatsOn })`(기본 false)로 기본판은 세 시점 모두 0개일 때만 통과(하나라도 있으면 실패, 측정값 없으면 실패), 켜짐 기대·공허 통과 금지 시험은 `floatsOn: true` 로 유지. 기본판 시험 추가.
- **커밋:** `854d9182` (같은 커밋)

**3. [Rule 1 - 버그] basic-off OFF5 가 배포본에서 그리기 지연으로 0개를 셈**
- **발견:** Task 3 배포본 E2E 첫 실행.
- **수정:** 센 뒤 판정하는 대신 `[data-end-discussion]` 이 붙을 때까지 최대 3초 기다린 뒤 센다. 기대(정확히 1개)는 그대로. 수정 뒤 배포본 `basic-off` 통과.
- **커밋:** `92c5a34a`

### 기존 간헐 실패(이 페이즈 밖, 고치지 않음)

- `perfbudget` B2 점광원 4>3, **M1 재열기 geometries 35>25**: 13페이즈 이전 코드(`aee9f9c2^`)를 임시 작업 트리에서 같은 조건으로 돌려도 둘 다 똑같이 실패해 기존임을 확인했다(작업 트리는 지움). M1 은 HANDOFF 알려진 한계에 더했다.
- `continuity` "옛 방장이 돌아오면…" 5초(단독 재실행에도 절반쯤 실패).
- 명시한 한계: 8자 이름 봇 8명판의 투표 이름표 버튼 겹침(PK3, 결정 0072 알려진 한계). 작은 화면 가장자리 문제라 고치지 않는다.

## 인증 게이트

없음. 배포 계정 가드(`check-account`)가 개인 계정(`dhkim1522@naver.com`)을 확인하고 통과했다.

## Known Stubs

없음.

## Threat Flags

없음. 계획의 T-13-17(위생: 작업 트리·13페이즈 커밋 메시지 결과 없음), T-13-18(배포 가드 우회 없음, 배포 후 health 와 v1·v2 불변 확인), T-13-19(문턱 낮추지 않음, 간헐은 재실행 사실 그대로 기록), T-13-SC(패키지 설치 없음) 모두 계획대로 처리했다.

## Self-Check: PASSED

- 신규 파일 `docs/decisions/0072-v3-basic-day-flow.md`, `.planning/phases/13-basic-day-flow/perf/nightload-390x844-x4.json` 존재, 커밋 `2eaad95a`·`854d9182`·`5d855a5f`·`92c5a34a`·`5015f51c` 가 HEAD 의 조상임. `origin/v3` 가 HEAD 와 같다(push 됨).
