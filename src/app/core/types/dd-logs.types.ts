export type EventType =
  | 'render_complete' // tela carregou dentro do SLA (≤ 5 s)
  | 'latency'        // tela carregou mas ultrapassou o SLA (> 5 s), dados chegaram
  | 'timer_lost'     // timeout automático: dados nunca chegaram em 5 s
  | 'request_error'  // falha HTTP
  | 'js_error';      // erro JavaScript não tratado

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
