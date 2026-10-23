import type { ReactElement } from "react";
import type { ClientMessage, RoomView } from "../../shared/protocol";

// 자리표시자: RED 단계에서 테스트가 import 오류가 아닌 단언 실패로 실패하도록 둔다. 02-08 GREEN 이 구현으로 바꾼다.
export function ClaimPanel(_props: {
  view: RoomView;
  canSend: boolean;
  send: (msg: ClientMessage) => boolean;
}): ReactElement | null {
  return null;
}
