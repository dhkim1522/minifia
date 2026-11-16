// 유언·쪽지 시트의 상태와 저장 흐름 (9페이즈 WILL-01·NIGHT-12, UI-SPEC 279~286행·228행).
//
// 하는 일: 어느 시트(유언/쪽지)가 열려 있는지, 쓰는 중인 글(초안), 저장 확인, 실패·사망·확정 풀림에 따른 닫기.
// 하지 않는 일: 채팅 입력 중 경로(typing)와 무관하다 — 이 훅이 서버로 보내는 메시지는 {t:"will"}·{t:"note"} 뿐이다(L7, T-09-38).
//
// 저장 확인(가정 A2): 서버가 본인(쪽지는 산 마피아)에게 보낸 view 의 me.will·me.note 가 보낸 글의 정리한 값과 같아지면 저장됨이다.
// WILL_SAVE_TIMEOUT_MS 안에 안 바뀌거나 거절(rejected 증가)이 오면 실패다 — 500ms 간격 초과로 서버가 조용히 버린 경우도 여기서 드러난다.
// 저장 뒤: 유언은 [저장]을 누르면 보내고 곧바로 창이 닫힌다(0083-6, close 와 같은 길) — 서버 확인은 기다리지 않고, 저장됨은 깃펜·[유언] 단추의 표시(hasWill)로 안다.
// 쪽지는 열린 채 '저장됨' 으로 남고 [닫기]로 닫는다. 실패(거절·3초 확인 없음)는 위 알림 한 번이고, 다시 열면 쓰던 글이 남아 있다.
// 초안: 서버 값이 기준이고, 저장하지 못한 글만 이 훅이 종류별로 기억해 다시 열면 이어 쓴다(쪽지는 확정이 풀려도 남는다, E2 #19).
//
// 유언 단계(defense, 22-11 D-15·D-16·D-28): 처형자(공개 값 day.candidate === 나)만 쓸 수 있다(서버 saveWill 과 같은 조건).
// - 단계가 시작되면 미리 써 둔 유언이 채워진 채 시트가 자동으로 열린다(한 단계에 한 번 — [닫기]로 접은 뒤 다시 열리지 않는다).
// - [남기기]: {t:"will", text, final:true} 를 보내고 곧바로 '남김'이다(서버 응답을 기다리는 표시 없음 — 단계가 곧 넘어간다). 거절이 오면 '남김' 을 풀고 알림 한 번(다시 누를 수 있다). [닫기]는 글을 저장하고 시트만 접는다(Pitfall 8).
// - 자동 저장: 입력이 바뀌고 600ms 뒤 한 번(서버 간격 500ms 위), 마감 700ms 전에 한 번 더. 시간이 끝나면 서버가 마지막 저장본을 낸다(마지막 약 0.5초 입력 손실 허용).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { isAlive } from "../../shared/game/alive";
import { sanitizeChatText } from "../../shared/game/chatRules";
import { MAP_PHASES } from "../../shared/game/movement";
import type { ClientMessage, RoomView } from "../../shared/protocol";

/** 보낸 뒤 이 시간 안에 서버 값이 바뀌지 않으면 저장 실패로 본다 */
export const WILL_SAVE_TIMEOUT_MS = 3000;

export type WillKind = "will" | "note";

export interface UseWillOptions {
  view: RoomView;
  /** 보냈으면 true, 소켓이 닫혀 못 보냈으면 false. 반환값이 없는 함수(void)는 보낸 것으로 본다 */
  send: (msg: ClientMessage) => boolean | void;
  /** 연결이 열려 서버로 보낼 수 있는가. 기본 true */
  canSend?: boolean;
  /** 서버 시각 − 로컬 시각(ms). 유언 단계의 마감 직전 전송 시각을 정한다. 기본 0 */
  offset?: number;
  /** 서버가 행동을 거절한 횟수. 저장을 기다리는 중에 늘어나면 실패다 */
  rejected?: number;
  /** 저장 실패 알림(위 알림 "보내지 못했어요. 다시 해 보세요") */
  onFail: () => void;
  /** 저장 확인을 기다리는 중이면 true 로 둔다 — 화면 틀이 같은 오류 프레임에 "지금은 고를 수 없어요" 를 이중으로 띄우지 않게 읽는다 */
  busyRef?: MutableRefObject<boolean>;
}

