---
phase: 21-cause-effect-missions
plan: "16"
subsystem: verification-deploy-docs
tags: [e2e-regression, deploy, cause-effect, decision-0088, perf, docs]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: 21-01~21-15 원인 흐름(저녁 등불·밤 집 찾기·아침 현장·의심 보드·건너뛰기·튜토리얼·시험 이전·E2E)
provides:
  - 로컬 전체 검증·폰 6종 E2E 전 흐름 회귀 결과(옛 낮 순서 흐름의 기본 마피아 판 이전 포함)
  - minifia-v3 배포 `2026-11-15T13:03:01Z+e3cb26fa`(smoke full 통과)
  - 결정 0088 마감(구현·배포됨·달라진 곳·알려진 한계), 화면 지도 21페이즈 절, HANDOFF·ROADMAP 갱신
affects: [v3.0 실테스트]

requirements-completed: [DEPLOY-06]

estimate:
  tokens: 75000
  raw_tokens: 75000
  tasks: 3
  confidence: low

actuals:
  tokens: 30000
  tasks: 3
  commits: 5

plan_head_before: 807881f50011b2ee9972aa2fcff75fe33c96b9e3
plan_head_after: 1df4591013a909d04829c161539d909eca74ae8f
commits: 5

key-files:
  modified:
    - scripts/e2e/flows.mjs
    - scripts/e2e/host.mjs
    - scripts/e2e/sound.mjs
    - scripts/perf-run.mjs
    - scripts/perf-run.test.mjs
    - test/worker/botTyping.test.ts
    - docs/decisions/0088-v3-cause-effect-day.md
    - docs/decisions/0081-v3-missions-flow-and-modes.md
    - docs/screen-map.md
    - HANDOFF.md
    - .planning/ROADMAP.md
  created:
    - .planning/phases/21-cause-effect-missions/perf/nightload-390x844-x4-town.json
key-decisions:
  - "제품 기본이 원인 흐름이 되어 옛 낮 순서를 전제한 E2E 흐름은 기본 마피아 판으로 돈다(openGame·lobbyWith 기본 basic, 원인 흐름·심부름·마을은 openExtended) — 21-13·14 의 갈래 A 와 같은 규칙, 판정 문턱은 그대로"
  - "성능 끊김 게이트는 이 PC 로 판정하지 않는다(미판정으로 기록, Mac 재측정)"
---

# Phase 21 Plan 16: 로컬 전체 검증·회귀·배포·결정 0088 마감 Summary

**한 줄 요약:** 폰 6종 E2E 전 흐름 회귀(옛 낮 순서 흐름은 기본 마피아 판으로 이전)와 전체 시험을 로컬에서 통과시키고 확장판 원인 흐름을 minifia-v3 에 배포(smoke full 통과)했다. 성능의 끊김 게이트는 이 PC 에서 판정하지 못했다(아래).

## 진행

- [x] 단계 1 로컬 검증: typecheck·build 통과, `npm test` 9,062 통과·262 건너뜀·실패 3(night.test.ts 5초 시간 초과 간헐, 단독 2회 19/19 통과)·`node --test` 716 통과, 폰 6종 E2E 전 흐름 8묶음 통과(알려진 perfbudget B2·M1 3건 제외), perf nightload 마을: 끊김 게이트 **미판정**
- [x] 단계 2 배포: `2026-11-13T03:30:33Z+07d6afee` → `2026-11-15T13:03:01Z+e3cb26fa` · 범위 diff 78개 · 개인 계정 확인 · smoke full 통과
- [x] 단계 3 문서: 0088 마감·0081 표시·screen-map 21 절·HANDOFF(6,046바이트 ≤ 6,144, 시험 통과)·ROADMAP·REQUIREMENTS(이미 완료 표시, 9줄 확인)

