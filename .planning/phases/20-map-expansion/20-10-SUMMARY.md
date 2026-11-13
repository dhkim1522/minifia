---
phase: 20-map-expansion
plan: "10"
subsystem: verification-deploy-docs
tags: [e2e-regression, deploy, town-map, decision-0087, docs]
requires:
  - phase: 20-map-expansion
    provides: 20-01~20-09 마을 맵(서버 구역·문 프레임·3D 장면·컷어웨이·E2E·성능 측정)
provides:
  - 로컬 전체 검증(typecheck·build·node --test·npm test)과 폰 6종 E2E 전 흐름 회귀 결과
  - minifia-v3 배포 `2026-11-13T03:30:33Z+07d6afee`(smoke full 통과)
  - 결정 기록 0087(마을 맵), 화면 지도 마을 맵 절, 구조 문서 구역·문 프레임 절
affects: [21]
tech-stack:
  added: []
  patterns: [폰 6종 흐름은 묶음을 나눠 돌리고 부하 간헐은 단독 재실행으로 가른다]
key-files:
  created: [docs/decisions/0087-v3-town-map.md]
  modified: [docs/decisions/0081-v3-missions-flow-and-modes.md, docs/screen-map.md, docs/architecture.md, HANDOFF.md, .planning/ROADMAP.md, .planning/STATE.md]
key-decisions:
  - "마을 맵은 확장판 전용으로 배포, 결정 0087 에 D-01~D-23·위임 기본값(P20-0~P20-20)·알려진 한계 기록"
metrics:
  duration: 50분
  completed: 2026-11-13
status: complete
actuals:
  tokens: 14500
  tasks: 3
  commits: 3
plan_head_before: e59963a571aabd62af69600ae8c661310d7e64c9
plan_head_after: 01c6fc3e90aba57f2fdbbc8cacdddfe49dae5731
commits: 3
---

# Phase 20 Plan 10: 로컬 전체 검증·폰 6종 회귀·배포·결정 0087 Summary

**한 줄 요약:** 폰 6종 E2E 전 흐름 회귀와 전체 시험을 로컬에서 통과시키고 마을 맵을 minifia-v3 에 배포(smoke full 통과)한 뒤 결정 0087·화면 지도·구조 문서·HANDOFF·ROADMAP 을 마무리했다.

## 진행

- [x] 단계 1 로컬 검증: npm test 8,569개 통과(건너뜀 262, 실패 0)·node --test 689 통과·E2E 전 흐름 폰 6종 회귀 통과(알려진 perfbudget B2·M1 3건 제외, 간헐 2건은 단독 재실행 통과)·위생 통과
- [x] 단계 2 배포: `2026-11-12T16:47:00Z+71a10fc8` → `2026-11-13T03:30:33Z+07d6afee` · 범위 diff 28개 · 개인 계정 확인 · smoke full 통과
- [x] 단계 3 문서: 0087·screen-map·architecture·ROADMAP·HANDOFF (HANDOFF 5,875바이트·시험 통과)

## 로컬 검증 숫자 (단계 1)

| 명령 | 결과 |
|---|---|
| `npm run typecheck`(tokens·placeart 검사 + wrangler types + tsc 앱·워커) | 오류 0 |
| `npm run build` | 성공(500kB 넘는 덩어리 경고는 기존) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 689 통과·실패 0 |
| `npm test` | 파일 291 통과·6 건너뜀, 테스트 8,569 통과·262 건너뜀·실패 0(옛 전역 규칙 상수 0줄 검사·누설 전수 포함) |
| 원격 레포 위생 git grep(저장소 전체) | 위생 검사 통과(새 결과 0 — 기준선 46줄과 같다) |

## E2E 전 흐름 회귀 결과 (단계 1)

로컬 개발 서버(`http://localhost:5173`, 이 계획이 띄우지 않은 기존 서버)로 묶음을 나눠 한 번씩 돌았다. 폰 6종 흐름은 360x640·390x664·430x932·360x560·390x844·402x874, 한 크기 흐름은 흐름의 고정 크기다. `--only` 는 id 부분 일치라 함께 도는 흐름이 있다.

