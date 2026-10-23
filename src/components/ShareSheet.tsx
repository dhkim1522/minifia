import { useEffect, useId, useRef, useState } from "react";
import { buildRoomLink, buildShareText, canWebShare, copyLink, shareOnly } from "../net/share";
import type { ShareNavigator } from "../net/share";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import "../styles/sheet.css";

export interface ShareSheetProps {
  code: string;
  hostNickname: string;
  /** 자리가 8개 다 찼다 */
  full: boolean;
  onClose: () => void;
  /** 기본값 window.location.origin */
  origin?: string;
  /** 기본값 전역 navigator */
  nav?: ShareNavigator;
}

const COPIED_MS = 2000;
const SHARE_TITLE = "Minifia";

// C-03 공유 시트 "친구 초대하기": 방 코드, 읽기 전용 초대 링크, [공유하기], [링크 복사].
// 공유 데이터와 링크에는 title·text·url 뿐이다 — 플레이어 토큰이나 세션 값은 들어가지 않는다(T-01-42).
// 공유·복사는 버튼 클릭 처리기의 첫 줄에서 바로 부른다(첫 await 앞). 그래야 iOS 가 사용자 제스처로 인정한다(Pitfall 6).
export function ShareSheet({ code, hostNickname, full, onClose, origin, nav }: ShareSheetProps) {
  const shareNav: ShareNavigator = nav ?? (typeof navigator === "undefined" ? {} : navigator);
  const url = buildRoomLink(origin ?? window.location.origin, code);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== undefined) clearTimeout(timer.current);
    };
  }, []);

  // iOS 에서는 포커스만으로는 선택되지 않아 setSelectionRange 도 부른다(리서치 가정 A14).
  const selectAll = () => {
    const el = inputRef.current;
    if (!el) return;
    el.select();
    el.setSelectionRange(0, el.value.length);
  };

  const onShare = () => {
    // 취소·거부 모두 화면에 표시하지 않는다. 결과를 기다리지도 않는다.
    void shareOnly(shareNav, { title: SHARE_TITLE, text: buildShareText(hostNickname, code), url });
  };

  const onCopy = async () => {
    const pending = copyLink(shareNav, url); // 첫 await 앞
    const result = await pending;
    if (!mounted.current) return;
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    if (result === "copied") {
      setCopyFailed(false);
      setCopied(true);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        setCopied(false);
      }, COPIED_MS);
    } else {
      setCopied(false);
      setCopyFailed(true);
      inputRef.current?.focus();
      selectAll();
    }
  };

  return (
    <Sheet label="친구 초대하기" onClose={onClose} showClose>
      <div className="mf-share">
        {full ? <p className="mf-share__full">방이 가득 찼어요</p> : null}
        <h2 className="mf-t-heading mf-sheet__title">친구 초대하기</h2>
        <div className="mf-share__block">
          <p className="mf-t-label">방 코드</p>
          <p className="mf-share__code">{code}</p>
        </div>
        <div className="mf-field">
          <label className="mf-field__label" htmlFor={inputId}>
            초대 링크
          </label>
          <input
            id={inputId}
            ref={inputRef}
            className="mf-field__input mf-share__link"
            type="text"
            readOnly
            value={url}
            autoComplete="off"
            spellCheck={false}
            onFocus={selectAll}
          />
          {copyFailed ? (
            <p className="mf-share__hint" role="status">
              길게 눌러 복사하세요
            </p>
          ) : null}
        </div>
        <div className="mf-share__buttons">
          {canWebShare(shareNav) ? (
            <Button variant="primary" block icon={<Icon name="share" />} onClick={onShare}>
              공유하기
            </Button>
          ) : null}
          <Button variant="secondary" block icon={<Icon name={copied ? "check" : "copy"} />} onClick={onCopy}>
            {copied ? "복사했어요" : "링크 복사"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
