import "../../styles/v2.css";
import type { MapChoice } from "../../../shared/protocol";
import { MAP_CHIP_NAME } from "../../game/dressText";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 오른쪽 열의 맵 단추 (11-13 지도 칩 → 16-06 V-2·V-5): 지금 고른 맵(재즈 바·광장·랜덤)을 아이콘으로 보인다.
// 상자가 곧 지름 52 원 면이다(아이콘 24). 글은 없고 이름은 aria-label(MAP_CHIP_NAME)이 맡는다(16페이즈 TOOL-04).
// 방장에게만 그린다(손님 화면은 칩을 그리지 않는다, T-16-13). 눌러 꾸미기 시트의 맵 탭을 연다. host 가 거짓이면 aria-disabled 이고 눌러도 아무 일 없다. 채팅 입력칸의 포커스(키보드)를 뺏지 않는다.
// 선택 값은 서버가 보낸 view.mapChoice 다 — 이 부품은 낙관 갱신을 하지 않는다.

export interface MapChipProps {
  /** 서버의 선택 값(기본 random) */
  choice: MapChoice;
  /** 방장인가. 아니면 읽기 전용 */
  host: boolean;
  onPress(): void;
}

const ICON: Readonly<Record<MapChoice, V2IconName>> = { bar: "mapBar", plaza: "mapPlaza", random: "shuffle" };

export function MapChip({ choice, host, onPress }: MapChipProps) {
  return (
    <button
      type="button"
      className="mf-mapchip"
      data-map-chip={choice}
      data-side-button="map"
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