| 묶음 | 흐름(`--only`) | 시간 | 결과 |
|---|---|---|---|
| 1 | errand·witness·trace | 256초 | 폰 6종 모두 통과(errand 22(390x844 는 27)·witness 13·trace 53) |
| 2 | world·day·ghost·noexec·night | 349초 | 폰 6종 모두 통과(world 23·day 116·ghost 46~95·night-sizes 50), noexec 23·night 147·avatar-phases-night 5·sound-night-parity 20·town-ghost 8(390x844) |
| 3 | result·host-handoff·polish-reveal·tutorial | 222초 | result-reveal 34·tutorial-solo 229~231·polish-reveal 44(폰 6종 모두 통과), result 27·result-rematch 19(360x560)·host-handoff 8·tutorial-together 34·sound-result 17 |
| 4 | basic·politics-verdict·mode-pick·mode-leak | 223초 | basic-vote 14~15·basic-off 10·mode-pick 41·mode-basic 19·mode-leak 25 통과, **politics-verdict 360x640 31/32**(VT1 233ms — 간헐, 아래) |
| 5 | avatar·sound | 173초 | avatar-emote 36·avatar-dress 35·sound-unlock 24(폰 6종 모두 통과), avatar-phases 19·avatar-phases-night 5·sound-render 8·sound-script 36·sound-night-parity 20·sound-result 17·emcee-sound 8 통과 |
| 6 | emcee·chat-game·chat-ime·chat-keyboard·town | 233초 | chat-keyboard 23~24·emcee-band 61(폰 6종 모두 통과), chat-ime 10(360x560·390x844)·chat-game 13·emcee-tools 17·emcee-sound 8·emcee-leak 23·town-room 26·town-sight 7·town-reduced 5·town-ghost 8 통과, **town-walk 3개 크기에서 TM9 실패**(아래) |
| 7 | reconnect·perfbudget·pc·wakelock | 287초 | pc 7/7·wakelock 2/2·reconnect 35/35, perfbudget 10/13(알려진 B2 둘·M1 하나) |
| 재실행 | town-walk | 25초 | 폰 6종 모두 7/7(문 앞까지 5.0~5.7초) |
| 재실행 | politics-verdict | 49초 | 폰 6종 모두 32/32 |
| 재실행 | town-walk·mode-rail·map-select·lobby·chat-lobby | 160초 | 폰 6종 모두 통과(lobby 39~40·mode-rail 39~41·map-select 82·chat-lobby 30·town-walk 7) |
| 재실행 | perfbudget | 47초 | 10/13, 같은 세 건(B2 점광원 4 > 3 둘·M1 지오메트리 35 > 25) |

- **town-walk TM9 (묶음 6, 390x664·430x932·360x560): 「문 앞까지 시간 안에 걸어 도착한다」 실패(도착하지 못함).** 같은 묶음의 360x640·390x844·402x874 는 4.98~5.7초에 통과했고, 단독 재실행(폰 6종 한 번 25초, 다섯 흐름과 함께 한 번 160초)은 모두 5.0~5.7초로 통과했다. 한 묶음에 폰 6종 흐름 여럿이 서로 다른 페이지 수십 개를 동시에 돌려 개발 서버·소프트웨어 GL 이 늦은 순간 한도(10초 고정)를 넘긴 부하 간헐로 판단한다. 앱 결함의 증거는 없다(같은 걷기가 부하 없이는 5초대, 이름표·겹침 판정은 통과). 판정 문턱은 낮추지 않았다. 폰 6종을 한 묶음에 많이 넣을 때 다시 나오면 흐름을 나누어 돌린다.
- **politics-verdict 360x640 VT1 (묶음 4): 「찬성 묶음이 처형 진입 0.6초(0.3~0.9)에 나타난다」 233ms.** 타이밍 판정이라 부하 간헐이다. 단독 재실행에서 폰 6종 모두 32/32. 문턱은 그대로.
- **perfbudget B2·M1**: 13페이즈부터 지속된 알려진 한계와 숫자까지 같다(19-08: 점광원 4 > 3 둘·지오메트리 35 > 25). 마을은 이 흐름의 맵이 아니다.
- 알려진 기존 한계(360x560 방장 대기실 접힌 줄과 위 알림 겹침)는 판정이 참고 줄로만 남겨 실패로 세지 않았다.
- 앱 결함으로 확인된 것은 없어 `fix(20-10)` 커밋은 없다. 20-01~20-09 가 넘긴 '앱 결함'도 없었다.
- 내가 띄운 개발 서버는 없다(이미 떠 있던 것을 그대로 썼고 끄지 않았다).

