# Figure

테이블에 앉는 캐릭터다. 세트 C 8종을 한 방 안에서 겹치지 않게 하나씩 쓴다. 원본은 저장소 `design/characters/table/`, 앱용은 `public/characters/table/`(`@2x`·`@4x`). 규격 원문은 `design/characters/ASSET_SPEC.md`.

- 논리 크기 72×96(가로:세로 3:4), 파일은 `@2x` 144×192 · `@4x` 288×384 투명 PNG. 발 끝은 아래에서 2px 위, 가로 가운데.
- 넥타이 색이 자리 구분색(`seat-1`~`seat-8`)과 맞춰져 있다. 이름표 점도 같은 색이다.
- 상태: `default`, `disconnected`(흑백 + 60%), `dead`(유령 v3 그림 하나, 결정 0031). 이름표에 끊김 아이콘과 "탈락" 글자를 함께 둔다.
- **후광** `halo`(결정 0030·0037): 그림 윤곽을 따르는 두 겹 `drop-shadow`. 흰 = 말하는 차례 · 내 선택, 앰버 = 공개 · 후보, 진홍 = 마피아 동료. 한 화면 최대 3개.
- 직업 그림(마피아 · 경찰 · 의사 · 시민)은 테이블에 쓰지 않는다. 본인 역할 카드, 마피아 본인 화면의 동료, 관전자 화면, 결과 화면에만 쓴다.
- 방장 배지 `characters/host/host_badge.svg` 는 대기실에서만 머리 왼쪽 위에 둔다.

| prop | 값 |
|---|---|
| `variant` | 0~7 (`fig1_boy_brown` 소년 갈색 … `fig8_girl_tanhat` 소녀 갈색 중절모) |
| `state` | `default` · `disconnected` · `dead` |
| `halo` | `white` · `amber` · `crimson` |
| `label` | 접근성 이름 |