## 로컬 검증 숫자 (단계 1)

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | 오류 0 |
| `npm run build` | 성공(500kB 넘는 덩어리 경고는 기존) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 716 통과·실패 0(이후 e2e 보정 뒤 `scripts/e2e` 626 통과, `perf-run.test.mjs` 25 통과, `vitest e2eContract` 110 통과) |
| `npm test`(첫 실행) | 실패 4: botTyping 1(**진짜 결함 — 아래 fix**), night.test.ts 2·waitHelpers 1(5초 시간 초과 간헐, 단독 통과) |
| `npm test`(botTyping 고친 뒤) | 파일 317 통과·6 건너뜀·1 실패, 테스트 9,062 통과·262 건너뜀·실패 3 — 모두 `night.test.ts` "Test timed out in 5000ms"(알려진 간헐). `npx vitest run test/worker/night.test.ts` 단독 2회 모두 19/19 통과 |

## E2E 전 흐름 회귀 (단계 1, 로컬 `vite dev --port 5231`, 시스템 Chrome)

첫 회귀에서 많은 실패가 나왔다. 원인은 제품 결함이 아니라 **제품 기본(확장판)이 원인 흐름이 되어 옛 낮 순서(밤 → 아침 → 토론, 얼굴 목록 밤, `dayAnnounce`)를 전제한 E2E 흐름이 그대로 확장판 기본으로 열렸기 때문**이다(21-15 는 cause·errand·town·mode 흐름만 옮겼다). 고친 뒤 처음부터 전 흐름을 다시 돌렸다(판정 문턱은 낮추지 않음). 최종 결과(수정 반영 코드, 재시도 합계 1 — emcee-leak 한 번):

| 묶음 | `--only` | 시간 | 결과 |
|---|---|---|---|
| 1 | errand,cause- | 164초 | 통과(errand 19·cause-phones 29~30 폰 6종, cause-evening 18·night 18·morning 40·skip 8·basic 9) |
| 2 | world,day,ghost,noexec,night | 376초 | 통과(world 23·day 116·ghost 46~90·night-sizes 50 폰 6종, noexec 23·night 147·sound-night-parity 20·avatar-phases-night 5·town-ghost 8) |
| 3 | result,host-handoff,polish-reveal,tutorial | 250초 | 통과(result-reveal 34·polish-reveal 44·tutorial-solo 224~226 폰 6종, result 27·result-rematch 19·host-handoff 8·sound-result 17·tutorial-together 38) |
| 4 | basic,politics-verdict,mode- | 243초 | 통과(basic-vote 14~15·politics-verdict 32·mode-rail 39~41 폰 6종, mode-pick 41·mode-basic 19·basic-off 10·cause-basic 9·mode-leak 25) |
| 5 | avatar,sound | 170초 | 통과(sound-unlock 24·avatar-dress 35·avatar-emote 36 폰 6종, avatar-phases 19·sound-render 8·sound-script 36·emcee-sound 8 등) |
| 6 | emcee,chat-game,chat-ime,chat-keyboard,town | 262초 | 통과(chat-keyboard 23~24·emcee-band 57·town-walk 7 폰 6종 등, 재시도 1: emcee-leak 첫 시도 후 통과) |
| 7 | reconnect,perfbudget,pc,wakelock | 293초 | perfbudget 10/13 — **알려진 B2 둘(점광원 4 > 3)·M1 하나(지오메트리 35 > 25)**, 13페이즈부터 같은 숫자. 나머지 통과 |
| 8 | lobby,map-select,chat-lobby | 141초 | 통과 |

- 묶음 하나 10분 이하(최장 376초). 폰 6종 흐름을 한 묶음에 몰지 않았다.
- 중간 시험에서 `sound-script` V5(판결 앞머리 소리 열) 가 묶음 부하에서 한 번 실패했다(5번째 심장 박동이 2350ms 경계에 걸림). 단독으로 두 번 돌려 통과했고 최종 묶음 5에서도 통과했다. 문턱은 그대로.

### 이 계획이 고친 것 (`fix(21-16)`)

