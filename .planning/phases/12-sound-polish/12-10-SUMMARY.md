---
phase: 12-sound-polish
plan: "10"
subsystem: ui
tags: [web-audio, director, verdict, emote, leak-safety, tdd, e2e, playwright]
status: complete
requires:
  - phase: 12-sound-polish
    provides: "12-02 verdictScript, 12-05 engine duckBed/runScript, 12-08/09 director·useSound·signals·audioView·sound-script·sound-night-parity"
provides:
  - "판결 소리: 처형 진입에서 verdictScript 를 T0 = endsAt − EXECUTION_MS(서버 시각) 기준으로 예약, GRACE_MS 250 유예, 남은 덕킹 구간, pin.on"
  - "결선(runoff.intro·pin.on·runoff.reveal)·마지막 3인(차례 pin.on·showdown.reveal) — pinOfAudio 가 pinOf 분기를 복제"
  - "값 없는 vote(찬성·반대 같은 vote.cast)·deny(거절 토스트 네 지점) 신호, emote {id, mine} 신호"
  - "emoteSoundGate(초당 3·동시 4) + directEmote(내 0dB·남의 −6dB, 밤에도 받은 프레임이면)"
  - "E2E: sound-script 처형 통과·부결 실시간 V1~V5, sound-night-parity 동작 누설 E1~E3"
affects: [12-11, 12-12]
actuals:
  tokens: 20400
  tasks: 3
  commits: 7
plan_head_before: 151251dd6724fce39b3342fac7b21a4d1665103c
plan_head_after: 34532e73d3456fbfb801836380799bffdcdcbb8c
tech-stack:
  added: []
  patterns: ["결과 무관 앞머리: 2600ms 앞 항목은 passed 를 읽지 않는 같은 목록(단위·E2E V5)", "도착 지연은 서버 시각 지연 = T0 + at − serverNow 로 환산, −GRACE_MS 보다 지난 항목은 버림", "게이트는 순수(상태 인자 + 시각 인자), 상태는 useSound ref"]
key-files:
  created:
    - test/unit/soundVerdict.test.ts
  modified:
    - src/audio/audioView.ts
    - src/audio/director.ts
    - src/audio/engine.ts
    - src/audio/script.ts
    - src/audio/signals.ts
    - src/audio/useSound.ts
    - src/components/v2/VerdictPicker.tsx
    - src/screens/GameMap.tsx
    - src/screens/RoomScreen.tsx
    - scripts/e2e/sound.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/soundDirector.test.ts
    - test/unit/soundNight.test.ts
    - test/unit/soundScript.test.ts
    - test/unit/soundEngine.test.ts
    - test/unit/soundStaticGuard.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/useSound.test.tsx
    - test/client/voteParts.test.tsx
    - test/client/gameMap.test.tsx
key-decisions:
  - "pin.on 은 verdictScript 에 넣지 않고 감독이 처형 진입 항목 앞에 더한다(12-02 대본 시험 불변). 같은 grace 규칙을 받는다"
  - "emote 는 directSignal 이 아니라 directEmote(signal, cur, gate, now) → {out, gate} 가 맡는다. 게이트 상태가 필요해서이고 directSignal 은 emote 에 무음"
  - "RoomScreen 은 world 저장소가 버리는 옛 연결 번호 프레임(meta.epoch < store.currentEpoch())에는 신호도 보내지 않는다 — 몸 동작과 소리가 같이 없다"
  - "lib 의 밤 소리 집합 비교(nightSegments)에서 emote.* 를 제외 — 동작 누설은 soundEmoteLeakChecks 가 따로 본다"
---

# Phase 12 Plan 10: 판결·결선·동작 소리 Summary

처형 진입의 판결 소리(심장 박동 → 찬반 둔탁음 → 의사봉+떠오름 / 부결 / 마지막 3인)를 서버 시각 기준으로 예약하고, 결선·마지막 3인·핀·찬반·거절·받은 동작 프레임 소리를 값 없는 신호와 공개 view 차이만으로 더했다. 결과는 2600ms 에 처음 소리로 나타난다.

## 수행 결과

