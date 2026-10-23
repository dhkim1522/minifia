# Button

화면의 주 행동 하나와 보조 행동을 누르는 버튼이다.

- 주 버튼(`primary`)은 화면에 하나만 둔다: 방 만들기, 들어가기, 게임 시작, 보내기. 면은 `gray-100`, 글자는 `night-900` 이다. 진홍 면 버튼은 없다.
- 보조 버튼(`secondary`)은 공유, 내 역할, 시트의 파괴 동작에 쓴다.
- 텍스트 버튼(`text`)은 나가기처럼 자주 누르지 않을 동작에 쓴다.
- 높이 52px(`control-button`), 짧은 버튼은 `compact` 로 44px.
- 요청 중에는 `disabled`. 시작 버튼은 누른 뒤 2초 동안 다시 보내지 않는다.

| prop | 값 |
|---|---|
| `variant` | `primary` · `secondary` · `text` |
| `block` | 전체 폭 |
| `compact` | 높이 44px |
| `icon` | Icon 이름 |
| `disabled`, `onClick`, `children` | 표준 |
