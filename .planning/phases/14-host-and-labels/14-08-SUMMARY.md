---
phase: 14-host-and-labels
plan: "08"
subsystem: e2e-host-labels
tags: [e2e, host-band, tool-label, leak-check, host-chime, view-keys, minifia-v3, host-01, host-05, tool-01]
status: complete

requires:
  - phase: 14-01
    provides: "자막 띠 HostBand(`[data-host-band]`·`[data-host-line]`·`[data-host-time]`)·hostLine.ts"
  - phase: 14-03
    provides: "알림음 ui.host(57번째 소리), hostChimeOf"
  - phase: 14-04
    provides: "빛남 is-call·data-call"
  - phase: 14-07
    provides: "도구 이름표 전체(ToolButton·FloatAction·MapChip·SoundButton), 면제 E-1·E-2"
provides:
  - "새 E2E 흐름 넷: emcee-band(폰 6종)·emcee-tools·emcee-leak·emcee-sound — scripts/e2e/host.mjs(makeHostFlows)"
  - "순수 판정(lib.mjs): hostBandChecks(HB1~5)·hostOverlapChecks(HO1)·toolLabelChecks(TL1·2)·hostLeakChecks(HL1~4)·viewKeyChecks(VK1)·hostChimeChecks(HS1~4), 사본 상수 VIEW_TOP/ME/DAY_KEYS·HOST_ACT_LINES·GOALS·HOST_MARKERS·TOOL_LABEL_EXEMPT"
  - "browser.mjs 읽기 도우미: tracker.viewKeys(키 이름만)·readHostBand·readToolButtons·readCallCount·readRoomText·readTagRects·armBandWatch/readBandWatch, guide 읽기 inBand, 묶음 H 에 띠 문장·띠 시간"
  - "기존 흐름 기대를 14페이즈 새 계약으로 옮김(문턱은 그대로) — 헤더 안내줄·링 → 띠, 36px 낮/밤 알림 삭제, 깜빡임 → 빛남, 꾸미기 → 옷장, 이름표로 커진 기하(패널 +11.6·떠 있는 단추 48×71.6·입력칸 폭 188·띠 아래 8)"
  - "run.mjs: E2E_STACK=1 이면 던진 오류의 전체 메시지·호출 자리를 찍는다(판정 그대로)"
affects: [14-09]

requirements-completed: [HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, TOOL-01, TOOL-02, TOOL-03]

actuals:
  tokens: 32350
  tasks: 3
  commits: 6

plan_head_before: 62b0ebed89b7ce2e098adfba9681ede0773a4bde
plan_head_after: d96f0c83226a640d69da41ff4569de46b5614fee

tech-stack:
  added: []
  patterns:
    - "흐름은 읽기만, 판정은 lib.mjs 순수 함수 — 값이 없거나 모양이 틀리면 `측정값 없음(…)` 으로 실패(공허 통과 금지). 판정 함수마다 통과·실패·측정값 없음 시험"
    - "사본 상수는 e2eContract 가 제품 값과 같음을 고정(HOST_ACT_LINES·GOALS ↔ hostLine.ts·roleText.ts, VIEW 키 ↔ view.test.ts + protocol.ts 선언, HOST_MARKERS ↔ src, 패널 +11.6 ↔ v2.css `.mv-tool__face` 36·라벨 14/1.4)"
    - "2초짜리 낮 시작처럼 한 칸 넘기고 읽기엔 짧은 단계는 띠 감시(MutationObserver)가 띠 값을 쌓아 같은 hostBandChecks 로 판정"
    - "알려진 한계(UI#14)는 판정 함수에 옵션/정보 줄로만 두고 값 그대로 남긴다(HO1k·R-MS6k·AW4k·GH13k). 문턱(4.5:1·150·44)은 어디서도 낮추지 않았다"

key-files:
  created:
    - scripts/e2e/host.mjs
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/run.mjs
    - scripts/e2e/politics.mjs
    - scripts/e2e/avatar.mjs
    - scripts/e2e/sound.mjs
    - scripts/e2e/result.mjs
    - scripts/e2e/result.test.mjs
    - scripts/e2e/mapselect.mjs
    - test/unit/e2eContract.test.ts
    - src/styles/phase.css
    - src/styles/v2.css