- **Task 1 (트레이서)**: audioView 에 `verdict {passed,last}`·`hasBallots` 불리언만 읽는다. 처형 진입(prev ≠ execution, 같은 epoch)에서 `verdictRun` 이 `verdictScript` 항목을 `delay = at − (serverNow − T0)` 로 환산: `−GRACE_MS(250)` 안은 지금, 더 지난 것은 버림, 덕킹은 남은 구간만(`toMs − elapsed`, 복귀 800ms). 처형 중간 합류·epoch 변경은 침대만, 같은 view 되풀이는 예약 없음, 밤으로 가면 `phase:execution:{n}` 취소. 엔진 `duckBed` 세 번째 인자는 이미 `returnMs` 로 있어 이름만 `releaseMs`(기본 250)로 바꾸고 시험을 더했다.
- **Task 2**: `runoff.intro`+`pin.on`(진입), `runoff.reveal`(step→2), 마지막 3인 차례 `pin.on`(말하는 사람이 바뀔 때)·`showdown.reveal`(i→4). `pinOfAudio` 는 `pinOf` 의 지목·결선·마지막 3인·처형 분기를 복제했고 soundDirector 시험이 21행 열에서 pin.on 순간을 `pinOf` 전이와 대조한다. `vote`(VerdictPicker 클릭, 값 없음)→`vote.cast`, `deny`(GameMap 거절 토스트 네 지점)→`ui.deny`, 밤 무음.
- **Task 3**: `emoteSoundGate`·`EMOTE_SOUND_*`(EMOTE_RENDER_MAX 와 같은 4, 시험 대조), `directEmote`, RoomScreen emote 프레임 처리 자리의 `emote {id, mine}` 신호, `soundVerdictTimingChecks`(V1~V5)·`soundEmoteLeakChecks`(E1~E3), sound.mjs 확장.

## E2E 결과 (390×844, 포트 5291 개발 서버)

`npm run e2e -- --url http://127.0.0.1:5291 --only sound-script,sound-night-parity` → **sound-script 37/37, sound-night-parity 20/20, 63초, E2E OK** (두 번째 실행 없이 첫 실행 통과).

- 통과 판: verdict.heart 5개, **gavel 간격 2594ms**, rise 간격 2594ms (V2·V3 통과).
- 부결 판: verdict.heart 5개, **reject 간격 2594ms**, gavel·rise 없음 (V4), 두 판의 2350ms 앞 판결 id 열 동일 (V5).
- 밤 마피아 동작: 방장 로그 emote.throat 1개 (E1), 시민 편 손님 3 로그 emote.* 0 (E2), 낮 동작 gain 보낸 1·받은 0.501 (E3). 기존 P1~P6 도 그대로 통과.

## 시험 (타깃)

soundVerdict·soundDirector·soundNight·soundScript·soundEngine·soundStaticGuard·e2eContract·emoteCap·verdictMoment·pinPlan, useSound·voteParts·gameMap·runoffScreen·showdownScreen·buttonSignal·badgeUi·whisperUi·roomScreen·worldStage·lobby·dressSheet — 22개 파일 통과, `node --test scripts/e2e/lib.test.mjs` 302 통과, `tsc -p tsconfig.app.json --noEmit` 오류 없음. 전체 회귀·웨이브 게이트는 지시대로 돌리지 않았다.

## Deviations from Plan

**1. [Rule 3 - 블로킹 없음/명세 보정] duckBed 의 releaseMs 는 이미 있었다**
- 엔진에 세 번째 인자가 `returnMs` 로 이미 있었다. 이름만 `releaseMs` 로 바꾸고(기본 250 유지) 800ms 가 `setTargetAtTime` 시정수에 반영되는 시험을 더했다(RED 가 아니라 처음부터 통과 — 새 동작이 아님).

**2. [Rule 3 - 파일 범위] 계획에 없는 파일 한 줄 수정**
- `test/unit/soundNight.test.ts`: AudioView 새 필드(verdict·hasBallots·runoff·showdown) 기본값과 신호표(vote·deny·emote). 밤 무음 시험에서 emote 는 제외(받은 프레임이면 밤에도 나는 것이 계약).
- 동작 신호의 RoomScreen 시험은 `test/client/gameMap.test.tsx` 에 두었다(RoomScreen 을 가짜 연결로 마운트하는 기존 모범).

