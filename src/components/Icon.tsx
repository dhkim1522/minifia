// RED 뼈대: GREEN 에서 채운다.
export type IconName = "back" | "share" | "close" | "copy" | "check" | "card" | "diamond" | "disconnected";

export function Icon(_p: { name: IconName; size?: number; label?: string; className?: string }) {
  return <svg />;
}
