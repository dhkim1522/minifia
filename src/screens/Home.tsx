import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { validateNickname } from "../../shared/nickname";
import { isPlaytestHost } from "../../shared/playtestHost";
import { isRoomCode } from "../../shared/roomCode";
import { WORKER_NAME } from "../../shared/version";

import { unlockAudio } from "../audio/unlock";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { NicknameSheet } from "../components/NicknameSheet";
import { TextField } from "../components/TextField";
import { Toast, useToast } from "../components/Toast";
import { V2Icon } from "../components/v2/V2Icon";
import { createRoom, joinRoom, testModeFromSearch } from "../net/api";
import { preloadEntryAssets } from "../net/assets";
import { messageForApiError, nicknameErrorText } from "../net/copy";
import { loadLastNickname, loadSession, saveLastNickname } from "../net/session";
import { useVisualViewportHeight } from "../net/useKeyboardLift";
import { preloadWorld } from "../world/runtime";

/** 시험판 Worker 별 첫 화면 표식. v1.0(`minifia`)·dev 에는 없다. */
const BUILD_LABEL: Record<string, string> = { "minifia-v2": "v2.0 시험판", "minifia-v3": "v3.0 시험판" };

interface HomeProps {
  onEnterRoom: (code: string, token: string) => void;
}

