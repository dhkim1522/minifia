import type { ReactElement } from "react";
import type { MapStatus } from "../world/status";
import { MAP_STATUS_COPY } from "../world/status";
import { Button } from "./Button";

// 맵 상태 카드(MAP-05, UI-SPEC 연결·복귀 상태의 WebGL 행). 문구는 status.ts 의 MAP_STATUS_COPY 가 정본이다(같은 글자를 다시 쓰지 않는다).
// 준비되면(ready) 아무것도 그리지 않는다. 소실·재생성 중(redrawing)은 문구 한 줄뿐인 작은 카드이고, 가림막(40%)은 WorldStage 가 깐다.
// 흰·검은 화면이 남지 않게 모든 실패 상태에 문구와 갈 길(다시 시도·나가기·새로 고침)이 있다.

export interface MapStatusCardProps {
  status: MapStatus;
  onRetry(): void;
  onLeave(): void;
  onReload(): void;
}

export function MapStatusCard({ status, onRetry, onLeave, onReload }: MapStatusCardProps): ReactElement | null {
  switch (status) {
    case "ready":
      return null;
    case "lost":
    case "recreating":
      return (
        <div className="mf-mapcard mf-mapcard--small" role="status">
          <p className="mf-t-body mf-mapcard__title">{MAP_STATUS_COPY.redrawing.title}</p>
        </div>
      );
    case "loading":
      return (
        <div className="mf-mapcard" role="status">
          <p className="mf-t-heading mf-mapcard__title">{MAP_STATUS_COPY.loading.title}</p>
        </div>
      );
    case "loadFailed":
      return <ActionCard copy={MAP_STATUS_COPY.loadFailed} onAction={onRetry} />;
    case "unsupported":
      return <ActionCard copy={MAP_STATUS_COPY.unsupported} onAction={onLeave} />;
    case "failed":
      return <ActionCard copy={MAP_STATUS_COPY.failed} onAction={onReload} />;
  }
}

function ActionCard({ copy, onAction }: { copy: { title: string; body?: string; action?: string }; onAction(): void }): ReactElement {
  return (
    <div className="mf-mapcard" role="alert">
      <h2 className="mf-t-heading mf-mapcard__title">{copy.title}</h2>
      {copy.body ? <p className="mf-t-body mf-t-muted mf-mapcard__body">{copy.body}</p> : null}
      {copy.action ? (
        <Button variant="primary" onClick={onAction}>
          {copy.action}
        </Button>
      ) : null}
    </div>
  );
}
