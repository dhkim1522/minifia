# Figure

테이블에 앉는 캐릭터다. 세트 C 8종을 자리마다 하나씩 쓴다. 원본은 저장소 `design/characters/table/`, 앱용은 `public/characters/table/`(`@2x`·`@4x`). 규격 원문은 `design/characters/ASSET_SPEC.md`.

- 논리 크기 72×96(가로:세로 3:4), 파일은 `@2x` 144×192 · `@4x` 288×384 투명 PNG. 발 끝은 아래에서 2px 위, 가로 가운데.
- 넥타이 색이 자리 구분색(`seat-1`~`seat-8`)과 맞춰져 있다. 이름표 점도 같은 색이다.
- 상태: `default`, `disconnected`(흑백 + 60%), `dead`(유령 그림 하나, `ghost`). 색·모양만으로 구분하지 않도록 이름표에 끊김 아이콘과 "탈락" 글자를 함께 둔다.
- 직업 그림(마피아·경찰·의사·시민)은 테이블에 쓰지 않는다. 본인 역할 카드 앞면(`RoleCard`)과 게임 끝 결과에만 쓴다. 다른 사람의 직업은 서버가 보내지 않는다.

| prop | 값 |
|---|---|
| `variant` | 0~7 (`fig1_boy_brown` 소년 갈색 … `fig8_girl_tanhat` 소녀 갈색 중절모) |
| `state` | `default` · `disconnected` · `dead` |
| `label` | 접근성 이름 |
