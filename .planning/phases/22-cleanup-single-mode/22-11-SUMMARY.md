---
phase: 22-cleanup-single-mode
plan: "11"
subsystem: will-phase
tags: [defense-to-will, final-early-finish, chat-lock, will-sheet, spotlight-pin, copy]
requires: [22-10]
provides:
  - "defense id 는 처형자의 10초 유언 단계다(DEFENSE_MS = 10_000). saveWill 은 이 단계에서 처형자(verdict.candidate)만 받고 다른 산 사람은 WRONG_PHASE, 후보가 없으면 아무도 못 쓴다(D-15·D-16, T-22-22)."
  - "와이어 will 메시지의 선택 필드 final?: true(z.literal(true).optional(), strictObject). 처형자의 final 은 worker applyWill 에서 간격 검사보다 먼저 저장하고 tick({...,phaseEndsAt: now}) → afterTransition 으로 처형 단계에 들어간다(처형 진입·사망 카드·방송·알람 한 길). 처형자가 아니면 final 을 무시하고 일반 저장 경로의 같은 응답이다(T-22-21, 오라클 없음)."
  - "CHAT_PHASES 에서 defense 를 뺐다 — channelOf 가 산 사람·유령 모두 null. 채팅뿐 아니라 동작(emote)·입력 중도 서버가 받지 않고 view.me.chat 키도 없다(조용히 지켜본다, T-22-23)."
  - "처형자 봇은 BOT_DEFENSE_LINES 하나를 {t:'will', text, final:true} 로 낸다(난수 호출 randInt(3)→randInt(4000) 그대로, typing 없음)."
  - "WillSheet 새 선택 prop saveLabel·savedLabel·secondsLeft + 저장 단추 data-will-save, 남은 초 .mv-will__secs(aria-hidden, data-tone=timerTone, 5초 이하 crimson-400). prop 이 없으면 밤 유언·쪽지는 지금 모양."
  - "useWill: 처형자·defense 에서 시트 자동 열림(단계 마감 시각마다 한 번, [닫기] 뒤 다시 열리지 않음), [남기기]=final 전송 후 즉시 '남김' 비활성(대기 표시 없음), 입력 변화 600ms 디바운스 자동 저장 + 마감 700ms 전 한 번 더(같은 글은 다시 보내지 않음). willAllowed 는 defense 에서 처형자만."
  - "ChatPanel locked(data-chat-locked): 입력칸 disabled·aria-disabled·안내 글자 없음·night-700 면 불투명도 .45, [보내기]·동작 버튼 없음, 기록 칸·높이 그대로. GamePanel 은 defense 에서 locked 를 켜고 깃펜은 처형자에게만 둔다(접은 시트를 다시 여는 [유언] 단추, callTargetsOf defense.act 가 시트 닫힘일 때만 빛남 — P22-17)."
  - "GameMap: 처형자 시트가 아래 패널을 대신한다(veiled 강제). 남은 초 시계(useCountdown)는 DefenseAwareWillSheet 안에 가둔다. pinOf defense → {mode:'turn', seat: day.candidate}(조기 종료로 마감이 당겨져 fixed 창이 아님), 이름표에는 득표 배지·도장 없음."
  - "문구: 띠 defense.act '마지막 한마디'·wait '마지막 한마디를 들어요'·ghost '지켜봐 주세요', 헤더 제목 '유언'(안내 줄 없음), aria-live '유언', TestTools 라벨 '유언'. 변론 득표 hot 줄(defenseLine·runoffDefenseLine)·변론 안내(defenseHint*)·defenderVotes·defenseAnnounce 삭제."
