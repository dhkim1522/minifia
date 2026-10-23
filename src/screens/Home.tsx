import { useState } from "react";
import type { FormEvent } from "react";
import { APP_VERSION } from "../../shared/version";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { createRoom } from "../net/api";

interface HomeProps {
  onEnterRoom: (code: string, token: string) => void;
}

// S-01 첫 화면. 코드로 참가하는 줄은 01-06 이 이 카드에 더한다.
export function Home({ onEnterRoom }: HomeProps) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const result = await createRoom(nickname);
    setBusy(false);
    if (result.ok) {
      onEnterRoom(result.data.code, result.data.token);
    } else {
      setFailed(true);
    }
  }

  return (
    <Backdrop layout="entry" variant="lobby">
      <main className="mf-root mf-entry">
        <header className="mf-entry__head">
          <p className="mf-t-label">친구들과 한 판, 점심시간 마피아</p>
          <h1 className="mf-t-display">미니피아</h1>
        </header>
        <form className="mf-entry__card" onSubmit={handleCreate}>
          <TextField label="닉네임" kind="nickname" value={nickname} onChange={setNickname} />
          <Button variant="primary" block type="submit" disabled={busy}>
            방 만들기
          </Button>
          {failed && (
            <p className="mf-field__error" role="alert">
              방을 만들지 못했어요. 다시 시도해 주세요
            </p>
          )}
        </form>
        <p className="mf-version">v{APP_VERSION}</p>
      </main>
    </Backdrop>
  );
}
