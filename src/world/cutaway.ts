// 컷어웨이 판정(20페이즈 D-10·D-11, UI-SPEC P20-8) — 순수 모듈: three·DOM 을 읽지 않는다.
// 어느 방을 걷을지는 서버의 구역과 같은 함수(shared zoneOf)의 결과를 받아 정할 뿐, 화면이 따로 판단하지 않는다.
// 내가 방 안이면 그 방 하나, 유령·결과 화면(roomsOpen)이면 네 방 모두, 그 밖(광장·문턱)은 모두 덮는다.
import { ROOM_IDS } from "../../shared/protocol";
import type { RoomId, ZoneId } from "../../shared/protocol";

const ALL: readonly RoomId[] = ROOM_IDS;

/** 열린(걷힌) 방의 집합. zone 은 내 그려진 위치의 구역(내 몸이 아직 없으면 null), all 은 유령·결과 화면 */
export function cutawayOf(zone: ZoneId | null, all: boolean): ReadonlySet<RoomId> {
  if (all) return new Set(ALL);
  if (zone !== null && (ALL as readonly string[]).includes(zone)) return new Set<RoomId>([zone as RoomId]);
  return new Set<RoomId>();
}

/** 두 집합이 같은 방들을 담고 있나(런타임이 바뀐 때만 렌더러에 보내려고 쓴다) */
export function sameRooms(a: ReadonlySet<RoomId>, b: ReadonlySet<RoomId>): boolean {
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}
