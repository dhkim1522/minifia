---
phase: 18-quick-fixes
reviewed: 2026-11-10T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - scripts/e2e/avatar.mjs
  - scripts/e2e/browser.mjs
  - scripts/e2e/errand.mjs
  - scripts/e2e/lib.mjs
  - scripts/e2e/tutorial.mjs
  - scripts/perf-run.mjs
  - shared/game/look.ts
  - shared/game/room.ts
  - src/components/v2/DressSheet.tsx
  - src/components/v2/EvidenceCard.tsx
  - src/components/v2/FocusRing.tsx
  - src/components/v2/TutorialEvidence.tsx
  - src/components/v2/TutorialNext.tsx
  - src/components/v2/TutorialRoleCards.tsx
  - src/components/v2/V2Icon.tsx
  - src/debug/perf/scenario.ts
  - src/game/dressText.ts
  - src/game/hostLine.ts
  - src/game/resultText.ts
  - src/game/traceText.ts
  - src/game/tutorialScript.ts
  - src/screens/GameMap.tsx
  - src/screens/Lobby.tsx
  - src/screens/ResultScreen.tsx
  - src/screens/RoleReveal.tsx
  - src/screens/TutorialScreen.tsx
  - src/styles/evidence.css
  - src/styles/phase.css
  - src/styles/tutorial.css
  - src/styles/v2.css
  - src/world/maps/bar.ts
  - src/world/maps/plaza.ts
  - src/world/runtime.ts
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 18: 코드 리뷰 보고서

**검토 시각:** 2026-11-10
**깊이:** standard (페이즈 diff 기준 `7fa192e0..HEAD`, 필요한 곳은 호출처까지 따라감)
**검토 파일 수:** 33 (요청 목록 34개 중 `src/world/runtime.ts` 포함 전부 열람. 위 목록은 요청 그대로)
**상태:** issues_found

## 요약

18페이즈의 변경(옷 겹침 해소·옷장 잠금, 튜토리얼 스포트라이트·[다음] 알약·카메라 고정, 증거 카드 eyeOff, 조명 재조정, `--mode light`, 공개 예고 삭제)을 검토했다. `tsc --noEmit` 은 통과한다.

**프로젝트 규칙 점검 (서버 소유 판정·역할 비노출):** 위반을 찾지 못했다.
- `resolveLookConflicts` 는 `seat`·`look` 만 읽는다(제네릭 제약이 `{ seat; look? }` 뿐이라 역할을 읽을 타입 경로도 없다). 난수·시각을 받지 않고 입력을 바꾸지 않는다.
- `beginGame` 은 `assignRoles` → 맵 결정(난수)을 모두 쓴 뒤에 `resolveLookConflicts` 를 부른다. 난수 호출 순서가 바뀌지 않았다.
- `setLook` 의 잠금 거절은 `{ ok:false, error:"BAD_MESSAGE" }` 이고, `worker/room.ts:applyDress` 가 사유와 무관하게 보낸 소켓에 state 한 프레임만 돌려준다(간격 초과와 같은 응답, L30·L40 유지). 잠금 판정은 공개 값(look)만 쓴다.
- 클라이언트 `lockedOutfits` 는 서버와 같은 함수이고 `view.players` 의 공개 look 만 읽는다. `data-taken`·aria 문구에 역할·좌석 정보가 없다.
- `TutorialRoleCards` 가 `ROLE_TEXT[kind].desc` 를 읽지만 정적 표이고 방 view·역할은 읽지 않는다.

BLOCKER 는 없다. 아래는 동작상 구멍 2건(WARNING)과 정리 거리 5건(INFO)이다.

## Warnings

### WR-01: 기본 옷(coat)을 "직접 고른" 사람은 잠기지 않아 시작 때 몰래 옷이 바뀔 수 있다

