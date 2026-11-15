// 밤 집 문패 파생(21페이즈 D-10·D-25, UI-SPEC P21-3~P21-5). 확장판(원인 흐름) 밤에 모든 역할이 같은 개관 화면에서 집 문패를 눌러 대상을 고른다 — 이 함수는 역할을 읽지 않는다.
// 읽는 값은 판 규칙(rulesetOf(modeOf))·단계·players(공개 alive·닉네임)·내 좌석·내 선택(me.pick, 서버가 본인에게만 보낸 값)·집 창 켜짐(houseLitOf)·빛남 대상(callTargetsOf)뿐이다.
// 3D 집 창과 문패 창 점은 houseLitOf 한 값에서 나온다(P21-4). 고름은 내 화면에만 있다 — 남의 선택은 view 에 없다(T-21-32).
import { isAlive } from "../../shared/game/alive";
import { modeOf, rulesetOf } from "../../shared/game/ruleset";
import type { RoomView } from "../../shared/protocol";
import { callTargetsOf } from "./hostLine";
import { houseLitOf } from "./lampView";

/** 문패 한 곳(집 i = 좌석 i). 맵 층(WorldStage)이 위치를, HouseTag 가 모양을 맡는다 */
export interface HouseTagModel {
  seat: number;
  /** 이 좌석에 앉은 사람의 닉네임(탈락자 포함). 빈 좌석은 null */
  nickname: string | null;
  /** 주인이 있다(탈락자 포함) — 얼굴 그림을 그린다 */
  owner: boolean;
  /** 주인이 산 사람이다. 단추가 아닌 문패는 산 사람이 아닐 때만 흐리다 */
  alive: boolean;
  /** 누를 수 있다: 산 사람의 집 + 내가 산 사람(내 집 포함, D-10) */
  button: boolean;
  /** 창 점 켜짐 = houseLitOf 의 같은 칸 */
  lit: boolean;
  /** 내가 고른 집(내 화면만) */
  picked: boolean;
  /** 지금 눌러 보라고 깜빡이는 집: 아직 안 골랐을 때 단추인 문패 전부(P21-5) */
  call: boolean;
}

/** 집은 좌석 수와 같이 8채다(shared/game/mapTown.ts 의 TOWN_HOUSES) */
const HOUSE_COUNT = 8;

/**
 * 밤 문패 8개. 원인 흐름 밤이 아니면 빈 목록. local.pick 은 내가 누른 즉시의 선택(서버 view 가 오면 서버 값이 이긴다 — 화면 쪽 useViewChoice 가 맞춘다).
 * 고른 뒤에는 빛남이 모두 꺼진다(P21-5). 유령 화면은 단추도 빛남도 없다(UI-SPEC C 유령 행).
 */
export function houseTagsOf(view: RoomView, local: { pick?: number } = {}): HouseTagModel[] {
  if (view.phase !== "night" || !rulesetOf(modeOf(view)).cause) return [];
  const me = view.players.find((p) => p.seat === view.me.seat);
  const meAlive = me === undefined || isAlive(me);
  const lit = houseLitOf(view);
  const pick = local.pick ?? view.me.pick;
  const call = callTargetsOf(view);
  const calling = pick === undefined && meAlive && call?.kind === "houses" ? new Set(call.seats) : new Set<number>();
  const tags: HouseTagModel[] = [];
  for (let seat = 0; seat < HOUSE_COUNT; seat++) {
    const owner = view.players.find((p) => p.seat === seat);
    const alive = owner !== undefined && isAlive(owner);
    const button = meAlive && alive;
    tags.push({
      seat,
      nickname: owner === undefined ? null : owner.nickname,
      owner: owner !== undefined,
      alive,
      button,
      lit: lit?.[seat] === true,
      picked: button && pick === seat,
      call: button && calling.has(seat),
    });
  }
  return tags;
}
