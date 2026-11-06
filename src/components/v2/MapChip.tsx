import "../../styles/v2.css";
import type { MapChoice } from "../../../shared/protocol";
import { MAP_CHIP_NAME } from "../../game/dressText";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 왼쪽 위 지도 칩 (11-13, UI-SPEC D-20·O-11): 지금 고른 맵(재즈 바·광장·랜덤)을 모두에게 아이콘으로 보인다.
// 시각 원 36(아이콘 24 + 안쪽 6)을 44×44 누르기 영역이 감싼다(바깥 4 는 음수 여백이라 자리는 36 만 차지한다). 글자는 아이콘 아래 이름표 '맵' 한 단어뿐(14-07 TOOL-01).
// 방장은 눌러 꾸미기 시트의 맵 탭을 연다. 손님은 aria-disabled 이고 눌러도 아무 일 없다. 채팅 입력칸의 포커스(키보드)를 뺏지 않는다.
// 선택 값은 서버가 보낸 view.mapChoice 다 — 이 부품은 낙관 갱신을 하지 않는다.

export interface MapChipProps {
  /** 서버의 선택 값(기본 random) */
  choice: MapChoice;
  /** 방장인가. 아니면 읽기 전용 */
  host: boolean;
  onPress(): void;
}

/** 이름표(TOOL-01 목록 3): 보이는 낱말. 접근성 이름 MAP_CHIP_NAME 은 이 낱말로 시작한다 */
const TOOL_WORD = "맵";

const ICON: Readonly<Record<MapChoice, V2IconName>> = { bar: "mapBar", plaza: "mapPlaza", random: "shuffle" };

export function MapChip({ choice, host, onPress }: MapChipProps) {
  return (
    <button
      type="button"
      className="mf-mapchip"
      data-map-chip={choice}
      data-tool-label={TOOL_WORD}
      aria-label={MAP_CHIP_NAME[choice]}
      aria-disabled={host ? undefined : "true"}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        if (host) onPress();
      }}
    >
      <span className="mf-mapchip__disc">
        <V2Icon name={ICON[choice]} size={24} />
      </span>
      <span className="mf-mapchip__label">{TOOL_WORD}</span>
    </button>
  );
}
