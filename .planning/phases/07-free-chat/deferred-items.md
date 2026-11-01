# 07-free-chat 미룬 항목

> 계획 실행 중 발견했지만 그 계획의 범위 밖이라 고치지 않은 것. 해당 계획이 오면 거기서 닫는다.

## 07-11 에서 발견

### 옛 와이어(say·옛 chat 모양)를 보내는 개발용 스크립트

07-11 이 서버·와이어에서 빠른 메시지(`say`)와 옛 `chat` 프레임 모양(`template`·`target`·`claimedRole`)을 지웠다. 아래 스크립트는 vitest 대상이 아니라 시험 초록에는 걸리지 않지만, 지금 배포본·로컬 서버에 돌리면 해당 단계에서 `BAD_MESSAGE` 를 받거나 옛 프레임 키를 기다리다 실패한다.

| 파일 | 옛 사용 | 비고 |
| --- | --- | --- |
| `scripts/bots.mjs` | `{t:"say", template:"innocent"}`, `nightAgree`, 변론 템플릿 | 개발용 사람 흉내 봇. 자유 채팅 `{t:"chat", text, pk}` 로 바꾸면 된다 |
| `scripts/smoke.mjs` | `CHAT_FRAME_KEYS`·`CHAT_ALLOWED_KEYS`(template·target·claimedRole), `say`/`emoji` 기대, `suspect` 템플릿 프레임 | 배포 뒤 스모크. 프레임 키 목록과 단계 기대를 새 모양으로 |
| `scripts/uat-day.mjs`, `scripts/uat-night.mjs`, `scripts/uat-vote.mjs` | `say` 템플릿 전송과 `chat` 프레임 키 검사 | 수동 UAT 용 |

- 담당: 07-12(텍스트 이모티콘·옛 필드 정리) 또는 07-14 이후 정리 계획. 프레임 단위 E2E(`scripts/e2e/`)는 화면 계획(07-15~)이 새 채팅 UI 와 함께 바꾼다.
- 이 계획의 Task 3 acceptance 는 `shared worker src` 만 대상이라 영향이 없다.

### 채팅 줄 번호·전송 기록은 DO 메모리뿐 (가정 A1) — 줄 번호는 07-14 에서 닫힘

> 07-14 갱신: `chatLog`(채널별 seq)는 이제 `chat:` 키에 저장되고 생성자가 복원한다. `chatRates`(D5 제한)는 계속 메모리뿐이라 evict 뒤 제한이 한 번 느슨해지는 것은 수용된 동작이다.

`chatLog`(채널별 seq)와 `chatRates`(D5 제한)는 DO 메모리에만 있어 하이버네이션·evict 로 비면 seq 가 1 로 돌아가고 제한이 한 번 느슨해진다. 07-14 가 같은 `appendLine` 결과에 저장·복원을 더한다. 그 전까지 줄 번호가 단계를 넘어 이어지는 시험은 evict 하지 않는 `advanceToKeep`(test/worker/helpers.ts)으로 넘긴다.

## 07-12 에서 발견

### emoji 를 보내거나 기다리는 개발용 스크립트·E2E

07-12 가 emoji 클라이언트·서버 메시지를 와이어에서 지웠다. 아래 파일은 vitest 대상이 아니라 시험 초록에는 걸리지 않지만, 배포본·로컬 서버에 돌리면 해당 단계에서 `BAD_MESSAGE` 를 받거나 사라진 `emoji` 프레임을 기다리다 실패한다. 07-11 항목(say·옛 chat 모양)과 같은 파일이 많다.

| 파일 | 비고 |
| --- | --- |
| `scripts/bots.mjs`, `scripts/smoke.mjs`, `scripts/uat-day.mjs`, `scripts/uat-night.mjs`, `scripts/uat-vote.mjs`, `scripts/uat-test-bots.mjs` | emoji 송신·기대. 07-11 항목과 함께 자유 채팅 `{t:"chat", text, pk}` 로 바꾼다 |
| `scripts/gallery.mjs` | emoji 언급 확인 필요(화면 갤러리) |
| `scripts/e2e/flows.mjs`, `scripts/e2e/lib.mjs`, `scripts/e2e/lib.test.mjs`, `scripts/e2e/browser.mjs` | 프레임 단위 E2E. 화면 계획(07-15~)이 새 채팅 UI 와 함께 바꾼다 |

