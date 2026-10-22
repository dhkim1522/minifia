import { describe, expect, it } from "vitest";
import { roomSocketUrl } from "../../src/net/useRoomConnection";

describe("roomSocketUrl", () => {
  it("https 는 wss, http 는 ws 이고 경로는 /api/rooms/{code}/ws 고정이다", () => {
    expect(roomSocketUrl({ protocol: "https:", host: "minifia.example.workers.dev" }, "0042")).toBe(
      "wss://minifia.example.workers.dev/api/rooms/0042/ws",
    );
    expect(roomSocketUrl({ protocol: "http:", host: "localhost:5173" }, "1234")).toBe(
      "ws://localhost:5173/api/rooms/1234/ws",
    );
  });
});
