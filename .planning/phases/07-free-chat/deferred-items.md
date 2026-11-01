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
