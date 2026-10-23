import { useState } from "react";
import type { FormEvent } from "react";
import { APP_VERSION } from "../../shared/version";
import { validateNickname } from "../../shared/nickname";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { Toast, useToast } from "../components/Toast";
import { createRoom } from "../net/api";
import { messageForApiError, nicknameErrorText } from "../net/copy";

interface HomeProps {
  onEnterRoom: (code: string, token: string) => void;
}

// S-01 첫 화면. 코드로 참가하는 줄은 01-06 이 이 카드에 더한다.
export function Home({ onEnterRoom }: HomeProps) {
  const [nickname, setNickname] = useState("");
  // 처음 열었을 때는 오류 문장이 없다. 한 번 입력한 뒤부터 칸 아래에 보여 준다.
  const [touched, setTouched] = useState(false);
  const [serverNicknameError, setServerNicknameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  const validation = validateNickname(nickname);
  const localError = touched && !validation.ok ? nicknameErrorText(validation.reason) : null;
  const nicknameError = serverNicknameError ?? localError;

  function handleNicknameChange(value: string) {
    setNickname(value);
    setTouched(true);
    setServerNicknameError(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (busy || !validation.ok) return;
    setBusy(true);
    setServerNicknameError(null);
    const result = await createRoom(validation.nickname);
    setBusy(false);
    if (result.ok) {
      onEnterRoom(result.data.code, result.data.token);
      return;
    }
    // 방 만들기에서 나올 수 있는 오류는 닉네임 칸 아래와 토스트뿐이다. 입력한 닉네임은 지우지 않는다.
    const message = messageForApiError(result.error, "create");
    if (message.place === "nickname") setServerNicknameError(message.text);
    else show(message.text);
  }

  return (
    <Backdrop layout="entry" variant="lobby">
      <main className="mf-root mf-entry">
        <header className="mf-entry__head">
          <p className="mf-t-label">친구들과 한 판, 점심시간 마피아</p>
          <h1 className="mf-t-display">미니피아</h1>
        </header>
        <form className="mf-entry__card" onSubmit={handleCreate}>
          <TextField
            label="닉네임"
            kind="nickname"
            value={nickname}
            onChange={handleNicknameChange}
            error={nicknameError}
          />
          <Button variant="primary" block type="submit" disabled={!validation.ok || busy}>
            방 만들기
          </Button>
        </form>
        <p className="mf-version">v{APP_VERSION}</p>
      </main>
      <Toast toast={toast} placement="bottom" />
    </Backdrop>
  );
}
