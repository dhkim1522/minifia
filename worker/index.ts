import { APP_VERSION } from "../shared/version";

export { Room } from "./room";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/health" && request.method === "GET") {
      return json({ ok: true, version: APP_VERSION });
    }
    if (pathname.startsWith("/api/")) {
      return json({ error: "NOT_FOUND" }, 404);
    }
    // /api/* 밖은 정적 에셋이 먼저 처리한다. 여기까지 오면 에셋이 없다는 뜻이다.
    return json({ error: "NOT_FOUND" }, 404);
  },
} satisfies ExportedHandler<Env>;
