# 폰트

- 앱 글꼴은 **Gowun Dodum**(OFL, `OFL-GowunDodum.txt`)이다. `index.html` 이 Google Fonts 로 불러오고, 토큰 `font-ui` 맨 앞에 두며 시스템 글꼴이 뒤를 받친다.
- `GowunDodum-og-subset.ttf` 는 OG 이미지(`scripts/make-og.mjs`)에 필요한 글자만 뽑은 부분 폰트다. 문구를 바꾸면 다시 뽑는다:
  `pyftsubset GowunDodum-Regular.ttf --text="<이미지에 쓰는 모든 글자>" --output-file=design/fonts/GowunDodum-og-subset.ttf --layout-features='*'`
  (원본 `GowunDodum-Regular.ttf` 는 https://github.com/google/fonts/tree/main/ofl/gowundodum, 저장소에는 넣지 않는다.)
