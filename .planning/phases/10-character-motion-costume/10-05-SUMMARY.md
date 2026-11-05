---
phase: 10-character-motion-costume
plan: "05"
subsystem: chat-ui
tags: [emote, chat-panel, tray, e2e, a11y]
status: complete
requirements: [AVTR-03]
requires:
  - phase: 10-01
    provides: "{t:emote,id,pk} 전송 규칙, 서버가 걷는 중·앞 동작 중 emote 를 조용히 버림"
  - phase: 10-03
    provides: "WorldStore.onEmote, window.__mfEmotes 훅, 캐릭터 동작 재생"
provides:
  - "입력줄 맨 앞 동작 버튼(face)과 5+4 아이콘 판 → emote 메시지 한 번, 판은 즉시 닫힘"
  - "걷는 중·내 동작 재생 중·끊김에서 칸이 조용히 비활성(알림 없음), 닫기 네 가지·키보드 열림 규칙·초점·화살표키"
  - "useMyMotion(moving·emoting), V2Icon 아홉 개, E2E avatar-emote 와 emoteTrayChecks·AVATAR_MARKERS"
affects: [10-06, 10-07, 10-08, 10-09]
tech-stack:
  added: []
  patterns: ["ChatPanel 슬롯(emotes·onEmote·emoteBlocked·emotePlaying)을 useChat 바인딩이 채워 Lobby·GameMap 이 코드 변경 없이 받음", "E2E 흐름 본문은 avatar.mjs 에 makeAvatarFlows(helpers)"]
key-files:
  created:
    - src/components/v2/EmoteTray.tsx
    - src/net/useMyMotion.ts
    - scripts/e2e/avatar.mjs
    - test/client/emoteTray.test.tsx
    - test/client/useMyMotion.test.tsx
  modified:
    - src/components/v2/ChatPanel.tsx
    - src/components/v2/V2Icon.tsx
    - src/game/chatText.ts
    - src/net/useChat.ts
    - src/screens/Lobby.tsx
    - src/screens/GameMap.tsx
    - src/styles/v2.css
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/flows.mjs
    - test/unit/e2eContract.test.ts
    - test/client/icon.test.tsx
    - test/client/lobby.test.tsx
decisions:
  - "판 칸 폭은 판 폭 − 32 기준 격자 계산으로 360 에서 약 55.6 이다(계약 본문의 59.2 는 계산식과 어긋남). 누르기 영역 하한 44(EP3)는 지킨다"
  - "비활성 판단은 서버 EMOTE_MS 와 구간 끝 시각을 따르고, 서버 간격(1초)은 화면이 추정하지 않는다 — 간격 안의 누름은 서버가 조용히 버린다(L30)"
metrics:
  tasks: 3
  tasks_completed: 3
actuals:
  tokens: 22000
  tasks: 3
  commits: 7
plan_head_before: 51d6df44b93e88cc2e99d87399f81b35e40f416f
plan_head_after: d164646000554c987071b4f3866878bcfa9b609e
---

# Phase 10 Plan 05: 동작 고르기 화면 Summary

입력줄 왼쪽 동작 버튼에서 5+4 아이콘 판을 열어 칸 하나를 누르면 `{t:"emote",id,pk}` 만 서버로 가고 판이 닫히며, 걷는 중·내 동작 재생 중·끊김에서는 칸이 알림 없이 비활성이 된다. E2E avatar-emote 가 폰 2종에서 통과했다.

## 한 일

- **Task 1 (트레이서)**: V2Icon 에 face·throat·deny·clap·cry·handshake·praise·surprise·dance(승인 bundle.js 데이터 그대로), `EMOTE_TRAY_ORDER`·`EMOTE_SHORT`·`EMOTE_TEXT`(chatText.ts 고정 표), `EmoteTray`, ChatPanel `emotes`·`onEmote` 슬롯(버튼은 `emotes`·`onEmote`·`onSend` 가 모두 있을 때만 DOM 에 생김), `useChat` 의 `emotes`·`onEmote`(연결이 열려 있을 때만 send, 낙관적 재생 없음). CSS 는 토큰만, 새 토큰·hex 없음.
- **Task 2**: `useMyMotion(store, seat, serverNow)` → `{moving, emoting}` (구간 끝·EMOTE_MS 타이머, 이동 시작 시 emoting null). `useChat({ motion })` 가 `emoteBlocked`·`emotePlaying` 을 반환, ChatPanel 이 칸을 aria-disabled/is-playing 으로 그림. 닫기(버튼 다시·바깥 pointerdown·Esc·선택) + 초점 복귀, 입력칸 포커스 중 첫 누름은 blur 만, 첫 칸 초점, 화살표키(±1·±5, 끝에서 멈춤). `body:has([data-emote-tray]) .mf-float { visibility: hidden }`.
- **Task 3**: `emoteTrayChecks`(EB1·EP2·TR1~TR5·EP3·EP4)와 `AVATAR_MARKERS`, E2E `avatar-emote`(`scripts/e2e/avatar.mjs`, FLOWS 에 extraSizes 로 등록), 표식 계약 시험.

## 검증

- `npx vitest run test/client/emoteTray.test.tsx test/client/useMyMotion.test.tsx test/client/icon.test.tsx test/client/chatPanel.test.tsx test/client/useChat.test.tsx test/client/lobby.test.tsx test/client/gameMap.test.tsx test/unit/e2eContract.test.ts` : 8개 파일 349개 통과
- `node --test scripts/e2e/lib.test.mjs` : 239 통과 / 실패 0
- `npm run typecheck` 오류 없음
- `npm run e2e -- --only avatar-emote --sizes 360x560,430x932` (로컬 개발 서버 포트 5199): **360x560 통과 36 / 실패 0, 430x932 통과 36 / 실패 0** (방장·손님 두 페이지 기하 EB1~TR5 전부, 박수 도착 AE2, 연타 무시 AE3, 걷는 중 비활성·걸음 끝 풀림 AE4, 키보드 규칙·Esc AE5). 개발 서버는 끝낸 뒤 껐다.
- 계획의 웨이브 게이트(build·전체 vitest·ui.safety-gate·schema-drift)는 지시에 따라 돌리지 않았다.

