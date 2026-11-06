---
phase: 07-free-chat
reviewed: 2026-11-02T00:00:00Z
depth: standard
scope: gap-closure round (plans 07-23..07-27), diff_base ae1c5b31948be01aa1869abca96f2cefc7032938
files_reviewed: 28
files_reviewed_list:
  - docs/architecture.md
  - docs/decisions/0030-visual-bundle.md
  - docs/decisions/0038-atmosphere-guide-wakelock.md
  - docs/screen-map.md
  - HANDOFF.md
  - scripts/e2e/browser.mjs
  - scripts/e2e/flows.mjs
  - scripts/e2e/lib.mjs
  - scripts/e2e/lib.test.mjs
  - shared/game/world.ts
  - src/components/SceneIntro.tsx
  - src/components/WorldStage.tsx
  - src/game/scenes.ts
  - src/world/character.ts
  - src/world/motion.ts
  - src/world/runtime.ts
  - src/world/store.ts
  - src/world/testHooks.ts
  - test/client/guide.test.tsx
  - test/client/phaseScreens.test.tsx
  - test/client/sceneIntro.test.tsx
  - test/client/worldStage.test.tsx
  - test/unit/character.test.ts
  - test/unit/e2eContract.test.ts
  - test/unit/motion.test.ts
  - test/unit/scenes.test.ts
  - test/unit/world.test.ts
  - test/unit/worldStore.test.ts
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 7 (갭 수정 07-23~07-27): Code Review Report

**Reviewed:** 2026-11-02
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

낮 시작 문구 정리(WR-03)와 결정 0059(내 캐릭터 이동 예측 + 구간 교체 섞기 + 방향·자세 섞기)를 검토했다. `git diff ae1c5b3` 기준으로 변경분을 읽고, 주변 코드(`worldStore`, `input.ts`, 서버 `requestMove`)를 따라가며 추적했다.

확인한 것(문제 없음):

- `planMoveSegment` 는 이전 `requestMove` 본체를 줄 단위로 옮긴 것과 같다. 간격 검사(`TOO_SOON`) 뒤에 부르고, 입력을 바꾸지 않고, `from` 을 뒤에서 다시 쓰지 않는다. 시험도 깊은 비교로 고정한다.
- `moveSeqOf` 의 epoch·reset 처리: `snap`·`reset()`·`retainSeats` 에서 지우고, 낡은 epoch·준비 전 move 는 세지 않는다. 런타임은 epoch 변화 프레임에서 `own.reset` 으로 기준을 다시 잡고, 같은 epoch 의 snap 으로 seq 가 줄면 `observe` 가 "reset" 을 내므로 두 경로 모두 막혀 있다.
- 07-25 의 문서화된 이탈 두 가지(`was = positionAt(eff, sNow - gapMs)`, dest 없는 `notifyMoveSent` 의 즉시 ack)는 의도한 곡선·동작과 맞는다. 첫 프레임의 한 프레임 걸음을 차이로 섞지 않아서 예측 경로와 1e-6 일치한다.
- 서버 판정·프로토콜은 바뀌지 않았다. 예측은 화면 위치에만 쓰이고 `sample()` 은 서버 값 그대로다. 보안 표면 변화는 없다.
- W11·W12 판정의 경계(`k + 1 > 3`, 쌍 간격 4~100ms, 쌍 10개 미만이면 실패)는 시험이 경계를 짚는다. `WORLD_MOVE_SPEED` 는 `e2eContract` 가 앱 `MOVE_SPEED` 와 같음을 고정한다.

blocker 는 없다. 응답 판정(`createOwnMoves`)에 서버가 한 탭을 버렸을 때 스스로 복구하지 못하는 경로가 하나 있어 WARNING 으로 올린다.

## Warnings

### GR-WR-01: 서버가 탭 하나를 버리면(TOO_SOON 등) 응답 개수 맞추기가 어긋나 유령 예측이 최대 1.5초 남고 응답이 왔는데도 "연결이 불안정" 알림이 뜬다

**File:** `src/world/motion.ts:217-234`, `src/world/runtime.ts:507-512`
**Issue:** `createOwnMoves` 는 `보낸 수 - 서버가 적용한 수` 를 센다. 서버는 `MOVE_MIN_GAP_MS`(150ms) 안에 도착한 move 를 **오류 프레임 없이 조용히 버린다**(`input.ts` 머리 주석이 이미 인정한다, 06 리뷰 WR-04). 클라이언트 탭 간격은 250ms(150 + 여유 100)지만 모바일 TCP 지터로 도착 간격이 150ms 아래로 줄 수 있고, 그 여유는 100ms 뿐이다.

