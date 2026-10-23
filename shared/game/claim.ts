// 직업 공개 규칙(DAY-02): 이번 낮 직접 고른 값(claimChoice)을 마감 순간 한꺼번에 공개 값(claimShown)으로 확정한다.
// 순수 모듈이다 — 현재 시각·난수를 읽지 않고, DOM·workerd API 를 쓰지 않는다. 입력 상태는 바꾸지 않는다.
//
// 서버는 주장의 참·거짓을 보지 않는다(D-10, 결정 0007): 이 파일은 플레이어의 실제 역할 필드를 읽지 않는다.
//
// 마감 확정 규칙표(02-RESEARCH Pattern 2, UI-SPEC "확인 필요 2" 확정). "연결됨" 은 마감 처리 시점의 players[].connected 다.
//   1일차, 미선택                       → none            (changed false)
//   1일차, 직접 선택 R                  → R               (changed false, 어제 없음)
//   2일차+, 어제 R, 미선택, 연결됨      → R 유지          (changed false)
//   2일차+, 어제 R, 미선택, 끊김        → none            (changed false, R→none 은 표시 없음)
//   어제 R, 오늘 R' ≠ R                 → R'              (changed true)
//   어제 R, 오늘 none                   → none            (changed false)
//   어제 none, 오늘 R                   → R               (changed false, 처음 주장으로 본다)
//   어제 none, 미선택, 연결됨           → none            (changed false)
//   끊긴 사람이라도 직접 고른 값이 있으면 그 값이 공개된다.
// 공개 뒤 claimLast = 공개 값. claimLast 가 매일 공개 값으로 덮이므로 어제 R → 오늘 none → 내일 R' 는
// 말 바꿈이 아니다 — "직전 낮이 말 안 함이면 처음 주장으로 본다"(D-08 권장안)의 직접 결과이며(A3), 결정 0016 에 기록한다.
import type { Claim } from "../protocol";
import type { Player, RoomState } from "./room";

/** 마감 순간의 공개 값. 직접 고른 값이 있으면 그 값, 없으면 연결된 사람은 어제 값을 이어받고 끊긴 사람은 말 안 함(D-05, D-09). */
function shownFor(p: Player): Claim {
  if (p.claimChoice !== undefined) return p.claimChoice;
  if (!p.connected) return "none";
  return p.claimLast ?? "none";
}

/** 말 바꿈: 어제 직업을 공개했는데 오늘 다른 직업을 공개했다(D-08 권장안). 말 안 함이 끼면 표시하지 않는다. */
function changedFrom(last: Claim | undefined, shown: Claim): boolean {
  return last !== undefined && last !== "none" && shown !== "none" && shown !== last;
}

/**
 * claimReveal 진입 훅. 모든 플레이어의 claimShown·claimChanged·claimLast 를 새 객체로 확정한다.
 * claimChoice 는 여기서 지우지 않는다 — 다음 낮 claim 진입(enterClaim)이 지운다.
 * 마감 전에는 어떤 경로도 claimChoice 를 claimShown 으로 옮기지 않는다(D-01, T-02-04): 공개는 이 훅에서만 일어난다.
 */
export function enterClaimReveal(state: RoomState): RoomState {
  return {
    ...state,
    players: state.players.map((p) => {
      const shown = shownFor(p);
      return { ...p, claimShown: shown, claimChanged: changedFrom(p.claimLast, shown), claimLast: shown };
    }),
  };
}
