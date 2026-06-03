import { getPostHogClient } from "../posthog";

export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  const client = getPostHogClient();
  if (!client) return;
  client.capture({ distinctId, event, properties });
}