affects: [22-12, 22-13]
key-files:
  created: []
  modified:
    - shared/game/phases.ts
    - shared/game/will.ts
    - shared/game/audience.ts
    - shared/game/bots.ts
    - shared/protocol.ts
    - shared/schemas.ts
    - worker/room.ts
    - src/components/v2/WillSheet.tsx
    - src/components/v2/ChatPanel.tsx
    - src/net/useWill.ts
    - src/screens/GameMap.tsx
    - src/screens/GamePanel.tsx
    - src/screens/RoomScreen.tsx
    - src/world/pinPlan.ts
    - src/game/hostLine.ts
    - src/game/dayView.ts
    - src/game/verdict.ts
    - src/components/TestTools.tsx
    - src/styles/v2.css
    - scripts/smoke.mjs
    - test/unit/will.test.ts
    - test/unit/audience.test.ts
    - test/unit/bots.test.ts
    - test/unit/phases.test.ts
    - test/unit/tick.test.ts
    - test/unit/view.test.ts
    - test/unit/emotePhases.test.ts
    - test/unit/pinPlan.test.ts
    - test/unit/hostLine.test.ts
    - test/unit/dayView.test.ts
    - test/unit/e2eContract.test.ts
    - test/unit/verdict.test.ts
    - test/worker/will.test.ts
    - test/worker/bots.test.ts
    - test/worker/chat.test.ts
    - test/worker/trial.test.ts
    - test/worker/world.test.ts
    - test/worker/emotePhases.test.ts
    - test/client/willSheet.test.tsx
    - test/client/willFlow.test.tsx
    - test/client/callGlow.test.tsx
    - test/client/ghostView.test.tsx
    - test/client/nightChat.test.tsx
    - test/client/v2parts.test.tsx
    - test/client/verdictScreen.test.tsx
    - test/client/gameMap.test.tsx
decisions:
  - "채팅 잠금을 CHAT_PHASES 에서 defense 를 빼는 것으로 했다(계획 선택). channelOf 한 곳이 채팅·동작·입력 중을 모두 정하므로 유언 단계에서는 몸동작도 서버가 버린다. UI-SPEC P22-9 는 입력줄만 비활성이라 적었지만 몸동작을 따로 살리라는 말이 없고 D-16 이 '조용한 순간'이라 같은 결과로 읽었다. 몸동작을 이 10초에 살리려면 audience 에 emote 만 허용하는 분기가 필요하다(사용자 결정 거리)."
  - "ChatPanel 입력줄을 잠글 때 동작 버튼도 그리지 않는다(서버가 버리는 입력을 보이지 않는다). 깃펜은 처형자에게만 있다."
  - "[남기기] 뒤 시트는 '남김' 비활성으로 남고 단계가 넘어가 처형자가 죽으면(willAllowed 거짓) 시트가 닫힌다. 응답 대기·실패 알림은 만들지 않는다. 자동 저장도 대기(pending)를 만들지 않아 조용하다."
  - "bots.ts 처형자 봇의 will 에는 typing 을 붙이지 않는다(유언·쪽지에 typing 을 안 붙이는 기존 규칙 WILL-01). 난수 호출 수·순서는 그대로라 시드 고정 값은 변하지 않는다."
metrics:
  tasks: 3
  files-touched: 46
status: complete
actuals:
  tokens: 120000
  tasks: 3
  commits: 7
plan_head_before: 16262a5d0db9c3b494149cd3dcddc2c84b99a4b2
plan_head_after: 6558719a758eb953654efefb900e5e7b2f93d8e1
commits: 7
---

# Phase 22 Plan 11: 유언 단계 Summary

최후 변론을 지우고 defense 단계를 처형자의 10초 유언 단계로 바꿨다. 서버(처형자만 쓰기·[남기기] 조기 종료·채팅 잠금·봇 유언)와 화면(시트 자동 열림·남은 초·[남기기]·자동 저장·나머지 입력 잠금·스포트라이트 핀·문구)을 함께 했다. 성공 기준 4 의 앞부분(처형자는 10초 안에 미리 쓴 글로 유언을 남기고 최후 변론은 없다)이 선다. 처형 단계의 유언 공개 카드와 시간표는 22-12 몫이다.

`commits: 7` 은 `git rev-list --count` 로 잰 값이다. 이 구간에는 이 계획의 커밋 6개와 다른 곳에서 들어온 `7fa43ff1`(docs: 결정 0089-26, `.planning/ROADMAP.md`·`docs/decisions/0089-...md`)이 한 개 섞여 있다. 이 계획의 커밋은 6개다.

## 커밋