- 담당: 07-14 이후 정리 계획 또는 화면 계획.

### 시험 flake: bots.test "봇 chat: 밤에는 마피아 봇의 줄이..."

`test/worker/bots.test.ts` 의 이 시험은 방 구성이 무작위라 방장(testRole mafia) 외의 마피아가 손님 자리에 앉으면 `mafiaBot` 이 `undefined` 가 되어 `TypeError: Cannot read properties of undefined (reading 'id')` 로 가끔 실패한다. 07-12 의 변경과 무관하다(전체 worker 한 번에서 1회 재현, 단독 재실행 3회 통과, 이어진 전체 실행 통과). 시드 고정이나 `mafiaBot` 없을 때 재시도로 고친다. 담당: 07-14 이후 정리.

### view.test 서버 전용 키 목록에서 옛 키 이름 제거

07-12 Task 2 의 acceptance(`nextNightSeq`·`lastSendAt` 이 test/unit·test/client 에 0줄)를 지키려고 `test/unit/view.test.ts` 의 서버 전용 키 목록 두 곳에서 `lastSendAt`·`nextNightSeq` 이름을 뺐다. 저장된 옛 방에 그 키가 남아 있어도 view 에 새지 않는다는 검사는 07-14 의 `normalizeStoredRoom` 시험이 맡는다(옛 키를 지우는 쪽). worker 의 누설 검사 목록(SERVER_ONLY_KEYS·FORBIDDEN_KEYS)과 `test/worker/testTools.test.ts` 의 FORBIDDEN_PLAYER 는 그대로다.

## 07-15 에서 발견

### 옛 낮 화면 프레임 단위 E2E 흐름 (claim·상태 줄·157 패널 높이·채팅 내역 모달 전제)

07-15 가 테이블 화면 하단을 ChatPanel 로 바꿨다(낮 토론 `LOG_H + 92`, 변론은 상태 줄 없음). 아래 옛 흐름은 vitest 대상이 아니라 시험 초록에는 걸리지 않지만, 로컬 서버에 돌리면 사라진 전제에서 실패한다. 새 길은 `chat-table`·`chat-ghost` 가 이미 본다.

| 위치 | 옛 전제 |
| --- | --- |
| `scripts/e2e/flows.mjs` 의 `game(...)`(police5·citizen4·mafia8·doctor5)·`specFlow`·`voteFlow` 등 | `skipTo(page, tracker, "claim")`(단계 `claim` 은 07-08 에서 사라짐), 순차 주장(`CLAIMS`), `openChatHistory`(`^` 채팅 내역 모달) |
| `scripts/e2e/lib.mjs` 의 `PANEL_H = 157`·`PANEL_H_DEFENSE_ME = 236`, D6·T1·K2 묶음 | 낮 토론·밤·변론 하단 패널이 157(변론 후보 본인 236)이라는 단언 — 채팅 패널이 붙는 단계는 188/244(안전 영역 제외) |
| `scripts/e2e/flows.mjs` 의 변론 검사(`defenseChecks`) | 하단 상태 줄 `.stat`·후보 본인 칩 6개 |

- 담당: 07-20(E2E 하네스 정리 — 주장·빠른 메시지 판정 삭제·패널 높이). 이 계획의 새 흐름은 위 옛 도우미를 쓰지 않는다.
- **07-20 에서 닫힘**: 게임 흐름이 claim 없이 discussion 으로 가고, 채팅 패널 상태의 하단 높이 기대값이 `expectedPanelH`(188·244, 그 밖 157)로 바뀌었다. `PANEL_H_DEFENSE_ME`·`defenseChecks` 의 후보 본인 칩 판정·`openChatHistory` 는 지웠다.

## 07-16 에서 정리됨 / 발견

### 닫힌 항목 (07-11·07-12 에서 넘어온 개발용 스크립트)

