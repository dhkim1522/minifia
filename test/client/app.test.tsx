import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App";

describe("App 첫 화면", () => {
  it("코드명 제목과 빌드 버전을 보여 준다", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "minifia" })).toBeTruthy();
    expect(screen.getByText("vdev")).toBeTruthy();
  });
});