## 배포 (단계 2)

- **개인 계정 확인**(`node scripts/check-account.mjs` 종료 0, 계정 식별자는 적지 않는다). `npm run deploy`(계정 가드·배포 대상 가드 우회 없음, 대상 minifia-v3)가 종료 0 으로 끝났다.
- **배포 전 health version**: minifia-v3 `2026-11-12T16:47:00Z+71a10fc8` · minifia `2026-10-29T14:52:03Z+cb6979c` · minifia-v2 `2026-11-06T13:49:18Z+e51942c6`
- **배포 뒤 health version**: minifia-v3 `2026-11-13T03:30:33Z+07d6afee`(배포 전과 다름, 배포 때 HEAD 커밋 `07d6afee` = 이 계획의 단계 1 커밋). minifia·minifia-v2 는 위 값 그대로다.
- **배포 범위 diff**(`git diff --name-only 71a10fc8..HEAD -- src shared worker public index.html wrangler.jsonc package.json package-lock.json`, 28개 — 서버(worker·shared) 포함이 이 페이즈의 의도다):
  - worker(1): `worker/room.ts`
  - shared(8): `shared/game/errand.ts`·`map.ts`·`mapTown.ts`·`maps.ts`·`room.ts`·`world.ts`·`zones.ts`, `shared/protocol.ts`
  - src(19): `src/components/WorldStage.tsx`·`v2/DressSheet.tsx`, `src/debug/perf/perfScene.ts`·`scenario.ts`, `src/game/tutorialScript.ts`, `src/screens/Lobby.tsx`·`ResultScreen.tsx`, `src/world/camera.ts`·`cutaway.ts`·`maps/plaza.ts`·`maps/town.ts`·`maps/types.ts`·`palette.ts`·`presence.ts`·`renderer.ts`·`runtime.ts`·`store.ts`·`testHooks.ts`·`threeRenderer.ts`
  - 패키지·설정·public·index.html 은 바뀌지 않았다. 저장된 진행 중 방은 `state.map` 이 정해져 있어 그 판은 그 맵으로 끝나고, 구역 기억이 없는 저장 world 는 알림 없이 지금 위치로 맞춰진다(20-02). 새로 시작하는 확장판부터 마을이다.
- **smoke full 1회**(`SMOKE_STACK=1 node scripts/smoke.mjs --prod --stage full --players 5 --previous-version <배포 전 version>`, 출력은 작업 트리 밖 임시 파일): **통과**(`SMOKE OK full players=5`, 서버 시각 편차 0ms/0ms, 도착 편차 600ms/775ms). 확장판 낮 심부름 단계(산 5명이 같은 마감 40초·장소 3곳)·처형·밤·재접속 복원·승패(시민 승, 2일차)까지 한 판을 돌았다. 한도 초과(500/1101)는 없었다. 배포본 대상 E2E 는 돌리지 않았다(결정 0076).

## 문서 (단계 3)

- `docs/decisions/0087-v3-town-map.md`(새): D-01~D-23 을 0087-1~17 로, 위임 기본값 P20-0~P20-20, 계획 단계에서 고른 것(MODE_MAPS·와이어 문 프레임·구역 기억·장소 id 다시 쓰기·문 앞 다시 누르기·문턱 옅어짐), 실행 중 달라진 곳(20-01~20-09), 성능 측정, 폰 6종 실측, 알려진 한계, 정하지 않은 것. 상태는 "채택(구현·배포됨)"이고 근거에 시안 사본 `design/v3.0/town-map/`.
- `docs/decisions/0081-v3-missions-flow-and-modes.md` 0081-4 에 "(구현: 결정 0087 …)" 한 줄(본문은 그대로).
- `docs/screen-map.md`: 방장 줄 설명(확장판은 [맵] 없음)·실측 표(확장판 단추 3 으로 맞춤)·새 "마을 맵" 절(방 넷·집 여덟·컷어웨이 0.25초·문 연출 0.2초·지붕 두 번 누르기·벽 뒤 이름표·카메라 한계·표식 `__mfMap`·`__mfTown`·`data-door`·`data-veiled`·알려진 한계)·자동 검사 절에 town-* 다섯 흐름과 TM1~TM12(TM11 은 map-select, TM12 는 perf-run).
- `docs/architecture.md`: "마을 맵: 구역·문 프레임" 절(MODE_MAPS·맵별 격자·`zoneOf`·이동 프레임 구역 거르기·문 프레임·구역 기억·심부름 구역·화면 파일).
- `HANDOFF.md` 5,875바이트(≤ 6,144, 시험 통과): 20 완료·배포 version·결정 0087, 20 눈 확인 줄, 다음 할 일 21(`/gsd-autonomous --from 21`).
- `.planning/ROADMAP.md`: Phase 20 체크 줄·Plans·진행 표를 완료(배포 `07d6afee`·결정 0087·실기기 확인은 v3.0 끝)로. `.planning/STATE.md`: 위치·결정·세션, Deferred Verification 표에 20 줄.
- 위생: 저장소 전체 git grep 이 기준선과 같다(새 결과 0). `.planning/milestone.lock`·`.planning/state.json`·`Claude outputs/`·`18-VERIFICATION.md` 는 커밋에 넣지 않았다.
- push: `git push origin v3`(아래 확인).

