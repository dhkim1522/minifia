# Table

모든 게임 화면의 중심인 2.5D 원근 타원 테이블과 8자리다. 화면에서는 항상 `Backdrop` 광장 위에 `bare` 로 놓는다. `bare` 없이 쓰는 단독 바탕은 부품 확인용이다.

- 내 자리는 항상 맨 아래 가운데(가장 크게), 맞은편은 0.62배. 좌표는 앱의 `seatLayout` 과 같은 식이다.
- 층: 비네트 → 달빛 웅덩이 → 테이블 그림자 → 테이블 판(아래 두께 띠) → 자리. 실시간 3D 는 쓰지 않는다. 게임 화면에서는 `Backdrop` 광장 위에 `bare` 로 놓는다.
- 이름표는 자리 크기와 상관없이 14px 이다. 앞쪽 자리는 발 아래, 뒤쪽 자리는 머리 위.
- 빈 자리는 빈 의자만 그린다. 방장은 왕관(머리 왼쪽 위), 마피아 동료는 마름모(오른쪽 위)와 발밑 진홍 링.
- `dimmed`(역할 확인 중)는 막을 덮지만 동료 표시는 막 위에 남는다.
- 밤 지목·투표에서 고를 수 있는 자리는 점선 링(`selectable`), 고른 자리는 흰 링(`selected`). 밤 화면은 역할과 상관없이 같은 색을 쓴다.
- 최후 변론 후보는 `candidate` 로 위에서 조명을 받는다.

| seat 항목 | 값 |
|---|---|
| `name`, `variant`, `me`, `host`, `mate` | 기본 정보 |
| `state` | `default` · `disconnected` · `dead` |
| `claim`, `changed` | 직업 주장과 말 바꿈 |
| `bubble` | 빠른 메시지 말풍선 |
| `reaction` | 반응 아이콘 이름 |
| `votes` | 받은 표 수. 투표가 끝난 뒤 동시 공개 화면에서만 넣는다(투표 중에는 남의 표를 보여 주지 않는다, 결정 0011) |
| `selectable`, `selected`, `candidate`, `pressable` | 고르기 상태 |

테이블 prop: `seats`(8칸, 빈 자리는 null), `mySeat`, `bare`(`Backdrop` 위에 올릴 때 자기 바탕을 지운다), `dimmed`, `morning`, `center`(판 위 글자), `onSeatPress`.
