---
phase: 22-cleanup-single-mode
fixed_at: 2026-11-16T00:00:00Z
review_path: .planning/phases/22-cleanup-single-mode/22-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 22: Code Review Fix Report

**Fixed at:** 2026-11-16
**Source review:** .planning/phases/22-cleanup-single-mode/22-REVIEW.md
**Iteration:** 1

**Summary:**
- 범위: WR-01, WR-02, WR-04, IN-01, IN-02 (지시로 정한 범위. WR-03·IN-03·IN-04·IN-05 는 범위 밖)
- 고침: 5
- 건너뜀: 0
- 작업 위치: 주 작업 트리(v3 브랜치, 새 브랜치·worktree 없음)

## Fixed Issues

### WR-01: [남기기] 가 거절되거나 유실되면 시트가 '남김' 으로 굳고 다시 못 보낸다

**Files modified:** `src/net/useWill.ts`, `test/client/willFlow.test.tsx`
**Commit:** 74f14513
**Applied fix:** [남기기] 도 확인 대기로 본다(`finalWaiting`, `setFinalBoth`). 거절(`rejected` 증가)이 오면 '남김' 을 풀고 `onFail` 을 한 번 부른다. busyRef 를 저장 확인 대기와 [남기기] 대기의 합으로 켜서 화면 틀의 "지금은 고를 수 없어요" 이중 알림을 막는다. 단계가 넘어가 '남김' 이 낡으면 대기를 푼다(뒤의 거절 알림을 막지 않게). 시험: 거절 뒤 알림이 '보내지 못했어요' 한 번, [남기기] 재활성, 다시 보내면 final 이 한 번 더 나간다. 수정을 빼면 이 시험이 실패하는 것을 확인했다.
**범위 메모:** "유실" 중 서버가 거절 프레임을 돌려주는 경우(BAD_MESSAGE·WRONG_PHASE)만 다뤘다. 응답이 아예 없는 유실은 3초 타임아웃을 두면 기존 시험(3초가 지나도 알림이 없어야 함, 서버 응답 대기 표시 없음 설계)과 부딪히고, 성공 시 단계가 곧 넘어가 시트가 닫히므로 이번에는 넣지 않았다. 속도 제한은 서버가 경고 프레임을 따로 보내므로 BAD_MESSAGE·WRONG_PHASE 경로가 아니다.
**상태:** fixed (로직 변경이라 사람 확인 권장)

### WR-02: 마감 직전 자동 저장이 늦게 도착하면 처형 연출 순간에 오류 알림이 뜬다

**Files modified:** `src/net/useWill.ts`, `test/client/willFlow.test.tsx`
**Commit:** d397c047
**Applied fix:** 자동 저장을 보낸 뒤 `WILL_QUIET_MS`(1500ms) 동안 busyRef 를 켜서 GameMap 의 거절 분기(알림 + deny 신호)를 건너뛰게 한다. 자동 저장은 pending 이 아니라서 useWill 의 실패 처리도 타지 않으므로 시트·쓰던 글은 그대로다. 단계가 execution 으로 넘어간 뒤 닿은 거절도 조용하고, 조용한 구간이 지나면 일반 거절 알림은 다시 뜬다(시험으로 확인). 리뷰가 덧붙인 "측정한 왕복 시간으로 앞당김 값 조정" 은 범위를 넓히지 않으려 하지 않았다.
**상태:** fixed (로직 변경이라 사람 확인 권장)

### WR-04: 옛 방 리셋이 채팅 저장분과 월드의 lay·home 을 지우지 않는다

**Files modified:** `worker/room.ts`, `test/worker/legacyRoom.test.ts`(새 파일)
**Commit:** 0d740d46
**Applied fix:** DO 생성자에서 `isLegacyV3Room(stored)` 였던 방에 한해 `chat:` 저장 키를 모두 지우고(뒤따르는 `restoreChatLog` 가 빈 줄을 읽는다), `respawnAll` 로 모두를 입장 지점에 다시 세우고 월드를 저장한다(옛 lay·home 폐기). handleRematch·handleTestReset 과 같은 길이다. 표시가 없는 방은 건드리지 않는다. 시험은 `test/worker/legacyRoom.test.ts` 새 파일(워커 시험이 필요해 단위 폴더가 아니라 워커 폴더에 새로 만들었다): 옛 표시가 있으면 chat 키·chatLog·lay·home 이 비고, 표시가 없으면 채팅이 그대로 복원된다. 수정을 빼면 첫 시험이 실패하는 것을 확인했다.
**상태:** fixed

### IN-01: `DayView.voted` 가 선언만 남았다

**Files modified:** `shared/protocol.ts`
**Commit:** 1df5d86e
**Applied fix:** `DayView` 의 `voted?: number[]` 한 줄을 삭제했다. src·shared·worker·test 어디에서도 읽지 않는 것을 확인했고(결선·결전의 `voted` 는 별개로 유지) typecheck 가 통과한다.

### IN-02: 낡은 주석이 지금 동작과 반대로 적혀 있다

**Files modified:** `shared/game/nomination.ts`, `shared/game/phases.ts`, `shared/game/view.ts`, `src/game/dayView.ts`
**Commit:** a4afcd70
**Applied fix:** 주석만 고쳤다. nomination 의 마감 설명(castTurnPoint 가 PICK_GAP_MS 마감을 쓴다), phases 의 `NOMINATION_MS`·nomination 행(동시 투표 표현 제거, 자리 값·임시 마감 의미), view 의 찬반 유권자(후보 없음, 산 사람 전원), dayView 머리(동시 투표 표현 제거). `NOMINATION_MS` 이름은 e2eContract 시험·스크립트 사본이 참조해 바꾸지 않았다.

## Skipped Issues

범위에서 일부러 뺀 항목(수정 시도 없음):

- WR-03: 수용한 한계(D-30) — 옛 표시가 하나도 없는 배포 전 방.
- IN-03: 설계 확인용(D-11), 플레이테스트 결과를 본다.
- IN-04: 지시 범위 밖.
- IN-05: 필요성 판정 항목, 지시 범위 밖.

## 검증

실행 위치: 주 작업 트리(worktree 미사용). 수정마다 `npm run typecheck` 와 건드린 시험 파일을 돌렸다.

- `npm run typecheck`: 통과
- `npx vitest run --project client --project unit`: 195 파일 통과 / 1 건너뜀, 6684 시험 통과
- `npx vitest run test/worker/legacyRoom.test.ts test/worker/will.test.ts test/worker/leak.test.ts`: 3 파일 통과(39 통과, 2 건너뜀)
- 추가로 생성자를 건드린 영향 확인: `test/worker/chatReplay.test.ts`, `day.test.ts`, `world.test.ts` 통과(72)
- 워커 로드 불안정 재시도는 필요하지 않았다.
- 저장소 위생 검사(커밋 전 지정 패턴 grep): 바뀐 파일 전부 결과 없음

---

_Fixed: 2026-11-16_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
