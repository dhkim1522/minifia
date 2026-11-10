# 18.1 이월 항목

## 18.1-04 에서 발견

- `scripts/e2e/browser.mjs` 838행: 행동 버튼 수를 `button:not([data-chat-send]):not([data-chat-newdot]):not([data-emote-button]):not([data-emote])` 로 센다. 18.1-04 가 기록 칸에 `button[data-chat-open]` 을 더해 이 수가 하나 늘어난다. E2E 를 손보는 계획(18.1-06·18.1-09)에서 `:not([data-chat-open])` 을 더한다. 18.1-04 의 files_modified 밖이라 고치지 않았다.
