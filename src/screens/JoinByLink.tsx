import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ApiErrorCode, RoomPreview } from "../../shared/protocol";
import { NICKNAME_MAX_GRAPHEMES, validateNickname } from "../../shared/nickname";
import { Backdrop } from "../components/Backdrop";
import { Button } from "../components/Button";
import { Figure } from "../components/Figure";
import { TextField } from "../components/TextField";
import { Toast, useToast } from "../components/Toast";
import { getPreview, joinRoom } from "../net/api";
import { messageForApiError, nicknameErrorText } from "../net/copy";
import { loadLastNickname, saveLastNickname } from "../net/session";
import { preloadWorld } from "../world/runtime";

interface JoinByLinkProps {
  code: string;
  notice?: string | null;
  onEnterRoom: (code: string, token: string) => void;
  onHome: () => void;
}

const MAX_SEATED = 8;
// 앉은 사람이 이 수 이상이면 광장을 줄여(인물 그림 48×64·여백 축소) 7명이 앉아도 [참가하기]가 한 화면에 들게 한다(P5-4).
// 4명 이하는 지금 배치 그대로다. 실제 높이 판정은 브라우저 E2E UX2-J(05-06).
const SEATED_COMPACT_FROM = 5;
// 미리보기를 다시 받는 간격. 화면이 보이는 동안에만 센다(Pitfall 18).
const POLL_MS = 10_000;

// 들어갈 수 없는 방의 사유. 문구는 copy.ts 의 "link" 맥락 문구를 그대로 쓴다.
type BlockReason = "not_found" | "started" | "full";
const BLOCK_ERROR: Record<BlockReason, ApiErrorCode> = {
  not_found: "ROOM_NOT_FOUND",
  started: "GAME_STARTED",
  full: "ROOM_FULL",
};

function blockReasonForError(error: ApiErrorCode | "NETWORK"): BlockReason | null {
  switch (error) {
    case "ROOM_NOT_FOUND":
      return "not_found";
    case "GAME_STARTED":
      return "started";
    case "ROOM_FULL":
      return "full";
    default:
      return null;
  }
}

