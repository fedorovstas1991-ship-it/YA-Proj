import { Type } from "@sinclair/typebox";
import { Static } from "@sinclair/typebox";
import { gatewayLogger as logger } from "../../logger";
import {
  ChannelTelegramSaveRequestSchema,
  ChannelTelegramSaveResponseSchema,
} from "../protocol/schema/channels";
import { ChannelTelegramConfigSchema } from "../protocol/schema/channels";
import { applyGatewayConfig, readGatewayConfig } from "../../config";

export const channelHandlers = {
  "channels.telegram.save": async ({
    params,
    context,
    respond,
  }: {
    params: Static<typeof ChannelTelegramSaveRequestSchema>;
    context: any; // TODO: Type this properly
    respond: (response: Static<typeof ChannelTelegramSaveResponseSchema>) => void;
  }) => {
    try {
      logger.info("channels.telegram.save called", params);

      const { token, allowFrom, groups } = params;

      // Validate the config against the schema
      const configToSave: Static<typeof ChannelTelegramConfigSchema> = {
        token,
        allowFrom: allowFrom || [], // Ensure allowFrom is an array
        groups: groups || {},
      };

      // Apply the new Telegram configuration to the gateway
      // This will merge the new config with existing channel configs
      await applyGatewayConfig((currentConfig) => {
        if (!currentConfig.channels) {
          currentConfig.channels = {};
        }
        if (!currentConfig.channels.telegram) {
          currentConfig.channels.telegram = {};
        }
        // Update only the specific fields for Telegram channel
        currentConfig.channels.telegram = {
          ...currentConfig.channels.telegram,
          ...configToSave,
        };
        return currentConfig;
      });

      // Attempt to configure the Telegram plugin
      let probeResult: any;
      if (context.channelPlugins?.telegram?.configure) {
        // Assuming the configure method exists and accepts the config
        probeResult = await context.channelPlugins.telegram.configure(configToSave);
      } else {
        logger.warn("Telegram channel plugin not found or configure method missing.");
        probeResult = { error: "Telegram plugin not available or not configured." };
      }

      if (probeResult?.error) {
        logger.error(
          "Failed to configure Telegram plugin:",
          probeResult.error,
        );
        respond({ ok: false, error: probeResult.error, probe: probeResult });
        return;
      }

      logger.info("Telegram channel saved and configured successfully.");
      respond({ ok: true, probe: probeResult });
    } catch (error: any) {
      logger.error("Error in channels.telegram.save:", error);
      respond({ ok: false, error: error.message });
    }
  },
};