| 작업 | 종류 | 커밋 | 내용 |
|------|------|------|------|
| 1 RED | test | f9a6582b | 처형자만 저장·final·채팅 잠금·봇 will 단언 — unit 7건 + worker 6건 실패 |
| 1 GREEN | feat | dab599a1 | DEFENSE_MS 10초, saveWill 처형자 전용, final 조기 종료, CHAT_PHASES 제외, 봇 will(final) |
| 2 RED | test | 76590086 | 시트·자동 열림·[남기기]·자동 저장·잠금·핀 단언 — client 14건 + unit 1건 실패 |
| 2 GREEN | feat | 18e507fe | WillSheet·useWill·ChatPanel locked·GamePanel·GameMap·pinPlan |
| 3 RED | test | 48ba0930 | 띠 세 문장·헤더 '유언'·변론·해명 글 없음·smoke 사본 단언 — unit 11건 실패 |
| 3 GREEN | feat | 6558719a | 문구·변론 줄/안내/득표 배지 삭제·aria-live·smoke 사본 |

## 검증 결과 (실제로 돌린 것)

- RED 증거(작업별 위 표): 구현 전에 각 묶음의 새 단언이 실패하는 것을 확인했다.
- `npx vitest run test/unit/will.test.ts test/unit/audience.test.ts test/worker/will.test.ts test/worker/bots.test.ts` + `npx tsc -p tsconfig.worker.json --noEmit`: 통과(작업 1).
- `npx vitest run test/client/willSheet.test.tsx test/client/willFlow.test.tsx test/client/willLetter.test.tsx test/client/useWillLetter.test.tsx test/unit/pinPlan.test.ts test/client/chatPanel.test.tsx` + `npm run typecheck`: 통과(작업 2, 전체 client·unit 도 초록).
- 최종 `npx vitest run` 전체: 7561 중 7322 통과·238 건너뜀·실패 1(`waitHelpers`, 간헐 부하 실패 — 단독 재실행 6/6 통과). 직전 전체 실행에서는 `bots`(밤 봇 채팅·누출) 한 건이 실패했고 `bots.test.ts` 단독 반복에서 통과·실패가 섞여 나왔다. 실패 모양은 `TypeError: Cannot read properties of undefined (reading 'id')`로 무작위 역할 배정에 기댄 시험의 간헐 실패(알려진 부하 불안정군)로 보고 회귀로 세지 않았다. 이 계획이 바꾼 유언 단계 시험(`bots.test.ts` 의 defense 봇 유언)은 매번 통과했다.
- `npm run typecheck`(tokens:check·wrangler types·app tsc·worker tsc): 오류 0.
- `node --test scripts/*.test.mjs`: 87/87, `node --test scripts/e2e/*.test.mjs`: 525/525.
- 계획 인수 grep: `DEFENSE_MS = 10_000`(phases.ts)=1, schemas.ts `final`=2, CHAT_PHASES 안 `"defense"`=0, WillSheet `secondsLeft`=5·`data-will-save`=1, `data-chat-locked`(src)=1, pinPlan `"defense"`=1, `"마지막 한마디"`(hostLine)=1, smoke `DEFENSE_MS = 10_000`=1, src 의 "최후 변론|변론을|해명할"=0.
- 인수 기준 `grep -c "phaseEndsAt: now" worker/room.ts >= 5`는 계획의 기준 값이 틀렸다(HEAD 에서 이미 1줄이었고 `-c` 는 줄 수라 지금 2). 의도(final 이 같은 tick+afterTransition 길을 쓴다)는 코드와 worker 시험으로 확인했다.
- 원격 레포 위생 grep(커밋 전 규칙 패턴): 변경 파일 전부 결과 없음.

## Deviations from Plan

### 자동 수정·추가

**1. [Rule 3 - Blocking] 변론을 전제로 한 기존 시험·기대값 갱신**
- 이유: 서버 규칙 변경(DEFENSE_MS 10초·defense 채팅 잠금·와이어)으로 옛 변론 가정 시험이 실패한다. 의도된 변경이라 시험을 새 규칙으로 고쳤다.
- 고친 것: `phases.test`·`tick.test`(길이 10초·구간 25.6초), `view.test`(phaseDurationMs defense 10000·me.chat 키 없음), `emotePhases` unit·worker(defense 는 조용한 단계), `chat.test`·`trial.test`·`world.test`(변론 채팅 허용 → 잠금), `bots.test` unit·worker(chat → will(final)), client 6개(callGlow·ghostView·nightChat·v2parts·verdictScreen·gameMap), `verdict.test`(defenseAnnounce 삭제).
- 커밋: dab599a1·18e507fe·6558719a.

