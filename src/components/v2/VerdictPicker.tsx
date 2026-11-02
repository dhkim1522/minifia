// RED 단계 임시 뼈대 — 다음 커밋(feat)에서 채운다.
export interface VerdictPickerProps {
  value?: "yes" | "no";
  onChange: (v: "yes" | "no") => void;
  disabled?: boolean;
}
export function VerdictPicker(_props: VerdictPickerProps) {
  return null;
}
