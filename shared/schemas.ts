// 서버 전용 입력 검증 스키마(zod 값 import). Worker 만 이 파일을 import 한다 — src/ 가 import 하면 클라이언트 번들에 zod 가 들어간다.
import { z } from "zod";
import type { ClientMessage, CreateRoomBody, JoinRoomBody } from "./protocol";

const nickname = z.string().max(64);

export const CreateRoomBodySchema = z.object({ nickname }) satisfies z.ZodType<CreateRoomBody>;
export const JoinRoomBodySchema = z.object({ nickname }) satisfies z.ZodType<JoinRoomBody>;

export const ClientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hello"), token: z.string().min(16).max(128) }),
  z.object({ t: z.literal("ping"), c: z.number() }),
  z.object({ t: z.literal("start") }),
  z.object({ t: z.literal("leave") }),
  z.object({ t: z.literal("kick"), seat: z.number().int().min(0).max(7) }),
  // 2페이즈 변형은 strictObject 다: 알 수 없는 키(text·seat·message 등)가 있으면 거부한다(T-02-15, D-16).
  // ROLE_IDS 는 readonly 배열이라 z.enum 에는 튜플 리터럴을 쓴다.
  z.strictObject({ t: z.literal("claim"), claim: z.enum(["mafia", "police", "doctor", "citizen", "none"]) }),
]) satisfies z.ZodType<ClientMessage>;