// S-02 링크 참가. 링크로 열면 코드는 이미 정해져 있어 닉네임만 넣는다. 카드는 방 정보를 받아 들어갈 수 있을 때만 보인다.
export function JoinByLink({ code, notice, onEnterRoom, onHome }: JoinByLinkProps) {
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [blocked, setBlocked] = useState<BlockReason | null>(null);
  // 마지막으로 쓴 닉네임을 미리 채운다(D-06). 미리 채운 값은 입력한 것이 아니라서 오류 문장은 아직 없다.
  const [nickname, setNickname] = useState(loadLastNickname);
  const [touched, setTouched] = useState(false);
  const [serverNicknameError, setServerNicknameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast, show } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  // 방이 없어졌거나 시작되면 더 받지 않는다. 참가 거절로 알게 된 경우도 같다.
  const stopped = useRef(false);

  const showCard = preview !== null && blocked === null;

  // 입장 화면이 열리면 맵 청크(three)를 미리 받아 둔다. 입장하자마자 조작할 수 있게 한다. 실패는 preloadWorld 가 삼킨다.
  useEffect(() => {
    preloadWorld();
  }, []);

  // 입력 카드가 처음 나타나는 순간 칸에 포커스를 주고, 미리 채운 글자는 전체를 선택해 바로 덮어쓸 수 있게 한다.
  useEffect(() => {
    const input = inputRef.current;
    if (!showCard || focused.current || !input) return;
    focused.current = true;
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
  }, [showCard]);

  // 링크를 다시 열 때 알려 줄 안내(예: 입장 정보가 없어요)는 아래 토스트로 보인다.
  useEffect(() => {
    if (notice) show(notice);
  }, [notice, show]);

  // 미리보기 폴링: 보이는 동안 10초 간격(setTimeout 사슬), 복귀하면 바로 한 번, 숨으면 멈춤, 요청은 한 번에 하나.
  useEffect(() => {
    stopped.current = false;
    let disposed = false;
    let inFlight = false;
    let shown = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clearTimer = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    };
    const isVisible = () => document.visibilityState === "visible";
    const schedule = () => {
      clearTimer();
      if (disposed || stopped.current || !isVisible()) return;
      timer = setTimeout(() => {
        timer = undefined;
        void poll(false);
      }, POLL_MS);
    };
    // force: 처음 한 번과 화면 복귀는 곧바로 받는다.
    async function poll(force: boolean): Promise<void> {
      if (disposed || stopped.current || inFlight) return;
      if (!force && !isVisible()) return;
      inFlight = true;
      const result = await getPreview(code);
      inFlight = false;
      if (disposed || stopped.current) return;
      if (result.ok) {
        shown = true;
        setPreview(result.data);
        if (result.data.phase !== "lobby") {
          stopped.current = true;
          setBlocked("started");
        } else if (result.data.playerCount >= result.data.maxPlayers) {
          // 정원이 찬 방은 자리가 날 수 있어 계속 받는다.
          setBlocked("full");
        } else {
          setBlocked(null);
        }
      } else if (result.error === "ROOM_NOT_FOUND") {
        stopped.current = true;
        setBlocked("not_found");
      } else if (!shown) {
        // 아직 한 번도 못 받았을 때만 알린다. 이미 보여 준 뒤의 실패는 마지막 표시를 두고 조용히 다음 주기를 기다린다.
        show(messageForApiError(result.error, "link").text);
      }
      schedule();
    }
    const onVisibility = () => {
      clearTimer();
      if (isVisible()) void poll(true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    void poll(true);
    return () => {
      disposed = true;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [code, show]);

  const validation = validateNickname(nickname);
  const localError = touched && !validation.ok ? nicknameErrorText(validation.reason) : null;
  const nicknameError = serverNicknameError ?? localError;

  function handleNicknameChange(value: string) {
    setNickname(value);
    setTouched(true);
    setServerNicknameError(null);
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (busy || !validation.ok) return;
    setBusy(true);
    setServerNicknameError(null);
    const result = await joinRoom(code, validation.nickname);
    setBusy(false);
    if (result.ok) {
      saveLastNickname(validation.nickname);
      // 입장 성공 직후: 로비 맵 3초 조작 측정(06-19)의 시작점
      performance.mark("room-enter");
      onEnterRoom(code, result.data.token);
      return;
    }
    // 입력한 닉네임은 지우지 않는다. 문구와 자리는 copy.ts 가 정한다.
    const message = messageForApiError(result.error, "link");
    const reason = blockReasonForError(result.error);
    if (message.place === "nickname") {
      setServerNicknameError(message.text);
    } else if (message.place === "card" && reason) {
      if (reason !== "full") stopped.current = true;
      setBlocked(reason);
    } else {
      show(message.text);
    }
  }

  const seated = preview ? [...preview.players].sort((a, b) => a.seat - b.seat).slice(0, MAX_SEATED) : [];

  const compact = seated.length >= SEATED_COMPACT_FROM;

  let body;
  if (blocked) {
    body = (
      <section className="mf-join__blocked">
        <h2 className="mf-t-heading">{messageForApiError(BLOCK_ERROR[blocked], "link").text}</h2>
        <Button variant="primary" block onClick={onHome}>
          처음으로
        </Button>
      </section>
    );
  } else if (preview) {
    body = (
      <>
        <section className="mf-join__plaza" aria-label="먼저 들어와 있는 사람">
          <ul className={`mf-join__seated${compact ? " mf-join__seated--many" : ""}`}>
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
            placeholder={`1~${NICKNAME_MAX_GRAPHEMES}자로 입력`}
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
    );
  } else {
    body = <p className="mf-t-body mf-t-muted mf-join__loading">방 정보를 불러오는 중…</p>;
  }

  return (
    <Backdrop layout="entry" scene="lobby">
      <main className={`mf-root mf-entry mf-join${compact && !blocked ? " mf-join--many" : ""}`}>
        <header className="mf-entry__head">
          <p className="mf-t-label">Minifia에 초대받았어요</p>
          <h1 className="mf-t-display">{`방 ${code}`}</h1>
        </header>
        {body}
      </main>
      <Toast toast={toast} placement="bottom" />
    </Backdrop>
  );
}
