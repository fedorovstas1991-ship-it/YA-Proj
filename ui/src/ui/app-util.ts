import { parseAgentSessionKey } from "../../../src/sessions/session-key-utils.js";

export function getSessionAgentId(sessionKey: string | undefined | null): string | null {
    if (!sessionKey) return null;
    const parsed = parseAgentSessionKey(sessionKey);
    return parsed?.agentId ?? null;
}

export function getSessionDisplayName(sessionKey: string | undefined | null): string {
    if (!sessionKey) return "Chat";
    const parsed = parseAgentSessionKey(sessionKey);
    if (parsed?.rest && parsed.rest !== "main") {
        return parsed.rest;
    }
    return "Chat";
}
