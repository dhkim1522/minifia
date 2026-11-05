---
phase: 11-result-rematch
plan: "03"
subsystem: shared/game + worker
tags: [result-chat, resultLog, tdd, leak]
requires: [11-02]
provides: [ResultLogFrame, buildResultLog, ended all chat]
affects: [11-05, 11-07, 11-11]
tech-stack:
  added: []
  patterns: [ended 전용 분기(CHAT_PHASES 불변), 전환 감지 한 번 전송, hello 재전송, 청크 40줄 프레임 열]
key-files:
  created:
    - shared/game/resultLog.ts
    - test/unit/resultLog.test.ts
    - test/worker/endedChat.test.ts
    - test/worker/resultLog.test.ts
  modified:
    - shared/protocol.ts
    - shared/game/audience.ts
    - shared/game/view.ts
    - worker/room.ts
    - test/unit/audience.test.ts
    - test/unit/view.test.ts
    - test/worker/helpers.ts
    - test/worker/leak.test.ts
    - test/worker/endgame.test.ts
decisions:
  - "결과 단계 채팅은 channelOf·CHAT_PHASES 를 고치지 않고 audience(ended 분기)·applyChat·view.me.chat 세 곳에서만 all 로 연다."
  - "resultLog 는 afterTransition 끝(찬반·사망 카드 보관 뒤)에서 prev 가 ended 가 아니고 지금이 ended 일 때 한 번, 방 전원에게 같은 열로 보낸다."
status: complete
commits: 6
plan_head_before: 4f54afc4f6b7a5340fbefc94ec548ef07aff1f08
plan_head_after: f88b8dc1373590f6a20c840613539fe900bb1a40
actuals:
  tokens: 20000
  tasks: 3
  commits: 6
completed: 2026-11-05
requirements: [END-03]
---

# Phase 11 Plan 03: 결과 단계 채팅과 resultLog 공개 Summary

ended 에서 모두가 all 채널 한 줄을 보내고 받으며, 판이 ended 로 들어서는 순간 마피아·유령 채팅, 귓속말 본문, 직업 주장 이력, 찬반 기록이 신분 구분 없이 같은 프레임 열로 한 번 공개되고(재접속하면 다시 받는다) 판 중에는 한 바이트도 새지 않는다.

## 한 일

- Task 1 (tracer): `audience` 에 ended 분기(chat/all 만 방 전원, 나머지 빈 집합), `view.me.chat` 이 ended 에서 all, `applyChat` 이 ended 에서 all. channelOf·CHAT_PHASES 는 그대로여서 동작·입력 중 버림 표가 유지된다. 결과 단계 줄은 통계 say 를 올리지 않는다(시험).
- Task 2: `ResultLogFrame`(protocol), `buildResultLog`(순수), 방 DO 의 `emitResultLog`(afterTransition 끝)와 hello 재전송(ended 일 때만, chatLog 다음). 마스크 없이 채널 전체·`whispers` 원본·모든 사람의 `badgeLog`·ballots 카드 파싱.
- Task 3: leak.test 6명 판에 판 중 resultLog 0건·ended 뒤 키 집합 고정·직업 단어 경로 ended 전용 집합·다섯 부분 순서 단언, `badgeLog`·`whispers` 를 서버 전용 이름에 추가. resultLog.test 에 시민에게 마피아·유령 줄 0건, 귓속말 본문 당사자 밖 0건, 판 중 hello 0건, 끝난 뒤 여섯 소켓 모두 수신.
- 제품 코드는 Task 1·2 에서 끝났고 Task 3 시험이 새 결함을 찾지 않았다.

## 시험

