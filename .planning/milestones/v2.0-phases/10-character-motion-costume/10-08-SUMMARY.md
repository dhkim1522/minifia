---
phase: 10-character-motion-costume
plan: "08"
subsystem: emote-phases
tags: [emote, audience, hold-pose, e2e, leak, tdd]
status: complete
requirements: [AVTR-05, AVTR-03]
requires:
  - phase: 10-01
    provides: "서버 emote 처리기, channelOf→audience(emote) 수신자, resetEmoteRates"
  - phase: 10-03
    provides: "WorldCharacter.playEmote/stopEmote, window.__mfEmotes 훅"
  - phase: 10-05
    provides: "동작 버튼·판, avatar.mjs makeAvatarFlows, 떠 있는 버튼 숨김 CSS"
  - phase: 10-07
    provides: "avatar.mjs 도우미 객체, FLOWS 등록 방식"
provides:
  - "단계 × 신분 동작 수신자 표(UI-SPEC A-6)를 구현과 독립으로 손으로 적은 기대표 단위 시험 + 이동이 막힌 실제 단계 워커 시험"
  - "지목 유지 자세(holdPose point) 위의 동작·끊김·해제와 위치·방향 불변 시험(캐릭터·런타임 두 층)"
  - "E2E avatar-phases / avatar-phases-night (390x844 한 크기)와 순수 검사 emoteDeliveryChecks·floatTrayChecks"
affects: [10-09]
tech-stack:
  added: []
  patterns: ["기대표는 Record<PhaseId,…> 로 적어 새 PhaseId 가 컴파일 시·실행 시(PHASE_DEFS 키 비교) 먼저 실패", "E2E 'absent' 검사는 받으면 안 되는 페이지를 도착 상한 동안 계속 훑어 한 번이라도 보이면 그 표본을 실패 근거로 쓴다"]
key-files:
  created:
    - test/unit/emotePhases.test.ts
    - test/worker/emotePhases.test.ts
  modified:
    - test/unit/character.test.ts
    - test/client/worldStage.test.tsx
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/avatar.mjs
    - scripts/e2e/flows.mjs
decisions:
  - "제품 코드(audience·서버 처리기·character·runtime)는 고치지 않았다 — 세 작업 모두 가드가 처음부터 통과, 제품 결함 없음"
  - "avatar-phases 는 한 판으로 AP5(방장이 마피아여야 함)에 닿지 않아 avatar-phases-night 로 나눴다(계획 허용). 유령 AP6 는 낮 흐름에서 처형된 방장으로 본다"
metrics:
  tasks: 3
  tasks_completed: 3
actuals:
  tokens: 11700
  tasks: 3
  commits: 4
plan_head_before: 6c667939f3b8132e2243dda8d3cfaf39273d95e2
plan_head_after: 1ae855673b7da5c5f40ed9a13c7b8fc1f6c3ab14
---

# Phase 10 Plan 08: 이동 막힌 구간·밤·유령의 동작 도착 확인 Summary

**단계 × 신분 동작 수신자 표를 구현과 독립으로 시험하고, 지목 유지 자세와 동작의 겹침을 고정하고, 두 E2E 흐름(낮 단계들·밤)으로 도착과 0건을 화면까지 확인했다.**

## Tasks

| Task | 이름 | 커밋 | 비고 |
| ---- | ---- | ---- | ---- |
| 1 | 수신자 표 단위 + 실제 방 워커 | 343c6ddb | 가드, 처음부터 통과 |
| 2 | 지목 유지 자세 위의 동작, 위치·방향 불변 | f7932bdb | 가드, 처음부터 통과 |
| 3 RED | emoteDeliveryChecks·floatTrayChecks 시험 | bcdc2f3d | import 실패로 RED |
| 3 GREEN | 순수 검사 구현 + E2E 두 흐름 | 1ae85567 | E2E 26/26 |

## 시험 결과

- Task 1: `test/unit/emotePhases.test.ts` 95개 · `test/worker/emotePhases.test.ts` 4개 · `test/unit/audience.test.ts` 통과. 단위는 PhaseId 14개 × 신분 여섯(산 시민·경찰·의사·마피아·탈락한 시민·탈락한 마피아, 로비는 산 사람 넷). `expectedEmoteRecipients` 는 audience.ts 를 읽지 않고 알 수 없는 단계는 던진다.
- 워커로 본 단계: nomination · defense(변론자 포함) · verdict · execution · 밤(마피아→시민·경찰·의사 0프레임, 탈락자→탈락자만) · morning · runoff(앞머리) · showdown(모이기). 결선·마지막 3인도 헬퍼로 닿아 단위 표로 갈음한 단계는 없다.
- Task 2: `test/unit/character.test.ts`(102) · `test/client/worldStage.test.tsx` 통과, `npm run typecheck` 오류 없음. 새 describe 이름에 AVTR-05 포함.
- Task 3: `node --test scripts/e2e/lib.test.mjs` 257/257 · `test/unit/e2eContract.test.ts` 30/30.
- E2E `npm run e2e -- --url http://localhost:5173 --only avatar-phases` (390x844, 로컬 dev, prefix 라 두 흐름이 함께 돈다): avatar-phases 19/19 · avatar-phases-night 7/7, 실패 0, 17~18초 (세 번 연속 통과).

