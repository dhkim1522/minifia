# Phase 20 Plan 10: 로컬 전체 검증·폰 6종 회귀·배포·결정 0087 Summary (작성 중)

## 진행

- [x] 단계 1 로컬 검증: npm test 8,569개 통과(건너뜀 262, 실패 0)·node --test 689 통과·E2E 전 흐름 폰 6종 회귀 통과(알려진 perfbudget B2·M1 3건 제외, 간헐 2건은 단독 재실행 통과)·위생 통과

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

<!-- gsd:write-continue -->
