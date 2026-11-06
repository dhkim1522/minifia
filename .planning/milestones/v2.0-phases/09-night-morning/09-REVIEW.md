---
phase: 09-night-morning
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 47
files_reviewed_list:
  - shared/game/audience.ts
  - shared/game/bots.ts
  - shared/game/chatLog.ts
  - shared/game/discussion.ts
  - shared/game/movement.ts
  - shared/game/night.ts
  - shared/game/phases.ts
  - shared/game/room.ts
  - shared/game/testTools.ts
  - shared/game/view.ts
  - shared/game/will.ts
  - shared/game/world.ts
  - shared/protocol.ts
  - shared/schemas.ts
  - worker/room.ts
  - src/components/KillFx.tsx
  - src/components/PoliceResultCard.tsx
  - src/components/ResultAnnounce.tsx
  - src/components/SceneCurtain.tsx
  - src/components/TensionVignette.tsx
  - src/components/WorldStage.tsx
  - src/components/v2/ChatPanel.tsx
  - src/components/v2/FaceList.tsx
  - src/components/v2/HeadStack.tsx
  - src/components/v2/SureStamp.tsx
  - src/components/v2/V2Icon.tsx
  - src/components/v2/WillSheet.tsx
  - src/game/chatText.ts
  - src/game/dayView.ts
  - src/game/eliminationText.ts
  - src/net/assets.ts
  - src/net/chatStore.ts
  - src/net/useChat.ts
  - src/net/useComposedText.ts
  - src/net/useDayFx.ts
  - src/net/useKeyboardLift.ts
  - src/net/useMapInsets.ts
  - src/net/useWill.ts
  - src/screens/GameMap.tsx
  - src/screens/GamePanel.tsx
  - src/screens/RoomScreen.tsx
  - src/world/maps/bar.ts
  - src/world/presence.ts
  - src/world/renderer.ts
  - src/world/runtime.ts
  - src/world/tension.ts
  - src/world/threeRenderer.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 9: 코드 리뷰 보고서

**검토 시각:** 2026-11-03
**깊이:** standard
**검토 파일 수:** 47
**상태:** issues_found

## 요약

9페이즈(밤·아침) 변경분 47개 파일을 읽고, 특히 "살아 있는 사람에게 남의 역할·밤 선택·쪽지 작성자·유언 본문·home 좌표를 보내지 않는다"(결정 0002·0021) 관점으로 서버 경로를 끝까지 따라갔다. `tsc -p tsconfig.app.json`, `tsc -p tsconfig.worker.json` 모두 오류 없이 통과한다.

**누출 경로 점검 결과: 보안 차단 사유(BLOCKER) 없음.** 확인한 항목은 아래와 같다.

- `view.ts`: 밤 필드(`pick`·`nightTally`·`nightSure`·`allyPicks`·`note`)는 모두 `isAlive(me) && role === "mafia"`(또는 본인) 조건 안에서만 키가 생기고, 유언(`me.will`)은 산 본인 + 지도 단계에서만 생긴다. `spectate.picks`는 `def.revealsOwnRole && !isAlive(me)` 안에서만 만들어진다. 쪽지 작성자는 `nightNote` 문자열 하나뿐이라 상태 어디에도 없다.
- `worker/room.ts`: 이벤트 프레임은 `deliver`(첨부 playerId ∈ audience) 한 길로만 나간다. `applyPick`은 `pickRecipientIds`(행위자 쪽 + 탈락자), `applyWill`은 본인, `applyNote`는 산 마피아에게만 `sendViewTo`를 하고 `persistAndBroadcast`를 부르지 않는다. 사망 카드(`appendCard`)는 `audience(all)`로 한 번만 만들어 마스크(`r`)와 함께 저장하고, 복원(`replayFor`)은 저장된 마스크만 쓴다.
- `audience.ts`·`worldVisibleTo`: 밤의 산 마피아 걸음은 산 마피아 + 유령에게만, 시민 편은 본인 한 칸만 받는다. 아침 `snap`도 `worldVisibleTo`로 거른 뒤 보는 사람 한 명씩 보낸다.
- 아침 길이(`morningMsOf`)는 탈락이 없으면 구출·무효·무사 모두 `MORNING_MS`로 같아서 `phaseDurationMs`로 의사 구출 여부가 새지 않는다. 쪽지·유언 길이 가산은 어차피 그 순간 카드로 공개되는 내용이다.
- 클라이언트 쪽: 경찰 결과 카드·마피아 문구·긴장 비네트는 모두 본인 `view.me` 분기 안에서만 만들어진다.

아래는 그 밖에 증명 가능한 결함이다.

## Warnings

### WR-01: 알람이 아침 길이 이상 늦으면 밤 위치 되돌림(snap)이 건너뛰어져 마피아 걸음이 낮까지 남고 시민 화면이 비는 경로

