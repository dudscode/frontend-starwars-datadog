export type EventType = 'latency' | 'request_error' | 'js_error' | 'render_complete';

export type Severity = 'info' | 'warning' | 'error';

export interface LogPayload {
  event_type: EventType;
  severity: Severity;
  view_name?: string;
  duration_ms?: number;
  threshold_exceeded?: boolean;
  http_status?: number;
  endpoint?: string;
  error_message?: string;
}

export interface DdLogsInstance {
  setGlobalContextProperty(key: string, value: string): void;
  logger: {
    log(message: string, context: Record<string, unknown>, level: string): void;
  };
}

declare global {
  interface Window {
    DD_LOGS?: DdLogsInstance;
  }
}
