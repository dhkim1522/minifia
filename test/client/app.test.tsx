import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App";

describe("App 첫 화면", () => {
  it("서비스 이름 제목과 빌드 버전을 보여 준다", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "미니피아" })).toBeTruthy();
    expect(screen.getByText("vdev")).toBeTruthy();
  });
});