// S-01 첫 화면. 버튼과 코드 칸만 두고, 닉네임은 [방 만들기]·[참가] 를 누른 뒤 시트에서 묻는다(결정 0014).
export function Home({ onEnterRoom }: HomeProps) {
  // 마지막으로 쓴 닉네임을 미리 채운다(D-06). 미리 채운 값은 입력한 것이 아니라서 오류 문장은 아직 없다.
  const [nickname, setNickname] = useState(loadLastNickname);
  const [code, setCode] = useState("");
  // 닉네임 시트: 어느 버튼으로 열었는지. 닫혀 있으면 null.
  const [sheet, setSheet] = useState<"create" | "join" | null>(null);
  // 처음 열었을 때는 오류 문장이 없다. 한 번 입력한 뒤부터 칸 아래에 보여 준다.
  const [touched, setTouched] = useState(false);
  // 서버가 거절한 이유는 한 번에 하나만, 해당 칸 아래에 둔다. 그 칸을 고치면 지운다.
  const [serverNicknameError, setServerNicknameError] = useState<string | null>(null);
  const [serverCodeError, setServerCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const viewportHeight = useVisualViewportHeight(true);
  const { toast, show } = useToast();
  // 대기실 첫 그림(배경·인물)과 맵 청크(three)가 비어 보이지 않게 첫 화면에서 미리 받아 둔다.
  useEffect(() => {
    preloadEntryAssets();
    preloadWorld();
  }, []);

  const validation = validateNickname(nickname);
  const localError = touched && !validation.ok ? nicknameErrorText(validation.reason) : null;
  const nicknameError = serverNicknameError ?? localError;
  const codeReady = isRoomCode(code) && !busy;
  const { hostname, search } = window.location;
  const playtest = isPlaytestHost(hostname) && new URLSearchParams(search).get("playtest") === "1";

  function handleNicknameChange(value: string) {
    setNickname(value);
    setTouched(true);
    setServerNicknameError(null);
  }

  function handleCodeChange(value: string) {
    setCode(value);
    setServerCodeError(null);
  }

  function openCreate() {
    setServerNicknameError(null);
    setServerCodeError(null);
    setSheet("create");
  }

  function openJoin(e: FormEvent) {
    e.preventDefault();
    if (!codeReady) return;
    // 이 브라우저가 이미 그 방의 토큰을 갖고 있으면 닉네임을 묻지 않고 같은 자리로 돌아간다(D-07).
    const stored = loadSession();
    if (stored && stored.code === code) {
      unlockAudio(); // 이 탭도 사용자 제스처다 — 방 화면의 오디오를 여기서 깨운다(D-7)
      onEnterRoom(code, stored.token);
      return;
    }
    setServerNicknameError(null);
    setServerCodeError(null);
    setSheet("join");
  }

  async function handleCreate() {
    unlockAudio(); // 제출 탭이 곧 소리를 켜는 제스처다: 어떤 await 보다 먼저, 같은 틱에서(D-7, B-3)
    if (busy || !validation.ok) return;
    setBusy(true);
    setServerNicknameError(null);
    setServerCodeError(null);
    const result = await createRoom(validation.nickname, {
      testMode: testModeFromSearch(search),
      ...(playtest ? { playtest: true } : {}),
    });
    setBusy(false);
    if (result.ok) {
      saveLastNickname(validation.nickname);
      // 입장 성공 직후: 로비 맵 3초 조작 측정(06-19)의 시작점
      performance.mark("room-enter");
      onEnterRoom(result.data.code, result.data.token);
      return;
    }
    // 방 만들기에서 나올 수 있는 오류는 닉네임 칸 아래와 토스트뿐이다. 입력한 닉네임은 지우지 않는다.
    const message = messageForApiError(result.error, "create");
    if (message.place === "nickname") {
      setServerNicknameError(message.text);
    } else {
      setSheet(null);
      show(message.text);
    }
  }

  async function handleJoin() {
    unlockAudio(); // 제출 탭이 곧 소리를 켜는 제스처다: 어떤 await 보다 먼저, 같은 틱에서(D-7, B-3)
    if (busy || !validation.ok || !isRoomCode(code)) return;
    setBusy(true);
    setServerNicknameError(null);
    setServerCodeError(null);
    const result = await joinRoom(code, validation.nickname);
    setBusy(false);
    if (result.ok) {
      saveLastNickname(validation.nickname);
      performance.mark("room-enter");
      onEnterRoom(code, result.data.token);
      return;
    }
    // 입력한 닉네임·코드는 지우지 않는다. 문구와 자리는 copy.ts 가 정한다.
    // 닉네임 오류는 열려 있는 시트 안에, 코드 오류와 그 밖의 오류는 시트를 닫고 첫 화면에 보여 준다.
    const message = messageForApiError(result.error, "home-code");
    if (message.place === "nickname") {
      setServerNicknameError(message.text);
      return;
    }
    setSheet(null);
    if (message.place === "code") setServerCodeError(message.text);
    else show(message.text);
  }

  return (
    <Backdrop layout="entry" scene="lobby">
      <main className="mf-root mf-entry mf-home" style={{ "--entry-height": `${viewportHeight}px` } as CSSProperties}>
        <header className="mf-entry__head">
          <h1 className="mf-t-display mf-home__title">미니피아</h1>
          <span className="mf-home__flourish" aria-hidden="true" />
          <p className="mf-entry__subtitle">우리 중 누가 마피아일까?</p>
        </header>
        <div className="mf-entry__actions">
          <form className="mf-entry__form" onSubmit={openJoin}>
            <TextField
              label="방 코드"
              kind="code"
              value={code}
              onChange={handleCodeChange}
              placeholder="4자리 숫자"
              error={serverCodeError}
              trailing={
                <Button variant="secondary" type="submit" disabled={!codeReady} className="mf-btn--field">
                  참가 <V2Icon name="chevronRight" size={16} />
                </Button>
              }
            />
          </form>
          <Button variant="primary" block icon={<Icon name="plus" size={20} />} onClick={openCreate} disabled={busy}>
            방 만들기
          </Button>
        </div>
        {BUILD_LABEL[WORKER_NAME] ? <p className="mf-entry__build">{BUILD_LABEL[WORKER_NAME]}</p> : null}
      </main>
      {sheet ? (
        <NicknameSheet
          mode={sheet}
          roomCode={code}
          nickname={nickname}
          onNicknameChange={handleNicknameChange}
          error={nicknameError}
          submitDisabled={!validation.ok || busy}
          onSubmit={sheet === "create" ? handleCreate : handleJoin}
          onClose={() => setSheet(null)}
        />
      ) : null}
      <Toast toast={toast} placement="bottom" />
    </Backdrop>
  );
}