**2. [Rule 1 - 계약] 몸동작도 유언 단계에서 버려진다**
- channelOf 한 곳이 채팅·동작·입력 중을 정하므로 CHAT_PHASES 에서 defense 를 빼면 몸동작도 서버가 받지 않는다(emotePhases 시험을 silent 로 갱신). UI-SPEC 은 이 점을 따로 적지 않았다. 아래 "사용자 결정 거리"에 올린다.

**3. [Rule 3] 계획 files_modified 밖 파일**
- `src/components/TestTools.tsx`(방장 도구 단계 라벨 "최후 변론"→"유언"), `src/game/verdict.ts`(defenseAnnounce 삭제), `src/styles/v2.css`(남은 초·잠긴 입력 규칙), `test/unit/verdict.test.ts`·`phases.test`·`tick.test`·`view.test`·`emotePhases`(위 1번), `test/worker/chat·world·trial·emotePhases`(위 1번), `test/client/callGlow·ghostView·nightChat·v2parts`.
- v2parts 의 진홍 범위 검사에 `.mv-will__secs[data-tone=urgent]` 를 시간 신호 예외로 추가했고(UI-SPEC P22-8, 기존 `.mv-ring.is-urgent` 와 같은 처리) willSheet 의 `.mv-will` 진홍 검사에도 같은 예외 한 줄을 뒀다.

## 22-10 이월 처리

- **`sure`/`SureStamp`/`VoteBadge`/`HeadStack` lead 배관**: 유언 단계 이름표에는 득표 배지·유력 도장을 달지 않기로 해(UI-SPEC D "득표 표시 없음") GameMap 의 defense 분기(`{count, sure:true}`)와 `defenderVotes` 를 지웠다. 그 결과 `sure` 를 넘기는 호출부가 GameMap 에서 사라졌다. 그러나 `SureStamp`·`HeadStack` 의 `sure`/`sureLabel`/`lead` prop·`.mv-badge.is-lead`·`WorldStage` 의 `extra.sure/lead`·`dayView.pointsTally.leader/sure`·tagOrder 의 `lead`·runtime 의 `data-lead` 는 부품·시험(v2parts·worldStage·voteParts·runoffScreen·nominationScreen·nightMap)과 얽혀 있고 `pointsTally` 는 SceneCurtain·presence 가 아직 읽는다. 이 계획에서 건드리면 범위가 넓어져 **22-13(죽은 코드 정리)로 넘긴다**: 호출부 0 으로 확인된 `SureStamp`·`sure`·`lead` 배관과 이를 가리키는 시험을 함께 지울 것.
- **변론·처형 화면 문구/시각**: `defenseHint`·`defenseHintSelf`·`defenseLine`·`runoffDefenseLine`·`defenderVotes` 는 삭제했다. 처형 단계의 "찬성 n · 반대 m" hot 줄·알림(`tallyText`)과 `executedText`·처형 시간표는 22-12 몫이라 그대로 뒀다.
- **UI-SPEC P22-3(찬반 때 장면: 토론 그대로)**: 시도했으나 **되돌리고 22-13 으로 넘긴다**. 바꿀 곳은 `src/world/presence.ts`(`FIXED_PHASES` 에서 verdict 제거 → follow 카메라, `lightingOf` verdict → talk)와 `src/game/scenes.ts`(PHASE_SCENE verdict → "day")뿐이지만 헤더 시간대 낱말(todOf = lightingOf 파생 → "낮")까지 같이 움직여 시험이 한꺼번에 15건 깨진다: `test/unit/presence.test.ts`(카메라·조명 5건)·`scenes.test.ts`(PHASE_SCENE·dusk 단계 목록·EXPECTED_SCENE 3건)·`timeOfDay.test.ts`(2건)·`e2eContract.test.ts`(TOD_BY_PHASE)·`test/client/atmosphere.test.tsx`·`gameMap.test.tsx`(시간대 표)·`ghostView.test.tsx`(카메라)·`verdictScreen.test.tsx`(조명 vote)와 `scripts/e2e/lib.mjs` 의 EXPECTED_SCENE·TOD_BY_PHASE 사본. 한 번에 고쳐야 일관되므로 22-13 의 장면·e2e 사본 정리와 같이 한다.
- **22-09 이월(defense 20초·옛 규칙)**: 이 계획이 10초로 정리했다.

