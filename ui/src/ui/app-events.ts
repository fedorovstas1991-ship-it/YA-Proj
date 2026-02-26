export type EventLogEntry = {
  ts: number;
  event: string;
  payload?: unknown;
};

export type AppEvent = {
  type: "success" | "error" | "info" | "warn";
  message: string;
};

export function sendAppEvent(event: AppEvent) {
  window.dispatchEvent(
    new CustomEvent("app-event", {
      detail: event,
      bubbles: true,
      composed: true,
    }),
  );
}