## 계획과 달라진 점

계획대로 실행했다. 다른 점만 적는다.

- **폰 6종 회귀 범위**: 이미 폰 6종으로 돈 흐름(town-walk·mode-rail·map-select·lobby·chat-lobby)도 묶음 마지막에 다시 한 번 돌렸다(160초). 건너뛰어도 되는 것을 넣었으므로 계획의 "전 흐름 한 번"보다 한 번 더다.
- **재실행으로 가른 간헐 둘**(town-walk TM9·politics-verdict VT1)은 판정을 고치지 않았다. 앱·흐름 코드를 바꾸지 않아 `fix(20-10)` 커밋이 없다.
- **묶음 구성**: 계획의 묶음 일곱(A~G)에 H(town)를 더하는 대신 시간(10분 이하)을 기준으로 영향 흐름 먼저(errand·witness·trace → world·day·ghost·night → …)로 다시 짰다. 같은 흐름을 모두 한 번씩 돌았다.
- **actuals.tokens** 는 이 계획이 바꾼 파일(문서·HANDOFF·ROADMAP 의 diff 약 5.5만 글자)을 chars/4 로 센 값이다.
- **커밋 수**: 이 SUMMARY 를 담은 마지막 커밋은 `plan_head_after`(문서 커밋 `01c6fc3e`) 뒤에 한 번 더 있다 — `commits: 3` 은 그 앞까지 잰 값이다.

## 알려진 한계 (남은 것)

결정 0087 "알려진 한계" 와 같다: 좌석 0·7 집 문 앞 자리(문에서 약 1.3)·북서 모서리 마당 걷기 불가 / 닫힌 방 안 분필(21) / 헤드리스 근거의 한계(폰 GPU·발열·셰이더 컴파일 끊김·밤 조명의 간판·문패·간판 뒤 사람 가림 — v3.0 끝 실기기) / 밤·아침 순간이동 문 연출 없음 / 말·채팅·감정표현은 구역과 무관 / 이름표가 지붕 판 위에 겹칠 수 있음 / 360×560 방 전체가 안 들어옴 / `perfbudget` B2·M1(13페이즈부터).

## Threat Flags

없음. 새 끝점·인증 경로·저장 스키마가 없다(이 계획은 시험·배포·문서). T-20-32(계정 확인 종료 0 뒤 가드를 거친 배포만, 식별자 미기록)·T-20-33(위생 git grep 기준선과 같음, smoke 출력은 작업 트리 밖)·T-20-34(저장된 방 호환은 20-02 시험, smoke full 통과)·T-20-35(배포본 대상 E2E 없이 health·smoke 1회, 한도 초과 없음)를 지켰다. 패키지를 설치하지 않았다(T-20-SC).

## Known Stubs

없음.

## Self-Check: PASSED

- 파일: `docs/decisions/0087-v3-town-map.md`·`docs/screen-map.md`·`docs/architecture.md`·`HANDOFF.md`·이 SUMMARY 가 있다.
- 커밋 `07d6afee`·`3d651e46`·`01c6fc3e` 가 HEAD 의 조상이다.
- 배포본 health 의 version 이 `2026-11-13T03:30:33Z+07d6afee` 이고 smoke full 이 통과했다.
