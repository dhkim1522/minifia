# ChatPanel

채팅: 기록과 입력줄 [감정표현] [입력칸] [보내기]. 감정표현을 누르면 입력칸 위로 아이콘 9개가 한 줄로 펼쳐지고, 고르면 내 캐릭터가 그 동작을 한다.

- 사람 메시지 `body` 16px. 시스템 메시지는 짧은 기록 형식 `label` 14px: 손가락 아이콘 + "민준 → 도윤"(`vote`), 선두·과반 `brass-200`(`hot`), 단계 안내 `gray-300`(`system`).
- 마피아 밤 채팅(`channel: 'mafia'`)은 마피아 본인 화면에만 보이고 이름이 `crimson-300`.
- 보내기와 감정표현은 아이콘 버튼(48px, `aria-label`). 입력칸 글자 16px, 100자까지.
- 쓰는 쪽이 줄 것: `messages`, `value`·`onChange`·`onSend`, `emotes`(id·label)·`onEmote`. 밤처럼 동작을 못 하는 단계는 `emotes` 를 비운다.
