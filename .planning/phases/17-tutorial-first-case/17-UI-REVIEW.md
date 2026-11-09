# Phase 17 — UI Review

**Phase:** 17 튜토리얼 "첫 사건"
**Overall Score:** 21/24
**Baseline:** 17-UI-SPEC.md
**감사 방식:** 코드 정적 분석(dev server 가 없어 스크린샷 없음). 상호작용 캡처 꺼짐.
**감사 주체:** gsd-ui-auditor (보고서 본문은 오케스트레이터가 옮겨 적음)

## Pillar Summary

| Pillar | Score | 핵심 근거 |
|--------|-------|-----------|
| 1. Copywriting | 4/4 | 사회자 문구 8개, 큰 카드·마무리 카드·스위치·기다림 문구가 UI-SPEC 표와 같다. |
| 2. Visuals | 3/4 | 부품 구조·접근성 이름은 계약대로다. 초점·위계를 눈으로 확인하지 못했다. |
| 3. Color | 4/4 | 튜토리얼 CSS 3개 파일에 hex·rgb 리터럴 0건. crimson 은 T-18 허용 범위 안. |
| 4. Typography | 4/4 | 글자 크기 14·16·24·36, 굵기 400·700 뿐. |
| 5. Spacing | 3/4 | "4의 배수만" 규칙을 깨는 값이 몇 군데 있다. |
| 6. Experience Design | 3/4 | 모션 줄이기·누르는 영역·오답 도움은 갖췄다. 포커스 깜빡임 구현이 계약과 약간 다르다. |

## Top Fixes (모두 WARNING, 차단 아님)

1. **4의 배수가 아닌 간격 값.** `gap: 2px`(`tutorialEntry.css` 두 곳, `tutorial.css` 한 곳), `margin: 2px 0 0`, `.tut-skip` 의 `padding: 0 10px`. 2px 는 `var(--space-xs)`(4), 10px 는 8px 로 바꾸고 카드 높이 84 유지 여부를 같이 본다.
2. **포커스 깜빡임 구현.** 계약은 테두리 4px 와 번짐이 같은 1Hz 키프레임인데, 실제는 `tut-ring`(요소 `opacity`)과 `::before` 의 `tut-glow` 가 따로 돈다. 지금은 위상이 같지만 한쪽만 바뀌면 어긋난다. 키프레임 하나로 합치고 실기기 확인을 UAT 목록에 넣는다.
3. **스크린샷 기반 시각 검증 보강.** 실기기 검사 때(프로젝트 규칙: 끝에 몰아서) 장면 6 포커스 테두리 4곳, 장면 7 직업 카드와 [다음] 겹침(360x560), 오프닝 어둠(.9 정지값)을 확인한다.

## Minor

- 직업 카드 한 줄 설명을 UI-SPEC 표와 대조하지 않았다.
- 램프 어둠 90px(`tutorial.css`), 링 60px, 오프닝 높이 60px 이 UI-SPEC 예외 표에 없다.
- 360x560 겹침과 장면 6 이름표 넘침은 `deferred-items.md` 의 알려진 한계로 감점하지 않았다(진행에 지장 없음, 작은 화면 문제는 그대로 둔다는 원칙).

## 세부 근거

- 문구: `src/game/tutorialScript.ts:86-93`, `TutorialEntry.tsx:36,39`, `TutorialEndCard.tsx:14,21`, `TutorialToggle.tsx:36`, `TutorialWait.tsx:66,71`, `OpeningFx.tsx:80`, `TutorialReveal.tsx:51`. 금지 문구 없음.
- 접근성: 이미지 `alt=""` 장식 처리, 아이콘 단추 `aria-label`, 스위치 `role="switch"`, 진행 점 `role="img"`, 사회자 띠 `role="status"`.
- 모션 줄이기 블록 4개(`tutorial.css:390` 등): 포커스 정지 4px, 파형 중간 높이, 오프닝·공개·직업 카드 즉시 완성.
- `.tut-skip::before` 는 `inset: -6px -2px` 로 누르는 영역을 44 이상으로 확장한다.
- 글자 크기 사용: 14px 8회, 16px 6회, 24px 6회, 36px 3회. 인라인 `fontSize` 없음.