- `scripts/bots.mjs`, `scripts/smoke.mjs`: 07-16 이 자유 채팅(`chat`·`typing`·`chatReject`·`chatLog`) 기준으로 다시 썼다. 옛 `say`·`emoji`·`claim` 송신과 `claimLog`·`turn` 기대가 없다.
- 07-17 갱신: `scripts/uat-day.mjs`, `uat-night.mjs`, `uat-vote.mjs`, `uat-test-room.mjs`, `uat-test-bots.mjs` 를 자유 채팅 기준으로 다시 썼다(옛 `say`·`emoji`·`claim` 송신과 `claimLog`·`day.turn` 기대 없음, 로컬 서버 실행 통과). 07-11·07-12 에서 넘어온 개발용 스크립트 항목은 `scripts/gallery.mjs`(emoji 언급 확인 필요) 하나만 남았다 — 07-20 이 맡는다. **07-20 에서 닫힘**: gallery 가 주장·빠른 메시지·이모티콘·채팅 내역 모달 대신 로비 채팅·토론 채팅·밤 마피아 채팅을 찍는다.

### 로컬 smoke full 의 하루 캐시 헤더 검사

`smoke.mjs --stage full` 이 보던 `Cache-Control: max-age=86400`(인물 그림·배경 WebP)은 배포본 Workers 정적 에셋의 헤더라 로컬 vite 개발 서버는 `no-cache` 를 준다. 07-16 이 이 두 검사를 로컬(localhost·127.0.0.1)에서는 건너뛰게 했다(배포본에서는 그대로 본다). 계획의 검증 명령(`smoke.mjs http://localhost:5173 --stage full`)이 통과하려면 필요한 조정이었다.

### 채팅 부하 하 로비 fps 가 6페이즈 기준에 못 미치는 첫 측정 (07-21 판정 입력)

`perf-run --mode chatload` 로컬 1분 측정(개발 서버·CPU 4배·DPR 2·390x844): 봇 7명이 2초마다 채팅·입력 중을 보내는 동안 평균 53.5fps·끊김(>50ms) 29회·43회(두 번), 같은 환경에서 봇 0명 대조는 60.0fps·끊김 0. 기준(5분 평균 55fps·끊김 5회)은 낮추지 않았다. 개발 서버(번들 안 줄임)와 측정 중 다른 프로세스 부하(남은 vitest 프로세스 둘이 코어를 쓰고 있었다)가 섞여 있으니 배포본·5분·조용한 환경의 숫자가 판정 입력이다. 숫자가 그대로 나오면 채팅 줄·입력 중 한 건마다 로비 화면이 다시 그려지는 비용(07-13 로비 ChatPanel·useChat)을 먼저 본다. 원자료: `.planning/phases/07-free-chat/perf/chatload-390x844-x4*.json`.

## 07-18 에서 발견

### E2E world 흐름이 360x560 에서 이동 목적지를 못 찾음 (07-13 이후 기존 실패)

`npm run e2e -- --only world` 가 360x560 에서만 `world/setup S4 단계 도달: 탭할 목적지를 찾지 못함(두 화면에 보이는 칸 5개, 3 단위 이상 먼 칸 0개)` 로 실패한다(나머지 5개 크기는 21/21). 로비 스테이지가 채팅 패널로 248 이 되면서(6페이즈 410) 하네스가 찾는 "3 단위 이상 먼 보이는 칸" 이 없어진 것이다. 07-18 의 카메라 변경 때문이 아니다 — `PAN_BOX` 를 6페이즈 값(4.8)으로 잠시 되돌려 같은 크기에서 돌려도 같은 곳에서 실패했다. 제품 결함이 아니라 하네스의 목적지 탐색 조건(거리 3, 스테이지 높이 가정)이다.

- 담당: 07-20(E2E 하네스 정리). 목적지 탐색의 거리 하한을 스테이지 높이에 맞춰 낮추거나, 360x560 은 보이는 칸 중 가장 먼 칸을 고르게 한다.
- **07-20 에서 닫힘**: `worldTapRanking` — 3 단위 이상 먼 칸이 없으면 1.5 단위 이상 먼 칸과 걷는 길이 0.8초 하한을 쓴다(W5 라벨에 "낮은 스테이지 기준" 표시). world 360x560 21/21.

