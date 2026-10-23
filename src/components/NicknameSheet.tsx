import { useRef } from "react";
import type { FormEvent } from "react";
import { Button } from "./Button";
import { Sheet } from "./Sheet";
import { TextField } from "./TextField";
import { validateNickname } from "../../shared/nickname";

export interface NicknameSheetProps {
  /** 방 만들기 후 열렸는지, 코드 참가 후 열렸는지. 제출 버튼 글자만 다르다 */
  mode: "create" | "join";
  nickname: string;
  onNicknameChange: (v: string) => void;
  error?: string | null;
  /** 요청 중이거나 닉네임이 유효하지 않으면 제출을 막는다 */
  submitDisabled: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

// 첫 화면에서 [방 만들기]·[참가] 를 누르면 올라오는 닉네임 시트(S-01, 결정 0014).
// 마지막에 쓴 닉네임은 미리 채워져 있고, 열릴 때 쓸 수 있는 닉네임이 채워져 있으면 포커스는 제출 버튼, 아니면 입력칸에 간다.
export function NicknameSheet({ mode, nickname, onNicknameChange, error, submitDisabled, onSubmit, onClose }: NicknameSheetProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const submitLabel = mode === "create" ? "만들기" : "참가하기";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!submitDisabled) onSubmit();
  };

  return (
    // 미리 채운 닉네임이 쓸 수 있으면 포커스를 제출 버튼에 둬 키패드가 저절로 뜨지 않게 한다. 비어 있거나 고쳐야 하면 입력칸.
    <Sheet label="내 닉네임" onClose={onClose} initialFocusRef={validateNickname(nickname).ok ? submitRef : inputRef} showClose>
      <form className="mf-nick-sheet" onSubmit={handleSubmit}>
        <h2 className="mf-t-heading mf-sheet__title">내 닉네임</h2>
        <TextField label="닉네임" kind="nickname" value={nickname} onChange={onNicknameChange} error={error} inputRef={inputRef} />
        <Button ref={submitRef} variant="primary" block type="submit" disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </form>
    </Sheet>
  );
}