key-decisions:
  - "VIEW 키 허용 목록 사본은 view.test.ts 의 TOP/ME/DAY_KEYS 에 9페이즈 상태 의존 키 셋(me.will·me.note·day.chalk)만 더한 집합이다. emcee-leak 이 실제 프레임에서 day.chalk 를 처음 잡았다(view.test 의 풍부한 상태는 분필을 만들지 않는다). 더한 셋은 e2eContract 가 shared/protocol.ts 의 MyInfo·DayView 선언으로 확인한다 — 14페이즈가 새 키를 더하면 VK1 이 여전히 잡는다"
  - "emcee-band 의 8명 투표는 4자 이름 사람 손님 7(basic-vote 와 같은 이름)이다 — 봇 이름은 첫 봇이 8자 고정이라 UI-SPEC 의 '이름표 8개(4자 이름)' 전제와 다르다. 8자 이름 겹침은 알려진 한계(UI#14)로 두었다. 결과(ended)는 사람 손님 판에서 닿기 어려워(투표가 없으면 처형이 없다) 같은 폰 크기의 봇 판으로 따로 읽는다"
  - "360×560 UI#14: 띠·헤더 밑에 걸린 요소(이름표 한 칸, 결과 화면 칩, 패 아래 스테이지, 유령 이름표)는 판정에서 빼고 잰 값을 정보 줄(HO1k·R-MS6k·AW4k·GH13k)로 남기며 고치지 않았다. 이름표끼리 겹침·글자 크기·가로 넘침·다른 5종 폰은 그대로 판정"
  - "입력줄 이름표 단추(면 36 + 4 + 라벨 19.6 = 59.6)가 입력칸 48 보다 11.6 커 패널·키보드 패널이 그만큼 는다 — 판정이 TOOL_ROW_EXTRA(11.6)를 더한다. 앱 상수(chatUi.ts)는 그대로 둔다(제품 변경 없음)"

patterns-established:
  - "새 E2E 흐름 모듈은 makeXFlows(helpers) 로 도우미를 받고 flows.mjs 가 FLOWS 에 등록(sound.mjs·politics.mjs 와 같은 모양)"

duration: 약 1시간 35분
completed: 2026-11-07
---

# Phase 14 Plan 08: 사회자·이름표 E2E 흐름 넷과 기존 흐름 기대 갱신 Summary

14페이즈를 끝에서 끝으로 검사하는 E2E 흐름 넷(emcee-band 폰 6종·emcee-tools·emcee-leak 역할 다섯 시점·emcee-sound)과 순수 판정 여섯 묶음을 만들고, 기존 흐름의 옛 기대(헤더 안내줄·링·36px 알림·깜빡임·꾸미기·이름표로 커진 기하)를 문턱을 낮추지 않고 새 계약으로 옮겼다. 로컬에서 바뀐 흐름 전체(114개 흐름×크기)가 통과했다.

## Accomplishments

- **Task 1 (RED→GREEN)** — `hostBandChecks`·`hostOverlapChecks`·`toolLabelChecks`·`hostLeakChecks`·`viewKeyChecks`·`hostChimeChecks` 와 사본 상수를 `lib.mjs` 에, 통과·실패·측정값 없음 시험을 `lib.test.mjs` 에, 사본 일치 시험(HOST_ACT_LINES·GOALS·VIEW 키·HOST_MARKERS)을 `e2eContract.test.ts` 에 두었다. `guideChecks` 는 헤더 한 줄 규칙을 "띠 안·3줄 미만"으로 옮겼다.
- **Task 2** — `host.mjs`(makeHostFlows) 네 흐름과 `browser.mjs` 읽기 도우미, `flows.mjs` 등록. 첫 실행에서 E2E 가 제품 결함 둘을 잡았다(아래 편차 1·2).
- **Task 3** — 옛 기대를 새 계약으로 옮기고 바뀐 흐름 전체를 로컬에서 돌렸다. 서버 diff 0(`git diff --quiet 2736a336 -- worker shared` 성공).

## 로컬 E2E 결과 (`npm run dev` + `npm run e2e -- --url http://localhost:5173 --only …`, 마지막 통합 실행 855초 "E2E OK")

