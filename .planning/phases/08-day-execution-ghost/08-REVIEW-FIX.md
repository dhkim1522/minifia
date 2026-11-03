---
phase: 08-day-execution-ghost
fixed_at: 2026-11-03T00:00:00Z
review_path: .planning/phases/08-day-execution-ghost/08-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 08: 코드 리뷰 수정 보고서

**수정 시각:** 2026-11-03
**원본 리뷰:** .planning/phases/08-day-execution-ghost/08-REVIEW.md
**반복:** 1

**요약:**
- 범위 내 지적: 4 (CR-01, WR-01, WR-02, WR-03)
- 수정: 4
- 건너뜀: 0
- 범위 밖: IN-01 ~ IN-05 (fix_scope 가 critical_warning 이라 손대지 않음)

서버 규칙(결정 0002)은 바꾸지 않았다. 수정은 모두 클라이언트 문구·컴포넌트 속성·E2E 실행기에 한정된다.

## Fixed Issues

### CR-01: 찬반 부결인데 처형 단계 화면 읽기가 "○○ 님 처형"이라고 알린다

**수정한 파일:** `src/screens/RoomScreen.tsx`, `test/client/phaseScreens.test.tsx`
**커밋:** 7d52664
**적용한 수정:** `executionAnnounceOf` 가 `view.day?.verdict?.passed !== true` 이면 `처형 없음` 을 돌려주고, 통과일 때만 `execution.seat ?? candidate` 로 `○○ 님 처형` 을 만든다(`dayView.phaseEntry` 와 같은 기준). phaseScreens 테스트에 통과(`하윤 님 처형`)와 부결(`처형 없음`, 변론자 이름 없음) 두 경우를 더했다. 수정 전 코드에서 부결 테스트가 `하윤 님 처형` 으로 실패하는 것을 확인했다.
**참고:** 처형 단계에서 `day.verdict` 가 아예 없는 view 도 `처형 없음` 이 된다(리뷰 제안 코드와 같은 동작). 서버는 처형 단계에 항상 verdict 를 싣는다.

### WR-01: 지목 동률·0표인 날의 결과 요약이 "처형 없음 (찬성 0 · 반대 0)"으로 나오고 동률/무표 구분이 사라진다

**수정한 파일:** `src/game/verdict.ts`, `test/unit/verdict.test.ts`, `test/client/resultScreen.test.tsx`
**커밋:** d5282cc
**적용한 수정:** `summaryLines` 에서 `!passed` 갈래 앞에 `log.cand` 가 있고 `candidate` 가 없으면 동률/던진 표 없음으로 가르는 갈래를 넣었다. 찬반 부결(`candidate` 있음)은 그대로 `찬성 n · 반대 m` 을 보인다. 테스트 고정값을 서버가 실제로 쌓는 `{ passed: false, cand: { votes } }`(candidate 없음) 모양으로 바꿨고, 옛 `passed: true` + candidate 없음 모양은 저장 방 이전용 별도 케이스로 남겼다. 찬반 부결 유지 케이스도 하나 추가했다.
**검증 상태:** 분기 순서가 걸린 논리 수정이다. 서버가 줄을 쌓는 모양(`shared/game/nomination.ts` 의 `cand: leader === undefined ? { votes } : { votes, candidate: leader }`)과 대조해 확인했지만, 결과 화면에서 동률·0표 날 문구를 사람이 한 번 봐 주면 좋다.

### WR-02: 게임 중 방장 화면에서 연결이 끊긴 사람의 이름표가 동작 없는 "내보내기" 버튼이 된다

**수정한 파일:** `src/components/WorldStage.tsx`, `src/screens/GameMap.tsx`, `test/client/worldStage.test.tsx`, `test/client/lobby.test.tsx`
**커밋:** 3b479ca
**적용한 수정:** `WorldStage` 의 `onKick` 을 선택 속성으로 바꾸고 `canKick` 에 `props.onKick !== undefined` 를 더했다. `GameMap` 은 빈 함수 `onKick={() => {}}` 를 넘기지 않는다. 대기실(`Lobby`)은 그대로 `onKick` 을 넘긴다. worldStage 테스트에 `onKick` 이 없으면 방장 화면에도 내보내기 버튼이 없음을 확인하는 케이스를 더했다. `onKick` 이 선택 속성이 되어 생긴 타입 오류를 막으려고 lobby 테스트의 `props().onKick(` 호출 다섯 곳을 `props().onKick!(` 로 고쳤다(동작 변화 없음).

### WR-03: E2E 실행기가 준비 실패로 재시도할 때 먼저 기록된 검사 실패를 버려 성공으로 바꿔 놓을 수 있다

**수정한 파일:** `scripts/e2e/run.mjs`
**커밋:** afdce12
**적용한 수정:** `runJob` 이 던진 시도의 `ctx.results` 중 `ok === false` 인 항목을 `carried` 에 모으고(같은 scenario·size·id·detail 은 한 번만), 재시도 결과와 상관없이 `results` 에 합친다. 재시도 로그 줄에도 그 시도에서 기록된 검사 실패 건수를 덧붙인다. 흐름이 끝까지 돌아 통과한 시도의 결과 처리는 그대로다.
**검증 상태:** 실제 Chrome 으로 E2E 를 돌리지 못했다. `node --check` 와 `test/unit/e2eContract.test.ts`·`scripts/e2e/lib.test.mjs` 만 확인했다. 실행기 재시도 경로는 배포본에서 E2E 를 돌릴 때 확인이 필요하다.

## 검증

실행 위치: 메인 작업 트리(`workflow.use_worktrees` 가 false 라 worktree 를 만들지 않았다), 브랜치 `v2`.

- `npx vitest run` (phaseScreens, verdict, resultScreen, worldStage, lobby, gameMap, e2eContract): 7개 파일, 386개 테스트 모두 통과
- `npx tsc -p tsconfig.app.json --noEmit`: 오류 없음
- `npx tsc -p tsconfig.worker.json --noEmit`: 오류 없음
- `npm run typecheck` 전체(`tokens:check`, `wrangler types` 포함)는 돌리지 않고 그 안의 두 `tsc` 만 직접 실행했다.
- 전체 테스트 묶음은 돌리지 않았다(지침상 지적별 검증만).

---

_수정 시각: 2026-11-03_
_수정자: Claude (gsd-code-fixer)_
_반복: 1_
