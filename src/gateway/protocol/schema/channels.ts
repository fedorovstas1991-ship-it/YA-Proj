import { Type, Static } from "@sinclair/typebox";
import { NonEmptyString } from "./utils";

export const ChannelTelegramConfigSchema = Type.Object(
  {
    token: NonEmptyString,
    allowFrom: Type.Array(Type.Union([Type.Number(), Type.String()])),
    groups: Type.Optional(
      Type.Record(
        Type.String(),
        Type.Object({
          requireMention: Type.Optional(Type.Boolean()),
        }),
      ),
    ),
  },
  { $id: "ChannelTelegramConfig" },
);

export type ChannelTelegramConfig = Static<typeof ChannelTelegramConfigSchema>;

export const ChannelTelegramSaveRequestSchema = Type.Object({
  token: Type.String({ minLength: 1, description: "Telegram bot token" }),
  allowFrom: Type.Optional(
    Type.Array(
      Type.Union([Type.String(), Type.Number()]),
      { description: "List of user IDs or usernames allowed to interact with the bot" },
    ),
  ),
  groups: Type.Optional(
    Type.Record(
      Type.String(),
      Type.Object(
        {
          requireMention: Type.Optional(Type.Boolean()),
        },
        { description: "Configuration for specific groups by their ID" },
      ),
    ),
  ),
});

export type ChannelTelegramSaveRequest = Static<
  typeof ChannelTelegramSaveRequestSchema
>;

export const ChannelTelegramSaveResponseSchema = Type.Object({
  ok: Type.Boolean(),
  probe: Type.Optional(
    Type.Any(),
  ), // Information about the connection result
  error: Type.Optional(Type.String()),
});

export type ChannelTelegramSaveResponse = Static<
  typeof ChannelTelegramSaveResponseSchema
>;
