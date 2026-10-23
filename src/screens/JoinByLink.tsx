import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { RoomPreview } from "../../shared/protocol";
import { validateNickname } from "../../shared/nickname";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { Figure } from "../components/Figure";
import { TextField } from "../components/TextField";
import { getPreview, joinRoom } from "../net/api";
import { nicknameErrorText } from "../net/copy";
import { loadLastNickname, saveLastNickname } from "../net/session";

interface JoinByLinkProps {
  code: string;
  notice?: string | null;
  onEnterRoom: (code: string, token: string) => void;
  onHome: () => void;
}

const MAX_SEATED = 8;

// S-02 링크 참가. 링크로 열면 코드는 이미 정해져 있어 닉네임만 넣는다. 카드는 방 정보를 받은 뒤에 보인다.
export function JoinByLink({ code, onEnterRoom, onHome }: JoinByLinkProps) {
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  // 마지막으로 쓴 닉네임을 미리 채운다(D-06). 미리 채운 값은 입력한 것이 아니라서 오류 문장은 아직 없다.
  const [nickname, setNickname] = useState(loadLastNickname);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);

  // 입력 카드가 나타나는 순간 칸에 포커스를 주고, 미리 채운 글자는 전체를 선택해 바로 덮어쓸 수 있게 한다.
  const ready = preview !== null;
  useEffect(() => {
    const input = inputRef.current;
    if (!ready || focused.current || !input) return;
    focused.current = true;
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
  }, [ready]);

  useEffect(() => {
    let cancelled = false;
    void getPreview(code).then((result) => {
      if (!cancelled && result.ok) setPreview(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const validation = validateNickname(nickname);
  const nicknameError = touched && !validation.ok ? nicknameErrorText(validation.reason) : null;

  function handleNicknameChange(value: string) {
    setNickname(value);
    setTouched(true);
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (busy || !validation.ok) return;
    setBusy(true);
    const result = await joinRoom(code, validation.nickname);
    setBusy(false);
    if (result.ok) {
      saveLastNickname(validation.nickname);
      onEnterRoom(code, result.data.token);
    }
  }

  const seated = preview ? [...preview.players].sort((a, b) => a.seat - b.seat).slice(0, MAX_SEATED) : [];

  return (
    <Backdrop layout="entry" variant="lobby">
      <main className="mf-root mf-entry mf-join">
        <header className="mf-entry__head">
          <p className="mf-t-label">미니피아에 초대받았어요</p>
          <h1 className="mf-t-display">{`방 ${code}`}</h1>
        </header>
        {preview ? (
          <>
            <section className="mf-join__plaza" aria-label="먼저 들어와 있는 사람">
              <ul className="mf-join__seated">
                {seated.map((p) => (
                  <li key={p.seat} className="mf-tag">
                    <Figure seat={p.seat} />
                    <span className="mf-tag__name" title={p.nickname}>
                      <span>{p.nickname}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mf-join__count">{`${preview.playerCount} / ${preview.maxPlayers}명이 모였어요`}</p>
            </section>
            <form className="mf-entry__card" onSubmit={handleJoin}>
              <TextField
                label="닉네임"
                kind="nickname"
                value={nickname}
                onChange={handleNicknameChange}
                placeholder="1~8자로 입력"
                inputRef={inputRef}
                error={nicknameError}
              />
              <Button variant="primary" block type="submit" disabled={!validation.ok || busy}>
                참가하기
              </Button>
              <Button variant="text" block onClick={onHome}>
                다른 방 코드로 참가
              </Button>
            </form>
          </>
        ) : (
          <p className="mf-t-body mf-t-muted mf-join__loading">방 정보를 불러오는 중…</p>
        )}
      </main>
    </Backdrop>
  );
}