export interface WillApi {
  open: WillKind | null;
  draft: string;
  setDraft: (value: string) => void;
  /** 열린 시트의 글(정리한 값)이 서버 값과 같다 */
  saved: boolean;
  /** 서버가 보낸 내 유언이 비어 있지 않다(깃펜 점, A3) */
  hasWill: boolean;
  /** 지금 유언을 열 수 있는가: 산 사람 + 지도 단계(유언 단계는 처형자만) */
  willAllowed: boolean;
  /** 지금이 유언 단계이고 내가 처형자다(시트가 아래 패널을 대신하고 [남기기]·남은 초를 보인다) */
  condemned: boolean;
  /** [남기기]를 보냈다('남김') */
  finalSent: boolean;
  /** 지금 쪽지를 쓸 수 있는가: 밤 산 마피아 + 확정 */
  noteReady: boolean;
  openSheet: (kind: WillKind, opener: HTMLElement | null) => void;
  /** 유언은 보내고 곧바로 닫는다(close 와 같은 길, 0083-6). 쪽지는 보내고 열어 둔다 */
  save: (text: string) => void;
  close: (text: string) => void;
}

/** 서버가 저장할 값: 공백뿐이면 지움(""), 아니면 sanitizeChatText 를 지난 글. 정리 실패(너무 긴 글)면 원문 그대로(서버가 거절한다) */
function normalized(text: string): string {
  if (text.trim().length === 0) return "";
  const clean = sanitizeChatText(text);
  return clean.ok ? clean.text : text;
}

/** 자동 저장 디바운스(ms) — 서버 간격(WILL_MIN_GAP_MS 500)보다 길다 */
export const WILL_AUTOSAVE_MS = 600;
/** 마감 이만큼 전에 쓰던 글을 한 번 더 보낸다(ms) */
export const WILL_LAST_SEND_LEAD_MS = 700;

