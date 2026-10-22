# 배경 에셋 (A_cute, 확정)

클로드 데스크톱에서 만든 배경 장면이다. 데스크톱에서 받은 `minifia-assets-all.zip` 의 `minifia-backgrounds/` 를 그대로 풀었다. 규격 원문은 `BACKGROUND_SPEC.md`.

- 그림체 두 가지 중 **A_cute**(둥글고 귀여운 면 색)를 쓴다(2026-10-22 사용자 결정). 캐릭터 세트 C 와 화풍이 같다. `B_system` 은 비교용으로 보관만 한다.
- 장면 4종 `lobby` · `night` · `day` · `verdict` × 구도 2종 `game`(지평선 높음, 테이블 화면) · `entry`(큰 달과 양옆 집, 입장 화면) = 8장.
- 1080×2340(약 9:19.5), PNG(불투명)와 SVG. 미리보기 `preview_A_cute.png`.

## 앱에서 쓰는 파일

앱은 `public/backgrounds/bg_<game|entry>_<장면>.svg`(A_cute SVG, 장면당 약 45KB)를 쓴다. PNG(장면당 약 450KB)는 원본 보관용이다. SVG 는 그림 파일·스크립트가 없는 순수 벡터이고, 들어 있는 메타데이터는 출처 표시(C2PA)뿐이다.

```css
.screen { background: var(--night-900) url(/backgrounds/bg_game_night.svg) center top / cover no-repeat; }
```

- 안전 영역: `game` 은 위 20% 하늘(단계 바), 가운데 아래 55% 광장(테이블). `entry` 는 아래 40% 광장(제목·입력칸).
- 글자는 장면 위에 바로 올리지 않는다. 장식이라 `aria-hidden`, 장면 전환은 0.8초 교차 페이드.
- 원본을 바꾸면 `A_cute/` 를 고친 뒤 `public/backgrounds/` 의 SVG 도 다시 복사한다.
