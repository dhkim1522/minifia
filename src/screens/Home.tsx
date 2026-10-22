import { useState } from "react";
import type { FormEvent } from "react";
import { APP_VERSION } from "../../shared/version";
import { createRoom } from "../net/api";

interface HomeProps {
  onEnterRoom: (code: string, token: string) => void;
}

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
    <>
      <main className="screen home">
        <h1 className="home-title">minifia</h1>
        <form className="home-form" onSubmit={handleCreate}>
          <label className="field">
            <span className="field-label">닉네임</span>
            <input
              className="field-input"
              type="text"
              value={nickname}
              maxLength={16}
              autoComplete="off"
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            방 만들기
          </button>
          {failed && (
            <p className="form-error" role="alert">
              방을 만들지 못했어요. 다시 시도해 주세요
            </p>
          )}
        </form>
      </main>
      <footer className="app-version">v{APP_VERSION}</footer>
    </>
  );
}
