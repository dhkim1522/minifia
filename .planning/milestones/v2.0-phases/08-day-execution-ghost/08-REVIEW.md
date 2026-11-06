---
phase: 08-day-execution-ghost
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - HANDOFF.md
  - scripts/e2e/run.mjs
  - src/components/WorldStage.tsx
  - src/game/verdict.ts
  - src/screens/GameMap.tsx
  - src/screens/RoomScreen.tsx
  - test/client/lobby.test.tsx
  - test/client/phaseScreens.test.tsx
  - test/client/resultScreen.test.tsx
  - test/client/worldStage.test.tsx
  - test/unit/verdict.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 08: Code Review Report (재검토)

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

이전 리뷰(`380efc4`)의 CR-01, WR-01, WR-02, WR-03 수정(`git diff 380efc4 HEAD`)을 서버 쪽 실제 데이터 모양과 대조해 다시 확인했다. 네 수정 모두 의도한 문제를 고쳤고 새 회귀는 찾지 못했다. Critical·Warning 은 없고, 아래 Info 2건만 새로 남긴다. 이전 리뷰의 IN-01 ~ IN-05 는 이번 변경 범위가 건드리지 않아 상태가 그대로 open 이다(재보고하지 않음).

수정별 확인 결과는 다음과 같다.

- **CR-01 (`RoomScreen.tsx:100-105`)**: 서버 `buildDay`(`shared/game/view.ts:82-95`)는 `execution` 단계에서 `day.verdict` 를 항상 그날 voteLog 줄의 `exec` 로 채우고, `day.execution` 은 `state.execution` 이 있을 때만(통과) 싣는다. 새 코드는 `verdict.passed !== true` 이면 `처형 없음` 을 돌려주므로 부결·verdict 없는 view 모두 거짓 처형 문구가 나오지 않는다. 통과 갈래의 `view.day.execution?.seat ?? view.day.candidate` 는 위 가드로 `view.day` 가 좁혀져 타입도 맞다. 통과·부결 두 경우를 `phaseScreens.test.tsx` 가 고정한다. 문제 없음.
- **WR-01 (`verdict.ts:89-92`)**: 서버 `resolveNomination` 이 동률·0표 날에 쌓는 줄(`exec {0,0,false}`, `cand {votes}` 에 `candidate` 없음, `nomination.ts:92-93`)이 새 갈래로 들어가 동률/무표가 가려진다. 찬반 부결(`cand.candidate` 있음)은 새 갈래를 피해 기존 `찬성 n · 반대 m` 으로 간다. 분기 순서(통과+후보 → 동률/무표 → 부결 → 옛 모양)가 맞고, 테스트 고정값이 서버가 실제로 쌓는 모양으로 바뀌었으며 부결 유지·옛 모양 이전 케이스가 따로 있다. 문제 없음(아래 IN-06 은 정리 후보).
- **WR-02 (`WorldStage.tsx:78,229,320`, `GameMap.tsx:347`)**: `onKick` 이 선택 속성이 되고 `canKick` 에 `onKick !== undefined` 가 추가됐다. `WorldStage` 를 쓰는 곳은 `Lobby.tsx:145`(onKick 전달)와 `GameMap` 둘뿐이라 대기실 동작은 그대로고, 게임 중 맵은 끊긴 사람 이름표가 일반 이름표로 남아 탭을 가로채지 않는다. 클릭 핸들러의 `onKick?.()` 도 안전하다. worldStage 테스트가 `onKick: undefined` 를 고정한다. 문제 없음.
- **WR-03 (`run.mjs:149-181`)**: 던진 시도의 `ok === false` 항목을 `carried` 에 모아 재시도 결과와 무관하게 `results` 에 합치므로, 이전에 가려지던 검사 실패가 최종 결과에 남는다. `info: true` 참고 행은 `ok: true` 라 걸러진다. 마지막 시도까지 실패해도 `carried` 가 `S4` 줄 앞에 합쳐진다. 동작은 맞지만 아래 IN-07 의 두 가지 가장자리가 있다. 실제 Chrome E2E 는 이번에도 돌리지 못했다는 점은 HANDOFF 가 이미 밝히고 있다.

HANDOFF.md 변경(검증 상태·다음 할 일 갱신)은 사실과 맞고 회사·조직 관련 표현도 없다. 변경 파일 전체에 대해 원격 레포 위생 검사 명령(`~/personal/CLAUDE.md`)을 돌려 해당 표현이 없음을 확인했다(`gameRoom.test.ts` 의 `seatOrdered` 는 무관한 일치).

## Info

### IN-06: `summaryLines` 마지막 `else` 의 삼항식이 도달하지 않는 갈래가 됐다

**File:** `src/game/verdict.ts:96-98`
**Issue:** WR-01 수정으로 `log.cand !== undefined && log.cand.candidate === undefined` 인 모든 줄이 새 갈래에서 먼저 처리된다. 그래서 마지막 `else`(`passed === true`, `candidate` 없음)에는 `log?.cand === undefined`(저장 방 이전 모양)이거나 `cand.candidate` 가 있는데 `row.exec.candidate` 만 없는 모순된 입력만 닿는다. 앞쪽 조건 `log?.cand !== undefined && log.cand.votes.length === 0` 은 사실상 참이 될 수 없어(후보가 있으면 득표 줄이 비지 않는다) `"처형 없음 (던진 표 없음)"` 갈래는 죽은 코드다. 저장 방 이전 테스트("옛 모양")가 던진 표 없음을 기대하는 케이스는 `cand: { votes: [] }` 가 있는 모양이라 새 갈래에서 처리되며, 이 마지막 `else` 를 거치지 않는다.
**Fix:** 마지막 `else` 를 단순화한다.
```ts
} else {
  // 저장 방 이전 모양(passed:true · candidate 없음 · cand 없음)
  text = "처형 없음 (동률)";
}
```
또는 새 갈래와 합쳐 `passed` 값과 무관하게 `cand` 로만 판정하도록 한 번에 정리한다.

### IN-07: 실행기가 모은 이전 시도의 검사 실패에 중복·재시도 원인 오인 가능성이 있다

**File:** `scripts/e2e/run.mjs:164-173`
**Issue:** (1) `carriedKeys` 는 던진 시도들 안에서만 중복을 거른다. 이전 시도에서 검사 X 가 실패하고 던진 뒤, 재시도 시도가 같은 검사 X 를 실패하고도 끝까지 돌아 `results.push(...ctx.results)` 로 들어가면 같은 항목이 결과 표에 두 번 나온다(실패 건수가 부풀려지고 요약이 헷갈린다). (2) 던진 시도에서 기록된 검사 실패는 그 시도를 던지게 만든 같은 간헐 문제(방 준비 실패, 화면이 아직 안 뜸 등)의 결과일 수도 있다. 이 경우 재시도가 통과해도 실행은 실패로 끝나, 이전 설계가 감수하던 간헐 재시도의 이점이 줄어든다. 의도(실패를 가리지 않음)에는 맞는 동작이지만 로그만으로는 어느 쪽인지 구분되지 않는다.
**Fix:** 성공한 시도의 결과를 합칠 때도 같은 키로 한 번 더 걸러 중복을 막는다.
```js
const seen = new Set(carriedKeys);
const own = ctx.results.filter((r) => r.ok !== false || !seen.has(JSON.stringify([r.scenario, r.size, r.id, r.detail])));
results.push(...own);
```
그리고 재시도 로그에 실패 검사 id 를 몇 개 덧붙여(`failed.map((r) => r.id).join(",")`) 사람이 재시도 원인과 실제 실패를 구분하도록 한다.

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