- 단위: audience(ended), view(me.chat ended), resultLog 13건. 워커: endedChat 4건, resultLog 8건(전송 4 + 누설 4), leak 12건(6명 판에 L35·L36 단언 추가), endgame·awards·ghostLeak·trial·reconnect·round·stats·emote·chat 통과. typecheck 통과.
- 웨이브 게이트(전체 회귀·build·nightload)는 지시대로 돌리지 않았다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 계약 변경에 따른 옛 기대 수정] ended 가 닫혀 있다는 옛 시험 기대**
- **Found during:** Task 1·2
- **Issue:** `test/unit/audience.test.ts` SILENT_PHASES 의 ended chat all 빈 집합, `test/unit/view.test.ts` 의 ended 키 없음, `test/worker/endgame.test.ts` 의 ended chat 거절(chatReject)은 D-11 이전 계약이다.
- **Fix:** ended 를 해당 표에서 빼고 새 기대를 따로 썼다(audience: chat all 만 전원, view: 모두 all, endgame: 네 소켓 `[chat]`). 거절 규칙(verdict·say·testSkip)과 emote·typing 버림은 그대로 단언한다. 임계값·허용 목록을 넓히지 않았다.
- **Files modified:** test/unit/audience.test.ts, test/unit/view.test.ts, test/worker/endgame.test.ts
- **Commit:** ab5de3a5, 311bc238, f88b8dc1

**2. [Rule 1 - 시험 안정화] endgame 종료 중 시험이 ended 직후 늦게 오는 resultLog 를 chat 창으로 읽음**
- **Fix:** 보내기 전에 모든 소켓을 flush 한다(f88b8dc1).

**3. [허용 경로] leak.test 직업 단어 검사가 `.part` 값 "mafia" 를 잡음**
- **Issue:** 부분 이름 `mafia` 가 직업 단어와 겹친다.
- **Fix:** ended 전용 집합 `RESULT_LOG_ROLE_PATHS = {.lines[].v, .part}` 로만 허용하고, 같은 시험이 판 중 프레임에는 resultLog 문자열 자체가 0건임을 단언한다.

## Known Stubs

None.

## Threat Flags

None (새 프레임은 ended 전용이고 위협 표 T-11-07~09 의 완화가 시험으로 닫혔다).

## 이월 메모

- 프레임 타입은 shared/protocol.ts: `ResultLogFrame`(= `{t:"resultLog", part, i, end, lines}` 부분별 유니온), 줄 `ResultLogChatLine{seat,n,text,at}`(mafia·ghost), `ResultLogWhisperLine{seat,to,n,text,at}`, `ResultLogClaimLine{seat,n,v:BadgeId}`, `ResultLogBallotsLine{n,yes,no}`, `ResultLogPart`. 만드는 곳은 shared/game/resultLog.ts `buildResultLog(state, chatLog)`, `RESULT_LOG_CHUNK = 40`.
- 순서는 mafia → ghost → whisper → claim → ballots, 부분마다 줄이 없어도 `{i:0,end:true,lines:[]}` 한 프레임. 화면은 `end` 가 오면 그 부분이 끝났다고 본다. 신분별 차이 없음.
- 클라이언트 `parseServerMessage`(src/net/useRoomConnection.ts)는 아직 resultLog 를 모른다(조용히 버림). 11-05·11-07 이 허용 목록과 `RoomEvent` 에 더한다.
- 결과 단계 입력줄은 `view.me.chat === "all"` 로 판단한다(ended 에서 모든 사람에게 실린다). channelOf 는 ended 에서 null 그대로다.
- typing·emote 는 ended 에서 서버가 버리므로 클라이언트가 보내지 않아야 한다(보내도 0프레임). 단계 키는 `1:{일차}:ended`(phaseKey).
- mafia 줄의 n 은 그 밤을 부르는 일차(구분선 '{n}밤'), claim 은 n 오름차순 → 좌석 순이다. 하이버네이션 뒤 hello 도 저장소에서 복원한 chatLog 로 같은 열을 보낸다.
- 허용 경로 추가분: 프레임 키 `t,part,i,end,lines`, 줄 키는 부분별 고정, 직업 단어는 `.lines[].v`(claim)·`.part` 에서만(ended 전용). 서버 전용 이름에 `badgeLog`·`whispers` 추가.
- 시험 도우미 `richEndedGame6()`·`endedGame4()`·`RICH_TEXT`(test/worker/helpers.ts)가 있다. bots 'mafia 봇의 줄' 시험이 묶음 실행에서 한 번 흔들렸고 단독 재실행에서 통과했다.

## Self-Check: PASSED

- 파일 존재: shared/game/resultLog.ts, test/unit/resultLog.test.ts, test/worker/endedChat.test.ts, test/worker/resultLog.test.ts 확인.
- 커밋 6개(ab5de3a5, 311bc238, a82f8ff4, 2de1537f, 47f6a0b5, f88b8dc1) 존재, HEAD 의 조상.
