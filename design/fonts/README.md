# 폰트

- 대표 제목, 제시어, 중앙 결과 발표에는 [Noto Serif KR](https://fonts.google.com/noto/specimen/Noto+Serif+KR) 900을 쓴다. 헤더 단계명과 버튼, 채팅, 이름표는 시스템 고딕을 쓴다. 유언과 쪽지의 본문은 Nanum Pen Script를 쓴다.
- 역할별 크기·굵기·행간은 [디자인 토큰](../tokens.json)에 있다. 토큰을 수정한 뒤 `npm run tokens`로 앱 CSS를 갱신한다.
- 대표 명조는 자체 호스팅한다. [Google Fonts 원본](https://github.com/google/fonts/tree/main/ofl/notoserifkr)의 Noto Serif KR 가변 TTF를 받아, `fonttools[woff]`가 설치된 Python에서 `python scripts/build-noto-serif-subsets.py <TTF 경로>`를 실행한다. 홈 네 글자, 자주 쓰는 게임 문구, 나머지 한글이 각각 필요한 때 내려간다. [라이선스](../../public/fonts/noto-serif-kr/OFL.txt)는 글꼴과 함께 둔다.
- 이전 버전 공유 이미지용 부분 폰트 `GowunDodum-og-subset.ttf`의 라이선스는 `OFL-GowunDodum.txt`에 있다.