추적한 경로:
1. 탭1 `sent(pred1)` → waiting 1. 탭2(250ms 뒤) `sent(pred2)` → waiting 2, `predicted = pred2`, 응답 없음 타이머는 탭2 기준으로 다시 걸린다.
2. 서버가 탭1은 받고 탭2는 `TOO_SOON` 으로 버린다. 응답1 도착: `d = 1`, waiting 2 → 1. `reachedPrediction` 은 `sameEnd(server, pred2)` 인데 서버는 탭1 목적지로 가는 구간이라 거짓(아래 "끝점이 같으면" 구제는 목적지가 다를 때 작동하지 않는다). → `null`, 예측 유지.
3. 내 캐릭터는 서버가 모르는 pred2 경로를 따라 최대 1.5초 걷는다(다른 사람 화면에서는 탭1 목적지로 간다). 탭2 기준 1.5초 뒤 타이머가 `expire()` → true → `clearRing()` + `onNotice(NETWORK_TEXT)`. 네트워크는 멀쩡하고 응답도 받았는데 알림이 뜬다. 이후 구간이 서버 구간으로 150ms 에 걸쳐 되돌아간다(최대 약 2.7 단위를 150ms 에).

결정 0059-2 는 "서버가 요청을 버린 경우 예측을 멈추고 서버가 아는 위치로 돌아간다" 이지만 구현은 이를 1.5초 시계에만 맡긴다. 이전 구현(`s !== baseSeg && s.t0 >= sentAt - slack`)은 서버 구간이 바뀐 사실로 ack 해서 이 경우에 갈라지지 않았다(링은 둘째 탭 기준이라 같은 알림은 났지만 예측이 없었다). 시험(`motion.test.ts` 164행)은 "첫 탭이 버려지고 둘째 응답만 오는" 경우만 다룬다. 둘째가 버려지는 경우와 목적지 불일치는 시험이 없다.

같은 뿌리로, 탭이 숨겨진 상태(rAF 중단)에서는 응답이 와도 `observe` 가 프레임에서만 불리므로, 숨긴 동안 타이머가 먼저 끝나면 같은 거짓 알림이 난다(이전 구현도 같았다).

**Fix:** 타이머 콜백이 `expire()` 하기 전에 스토어를 직접 한 번 더 관찰하고, "마지막 보냄 이후 응답을 하나라도 들었는가"로 알림 여부를 가른다.
```ts
// motion.ts — OwnMoves 에 추가
//   heardSinceSent: sent() 에서 false, observe() 가 d > 0 로 대기를 줄일 때 true
//   expire(): { cleared: boolean; silent: boolean }  — silent = 응답은 들었지만 마지막 탭만 안 온 경우

// runtime.ts — ackTimer 콜백
ackTimer = setTimeout(() => {
  ackTimer = null;
  if (disposed) return;
  own.observe(store.moveSeqOf(deps.mySeat()), store.segOf(deps.mySeat())); // 숨은 탭에서도 응답을 센다
  const r = own.expire();
  if (!r.cleared) return;
  clearRing();
  if (!r.silent) deps.onNotice(NETWORK_TEXT); // 응답을 하나라도 들었으면 네트워크 문제가 아니다
}, MOVE_ACK_TIMEOUT_MS);
```
더 나아가 응답을 들은 뒤(waiting > 0 으로 남을 때)에는 탭 간격 + 왕복(예: 400ms)짜리 짧은 유예 타이머를 걸어 남은 대기를 조용히 비우면, 버려진 탭의 유령 예측이 1.5초가 아니라 0.4초 안에 끝난다. 시험: "둘째 탭이 TOO_SOON 으로 버려지고 목적지가 다르다" 케이스를 `motion.test.ts` 와 `worldStage.test.tsx` 에 추가한다.

## Info

### IN-01 (GR-IN-01): "화면에서 뒤로 걷지 않는다"는 주석의 전제는 왕복 약 200ms 이하다

**File:** `src/world/motion.ts:117-119`
**Issue:** smoothstep 최대 감소율 = 평균의 1.5배. 앞섬 L 단위를 150ms 에 줄이면 최대 감소 속도는 `1.5 × L / 0.15 = 10 L`(단위/초)이다. 걷는 속도 1.8 을 넘으려면 L > 0.18, 즉 왕복 > 약 200ms(L = 0.9 × RTT)다. 주석은 RTT 155ms(L = 0.14)만 근거로 든다. 배포본 p50 이 155ms 이면 p95 는 200ms 를 넘을 가능성이 높다. 그때 약 40~60ms 동안 걷기 자세로 아주 조금(0.02 단위 미만) 뒤로 미끄러진다. 눈에 띌 정도는 아니지만 시험은 RTT/2 = 77ms 한 가지만 쓴다.
**Fix:** 주석에 "왕복 약 200ms 까지"를 적고, 시험에 RTT/2 = 150ms 를 하나 더해 `maxBackStep` 이 작음(예: 0.01 이하)을 단언한다. 문제가 되면 `SEG_BLEND_MS` 대신 앞섬 크기에 비례해 시간을 늘린다.

