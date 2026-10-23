# ResultList

게임이 끝나면 모든 사람의 역할을 공개하는 목록이다.

- 행마다 인물, 이름, 역할 문양과 이름. 마피아 행의 역할 글자만 `crimson-300`.
- 탈락한 사람은 이름에 취소선과 흐린 인물.
- 위에는 Announcement 로 승리 팀을 발표한다.

| prop | 값 |
|---|---|
| `players` | `{ name, role, dead, me, variant }` 목록 |