### perfScene 의 스테이지 사각형 기본값

`src/debug/perf/perfScene.ts` 는 `PANEL_HEIGHT` 를 그대로 가져다 쓴다. 07-18 이 `PANEL_HEIGHT` 를 88 에서 250(로비 패널 기본값)으로 바꿔 성능 측정 장면의 스테이지 사각형도 같이 줄었다. 캔버스 크기는 그대로라 fps 에는 영향이 없다고 보지만, 6페이즈 `06-PERF-RESULTS.md` 와 같은 조건으로 다시 재야 할 일이 생기면 이 값을 확인한다. 담당: 07-21(판정 때 필요하면).

## 07-19 에서 발견

### 테이블 화면(DayScene)의 가상 키보드 E2E 와 실기기 확인

- status: open
- 07-19 의 chat-keyboard 흐름은 로비만 본다(계획 범위). 테이블 화면은 단위 시험(클래스·변수·장면 자리 불변)까지만 초록이다. 올라온 패널이 테이블 아래 인물을 가리는 정도와 실제 키보드 배치는 알려진 한계(UI-SPEC)이고 07-21 실기기 확인(합격 검사 7)이 맡는다. 07-20 이 하네스를 정리할 때 chat-keyboard 를 DayScene 으로 넓힐지 정한다. **07-20 결정: 넓히지 않는다** — 테이블 틀은 8페이즈에서 삭제되고 알려진 한계(UI-SPEC)라 가짜 값으로 시험할 근거가 약하다. 07-21 실기기 확인(합격 검사 7)이 맡는다. status 는 그대로 open.

### 방 높이 px 고정과 #root min-height 100dvh

- status: open
- `.mf-room` 높이는 `--mf-room-h` px 로 고정되지만 `#root` 의 `min-height: 100dvh`(base.css)는 그대로다. 레이아웃 뷰포트가 키보드로 줄어드는 WebView(카카오톡 인앱 등)에서 `#root` 가 줄고 방 틀은 px 그대로라 문서가 스크롤될 수 있다. 가정 A1·UI-SPEC "검사 실패 때 내리는 순서" 3단계 후보이며 07-21 실기기에서 보일 때만 손댄다.

## 07-20 에서 발견

### 낮 시작 문구에 옛 직업 공개 문장이 남아 있음

- status: open
- `src/game/scenes.ts` 의 `PHASE_INTRO.dayAnnounce.sub`("토론 전에 먼저 직업을 공개해요")와 `PHASE_GUIDE_FILL.dayAnnounce.guide`("곧 직업 공개가 시작돼요")는 순차 주장(직업 공개) 단계가 7페이즈에서 없어졌는데 그대로다. E2E(`INTRO_SPEC.day`·`N8`)는 앱 문구를 그대로 따라 맞춰 두었다. 문구를 바꾸면 `scenes.test.ts`·`lib.mjs` `INTRO_SPEC`·`NIGHT_PANEL_TEXT` 계열 시험이 같이 바뀐다. 문구는 사용자 확인 사항이라 이 계획에서 고치지 않았다. 담당: 07-21 판정 때 사용자에게 문구 안을 묻는다(결정 0051 글 최소화 기준).

### E2E reconnect/offline RC1 이 병렬 부하에서 한 번 실패

- status: open
- 전체 실행(세 흐름 병렬) 중 한 번 `reconnect/offline RC1 콘솔 경고·오류 0건` 이 WebSocket "closed before the connection is established" 경고 5건으로 실패했다. 단독 3회·전체 재실행 2회는 35/35. 06-18 흐름의 병렬 부하 민감도로 보이며 07-20 의 변경과 무관하다. 재현되면 reconnect 를 단독으로 돌려 구분한다.

### gallery 의 citizen 역할

- status: open
- `node scripts/gallery.mjs <폴더> citizen` 은 시민에게 [활동 기록] 탭이 없어 `rolecard` 단계에서 실패하고 뒤 단계가 시트에 막혀 이어서 실패한다(기본값 police·mafia 는 통과). 07-20 이전부터 있던 동작이다. 필요하면 시민은 탭 선택을 건너뛰게 한다.