### IN-02 (GR-IN-02): 구간 교체 차이 계산의 `gapMs` 에 상한이 없다

**File:** `src/world/runtime.ts:710`
**Issue:** `const was = positionAt(eff, sNow - Math.max(gapMs, 0))` 는 프레임 간격 그대로를 되돌아가지만 이동량(`dt`)은 `MAX_DT`(50ms)로 자른다. 숨김 복귀는 `resync` 가 막아 주지만, 긴 프레임(GC·복귀 직후 300ms 정지)에서 새 구간이 오면 `was` 가 `dt` 보다 훨씬 먼 과거를 가리켜 차이가 한 프레임 걸음과 어긋난다. 영향은 작다(한 프레임, 몇 센티 단위).
**Fix:** `Math.min(Math.max(gapMs, 0), MAX_DT * 1000)` 로 `dt` 와 같은 상한을 쓴다.

### IN-03 (GR-IN-03): `notifyMoveSent(at, dest?)` 의 선택 인자가 "예측·추적 없음 + 즉시 ack" 경로를 조용히 켠다

**File:** `src/world/runtime.ts:498-504`, `src/components/WorldStage.tsx:180`
**Issue:** dest 를 빠뜨리면 예측과 응답 없음 시계가 모두 꺼지고, 링은 지금 있는 내 서버 구간으로 곧바로 ack 된다. 성능 스파이크용인데 공개 인터페이스의 선택 인자로 열려 있어, 앞으로 호출자가 dest 를 빠뜨리면 이전 이동의 낡은 구간으로 링이 미끄러지고 응답 판정이 사라져도 알아채기 어렵다. 프로덕션 호출(`WorldStage.onTap`)은 항상 dest 를 넘긴다.
**Fix:** 성능 스파이크 전용 메서드(`ackFromStore()` 등)로 나누거나 dest 를 필수로 하고, 스파이크 장면이 별도 이름의 메서드를 부르게 한다.

### IN-04 (GR-IN-04): W11 은 프레임 수로만 판정하고, 최종 화면 위치가 서버 도착점과 같은지는 E2E 가 보지 않는다

**File:** `scripts/e2e/lib.mjs:1853-1859`, `scripts/e2e/flows.mjs:533-534`
**Issue:** (1) W11 의 기준 "3프레임 이내"는 60fps 가정(예측이 없으면 RTT 155ms ≈ 10프레임)이다. 소프트웨어 렌더링 E2E 호스트가 15~20fps 로 떨어지면 예측이 없는 코드(약 3프레임)도 통과해 회귀를 놓친다. `after[k].at - up` 의 ms 는 이미 계산하니 판정에 같이 쓸 수 있다. (2) 도착 뒤 W6·W7 은 `sample`(서버 구간)로만 도착점을 잰다. 섞기가 잔여 차이를 남기거나 예측이 도착점과 다르게 끝나도 E2E 는 모른다(단위 시험만 수렴을 확인한다). (3) `before` 에 프레임이 없으면 `origin = frames[0]` 이 이미 손 뗀 뒤 프레임이라 첫 이동을 놓칠 수 있다(흔치 않음).
**Fix:** W11 에 `after[k].at - up <= 100` ms 상한을 함께 둔다. `readWalkWatch` 의 마지막 `shown` 과 `sampleWorld` 도착점 차이가 0.05 이하임을 보는 W13 을 더한다.

### IN-05 (GR-IN-05): v1.0 디자인 시스템 사본의 낮 시작 문구가 옛 보조줄을 그대로 쓴다

**File:** `design/design-system/components/PhaseCards/README.md:5`
**Issue:** "낮은 보조줄 '토론 전에 먼저 직업을 공개해요'" 가 남아 있다. 결정 0030 개정(07-23)과 `PHASE_INTRO` 와 어긋난다. 이 사본은 "v1.0 디자인 시스템은 디자인 세션에서만 고친다"는 규칙 아래에 있어 코드 쪽에서 고치지 않는 것이 맞다. AI 가 이 문서를 화면 기준으로 읽으면 보조줄을 되살릴 위험이 있다.
**Fix:** 디자인 세션에서 사본과 아티팩트를 함께 고치거나, 사본 맨 위에 "낮 시작 보조줄은 결정 0030 개정으로 삭제됨" 한 줄을 덧붙인다. `docs/decisions/0030-visual-bundle.md:44` 는 본문에 옛 문구를 남기고 개정을 덧붙이는 방식이라 그대로 두어도 된다.

---

_Reviewed: 2026-11-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
