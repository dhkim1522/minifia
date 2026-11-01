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

### 채팅 줄 번호·전송 기록은 DO 메모리뿐 (가정 A1)

`chatLog`(채널별 seq)와 `chatRates`(D5 제한)는 DO 메모리에만 있어 하이버네이션·evict 로 비면 seq 가 1 로 돌아가고 제한이 한 번 느슨해진다. 07-14 가 같은 `appendLine` 결과에 저장·복원을 더한다. 그 전까지 줄 번호가 단계를 넘어 이어지는 시험은 evict 하지 않는 `advanceToKeep`(test/worker/helpers.ts)으로 넘긴다.
