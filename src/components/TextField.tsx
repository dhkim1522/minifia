import { useId } from "react";
import type { ReactNode, Ref } from "react";

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  kind: "nickname" | "code";
  placeholder?: string;
  error?: string | null;
  inputRef?: Ref<HTMLInputElement>;
  autoFocus?: boolean;
  trailing?: ReactNode;
}

const CODE_LENGTH = 4;
// 닉네임은 9글자 이상도 일단 입력되게 두고(오류 문장으로 알린다) 극단적으로 긴 붙여넣기만 막는다.
const NICKNAME_INPUT_MAX = 32;

// 제어 입력칸. 사용자 문자열은 value 로만 다룬다(HTML 로 해석하지 않는다).
export function TextField({ label, value, onChange, kind, placeholder, error, inputRef, autoFocus, trailing }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-err`;
  const isCode = kind === "code";
  const classes = ["mf-field", error && "mf-field--error"].filter(Boolean).join(" ");
  const inputClasses = ["mf-field__input", isCode && "mf-field__input--code"].filter(Boolean).join(" ");

  const input = (
    <input
      id={id}
      ref={inputRef}
      className={inputClasses}
      type="text"
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      maxLength={isCode ? undefined : NICKNAME_INPUT_MAX}
      inputMode={isCode ? "numeric" : undefined}
      pattern={isCode ? "[0-9]*" : undefined}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={error ? errorId : undefined}
      onChange={(e) => onChange(isCode ? e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH) : e.target.value)}
    />
  );

  return (
    <div className={classes}>
      <label className="mf-field__label" htmlFor={id}>
        {label}
      </label>
      {trailing ? (
        <div className="mf-field__row">
          {input}
          {trailing}
        </div>
      ) : (
        input
      )}
      {error ? (
        <p className="mf-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