**File:** `shared/game/look.ts:28` (원인), `shared/game/look.ts:63-68` (문서 불일치), `shared/game/look.ts:39-58`
**Issue:** `setLook` 의 같은 값 검사(`(actor.look ?? DEFAULT_LOOK) === look` → 입력 상태 그대로 ok)가 잠금 검사보다 앞이라, look 키가 없는 사람이 coat 카드를 눌러도 저장되지 않는다. `lockedOutfits` 는 look 키가 있는 사람만 잠그므로 그 사람의 coat 는 잠기지 않는다. 결과:
1. A(look 없음)가 coat 를 눌러 "내가 coat 를 골랐다"고 본다. 서버 상태는 그대로다.
2. B 가 coat 를 누르면 잠금에 걸리지 않아 B.look = "coat" 로 저장된다(직접 고름).
3. 시작 때 `resolveLookConflicts` 는 직접 고른 쪽을 먼저 지키므로 A 가 진 사람이 되어 `OUTFIT_IDS` 순서의 첫 빈 옷으로 바뀐다. A 는 로비 내내 coat 를 입고 있던 것으로 보았으니, 옷이 몰래 바뀌는 놀라움이 생긴다. A 의 옷장에서도 B 의 coat 는 `id !== value` 조건 때문에 잠금으로 표시되지 않아 충돌을 알아챌 길이 없다.
또 `lockedOutfits` 문서(`look 키가 없는 사람의 기본 coat 는 넣지 않는다(고르면 저장되고 …)`)는 "고르면 저장된다"고 쓰지만 coat 는 저장되지 않으므로 사실과 다르다.
**Fix:** 같은 값 검사에서 "저장값이 없으면서 기본값을 누른 경우"만 look 을 명시 저장하도록 바꾼다. 단 look 키가 없던 사람이 coat 를 누를 때 잠금(남이 이미 직접 coat 를 고름)도 함께 검사해야 한다.
```ts
const current = actor.look ?? DEFAULT_LOOK;
const taken = lockedOutfits(state.players.filter((p) => p.id !== actorId));
if (current === look && actor.look !== undefined) return { ok: true, state };
if (taken.has(look)) return { ok: false, error: "BAD_MESSAGE" };
return { ok: true, state: { ...state, players: state.players.map((p) => (p.id === actorId ? { ...p, look } : p)) } };
```
(look 키가 생기는 방식이 바뀌면 "기본 coat 를 지킨 사람은 look 키가 계속 없다"는 `resolveLookConflicts` 문서·테스트와 `__mfLooks`/E2E 기대도 함께 확인한다.) 고치지 않겠다면 문서를 현재 동작에 맞게 고치고, 이 구멍을 결정 0081-1 의 알려진 한계로 기록한다.

### WR-02: 쉬는 사람(bench)은 잠금·겹침 해소 대상이 아니라 결과 화면에서 같은 옷이 다시 나타난다

**File:** `shared/game/rematch.ts:88-98, 143-149` (영향 받는 쪽), `shared/game/room.ts:448`
**Issue:** `rematch` 는 참가자만 `fresh.players` 로 만들어 `beginGame` 에 넘기고, 쉬는 사람은 `bench` 에 옛 look 그대로 둔다. `resolveLookConflicts` 는 참가자끼리만 푼다. 판이 끝나 `seatBench` 로 쉬던 사람이 `players` 에 합류하면, 방금 해소된 참가자 옷과 같은 look 을 가진 사람이 결과 화면에 생긴다(잠금은 새로 고르는 행동만 막는다). D-01 의 의도("한 판 옷이 모두 다르다")는 판 중에는 지켜지지만, 다음 `beginGame` 전까지의 결과 화면과 옷장에서는 같은 옷 둘이 보이고, 그 상태에서는 잠금 규칙의 전제(남이 입은 옷은 내가 못 입는다)도 깨져 있다. 큰 사고는 아니나 E2E `OU1` 은 판 시작 직후 스냅샷만 보므로 이 경로를 잡지 못한다.
**Fix:** `seatBench` 에서 합류시킨 뒤 `resolveLookConflicts(players)` 를 한 번 더 부르거나, 쉬는 사람의 look 을 `benchRow` 에서 빼서(기본 coat 로 돌려) 합류 때 겹침이 생기지 않게 한다. 어느 쪽이든 역할·난수를 읽지 않는 같은 함수만 쓴다.

## Info

### IN-01: `resolveLookConflicts` 의 "빈 옷이 없으면 continue" 가 겹침을 조용히 남긴다