1. `test/worker/botTyping.test.ts` — 21-13 의 파일별 원인 흐름 잠금(`lockCauseInFile`)이 빠진 파일이라 혼자 돌려도 낮 토론 typing 시험이 실패했다. 다른 워커 시험과 같이 잠금을 머리에 두었다(단언 그대로). 커밋 `9cb65061`.
2. `scripts/e2e/flows.mjs`·`host.mjs`·`sound.mjs` — `openGame`·`lobbyWith` 기본 판 종류를 기본 마피아로, 원인 흐름·심부름·마을은 `openExtended`. `basic-off` OFF3 은 basic 그래프로 판정, emcee-band 필수 단계에서 errand 를 뺐다(확장판 저녁 띠는 cause-evening 이 본다), emcee-sound·sound-script 는 기본 마피아 판을 고른다. `OUT_DIR` 은 `fileURLToPath` 로(Windows 에서 `mkdir C:\C:\...` ENOENT — world 흐름 setup 실패의 원인). 커밋 `236a4305`.
3. `scripts/perf-run.mjs`(+ 시험) — nightload 마을 장면 표를 원인 흐름 순서(저녁 → 밤 → 아침 있을 때만 → 토론 → … → 처형)로, 마피아 판 밤은 집 문패를 누르게, 대기실 복귀 직후 시트 열기 경합은 한 번 쉬고 재시도. 옛 순서로는 "목표 단계 morning 에 도달하지 못함"(피해자 없는 밤은 아침이 없다, 0088-3) 으로 측정이 시작도 못 했다. 커밋 `3a7610d4`.

## 성능 (LH12, nightload 마을, 390×844 · CPU 4배 · 5분)

Windows PC(rAF **132Hz**, 로컬 vite dev, 헤드리스 시스템 Chrome). 두 번 쟀다.

| 항목 | 결과 | 게이트 |
|---|---|---|
| renderer.calls(최대 장면) | 87 | ≤ 120 — 통과 |
| 점광원 | 3 | 3 — 통과 |
| 평균 fps | 123.7(1회)·124.0(2회) — 132Hz 화면이라 값이 높다 | ≥ 55 — 통과(단 화면 주사율이 달라 Mac 값과 직접 비교 불가) |
| 끊김(>50ms) | 117(1회)·107(2회), 5분 환산 약 86·78 | ≤ 5 — **통과 못함, 단 원인 미확정** |

- 대조: 21 이 거의 건드리지 않은 재즈 바(기본 마피아, `--map bar`)도 같은 PC 에서 끊김 88회·평균 124.4fps 였다. 이 PC 에는 다른 프로젝트의 node·브라우저 프로세스가 다수 떠 있다. 그래서 끊김이 21 때문이라고도 이 PC 의 부하 때문이라고도 **단정할 수 없다**. 21 이전 빌드를 같은 PC 에서 재지 못했다.
- 20-09 의 Mac 측정(평균 59.8fps·끊김 1·calls 82)과 환경이 다르다. 게이트를 낮추거나 통과로 적지 않는다: **Mac 에서 `node scripts/perf-run.mjs --mode nightload --map town` 재측정이 남았다**(HANDOFF·결정 0088 "알려진 한계"에 적음).
- 저장: `.planning/phases/21-cause-effect-missions/perf/nightload-390x844-x4-town.json`(1회차)·`.png`.

## 배포 (단계 2)

- **개인 계정 확인**(`node scripts/check-account.mjs` 종료 0, 식별자는 적지 않는다). `npm run deploy`(계정 가드·배포 대상 가드 우회 없음, 대상 minifia-v3)가 종료 0.
- **배포 전 health version**: minifia-v3 `2026-11-13T03:30:33Z+07d6afee` · minifia `2026-10-29T14:52:03Z+cb6979c` · minifia-v2 `2026-11-06T13:49:18Z+e51942c6`
- **배포 뒤**: minifia-v3 `2026-11-15T13:03:01Z+e3cb26fa`(배포 전과 다름, 배포 때 HEAD = 문서 커밋 `e3cb26fa`). minifia·minifia-v2 는 위 값 그대로다.
- **배포 범위 diff**(`git diff --name-only 07d6afee..HEAD -- src shared worker public index.html wrangler.jsonc package.json package-lock.json`, 78개): worker 1(`worker/room.ts`), shared 23(`shared/game/` 의 audience·discussion·errand·execution·gather·lamps·map·mapTown·movement·night·nomination·phases·room·ruleset·runoff·scene·showdown·skip·tick·view·world, `shared/protocol.ts`·`schemas.ts`), src 54. 패키지·설정·public·index.html 은 바뀌지 않았다. 진행 중이던 확장판 방은 다음 마감부터 새 순서를 따른다(결정 0088-19, 방 만료 3시간).
- **smoke full 1회**(`SMOKE_STACK=1 node scripts/smoke.mjs --prod --stage full --players 5 --previous-version 2026-11-13T03:30:33Z+07d6afee`, 출력은 작업 트리 밖 임시 파일): **통과** `SMOKE OK full mode=extended code=… players=5 day1=errand→night→discussion serverSpread=0ms`. 확장판 첫날 사슬(저녁 5명 같은 마감 40초·장소 3곳 → 밤 → 토론)까지다. 하루의 나머지(투표·처형·다음 저녁)를 확장판으로 도는 smoke 는 없다(21-13 한계). 한도 초과(500/1101) 없음. 배포본 대상 E2E 는 돌리지 않았다(결정 0076).