**파일:** `worker/room.ts:895-911` (`syncHome`), `worker/room.ts:797-804` (`afterTransition`)
**문제:** 밤·아침의 위치 되돌림은 "지금 단계가 `night` 또는 `morning`일 때"만 일어난다(`if (room.phase !== "night" && room.phase !== "morning") return;`). `tick`은 늦게 불리면 여러 단계를 한 번에 따라잡는데(`shared/game/tick.ts`의 while 루프), 마감 지연이 아침 길이(5~15초)를 넘으면 `night → morning → dayAnnounce`(또는 `discussion`)를 한 번에 지난다. 이때 `afterTransition`은 최종 단계(`dayAnnounce`)만 보므로 `syncHome`이 아무것도 하지 않는다. 결과는 두 가지다.
1. 마피아가 밤에 대상 곁으로 걸어간 구간이 `world`에 그대로 남아, 낮 내내 암살 대상 옆에 서 있는 사람이 보인다(누가 마피아인지 추리할 수 있는 정보가 낮에 노출된다. 정상 경로는 아침 `teleportHome`이 이 구간을 버린다).
2. 밤 `snap`에서 시민 편은 본인 한 칸만 받았고 아침 `snap`을 못 받으므로, 클라이언트 스토어에 다른 사람 위치가 없는 채로 낮이 시작된다(재접속해야 전원 snap을 받는다).
트리거(알람이 5초 이상 지연)는 드물지만, 코드 경로는 확정적이고 결과가 비밀 정보 노출이라 WARNING으로 올린다.
**수정:** `syncHome`을 "밤·아침 단계"가 아니라 "마지막으로 적용한 lay.key가 이번 일차의 `:night`인데 지금 단계가 night가 아니고 아직 되돌리지 않았다"까지 다루게 한다. 예시는 아래와 같다.
```ts
// syncHome 맨 앞에 추가: 밤을 지나 아침 없이 낮으로 온 경우(알람 따라잡기) 되돌림을 한 번 한다.
const lastKey = this.world.lay?.key;
const skippedMorning =
  room.phase !== "night" && room.phase !== "morning" && MAP_PHASES.has(room.phase) &&
  lastKey !== undefined && lastKey.endsWith(":night");
if (skippedMorning) {
  // home.day 는 지난밤의 일차다. 산 사람 전원을 home 으로 되돌리고 보는 사람별 snap 을 보낸다(아래 로직과 같다).
  const moved = room.players.filter(isAlive).map((p) => p.id);
  this.world = { ...teleportHome(this.world, moved, now), lay: { key: `${room.day}:catchup`, slots: this.world.lay?.slots ?? {} } };
  await this.flushWorld();
  for (const viewer of room.players) { /* 기존 snap 전송 블록과 동일 */ }
  return;
}
```
(키 이름은 임의이며, 핵심은 "night 키가 남아 있으면 다음 지도 단계 진입에서 한 번 되돌린다"는 조건이다. `lay.key`가 `:night`로 끝나는 동안 `syncLayout`이 새 키로 덮으면 같은 효과가 나므로, 그 경로에서 `teleportHome` + snap을 함께 호출하는 방식도 된다.)

### WR-02: 경찰 결과 카드의 얼굴 대체 원이 자리 구분색 변수를 한 칸 틀리게 참조한다

**파일:** `src/components/PoliceResultCard.tsx:31`
**문제:** `var(--seat-${((seat % 8) + 8) % 8})`는 0~7을 만든다. 그러나 토큰은 `--seat-1`~`--seat-8`뿐이다(`src/styles/tokens.css:43-50`). 같은 대체 원을 그리는 `FaceList.tsx`·`GamePanel.tsx:117`은 `(seat % 8) + 1`을 쓴다. 얼굴 그림이 안 뜰 때 0번 자리는 `--seat-0`(미정의 → 배경 없음)이고 나머지는 한 칸씩 어긋난 색이 나온다. 경찰이 조사한 대상의 자리 색이 얼굴 목록에서 본 색과 달라진다.
**수정:**
```tsx
<i style={{ background: `var(--seat-${(((seat % 8) + 8) % 8) + 1})` }} />
```
(`faceSrc`와 같은 정규화 뒤에 +1을 더한다. 색 계산을 `assets.ts` 같은 한 곳의 `seatColorVar(seat)`로 빼서 세 군데가 같이 쓰게 하면 재발하지 않는다.)

## Info

### IN-01: 쓰기 시트에서 [저장]을 누른 뒤 조합이 끝나기 전에 [닫기]를 누르면 닫기 요청이 버려진다

**파일:** `src/net/useComposedText.ts:39-49`, `src/components/v2/WillSheet.tsx:89-93`
**문제:** 조합 중에는 `settle`이 첫 콜백 하나만 `pendingRef`에 넣고 이후 호출은 `if (pendingRef.current) return;`으로 버린다. [저장] 직후 조합이 끝나기 전에 [닫기]를 누르면 닫기 콜백이 사라지고, `compositionend`(또는 `IME_WAIT_MS`) 때 저장만 실행되어 시트가 열린 채 남는다. 한 번 더 눌러야 닫힌다. 데이터 손실은 없고 드문 입력 순서의 사용성 문제다.
**수정:** 대기 중인 콜백을 덮어쓰지 말고 큐로 쌓아 순서대로 부르거나(저장 → 닫기), 닫기 쪽 콜백이 마지막 값으로 저장까지 하도록 하나로 합친다.

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
