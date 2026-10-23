import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { validateNickname } from "../../shared/nickname";
import { isRoomCode } from "../../shared/roomCode";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import { Toast, useToast } from "../components/Toast";
import { createRoom, joinRoom } from "../net/api";
import { preloadEntryAssets } from "../net/assets";
import { messageForApiError, nicknameErrorText } from "../net/copy";
import { loadLastNickname, loadSession, saveLastNickname } from "../net/session";

interface HomeProps {
  onEnterRoom: (code: string, token: string) => void;
}

// S-01 첫 화면. 닉네임으로 방을 만들거나, 받은 4자리 코드로 들어온다.
export function Home({ onEnterRoom }: HomeProps) {
  // 마지막으로 쓴 닉네임을 미리 채운다(D-06). 미리 채운 값은 입력한 것이 아니라서 오류 문장은 아직 없다.
  const [nickname, setNickname] = useState(loadLastNickname);
  const [code, setCode] = useState("");
  // 처음 열었을 때는 오류 문장이 없다. 한 번 입력한 뒤부터 칸 아래에 보여 준다.
  const [touched, setTouched] = useState(false);
  // 서버가 거절한 이유는 한 번에 하나만, 해당 칸 아래에 둔다. 그 칸을 고치면 지운다.
  const [serverNicknameError, setServerNicknameError] = useState<string | null>(null);
  const [serverCodeError, setServerCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();

  // 대기실 첫 그림(배경·인물)이 비어 보이지 않게 첫 화면에서 미리 받아 둔다.
  useEffect(() => {
    preloadEntryAssets();
  }, []);

  const validation = validateNickname(nickname);
  const localError = touched && !validation.ok ? nicknameErrorText(validation.reason) : null;
  const nicknameError = serverNicknameError ?? localError;
  const canJoin = validation.ok && isRoomCode(code) && !busy;

  function handleNicknameChange(value: string) {
    setNickname(value);
    setTouched(true);
    setServerNicknameError(null);
  }

  function handleCodeChange(value: string) {
    setCode(value);
    setServerCodeError(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (busy || !validation.ok) return;
    setBusy(true);
    setServerNicknameError(null);
    setServerCodeError(null);
    const result = await createRoom(validation.nickname);
    setBusy(false);
    if (result.ok) {
      saveLastNickname(validation.nickname);
      onEnterRoom(result.data.code, result.data.token);
      return;
    }
    // 방 만들기에서 나올 수 있는 오류는 닉네임 칸 아래와 토스트뿐이다. 입력한 닉네임은 지우지 않는다.
    const message = messageForApiError(result.error, "create");
    if (message.place === "nickname") setServerNicknameError(message.text);
    else show(message.text);
  }

  async function handleJoinCode(e: FormEvent) {
    e.preventDefault();
    if (!canJoin || !validation.ok) return;
    // 이 브라우저가 이미 그 방의 토큰을 갖고 있으면 다시 참가하지 않고 같은 자리로 돌아간다(D-07).
    const stored = loadSession();
    if (stored && stored.code === code) {
      onEnterRoom(code, stored.token);
      return;
    }
    setBusy(true);
    setServerNicknameError(null);
    setServerCodeError(null);
    const result = await joinRoom(code, validation.nickname);
    setBusy(false);
    if (result.ok) {
      saveLastNickname(validation.nickname);
      onEnterRoom(code, result.data.token);
      return;
    }
    // 입력한 닉네임·코드는 지우지 않는다. 문구와 자리는 copy.ts 가 정한다.
    const message = messageForApiError(result.error, "home-code");
    if (message.place === "code") setServerCodeError(message.text);
    else if (message.place === "nickname") setServerNicknameError(message.text);
    else show(message.text);
  }

  return (
    <Backdrop layout="entry" variant="lobby">
      <main className="mf-root mf-entry">
        <header className="mf-entry__head">
          <p className="mf-t-label">친구들과 한 판, 점심시간 마피아</p>
          <h1 className="mf-t-display">미니피아</h1>
        </header>
        <div className="mf-entry__card">
          <form className="mf-entry__form" onSubmit={handleCreate}>
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
          <p className="mf-entry__divider">또는</p>
          <form className="mf-entry__form" onSubmit={handleJoinCode}>
            <TextField
              label="방 코드"
              kind="code"
              value={code}
              onChange={handleCodeChange}
              placeholder="4자리 숫자"
              error={serverCodeError}
              trailing={
                <Button variant="secondary" type="submit" disabled={!canJoin} className="mf-btn--field">
                  참가
                </Button>
              }
            />
          </form>
        </div>
      </main>
      <Toast toast={toast} placement="bottom" />
    </Backdrop>
  );
}