**File:** `shared/game/look.ts:52-54`
**Issue:** 옷 9종 > 자리 8 이라는 주석에만 기대고 `free === undefined` 면 아무 일 없이 건너뛴다. 최대 인원이 9 이상으로 늘면(또는 호출자가 쉬는 사람까지 넘기면) 겹침이 오류 없이 남는다.
**Fix:** 불변식을 단언으로 남긴다(`if (free === undefined) throw new Error("옷 수 < 자리 수")`). 호출 쪽이 서버라 던져도 되는 입력 오류이고, 조용히 남기는 것보다 시험에서 바로 드러난다.

### IN-02: 튜토리얼 좌석 위치 주석이 값과 어긋난다

**File:** `src/game/tutorialScript.ts:317-325`
**Issue:** 주석은 "광장 가운데 연단 둘레 반지름 약 2.6" 이라 하나 좌석 1 은 `(1.3, -1.5)` 로 바뀌어 반지름이 약 1.98 이다(좌석 2·3 은 `±1.3, ±2.3` 으로 약 2.64). 같은 표 안 반지름이 둘이 되었다.
**Fix:** 주석에 "좌석 1 만 18-08 측정값으로 안쪽에 둔다"를 더한다.

### IN-03: `RoleReveal` 의 빈 `hints` 칸과 설명 주석만 남은 자리

**File:** `src/screens/RoleReveal.tsx:63, 79`
**Issue:** 공개 예고를 지우고 `<div className="mf-reveal__hints" />` 가 빈 칸으로 남았고, 63행에 "삭제 — 빈 칸은 레이아웃을 지킨다"라는 지나간 변경 설명만 있는 주석이 있다. 레이아웃 자리라면 `phase.css` 의 padding 이 높이를 만들 뿐이라 의도가 코드에서 읽히지 않는다.
**Fix:** 63행 주석을 79행 요소 위의 한 줄("레이아웃 자리, 내용 없음")로 옮기고, 지나간 변경 설명은 지운다. 기존 시험(`phaseScreens.test.tsx` 의 "빈 hints 칸 1개")이 이 요소를 고정하고 있으므로 요소 자체는 유지한다.

### IN-04: 스크립트·E2E 판정 쪽 매직 넘버와 오류 수집 누락

**File:** `scripts/e2e/lib.mjs:~3935`(`dressLockChecks` 의 `s.cards.length !== 9`), `scripts/perf-run.mjs:947-962`(`runLight`)
**Issue:** (1) `dressLockChecks` 가 옷 개수 9 를 직접 박았다. `OUTFIT_IDS` 가 늘면 세 줄 모두 "측정 못 함"으로 돌아서 원인을 찾기 어렵다. (2) `runLight` 의 컨텍스트에는 같은 파일의 다른 측정 모드가 하는 `page.on("pageerror")` 수집이 없다. 페이지가 예외로 반쯤 그려진 캔버스도 휘도로 재서 순서 판정에 섞인다.
**Fix:** (1) `AVATAR` 쪽 상수나 `cards.length >= 1` 로 완화하고 `OUTFIT_IDS` 와의 대조는 `e2eContract.test.ts` 에 둔다. (2) `runLight` 에도 `pageerror` 를 모아 실패로 기록한다.

### IN-05: 화면 컴포넌트 파일에서 순수 함수 export, 고정 mask id 가정

**File:** `src/components/v2/TutorialEvidence.tsx:134-136`(`clampPoint`), `src/components/v2/FocusRing.tsx:97`(`MASK_ID`)
**Issue:** `clampPoint` 는 시험용으로 컴포넌트 파일에서 export 되어 React Fast Refresh 가 이 파일 변경을 전체 새로고침으로 처리한다. `FocusRing` 은 `MASK_ID` 를 고정 문자열로 쓰는데, `FocusRing` 이 두 곳 이상에서 동시에 마운트되면 `url(#tut-dim-mask)` 참조가 첫 mask 로 몰린다(현재는 `TutorialScreen` 한 곳뿐이라 안전).
**Fix:** `clampPoint` 를 `src/game/` 쪽 순수 모듈로 옮기고, `MASK_ID` 위에 "화면에 FocusRing 은 하나"라는 전제를 한 줄로 못 박아 둔다(이미 주석에 일부 있음, 전제를 명시적으로).

---

_검토: 2026-11-10_
_검토자: Claude (gsd-code-reviewer)_
_깊이: standard_