## 문서 (단계 3)

- `docs/decisions/0088-v3-cause-effect-day.md`: 상태 "채택(구현·배포됨 …)", "계획 실행 중 달라진 곳"(21-01~21-16), "알려진 한계".
- `docs/decisions/0081-v3-missions-flow-and-modes.md`: 0081-2·3 에 21페이즈 구현 표시.
- `docs/screen-map.md`: "확장판 하루 흐름 (21페이즈, 결정 0088)" 절(단계 표·표식 `data-house-tag`·`data-clue-*`·`data-board*`·`data-skip`·`__mfTown houseLit/lampLit`·`__mfCamera overview`·알려진 한계)과 자동 검사 절의 cause-* 흐름·기본 마피아 이전 설명.
- `HANDOFF.md` 6,046바이트: 21 완료·배포 version, 21 눈 확인·성능 미판정, 다음 할 일(v3.0 실테스트).
- `.planning/ROADMAP.md` 21 완료(16/16), REQUIREMENTS 의 21페이즈 12개는 이미 체크·Complete(요구사항 표 9줄 정규식 확인). 위생: 이 계획의 diff 에 계정·토큰·경로 문자열 없음(사용자 규칙 파일은 이 PC 에 없어 일반 패턴만 확인).

## 21-15 가 넘긴 알려진 한계 (숨기지 않고 기록한 것)

결정 0088 "알려진 한계"·screen-map 21 절·HANDOFF 에 적었다: 보드 8자 닉네임이 칸 안에서 잘림(말줄임·두 줄·축소는 디자인 결정 필요) · 같은 집 현장 지점 표지 겹침(중심 거리 약 47px < 52) · 문패 inset 은 보이는 원 40 기준 통과/상자 44 기준 1px · 저녁 시작 카드 줄 "가는 길에 본 사람이 기록돼요" 어색 · E2E 가 못 본 것(밝은 창 카드·확장판 하루 이후 완주·미수 현장·목격 칸·실기기·LH12 는 위 성능 절).

## 계획과 달라진 점

- **E2E 이전이 계획에 없었다**: 계획은 "회귀 한 번"이었으나 옛 낮 순서 흐름 다수가 새 기본에서 실패해 흐름 설정을 기본 마피아 판으로 옮겼다(위 fix 2). 이 때문에 옛 흐름은 확장판 원인 흐름 위에서 돌지 않는다 — 확장판은 cause-*·errand·town-*·tutorial 이 맡는다.
- **성능 게이트 미판정**을 통과로 적지 않았다(계획 must_have "끊김 ≤ 5" 는 충족하지 못함). 배포는 그 게이트 판정을 기다리지 않고 진행했다(대상은 개발용 minifia-v3, 원인이 21 인지 환경인지 미확정, 재측정은 Mac 에서).
- 내가 띄운 로컬 dev 서버(포트 5231)는 마지막에 종료한다. 다른 프로젝트 서버는 건드리지 않았다.

## Known Stubs

없음.

## Threat Flags

없음(새 끝점·저장 스키마 없음). T-21-49(check-account 종료 0·가드 우회 없음·식별자 미기록)·T-21-50(smoke 출력은 작업 트리 밖)·T-21-52(배포본은 health + smoke 1회)를 지켰다. 패키지 설치 없음(T-21-SC).