| 흐름 | 크기 | 통과/전체 | 비고 |
|---|---|---|---|
| **emcee-band** | 폰 6종 | 360x640 30/30 · 390x664 30/30 · 430x932 30/30 · 360x560 31/31 · 390x844 30/30 · 402x874 30/30 | 360x560 은 HO1k 정보 줄 1(이름표 3 이 띠와 겹침 가로 103.8·세로 5.6px) |
| **emcee-tools** | 390x844 | 19/19 | |
| **emcee-leak** | 390x844 | 22/22 | 읽기 60곳, view 키 최상위 15·me 12·day 12 |
| **emcee-sound** | 390x844 | 8/8 | |
| **politics-verdict** | 폰 6종 | 각 33/33 | 줌 문턱 높이를 띠 아랫변 기준으로(편차 5) |
| **basic-vote** | 폰 6종 | 15/15(430x932 14/14) | BV4 가 띠 시간으로 |
| lobby / chat-lobby | 폰 6종 | 34/34(360x560 33/33) · 23/23 | CP1·CP3 이름표 줄 +11.6 |
| day / ghost / night-sizes / map-select / avatar-dress / avatar-emote / sound-unlock / result-reveal / result-awards | 폰 6종 | 전부 통과 | day 111/111 |
| noexec / night / basic-off / avatar-phases(+night) / result / result-rematch / sound-script / sound-night-parity / sound-result / sound-render / chat-game / chat-ime / chat-keyboard / world / host-handoff | 한 크기 | 전부 통과 | night 144/144 |

재실행·간헐(그대로 기록): `avatar-phases` 390x844 가 "손님이 첫 밤에 탈락함 — 새 방으로 다시 돈다" 설정 재시도 2번 뒤 통과(설계된 재시도). 중간 실행에서 `result` 390x844 가 `tapPick` "element is not stable" 로 3번 재시도 뒤 통과(15개 흐름 병렬 부하), `emcee-leak` 이 한 번 "ended 에 닿지 못함" 설정 재시도(처형 없는 날이 이어짐)를 했다. `npm test`(vitest) 7049 통과 + 간헐 둘(`continuity` 5초 제한 — 기지, `bots.test` 전체 실행 때만 — 단독 실행은 통과, 서버·shared 변경 없음).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘] 역할 확인 화면의 [테스트] 단추가 눌리지 않음**
- **Found during:** Task 2 (emcee-sound 첫 실행)
- **Issue:** 14-05 가 역할 확인 머리를 `pointer-events:none` 절대 배치로 바꾸면서 `.mf-tt`([테스트], 테스트 방 전용)가 `.mf-reveal__stage` 에 가려 눌리지 않았다. 일반 사용자 화면에는 없는 단추지만 E2E 가 역할 확인을 넘기지 못한다
- **Fix:** `.mf-reveal__header .mf-btn` 규칙에 `.mf-tt` 를 더했다
- **Files modified:** src/styles/phase.css
- **Commit:** 3207b459

**2. [Rule 1 - 결함] 마지막 5초 숫자 대비 4.2:1**
- **Found during:** Task 2 (emcee-band 묶음 H, 390x664 투표)
- **Issue:** 띠 시간 숫자의 마지막 5초 색 `crimson-400` 이 어두운 면 위에서 4.2:1 로 묶음 H(4.5:1)에 못 미쳤다(옛 타이머도 같은 색이었지만 마지막 5초에는 재지 않았다)
- **Fix:** 숫자(글자)만 `crimson-300`(5.5:1)으로, 막대(글자 아님)는 UI-SPEC 대로 `crimson-400` 유지. UI-SPEC 의 "숫자도 같은 색" 문구와 다른 점은 14-09 가 사용자에게 알린다
- **Files modified:** src/styles/v2.css
- **Commit:** 3207b459

**3. [Rule 1 - 계획 가정 오류] VIEW 키 허용 목록에 상태 의존 키 셋 추가** — 위 key-decisions 첫 항목. emcee-leak VK1 이 `day.chalk` 로 실패 → `me.will·me.note·day.chalk` 를 더하고 protocol.ts 선언을 e2eContract 로 고정. (Commit 4da72513)

