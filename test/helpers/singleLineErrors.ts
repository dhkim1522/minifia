// 테스트 전용: Testing Library 의 찾기 실패 메시지에서 화면 전체 덤프(여러 줄)를 뺀다.
// 실패 보고서가 한 줄 메시지로 남아 TAP 보고서를 기계가 읽을 수 있고, 어떤 칸·문구가 없는지가 먼저 보인다.
// 파일 첫머리에서 `import "../helpers/singleLineErrors";` 로 켠다(테스트 파일마다 모듈이 따로라 다른 파일에는 번지지 않는다).
import { configure } from "@testing-library/react";

configure({
  getElementError: (message) => new Error((message ?? "").split("\n")[0] ?? ""),
});
