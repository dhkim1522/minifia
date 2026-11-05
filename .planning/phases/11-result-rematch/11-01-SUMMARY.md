---
phase: 11-result-rematch
plan: "01"
subsystem: server-rules
tags: [phase-key, round, stats, leak, tdd]
requires: []
provides:
  - "phaseKey 세 부분 '{판}:{일차}:{단계}' 와 view.round, RoomState.round, roundOf"
  - "Player.stats {say, emote} 서버 전용 카운터와 shared/game/stats.ts bumpStat"
affects: [11-02, 11-03, 11-08]
tech-stack:
  added: []
  patterns: ["서버 전용 카운터는 room 키만 저장하고 방송하지 않는다", "단계 키는 shared 한 함수로만 만든다"]
key-files:
  created: [shared/game/stats.ts, test/worker/round.test.ts, test/worker/stats.test.ts, test/unit/stats.test.ts]
  modified: [shared/protocol.ts, shared/game/audience.ts, shared/game/room.ts, shared/game/view.ts, worker/room.ts, src/net/useChat.ts, src/screens/RoomScreen.tsx, src/components/WorldStage.tsx, scripts/smoke.mjs, scripts/bots.mjs, test/worker/helpers.ts, test/worker/leak.test.ts]
decisions:
  - "view.round 는 optional 타입이지만 서버는 항상 싣는다. 화면은 view.round ?? 1 (phaseKey 가 기본값 처리)"
  - "phaseKey 인자는 day·round 에 undefined 를 허용해 호출부가 view.day?.n, view.round 를 그대로 넘긴다"
metrics:
  duration: "약 25분"
  completed: 2026-11-05
status: complete
actuals:
  tokens: 18000
  tasks: 3
  commits: 6
plan_head_before: 969c4afd3bec9ef672284c0fc3b6946e279c34b7
plan_head_after: 04dda0e32f3ee02dcb1f9200ce803f770bc369e8
requirements-completed: [REMATCH-01, END-04]
---

# Phase 11 Plan 01: 판 번호와 판 통계 Summary

세 부분 단계 키 `{판}:{일차}:{단계}` 와 공개 `view.round`, 서버 전용 `Player.stats {say, emote}` 카운터(bumpStat)를 서버·화면·스크립트·시험에 한꺼번에 깔았다. 이전 판·옛 두 부분 키의 chat·typing·emote 는 모든 소켓에서 폐기된다(L41).

## 한 일

- Task 1 (트레이서): phaseKey/roundOf/view.round, 방 DO 네 비교 지점, 시험 도우미 phaseKeyOf. round.test.ts 가 L41 폐기(chat 은 chatReject why phase + state, typing·emote 는 보낸 소켓 포함 0프레임)를 고정.
- Task 2: useChat·RoomScreen·WorldStage 가 `view.round` 를 넘김(판만 바뀌어도 동작 정리). smoke·bots 외 uat-vote·uat-night·uat-day·perf-run 의 pkOf 도 같은 모양으로 갱신(`node --check` 통과). 손으로 만든 옛 키를 쓰던 시험 갱신.
- Task 3: stats.ts(STAT_PHASES, 순수 bumpStat), applyChat(all 채널 받아들인 줄 뒤, `await put("room")` 만), applyEmote(게이트 통과 뒤 동기 갱신 + `void put`). leak.test SERVER_ONLY_KEYS 에 "stats".

## 시험

- 전체 `npx vitest run`(Task 2 끝): 5599 통과, testTools 'ended' 1건은 알려진 flaky 로 단독 재실행 통과.
- Task 3 뒤: unit 전체 + 채팅·귓속말·누설·복원 워커 시험 102 파일 통과. typecheck 오류 없음.
- 웨이브 게이트(build·ui.safety-gate·schema-drift)는 지시에 따라 돌리지 않았다.

## Deviations from Plan

**1. [Rule 3 - Blocking] view.test.ts TOP_KEYS 에 "round" 추가** — 최상위 키 허용 목록(공개 키)이라 view.round 를 싣자 전수 누출 검사 두 곳이 실패. 금지 목록(leak.test)은 줄이지 않았고 허용은 round 한 키만 더했다.

**2. [Rule 3 - Blocking] 계획에 없던 옛 키 정리** — 계획 파일 목록 밖의 scripts(uat-vote·uat-night·uat-day·perf-run)와 시험(schemas·chatStore·useWillLetter·verdictScreen·gameMap·lobby·emoteTray·whisper·chatReplay·ballots·world·bots·chatLeak)이 손으로 옛 두 부분 키를 만들고 있어 같이 갱신. 거부 시험의 의도는 그대로(예: "1:9:night", "1:7:night").

**3. 화면 시험 리터럴** — RoomView.round 가 optional 이라 화면 시험 RoomView 리터럴은 바꿀 필요가 없었다.

## Known Stubs

없음.

## Threat Flags

없음 (T-11-01·02 는 round.test L41 과 leak.test "stats" 로 고정, T-11-03 은 nightload 에서 확인할 항목).

## 이월 메모

- `phaseKey({ phase, day?, round? })` — shared/game/audience.ts, 반환 `${round ?? 1}:${day ?? 0}:${phase}`. day·round 에 undefined 허용. 화면은 `phaseKey({ phase: view.phase, day: view.day?.n, round: view.round })`.
- `roundOf(state)` / `RoomState.round?: number` — shared/game/room.ts. 판 번호를 올리는 길은 만들지 않았다(11-08 이 다시 하기 리터럴에서 올리고 stats 를 버린다).
- `view.round` 는 buildView 가 항상 싣고 view.test TOP_KEYS 허용 목록에 "round" 가 들어 있다.
- `bumpStat(state, playerId, "say"|"emote")`, `STAT_PHASES` — shared/game/stats.ts(순수, 판 중 열 단계). `Player.stats?: {say, emote}` 는 서버 전용이고 11-02 칭호가 읽는다.
- 올리는 곳은 worker/room.ts applyChat(ch==="all" 뒤 `await put("room")`)·applyEmote(`void put("room")`)뿐. 봇도 같은 본체라 같이 센다. 결과 단계 채팅은 STAT_PHASES 밖이라 안 센다.
- 시험 도우미: `helpers.phaseKeyOf(sock)` 가 shared phaseKey 를 쓴다(손으로 키를 만들면 `1:${day ?? 0}:${phase}`). 저장소의 stats 는 `storedRoom(code).players[].stats`(타입에 없어 캐스팅, stats.test 의 statsOf 참고), emote 쪽 저장은 기다리지 않아 `until` 로 읽는다.
- 최종 계획 nightload 에서 확인: 채팅 줄마다 room 키 재저장 비용(T-11-03, 도배 제한이 상한).
- 알려진 flaky(testTools 'ended', bots, GH13 360x560)는 건드리지 않았다.

## Self-Check: PASSED

- 파일 존재: shared/game/stats.ts, test/worker/round.test.ts, test/worker/stats.test.ts, test/unit/stats.test.ts 확인.
- 커밋 6개 존재(e4022ca3, 7f37565e, c2df611c, 12199438, d2659862, 04dda0e3), HEAD 의 조상.
