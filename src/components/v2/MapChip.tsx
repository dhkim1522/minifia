import "../../styles/v2.css";
import type { MapChoice } from "../../../shared/protocol";
import { MAP_CHIP_NAME } from "../../game/dressText";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 오른쪽 열의 맵 단추 (11-13 지도 칩 → 16-06 V-2·V-5): 지금 고른 맵(재즈 바·광장·랜덤)을 아이콘으로 보인다.
// 상자가 곧 지름 52 원 면이다(아이콘 24). 글은 없고 이름은 aria-label(MAP_CHIP_NAME)이 맡는다(16페이즈 TOOL-04).
// 방장에게만 그린다(손님 화면은 칩을 그리지 않는다, T-16-13). 눌러 꾸미기 시트의 맵 탭을 연다. host 가 거짓이면 aria-disabled 이고 눌러도 아무 일 없다. 채팅 입력칸의 포커스(키보드)를 뺏지 않는다.
// 선택 값은 서버가 보낸 view.mapChoice 다 — 이 부품은 낙관 갱신을 하지 않는다.
// 19페이즈: 방장 줄 변형(P19-4) — rail 이면 색·표식만 방장 단추가 되고(금빛 테두리, 줄 표식 값 map) 아이콘·동작·data-map-chip 은 그대로다. rail 이 없으면 마크업이 예전 그대로다.

export interface MapChipProps {
  /** 서버의 선택 값(기본 random) */
  choice: MapChoice;
  /** 방장인가. 아니면 읽기 전용 */
  host: boolean;
  onPress(): void;
  /** 방장 줄(HostRail)의 칸인가. 참이면 방장 단추 모양(금빛 테두리)이고 오른쪽 열 표식 대신 줄 표식(값 map)을 단다 */
  rail?: boolean;
  /** 줄 변형에서만: 꾸미기 시트의 맵 탭이 열려 있다(눌림) */
  pressed?: boolean;
}

const ICON: Readonly<Record<MapChoice, V2IconName>> = { bar: "mapBar", plaza: "mapPlaza", random: "shuffle" };

export function MapChip({ choice, host, onPress, rail, pressed }: MapChipProps) {
  return (
    <button
      type="button"
      className={rail ? "mf-mapchip mv-hostrail-btn" : "mf-mapchip"}
      data-map-chip={choice}
      {...(rail ? { "data-host-rail-btn": "map", "aria-pressed": pressed === true } : { "data-side-button": "map" })}
      aria-label={MAP_CHIP_NAME[choice]}
      aria-disabled={host ? undefined : "true"}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (host) onPress();
      }}
    >
      <V2Icon name={ICON[choice]} size={24} />
    </button>
  );
}
