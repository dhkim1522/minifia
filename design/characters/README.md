# 캐릭터 에셋 (세트 C, 확정)

클로드 데스크톱에서 만든 "minifia 캐릭터 에셋" 캔버스(https://claude.ai/artifact/4dYpe74vxJHSnA4WhFSLTM)의 **세트 C** 를 최종 캐릭터로 정했다(2026-10-22). 이 폴더는 데스크톱에서 내려받은 `minifia-characters-C.zip` 을 그대로 푼 원본이다. 규격의 원문은 `ASSET_SPEC.md`, 전체 목록·한글 이름·자리 색은 `manifest.json`.

## 요약

| 항목 | 값 |
|---|---|
| 화면 크기 | 72×96 (가로:세로 3:4) |
| 파일 | `@2x` 144×192, `@4x` 288×384 투명 PNG |
| 이름 | `<id>_<state>@2x.png`, state 는 `default` · `disconnected` · `dead` |
| 기준점 | 발 끝이 아래에서 2px(논리) 위, 가로 가운데 |
| 끊김 | 흑백 + 60% (파일도 있지만 코드로 만든다) |
| 탈락 | 인물 대신 유령 `ghost` 하나(자리별 유령 없음) |

## 폴더

| 폴더 | 내용 | 누가 보나 |
|---|---|---|
| `table/` | 테이블 인물 8종 `fig1_boy_brown` ~ `fig8_girl_tanhat`. 넥타이 색이 자리 구분색 `seat-1`~`seat-8`. 직업 소품 없음 | 모두 |
| `roles/` | 직업 4종 `mafia` · `police` · `doctor` · `citizen`. 진홍 넥타이는 마피아에만, 의사 십자는 청록 | 본인 역할 카드, 마피아 동료, 경찰 결과, 게임 끝 결과에만 |
| `ghost/` | 탈락자 유령 1종(고리, X 눈). 원본 SVG 는 `source/ghost_svg/` | 모두 |
| `extra/` | 확장용 16종. v1 에는 쓰지 않는다. 의사 B·경찰 의사는 빨간 십자, 마피아 C·D·탐정은 총·무전기 소품이 있어 쓰기 전에 고친다(`ASSET_SPEC.md` 8) | — |

다른 사람의 직업은 서버가 보내지 않으므로, 직업 그림은 받은 정보가 있는 화면에서만 그린다.

## 앱에서 쓰는 파일

앱은 `public/characters/` 의 사본을 쓴다(빌드하면 그대로 배포된다). 기본 상태만 넣었다. 끊김·탈락 효과는 CSS 로, 해상도는 `srcset` 으로 고른다.

```
public/characters/table/fig{1-8}_<이름>_default@2x.png · @4x.png
public/characters/roles/{mafia,police,doctor,citizen}_default@2x.png · @4x.png
public/characters/ghost/ghost_default@2x.png · @4x.png
```

```html
<img src="/characters/table/fig1_boy_brown_default@2x.png"
     srcset="/characters/table/fig1_boy_brown_default@2x.png 2x, /characters/table/fig1_boy_brown_default@4x.png 4x"
     width="72" height="96" alt="">
```

원본을 바꾸면 이 폴더를 고친 뒤 `public/characters/` 의 해당 파일도 다시 복사한다. 새 캐릭터는 `ASSET_SPEC.md` 7(확장 규칙)을 지키고 `manifest.json` 에 한 줄 더한다.
