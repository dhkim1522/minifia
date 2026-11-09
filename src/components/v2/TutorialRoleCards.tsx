import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import "../../styles/tutorial.css";
import { roleArtSrc } from "../../net/assets";
import { useReducedMotion } from "../../net/useReducedMotion";
import { Diamond } from "../RoleCard";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 첫 사건 장면 7 직업 카드 4장(17-08, 결정 0078-1.5, UI-SPEC "직업 카드 계약"·T-15): 시민·마피아·의사·경찰이 실제 역할 확인 카드처럼 뒷면 마름모에서 앞면으로 뒤집히고,
// 카드마다 실제 역할 그림(roleArtSrc)·이름·한 줄 설명과 오른쪽 아래 배지의 대표 움직임 하나가 있다. 제목은 화면에 쓰지 않는다(사회자 띠 "밤에는 저마다 할 일이 있어요" — 3초 규칙).
// 카드는 고정 상수 네 종류다: 실제 방의 view·역할·직업 값을 받지도 읽지도 않는다(T-17-18, 정적 가드). 진홍은 마피아 카드(.tut-role--mafia)의 테두리·이름·배지에만 쓴다(T-18).
// 뒤집기 소리(tut.flip)는 장면 시각표가 같은 시각(100·450·800·1150ms)에 낸다 — 이 부품은 화면 연출만 같은 시각에 맞춘다(지연 --tut-flip-delay).
// 모션 줄이기: 카드는 즉시 앞면(뒷면·뒤집기 없음), 배지 움직임 없음. 애니메이션은 transform·opacity·filter 뿐이다(tutorial.css).

type CardKind = "citizen" | "mafia" | "doctor" | "police";

interface CardDef {
  kind: CardKind;
  name: string;
  line: string;
  icon: V2IconName;
  /** 배지 대표 움직임 클래스(시안 Roles.dc.html 의 a-eye·a-mask·a-shield·a-lens) */
  anim: "a-eye" | "a-mask" | "a-shield" | "a-lens";
}

/** 시민 → 마피아 → 의사 → 경찰 순서(시안과 같다) */
const CARDS: readonly CardDef[] = [
  { kind: "citizen", name: "시민", line: "흔적과 목격으로 마피아를 찾아요", icon: "eye", anim: "a-eye" },
  { kind: "mafia", name: "마피아", line: "밤에 한 명을 고르고 들키지 않아요", icon: "mask", anim: "a-mask" },
  { kind: "doctor", name: "의사", line: "밤에 한 명을 지켜요", icon: "shield", anim: "a-shield" },
  { kind: "police", name: "경찰", line: "밤에 한 명이 마피아인지 알아봐요", icon: "lens", anim: "a-lens" },
];

/** 뒤집기 시작 지연(ms): 0.35초 간격 — tutorialScript 의 tut.flip 시각(100·450·800·1150)과 같은 값이다 */
const FLIP_DELAYS_MS: readonly number[] = [100, 450, 800, 1150];
/** 아래 줄 "낮에는 모두 함께 투표해요"를 보이는 창 높이 하한(UI-SPEC T-15: 높이 700 이상에서만) */
const FOOT_MIN_HEIGHT = 700;

/** 창 높이(px). 화면 회전·키보드로 바뀌면 따라간다 */
function useWindowHeight(): number {
  const [h, setH] = useState<number>(() => (typeof window === "undefined" ? 0 : window.innerHeight));
  useEffect(() => {
    const onResize = (): void => setH(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return h;
}

/** 직업 그림: 3:4 자리를 비워 두고(레이아웃 이동 없음), 그림이 오면 불투명도만 바꾼다. 장식이라 alt 는 빈칸 */
function RoleArt({ kind }: { kind: CardKind }) {
  const art = roleArtSrc(kind);
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const img = ref.current;
    if (img !== null && img.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <span className={loaded ? "tut-role__art is-loaded" : "tut-role__art"}>
      <img ref={ref} src={art.src} srcSet={art.srcSet} alt="" width={96} height={128} draggable={false} onLoad={() => setLoaded(true)} />
    </span>
  );
}

export function TutorialRoleCards() {
  const reduced = useReducedMotion();
  const height = useWindowHeight();
  return (
    <div className="tut-roles" data-tutorial-roles="">
      <div className="tut-roles__grid">
        {CARDS.map((c, i) => (
          <div
            key={c.kind}
            className={`tut-role tut-role--${c.kind}${reduced ? "" : " is-flip"}`}
            data-tutorial-role-card={c.kind}
            role="group"
            aria-label={`${c.name} 카드`}
            style={{ "--tut-flip-delay": `${FLIP_DELAYS_MS[i]}ms` } as CSSProperties}
          >
            <div className="tut-role__face">
              <RoleArt kind={c.kind} />
              <span className="tut-role__name">{c.name}</span>
              <span className="tut-role__line">{c.line}</span>
              <span className="tut-role__badge" data-role-badge="">
                <V2Icon name={c.icon} size={24} className={reduced ? undefined : `tut-role__ico ${c.anim}`} />
              </span>
            </div>
            {reduced ? null : (
              <div className="tut-role__back" aria-hidden="true">
                <Diamond />
              </div>
            )}
          </div>
        ))}
      </div>
      {height >= FOOT_MIN_HEIGHT ? <p className="tut-roles__foot">낮에는 모두 함께 투표해요</p> : null}
    </div>
  );
}