**3. [Rule 1 - 판정 보정] V5 비교 구간을 2500 → 2350ms 로**
- V2 허용(±250)이 2350 부터라서 앞머리 구간이 2500 이면 허용 안의 gavel 이 V5 를 거짓 실패시킨다. 구간을 `announceAt − tolerance`(2350)로 잡았다. 2400ms 심장 박동은 V1(개수)이 본다.

**4. [동작] ballots 카드 ui.card 는 verdictScript 의 4600 항목 하나뿐**
- 지시대로 BALLOT_END_AT 에 찬반 기록이 있을 때만 ui.card 가 난다(RoomScreen 의 chat 신호는 ballots 카드에 신호 없음 — 중복 없음).

**5. [제한] 거절 토스트가 아닌 willBusy 분기는 deny 없음**
- 유언·쪽지 저장 중 거절은 useWill 이 "보내지 못했어요"를 따로 띄우므로 GameMap 의 네 지점(귓속말·배지·지목·일반)에만 deny 를 보냈다.

**개발 서버/타입체크**: `npm run typecheck` 는 `wrangler types` 가 파일을 건드릴 수 있어 `tsc -p tsconfig.app.json --noEmit` 만 돌렸다(worker 쪽은 이 계획이 건드리지 않음).

## Known Stubs

없음. 새 소리는 모두 12-02 레시피를 쓴다(오디오 파일·의존성 없음).

## Threat Flags

없음. 새 네트워크·인증·파일 접근 없음. 신호 인자는 `vote`·`deny` 값 없음, `emote {id, mine}` 뿐이다(T-12-36~40 모두 시험 고정).

## 이월 메모

- grace 상수: `director.ts` 의 `GRACE_MS`(250). 처형 대본은 `verdictRun`(onPhaseChange 에서 execution 진입에 호출), 키 `phase:execution:{n}`(scriptKeys 에 등록). 핀 복제는 `pinOfAudio`(지목·결선·마지막 3인·처형).
- emote 게이트: `script.ts` 의 `emoteSoundGate`·`EMOTE_SOUND_*`·`EMOTE_GATE_EMPTY`, 감독 쪽 `directEmote(signal, cur, gate, now) → {out, gate}`, 상태 ref 는 `useSound.ts`(`emoteGate`). 신호는 RoomScreen emote 프레임 분기에서만.
- 12-11 이 쓸 자리: 신호 종류는 `signals.ts` `SIGNAL_KINDS`·`LocalSignal`(+ `directSignal` 분기 한 줄), audioView 필드는 `AudioView`·`AUDIO_VIEW_FIELDS`·`audioViewOf`·soundStaticGuard `ALLOWED_VIEW_PATHS` 네 곳(경로는 `view.day.…`). 결과·시상 대본은 `onPhaseChange` 에 `ended` 분기를 더하고 `scriptKeys` 에 키 등록.
- sound.mjs 확장: `soundScriptFlow` 는 `soundScriptSteps`(SC1~SC12) 뒤에 `soundVerdictWatch` 두 판을 돈다. 새 단계는 SOUND_SCRIPT_STEPS 행 + `soundScriptSteps` 끝(새로고침 SC10 뒤), 새 판정은 lib.mjs 순수 함수 + `recOne`. 처형을 지켜보는 도우미는 `soundVerdictWatch(ctx, rec, "pass"|"reject")`(openGame 새 방, 약 25초씩).
- 동작 소리 E2E 도우미 `sendEmote(page, id)`·`waitEmoteLog(page, n)` 가 `makeSoundFlows` 안에 있다(sound-night-parity 가 낮 clap·밤 throat 에 사용). 밤 소리 집합 비교(nightSegments)는 emote.* 를 뺀다.
- 알려진 한계: 처형 로그는 skipTo 진입 후 3.8초 시점에 읽는다(처형 5.6초 이내). 결선 reveal 등 새 소리의 귀 조정(레시피 dB)은 실기기 UAT 대기. GameMap 거절 deny 는 willBusy 분기에 없음.

## Self-Check: PASSED

- 파일 존재: `test/unit/soundVerdict.test.ts` · `.planning/phases/12-sound-polish/12-10-SUMMARY.md` 및 수정 파일 21개.
- 커밋 7개(bfa04d30 · aedc1bfa · 60a58bff · b95ff153 · 42ff08f6 · 2e12ff25 · 34532e73)가 HEAD 의 조상임.
