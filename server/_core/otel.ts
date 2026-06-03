/**
 * Optional OpenTelemetry — enable with OTEL_EXPORTER_OTLP_ENDPOINT.
 * Full SDK wiring is deferred; this documents the hook point for Phase 4.
 */

export function initOtel(): void {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  console.info(
    JSON.stringify({
      type: "otel",
      message: "OTEL_EXPORTER_OTLP_ENDPOINT is set; install @opentelemetry/sdk-node for full export",
    })
  );
}
