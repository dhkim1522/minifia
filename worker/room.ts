import { DurableObject } from "cloudflare:workers";

// 방 하나 = Durable Object 하나. 기능은 01-02 에서 얹는다.
export class Room extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }
}
