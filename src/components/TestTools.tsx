import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { ROLE_IDS, testRoleOptions } from "../../shared/game/roles";
import type { RoleId } from "../../shared/game/roles";
import { MAX_TEST_BOTS } from "../../shared/protocol";
import type { BotVoteExec, BotVotePick, ClientMessage, PhaseId, RoomView } from "../../shared/protocol";
import { testButtonCompact } from "../game/dayTable";
import { ROLE_TEXT } from "../game/roleText";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import "../styles/chip.css";
import "../styles/testtools.css";

// 테스트 방 방장 도구(결정 0022, 시안 design/screens/night-v1 T1·T2): 점선 [테스트] 버튼과 '테스트 도구' 시트.
// 화면은 요청만 보낸다 — 단계를 넘기거나 직업을 정하는 판단은 서버가 한다(결정 0002). 이 부품은 방장 + testMode 일 때만 마운트된다.

/** 아랫줄 '지금: …' 의 단계 이름. PhaseId 를 모두 키로 두어 4페이즈가 단계를 더하면 타입 오류로 알게 한다. */
export const TEST_PHASE_LABEL: Readonly<Record<PhaseId, string>> = {
  lobby: "대기실",
  assigning: "직업 배정",
  roleReveal: "역할 확인",
  dayAnnounce: "낮 시작 발표",
  claim: "직업 공개",
  discussion: "낮 토론",
  night: "밤",
  morning: "아침",
  execVote: "처형 여부 투표",
  candidateVote: "후보 선택",
  candidateVoteReveal: "투표 공개",
  defense: "최후 변론",
  execution: "처형",
  ended: "판 종료",
};

export interface TestToolsButtonProps {
  onOpen: () => void;
}

/** 버튼이 놓인 장면 상자(낮 테이블). 역할 확인 위쪽 바처럼 장면 밖에 놓이거나, 맵 로비의 [테스트] 자리(.mf-lobby__test, 06-15)처럼 캐릭터 상자와 겹치지 않는 곳이면 없다. */
const SCENE_SELECTOR = ".mf-dayscene__scene";

export function TestToolsButton({ onOpen }: TestToolsButtonProps): ReactElement {
  const ref = useRef<HTMLButtonElement>(null);
  // 짧은 장면(높이 < 299)에서만 좁힌다: 마운트 직후 한 번 동기로 재고(첫 페인트부터), 이후 ResizeObserver 로 따라간다. 긴 화면·장면 밖은 늘 false.
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const scene = ref.current?.closest<HTMLElement>(SCENE_SELECTOR) ?? null;
    if (!scene) return;
    const apply = (): void => setCompact(testButtonCompact(scene.getBoundingClientRect().height));
    apply();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(apply);
    ro.observe(scene);
    return () => ro.disconnect();
  }, []);
  return (
    <button ref={ref} type="button" className="mf-tt" aria-haspopup="dialog" onClick={onOpen} {...(compact ? { "data-compact": "" } : {})}>
      <Icon name="wrench" size={18} />
      <span className="mf-tt__label">테스트</span>
    </button>
  );
}

export interface TestToolsSheetProps {
  view: RoomView;
  canSend: boolean;
  send: (msg: ClientMessage) => boolean | void;
  onClose: () => void;
}

/** 채우기 버튼이 맞추는 총 인원 — 5명이면 네 직업이 모두 나온다(rolesInPlay). */
const FILL_TO_PLAYERS = 5;

/** 칩이 고르는 값: null = 랜덤. */
type Pick = RoleId | null;

/** 봇 투표 선택 칩 — 그룹 이름(aria-label)과 칩 이름이 04-31 E2E 도우미의 선택자 계약이다. 두 그룹에 '무작위' 가 있어 그룹 이름으로 가린다. */
const BOT_EXEC_CHIPS: ReadonlyArray<{ value: BotVoteExec; label: string }> = [
  { value: "random", label: "무작위" },
  { value: "yes", label: "모두 찬성" },
  { value: "no", label: "모두 반대" },
];
const BOT_PICK_CHIPS: ReadonlyArray<{ value: BotVotePick; label: string }> = [
  { value: "random", label: "무작위" },
  { value: "host", label: "방장" },
  { value: "other", label: "방장 아닌 사람" },
];