export function useWill({ view, send, canSend = true, offset = 0, rejected = 0, onFail, busyRef }: UseWillOptions): WillApi {
  const meSeat = view.me.seat;
  const meRow = view.players.find((p) => p.seat === meSeat);
  const meAlive = meRow === undefined || isAlive(meRow);
  const condemned = view.phase === "defense" && meAlive && view.day?.candidate === meSeat;
  const willAllowed = meAlive && MAP_PHASES.has(view.phase) && (view.phase !== "defense" || condemned);
  const nightMafia = view.phase === "night" && meAlive && view.me.role === "mafia";
  const noteReady = nightMafia && view.me.nightSure !== undefined;
  const serverWill = view.me.will;
  const serverNote = view.me.note;
  const serverOf = (kind: WillKind): string => (kind === "will" ? serverWill : serverNote) ?? "";

  const [open, setOpen] = useState<WillKind | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<{ kind: WillKind; text: string } | null>(null);
  const pendingRef = useRef<{ kind: WillKind; text: string } | null>(null);
  /** 서버에 닿지 못했거나 아직 확인되지 않은 글(종류별). 다시 열면 이어 쓴다 */
  const kept = useRef<Partial<Record<WillKind, string>>>({});
  const opener = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const live = useRef({ onFail });
  useLayoutEffect(() => {
    live.current = { onFail };
  });
  // 유언 단계: 단계(마감 시각)마다 한 번만 자동으로 연다 / [남기기]를 보낸 단계 / 마지막으로 보낸 정리한 글(같은 글은 다시 보내지 않는다)
  const autoOpened = useRef<number | null>(null);
  const [finalFor, setFinalFor] = useState<number | null>(null);
  const finalSent = condemned && finalFor !== null && finalFor === view.phaseEndsAt;
  const lastSent = useRef<string | null>(null);
  // 화면 틀이 거절 프레임에 "지금은 고를 수 없어요" 를 띄울지 가르는 busyRef 는 두 가지가 켠다: 저장 확인 대기 / [남기기] 확인 대기
  const finalWaiting = useRef(false);
  const syncBusy = useCallback(() => {
    if (busyRef) busyRef.current = pendingRef.current !== null || finalWaiting.current;
  }, [busyRef]);

  const setPendingBoth = useCallback(
    (next: { kind: WillKind; text: string } | null) => {
      pendingRef.current = next;
      syncBusy();
      setPending(next);
    },
    [syncBusy],
  );

  const setFinalBoth = useCallback(
    (next: number | null) => {
      finalWaiting.current = next !== null;
      syncBusy();
      setFinalFor(next);
    },
    [syncBusy],
  );

  // 저장 확인: 서버 값이 보낸 글의 정리한 값과 같아지면 끝
  useEffect(() => {
    if (pending === null) return;
    if (normalized(pending.text) === serverOf(pending.kind)) {
      if (kept.current[pending.kind] === pending.text) delete kept.current[pending.kind];
      setPendingBoth(null);
    }
    // serverOf 는 serverWill·serverNote 만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, serverWill, serverNote, setPendingBoth]);

  // 시간 초과 = 실패
  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => {
      if (pendingRef.current === null) return;
      setPendingBoth(null);
      live.current.onFail();
    }, WILL_SAVE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [pending, setPendingBoth]);

  // 거절 = 실패 (기다리는 중이 아니면 이 훅의 일이 아니다). [남기기]도 기다리는 중이다: 거절되면 '남김' 을 풀어 다시 보낼 수 있게 하고 한 번 알린다(22 WR-01).
  const seenRejected = useRef(rejected);
  useEffect(() => {
    if (seenRejected.current === rejected) return;
    seenRejected.current = rejected;
    if (finalWaiting.current) {
      setFinalBoth(null);
      live.current.onFail();
      return;
    }
    if (pendingRef.current === null) return;
    setPendingBoth(null);
    live.current.onFail();
  }, [rejected, setPendingBoth, setFinalBoth]);

  // 단계가 넘어가 '남김' 이 낡았으면(마감·처형 단계 진입) 확인 대기를 푼다 — 뒤의 거절 알림을 막지 않게
  useEffect(() => {
    if (finalFor !== null && !finalSent) setFinalBoth(null);
  }, [finalFor, finalSent, setFinalBoth]);

  const finish = useCallback(
    (focus: boolean) => {
      setOpen(null);
      restoreFocus.current = focus ? opener.current : null;
    },
    [],
  );

  // 닫은 뒤 초점은 시트를 연 버튼으로 돌아간다(UI-SPEC 442행). 시트가 사라진 다음 렌더에서 옮긴다.
  useEffect(() => {
    if (open !== null) return;
    const el = restoreFocus.current;
    restoreFocus.current = null;
    if (el !== null && el.isConnected) el.focus({ preventScroll: true });
  }, [open]);

  // 유언 단계 자동 열림(P22-6): 처형자의 단계가 시작되면 미리 써 둔 글로 연다. 단계마다 한 번 — [닫기]로 접은 시트는 다시 열리지 않고 [유언] 단추가 부른다.
  useEffect(() => {
    if (!condemned || view.phaseEndsAt === null || autoOpened.current === view.phaseEndsAt) return;
    autoOpened.current = view.phaseEndsAt;
    lastSent.current = null;
    opener.current = null;
    setDraft(kept.current.will ?? serverWill ?? "");
    setOpen("will");
    // serverWill 은 처음 열 때의 값만 쓴다(그 뒤 서버 값 변화로 다시 열지 않는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condemned, view.phaseEndsAt]);

  // 유언 단계 자동 저장(D-28): 열린 시트에서 입력이 바뀌고 600ms 뒤 + 마감 700ms 전. 같은 글(마지막으로 보낸 값·서버 값)은 보내지 않는다. 확인 대기(pending)를 만들지 않는다 — 실패 알림 없는 조용한 저장.
  const autoOn = open === "will" && condemned && canSend && !finalSent;
  const draftRef = useRef(draft);
  useLayoutEffect(() => {
    draftRef.current = draft;
  });
  const autoSave = useCallback(
    (text: string) => {
      const n = normalized(text);
      if (n === (lastSent.current ?? (serverWill ?? ""))) return;
      if (send({ t: "will", text }) !== false) lastSent.current = n;
    },
    [send, serverWill],
  );
  const autoSaveRef = useRef(autoSave);
  useLayoutEffect(() => {
    autoSaveRef.current = autoSave;
  });
  useEffect(() => {
    if (!autoOn) return;
    const timer = setTimeout(() => autoSaveRef.current(draftRef.current), WILL_AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [autoOn, draft]);
  useEffect(() => {
    if (!autoOn || view.phaseEndsAt === null) return;
    const wait = Math.max(0, view.phaseEndsAt - (Date.now() + offset) - WILL_LAST_SEND_LEAD_MS);
    const timer = setTimeout(() => autoSaveRef.current(draftRef.current), wait);
    return () => clearTimeout(timer);
  }, [autoOn, view.phaseEndsAt, offset]);

  // 죽거나 단계가 지도 밖으로 나가면 유언 시트가 닫힌다. 쪽지는 확정이 풀려도 닫히고, 밤 산 마피아면 쓰던 글을 남긴다.
  useEffect(() => {
    if (open === "will" && !willAllowed) {
      delete kept.current.will;
      setPendingBoth(null);
      finish(false);
    } else if (open === "note" && !noteReady) {
      if (nightMafia) kept.current.note = draft;
      else delete kept.current.note;
      finish(false);
    }
    if (!nightMafia) delete kept.current.note;
    if (!willAllowed) delete kept.current.will;
  }, [open, willAllowed, noteReady, nightMafia, draft, finish, setPendingBoth]);

  const submit = useCallback(
    (kind: WillKind, text: string): "same" | "sent" | "failed" | "offline" => {
      if (normalized(text) === serverOf(kind)) return "same";
      if (!canSend) return "offline";
      const msg: ClientMessage = kind === "will" ? { t: "will", text } : { t: "note", text };
      if (send(msg) === false) return "failed";
      setPendingBoth({ kind, text });
      return "sent";
    },
    // serverOf 는 serverWill·serverNote 만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canSend, send, serverWill, serverNote, setPendingBoth],
  );

  const close = useCallback(
    (text: string) => {
      if (open === null) return;
      const waiting = pendingRef.current;
      // 같은 글을 이미 보내고 확인을 기다리는 중이면(저장 뒤 바로 닫기) 다시 보내지 않고 글만 남긴 채 닫는다(IN-01)
      if (waiting !== null && waiting.kind === open && waiting.text === text) {
        kept.current[open] = text;
        finish(true);
        return;
      }
      const result = submit(open, text);
      if (result === "failed") live.current.onFail();
      // 서버가 이미 가진 값이면 남길 글이 없고, 아니면 확인이 올 때까지(또는 못 보냈으면 계속) 남겨 다시 열면 이어 쓴다
      if (result === "same") delete kept.current[open];
      else kept.current[open] = text;
      finish(true);
    },
    [open, submit, finish],
  );

  const save = useCallback(
    (text: string) => {
      if (open === null) return;
      // [남기기](22-11 D-15): 글을 보내고 단계를 곧바로 끝낸다. 시트는 '남김' 으로 남고(서버 응답을 기다리지 않는다) 단계가 넘어가면 닫힌다.
      if (open === "will" && condemned) {
        if (finalSent || !canSend) return;
        if (send({ t: "will", text, final: true }) === false) {
          live.current.onFail();
          return;
        }
        lastSent.current = normalized(text);
        setFinalBoth(view.phaseEndsAt);
        return;
      }
      if (open === "will") {
        close(text); // 0083-6: 유언은 저장하면 닫힌다
        return;
      }
      const waiting = pendingRef.current;
      if (waiting !== null && waiting.kind === open && waiting.text === text) return; // 같은 글을 보내고 기다리는 중이면 다시 보내지 않는다
      if (submit(open, text) === "failed") live.current.onFail();
    },
    [open, submit, close, condemned, finalSent, canSend, send, view.phaseEndsAt, setFinalBoth],
  );

  const openSheet = useCallback(
    (kind: WillKind, el: HTMLElement | null) => {
      if (!canSend) return;
      if (kind === "will" ? !willAllowed : !noteReady) return;
      if (open === kind) {
        close(draft); // 같은 버튼을 다시 누르면 닫는다
        return;
      }
      if (open !== null) {
        // 다른 시트가 열려 있으면 먼저 저장하고 닫는다
        const result = submit(open, draft);
        if (result === "failed") live.current.onFail();
        if (result === "same") delete kept.current[open];
        else kept.current[open] = draft;
      }
      opener.current = el;
      setDraft(kept.current[kind] ?? serverOf(kind));
      setOpen(kind);
    },
    // serverOf 는 serverWill·serverNote 만 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canSend, willAllowed, noteReady, open, draft, close, submit, serverWill, serverNote],
  );

  return {
    open,
    draft,
    setDraft,
    // 유언 단계의 [남기기]는 서버 값과 같아도 눌러야 단계가 끝나니 '남김' 은 보낸 뒤에만 켜진다
    saved: open === "will" && condemned ? finalSent : open !== null && normalized(draft) === serverOf(open),
    hasWill: serverWill !== undefined && serverWill !== "",
    willAllowed,
    condemned,
    finalSent,
    noteReady,
    openSheet,
    save,
    close,
  };
}