## 사용자 결정 거리 / 알려진 한계

- **유언 단계의 몸동작**: 서버가 동작을 버린다(위 Deviation 2). 이 10초에 몸동작을 살리려면 `audience`/`relayEmote` 에 defense 예외 분기가 필요하다. 지금은 UI-SPEC D "조용히 지켜본다"를 따랐다.
- **높이 560~664 폰에서 키보드 열림 시트 위치(backstop)**: 단위·jsdom 으로는 확인할 수 없다(시트 윗변 ≥ 0, [남기기]·글칸·[닫기] 가림 없음). `.mf-will-layer` 와 `veiled` 로 시트를 패널 자리에 앉히는 기존 규칙을 그대로 썼고 CSS·시트 높이는 새로 만들지 않았다. **실기기 검사로 남겼다**(결정 메모: 실기기 항목은 끝에 몰아서). 처형자가 664 이하에서 키보드를 열면 자기 캐릭터가 안 보이는 것은 계획에 적힌 알려진 한계다.
- **e2e 스크립트의 옛 변론 가정**: `scripts/e2e/polish.test.mjs` TITLE_OF("최후 변론"·"투표"), `scripts/e2e/flows.mjs` 1669 부근(변론자 득표 배지·패널 채팅), `scripts/e2e/politics.mjs`(`runoffDefenseLine`·"최후 변론" 기대), `scripts/bots.mjs`·`gallery.mjs` 주석은 새 흐름과 어긋난다. smoke.mjs 의 낮 흐름 걸음(토론 끝내기 → 지목 → 변론 → 찬반 단언)도 22-09 가 "걸음 개편은 이월"이라 남긴 상태 그대로다(DEFENSE_MS 사본과 길이 주석만 맞췄다). 브라우저·배포본이 필요한 e2e 는 이 계획에서 돌리지 않았다 — 해당 정리는 e2e/배포 검증을 맡는 후속 계획 몫으로 남긴다.

## Known Stubs

없음. (유언 단계 화면 데이터는 모두 서버 view 값 — `day.candidate`·`me.will`·`phaseEndsAt` — 에 연결돼 있다.)

## Threat Flags

없음. 위협 모델 T-22-21~25 는 모두 구현·시험으로 닫혔다.

| 위협 | 완화 | 시험 |
|------|------|------|
| T-22-21 처형자 아닌 사람의 final | 서버가 단계·처형자 좌석을 확인, 아니면 final 무시 + 일반 거절과 같은 응답 | worker will.test(defense 비처형자 final → `[error:WRONG_PHASE,state:defense]`, 단계 그대로·저장 없음 / 토론의 final 은 일반 저장) |
| T-22-22 유언 단계에 남의 유언 변경 | saveWill 이 defense 에서 처형자만 ok | unit will.test(WRONG_PHASE·후보 없으면 전원 거절) |
| T-22-23 유언 단계 발언 | CHAT_PHASES 제외 → channelOf null(서버 권위) | unit audience·view, worker will·chat·trial(chatReject 이고 다른 소켓 0프레임) |
| T-22-24 XSS | 서버 sanitizeChatText·50자소, 화면은 textarea value·React 텍스트 노드만 | 기존 willSheet·useWill 경로 그대로 |
| T-22-25 스키마 | strictObject + `final: z.literal(true).optional()` | worker will.test(`final:false`·덧붙은 키 BAD_MESSAGE) |
| T-22-SC 패키지 설치 | 설치 없음 | — |

## Self-Check: PASSED

- 생성·수정 파일 존재: 위 key-files.modified 전부 확인(수정 대상이 모두 저장소에 있음), SUMMARY 자체는 아래 커밋.
- 커밋 존재(`git merge-base --is-ancestor`): f9a6582b·dab599a1·76590086·18e507fe·48ba0930·6558719a 모두 HEAD 의 조상이다.
- 브랜치 v3, `.planning/STATE.md`·`state.json`·`ROADMAP.md`·`Claude outputs/` 는 건드리거나 스테이징하지 않았다.