export function TestToolsSheet({ view, canSend, send, onClose }: TestToolsSheetProps): ReactElement {
  const isLobby = view.phase === "lobby";
  // 낙관적 선택: 누른 view 와 함께 기억해, 새 view 객체가 오면 버리고 서버 값(me.testRole)을 따른다(ClaimPanel 선례).
  const [pending, setPending] = useState<{ view: RoomView; role: Pick } | null>(null);
  const selected: Pick = pending !== null && pending.view === view ? pending.role : (view.me.testRole ?? null);
  // 봇 투표 선택(P-13): 같은 방식의 낙관적 값. testBotVote 메시지는 절대값 한 쌍이라 칩 하나를 눌러도 다른 그룹의 현재 값을 함께 싣는다.
  const [pendingVote, setPendingVote] = useState<{ view: RoomView; exec: BotVoteExec; pick: BotVotePick } | null>(null);
  const botVote =
    pendingVote !== null && pendingVote.view === view
      ? pendingVote
      : { exec: view.me.testBotVote?.exec ?? "random", pick: view.me.testBotVote?.pick ?? "random" };
  const chooseBotVote = (exec: BotVoteExec, pick: BotVotePick) => {
    if (!canSend || (exec === botVote.exec && pick === botVote.pick)) return;
    setPendingVote({ view, exec, pick });
    send({ t: "testBotVote", exec, pick });
  };
  const options = testRoleOptions(view.players.length);

  // 봇 줄(결정 0024): 숫자는 서버 view 의 me.testBots 를 따른다(낙관적 값 없음 — count 가 절대값이라 연타해도 같은 요청이다).
  const bots = view.me.testBots ?? 0;
  const humans = view.players.length - bots;
  const maxBots = Math.min(MAX_TEST_BOTS, view.maxPlayers - humans);
  const setBots = (count: number) => {
    if (canSend) send({ t: "testBots", count });
  };

  const choose = (role: Pick) => {
    if (!canSend || role === selected) return;
    setPending({ view, role });
    send({ t: "testRole", role });
  };

  return (
    <Sheet label="테스트 도구" showClose onClose={onClose} className="mf-tt-sheet">
      {(requestClose) => (
        <>
          <h2 className="mf-t-heading mf-sheet__title">테스트 도구</h2>
          <p className="mf-tt-sheet__note">테스트 방에서만 보이는 방장 도구예요</p>
          {isLobby ? (
            <section className="mf-tt-sheet__roles">
              <p className="mf-tt-sheet__label">내 직업</p>
              <div className="mf-chips">
                <Chip selected={selected === null} disabled={!canSend} onPress={() => choose(null)}>
                  랜덤
                </Chip>
                {ROLE_IDS.map((role) => (
                  <Chip key={role} selected={selected === role} disabled={!canSend || !options.includes(role)} onPress={() => choose(role)}>
                    {ROLE_TEXT[role].name}
                  </Chip>
                ))}
              </div>
            </section>
          ) : null}
          {isLobby ? (
            <section className="mf-tt-sheet__bots">
              <p className="mf-tt-sheet__label">봇</p>
              <div className="mf-tt-sheet__stepper">
                <Button
                  variant="secondary"
                  compact
                  className="mf-tt-sheet__step"
                  aria-label="봇 줄이기"
                  icon={<Icon name="minus" size={18} />}
                  disabled={!canSend || bots <= 0}
                  onClick={() => setBots(bots - 1)}
                />
                <span className="mf-tt-sheet__count" aria-live="polite">{`${bots}명`}</span>
                <Button
                  variant="secondary"
                  compact
                  className="mf-tt-sheet__step"
                  aria-label="봇 늘리기"
                  icon={<Icon name="plus" size={18} />}
                  disabled={!canSend || bots >= maxBots}
                  onClick={() => setBots(bots + 1)}
                />
                <Button
                  variant="secondary"
                  compact
                  disabled={!canSend || view.players.length >= FILL_TO_PLAYERS}
                  onClick={() => setBots(FILL_TO_PLAYERS - humans)}
                >
                  5명 채우기
                </Button>
              </div>
            </section>
          ) : null}
          {isLobby ? (
            <>
              <section className="mf-tt-sheet__botvote">
                <p className="mf-tt-sheet__label">봇 처형 투표</p>
                <div className="mf-chips" role="group" aria-label="봇 처형 투표">
                  {BOT_EXEC_CHIPS.map(({ value, label }) => (
                    <Chip key={value} selected={botVote.exec === value} disabled={!canSend} onPress={() => chooseBotVote(value, botVote.pick)}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </section>
              <section className="mf-tt-sheet__botvote">
                <p className="mf-tt-sheet__label">봇 후보 선택</p>
                <div className="mf-chips" role="group" aria-label="봇 후보 선택">
                  {BOT_PICK_CHIPS.map(({ value, label }) => (
                    <Chip key={value} selected={botVote.pick === value} disabled={!canSend} onPress={() => chooseBotVote(botVote.exec, value)}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </section>
            </>
          ) : null}
          <div className="mf-tt-sheet__list">
            <Button variant="primary" block disabled={!canSend || isLobby} onClick={() => send({ t: "testSkip" })}>
              다음 단계로 넘기기
              <small>{`지금: ${TEST_PHASE_LABEL[view.phase]}`}</small>
            </Button>
            <Button
              variant="secondary"
              block
              disabled={!canSend || isLobby}
              onClick={() => {
                send({ t: "testReset" });
                requestClose();
              }}
            >
              대기실로 되돌리기
              <small>인원 유지, 새 판</small>
            </Button>
          </div>
        </>
      )}
    </Sheet>
  );
}