## E2E 확인 내용

AP1 낮 토론 도착 + 떠 있는 버튼(.mf-float) 판 열림 중 hidden·닫으면 복귀(FT1~3) · AP2 지목에서 동작 도착과 채팅 한 줄 도착 · AP3 변론(변론자 방장의 동작)·찬반 도착 · AP4 처형 뒤 아침에 산 손님 동작이 유령 방장에게 도착 · AP5 밤 마피아 방장의 동작이 시민 편 손님에게 0건, 손님 밤 DOM 의 [data-emote-button]·[data-emote-tray]·[data-emote] 0개, 마피아 방장 자기 페이지에는 프레임 있음 · AP6 유령 방장의 동작이 산 손님에게 0건, 유령 자기 페이지에는 있음 · AP7 모든 표본(낮 12개 + 밤 2개)의 이름표 층에 [data-emote] 도 emote 가 든 속성도 0개.

## Deviations from Plan

**1. [Rule 3 - 흐름 결함] 동작 버튼 첫 누름이 키보드만 닫음.** 채팅을 보낸 뒤 입력칸에 초점이 남아 있으면 버튼이 판을 열지 않고 blur 만 한다(10-05 의 의도된 규칙, AE5). 흐름이 sendEmote 에서 초점을 뺀 뒤 누르도록 고쳤다. 제품 결함 아님. 파일: scripts/e2e/avatar.mjs.

**2. [Rule 1 - 흐름 결함] absent 검사가 동작이 끝난 뒤의 playing 을 읽음.** 보낸 사람 자기 페이지의 도착을 잡은 순간의 값을 쓰고, 받으면 안 되는 페이지는 도착 상한 동안 계속 훑도록 바꿨다(문턱은 그대로). 파일: scripts/e2e/avatar.mjs.

**3. 흐름을 둘로 나눔(계획 허용).** `avatar-phases`(AP1~4·6·7)와 `avatar-phases-night`(AP5·7), 둘 다 size 390x844. AP5 는 방장이 마피아이고 손님이 시민 편이어야 해서 손님이 마피아면 SetupError 로 새 방에서 다시 돈다.

**4. 단위 시험 범위 보정.** 계획의 "canMoveIn 이 거짓인 지도 단계마다 산 사람의 emote 수신자가 비어 있지 않다"는 밤 시민 편을 제외했다. 밤 시민 편은 이동도 동작도 막히는 설계(수신자 표 '버림', L27)라 따로 단언한다. AVATAR_MARKERS 는 새 표식이 없어 바꾸지 않았고 e2eContract 시험 갱신도 필요 없었다.

**5. 시험 도구 오류 정정.** 첫 emotePhases 단위 시험의 readonly 타입 오류와 유지 자세 기준선 시각(idle 숨쉬기 y 가 시각에 따라 달라짐)을 정정했다(제품 코드 아님).

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 면·스키마 없음(시험과 E2E 흐름만 추가).

## 이월 메모

- 최종 흐름 이름: `avatar-phases`, `avatar-phases-night` (둘 다 390x844 고정, 합쳐 약 17초). 마지막 계획 6종 회귀의 `--only` 묶음에는 `avatar-emote`, `avatar-dress`(폰 6종)와 함께 `avatar-phases`(prefix 라 night 도 같이 돈다)를 넣는다.
- 이 계획은 가드라 제품 코드를 건드리지 않았다. 수신자 표가 바뀌면 test/unit/emotePhases.test.ts 의 KIND 표와 `expectedEmoteRecipients` 를 먼저 고친다(새 PhaseId 는 컴파일 오류로 알려 준다).
- 플레이 뒤 판단 후보 O-12: 밤 시민 편 화면에 동작 버튼이 아예 없는 것(D-20)은 E2E 가 고정했다. 시민 편이 허전하다는 반응이 있으면 결정 필요.
- 실기기 이월: 지목 중 손가락 유지 자세 위의 동작 겹침 모양은 단위·런타임 시험만 있다(눈으로 본 확인 없음).
- 서버 간격 1초와 UI 비활성 시간 차이(10-05 이월)는 E2E 에서 GAP_MS(1200) 간격으로 피했다. 실제 사용자는 끝난 직후 1초 안에 누르면 침묵으로 버려진다.

## Self-Check: PASSED

- 생성 파일 test/unit/emotePhases.test.ts, test/worker/emotePhases.test.ts 존재 확인.
- 커밋 343c6ddb·f7932bdb·bcdc2f3d·1ae85567 이 HEAD 의 조상임을 확인.
