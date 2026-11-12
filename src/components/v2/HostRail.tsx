import type { ReactNode } from "react";

// 방장 줄 틀(19페이즈 자리 — 부품은 다음 커밋이 채운다).
export interface HostRailLayout {
  crown: boolean;
  columns: number[];
}

export function hostRailLayout(_n: number, _maxH: number, _cell = 52, _gap = 12, _crown = 20): HostRailLayout {
  return { crown: false, columns: [] };
}

export interface HostRailProps {
  maxHeight: number;
  testShift?: boolean;
  children: ReactNode;
}

export function HostRail(_props: HostRailProps) {
  return null;
}