## Deviations from Plan

**1. [Rule 1 - Bug] 기존 시험의 패널 버튼 수 선택자**
- **Found during:** Task 2
- **Issue:** `test/client/lobby.test.tsx` 가 `.mf-lobby__panel button:not([data-chat-send])` 로 행동 줄 버튼 수를 세는데 동작 버튼이 하나 더 잡혀 4개가 실패.
- **Fix:** 선택자에 `:not([data-emote-button])` 를 더하고 주석을 갱신(계획 files 목록 밖의 시험 파일 한 개).
- **Commit:** 3eefab59

**2. [계획 계약 불일치] 칸 폭**
- 계약 본문은 "칸 폭 = (판 폭 − 16 − 32)/5 → 360 에서 59.2" 라 했으나 그 식은 56, 59.2 는 (328 − 32)/5 와 같아 안쪽 8 을 빼지 않은 값이다. "안쪽 8, 칸 사이 8, 판 폭 = 폰 폭 − 32"를 지켜 격자(10열, 칸 2열 폭)로 만들었고 칸은 360 에서 55.6x56 이다. must_haves 의 "59×56 이상"은 이 때문에 달성하지 않았다. 판정 문턱 EP3(≥ 44)는 통과. 사용자 결정이 필요하면 가로 안쪽 여백을 줄여야 한다.

**3. [기록] 테스트 상태**
- `test/client/ghostView.test.tsx` 2개가 `runtimeRef.current?.stopAllEmotes is not a function` (WorldStage 10-03 변경 + 그 시험의 가짜 런타임)로 실패한다. 이 계획이 건드리지 않은 곳이고 계획의 시험 목록 밖이라 고치지 않았다(deferred).

그 밖에는 계획대로 실행했다. 인증 문 없음.

## Known Stubs

없음.

## Threat Flags

없음. 새 전송은 고정 enum id + 단계 키뿐이고 위협 모델(T-10-16~18)이 다룬다.

## 커밋 (이 계획 7개, 사이에 10-04 커밋 섞임)

cf173cd(RED) · fe0297b(GREEN) · 9bc6c58(RED) · 3eefab5(GREEN) · e80cf1d(RED) · 95b123e(GREEN) · d164646(GREEN). 프런트매터 `commits` 는 이 계획 커밋 7개를 grep 으로 센 값이다(원장 `plan_head_before..HEAD` 는 병행 실행된 10-04 커밋 6개가 섞여 13).

## 이월 메모

- 셀렉터: `[data-emote-button]`(aria-expanded·aria-pressed, 끊김일 때만 aria-disabled) · `[data-emote-tray]`(role=group, 이름 "동작") · 칸 `[data-emote="{id}"]`(aria-disabled / `.is-playing`) · 칸 이름 `.mv-emote-tray__name` · 입력줄 `.mv-chat__form`. 훅은 `window.__mfEmotes` 만 읽는다.
- ChatPanel 슬롯: `emotes`·`onEmote`·`emoteBlocked`·`emotePlaying`. 값은 `useChat({ motion })` 가 채운다. 밤 시민 편은 GamePanel 이 ChatPanel 을 안 그려 버튼이 없다(O-12 판단은 플레이 뒤).
- avatar.mjs: `makeAvatarFlows({ recorder, startHost, openGuest, attempt, walkableCentersOfApp, LOBBY_HOST_NICK, WORLD_GUEST_NICK })` → `{ avatarEmoteFlow }`. 모듈 도우미 `readEmoteUi(page, seat)`·`readEmotes(page)`·`until(fn, ms)`·`openTray`/`closeTray`/`waitUnblocked`(끝나면 판 닫힘). 10-07·10-08 은 같은 객체에 도우미를 더하고 흐름을 같은 파일에 더한다.
- 떠 있는 버튼 숨김(`body:has([data-emote-tray]) .mf-float`)의 E2E 확인은 이 흐름이 로비라 하지 않았다 — 10-08 몫.
- AVATAR_MARKERS(`lib.mjs`)에 의상 표식(10-07)을 더하고 e2eContract 의 `toBe(4)` 를 함께 고친다. lib.test.mjs 의 extraSizes 계약 목록에는 avatar-emote 가 들어 있다(avatar-dress·avatar-phases 도 extraSizes 를 쓰면 목록에 더할 것).
- 서버 간격(1초)은 화면이 모른다: 동작이 끝난 직후 1초 안에 누르면 칸은 풀려 있지만 서버가 버린다(침묵). 필요하면 UI 비활성 시간을 EMOTE_MS + 간격으로 늘리는 결정이 필요하다.
- 칸 폭 55.6(위 Deviations 2). `ghostView.test.tsx` 의 가짜 런타임에 `stopAllEmotes` 추가가 필요하다(10-03 후속).

## Self-Check: PASSED

- 생성 파일 5개(EmoteTray.tsx, useMyMotion.ts, avatar.mjs, emoteTray.test.tsx, useMyMotion.test.tsx) 존재 확인.
- 커밋 cf173cd·fe0297b·9bc6c58·3eefab5·e80cf1d·95b123e·d164646 가 HEAD 의 조상임을 확인.