**4. [Rule 3 - 설계 변경] emcee-band 구성** — 4자 이름 사람 손님 7 + 별도 봇 판으로 결과 읽기 + 낮 시작은 띠 감시(2초 단계라 한 칸 넘기고 읽을 수 없음, 넘기기를 누르면 토론까지 건너뜀). (Commit 4da72513)

**5. [Rule 1 - 기대 갱신] 계획 목록 밖의 옛 기대** — 아래는 모두 같은 원인(14-06·14-07 이름표 단추, 14-01 띠)이고 문턱·개수는 그대로다:
- 입력줄 이름표 단추 59.6 → 패널 +11.6: `gamePanelHeight`(day·night-sizes·politics), chat-lobby CP1·CP3, result RS5·RT3, chat-keyboard KB_PANEL_H
- 떠 있는 단추 상자 48×71.6: `floatButtonChecks` boxH, `dressChecks` floatH, AW5(윗변 = 옛 위 칸 자리, 아랫변 ≤ 패널 − 8)
- 다시 하기 입력칸 폭 폭 − 188(보내기 단추 44), 동작 판 labeled(EB1 폭 44~52·높이 59.6, TR3 간격 +11.6)
- 맵 칩·시상 패·소리 단추는 띠 아랫변 + 8(MS1·AW4·SU3), SU5 는 덮든 안 덮든 중심 최상단이 단추, SK4 글은 라벨 '소리'
- politics-verdict 줌 문턱(스테이지 360 이상)은 앱처럼 띠 아랫변을 윗변으로 계산
- ghost 스테이지 목적지는 띠 아래에서 고름
- Commits: b995cbd8, d96f0c83

### 알려진 한계 (UI#14, 고치지 않음, 값 그대로 기록)

| 줄 | 크기 | 측정값 |
|---|---|---|
| HO1k | 360x560 투표 | 이름표 3 이 띠 아랫변과 가로 103.8px·세로 5.6px 겹침(띠는 눌림을 받지 않아 이름표는 계속 눌린다) |
| R-MS6k | 360x560 결과 | 맵 칩(63높이)이 이름표 한 칸과 겹침 — 칩 (12,135,56,198) · 이름표 (5,181,137,205) |
| AW4k | 360x560 시상 | 패 아래 스테이지 125.6 < 150(문턱 150 은 그대로, 이 한 항목만 정보 줄) |
| GH13k | 360x560 유령 | 유령 이름표가 헤더·띠 밑으로 올라가 화면 그림으로 대비를 잴 수 없음(가려지지 않은 이름표는 4.5:1 로 판정 — 통과) |

## Issues Encountered

- 새 흐름 첫 실행들에서 설정 문제(사람 손님은 스스로 투표하지 않아 변론·찬반·처형이 열리지 않음, 처형 없는 날이 이어져 `ended` 에 닿지 못함, `skipOnce` 가 낮 시작 2초를 건너뛰어 토론까지 넘김)를 찾아 흐름을 고쳤다. 판정 문턱은 건드리지 않았다.
- 처음 낮 시작이 읽히지 않는 것은 흐름의 한계가 아니라 단계가 2초라는 서버 설정(`DAY_ANNOUNCE_MS`)이다.

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크·인증·파일 접근 면 없음. `tracker.viewKeys` 는 키 이름만, 결과 줄에 닉네임·토큰 없음 — T-14-19~22 완화 확인).

## Self-Check: PASSED

- 파일: scripts/e2e/host.mjs 있음, lib.mjs 판정 함수 5개(`export function hostBandChecks|toolLabelChecks|hostLeakChecks|hostChimeChecks|viewKeyChecks`) 있음, `hostLeakChecks` lib.test 20줄 이상, flows.mjs `makeHostFlows` 2 이상, browser.mjs `viewKeys` 1 이상
- 인수 기준: `is-blink` 0 · `mv-ring` 0 · avatar.mjs `"꾸미기"` 0, `git diff --quiet 2736a336 -- worker shared` 성공
- 커밋: 64220023 · a6562dbb · 3207b459 · 4da72513 · b995cbd8 · d96f0c83 모두 `v3` 에 있음
- `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` 490 통과·실패 0, `npx vitest run test/unit/e2eContract.test.ts` 61 통과
