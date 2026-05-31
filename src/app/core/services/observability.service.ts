import { Injectable } from '@angular/core';
import { Observable, filter, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LogPayload } from '../types/dd-logs.types';

const LATENCY_THRESHOLD_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ObservabilityService {
  constructor() {
    if (!window.DD_LOGS) return;
    window.DD_LOGS.setGlobalContextProperty('app_version', environment.appVersion);
    window.DD_LOGS.setGlobalContextProperty('deploy_type', environment.deployType);
  }

  log(payload: LogPayload): void {
    if (!window.DD_LOGS) return;
    const level =
      payload.severity === 'error'
        ? 'error'
        : payload.severity === 'warning'
        ? 'warn'
        : 'info';
    window.DD_LOGS.logger.log(payload.event_type, { ...payload }, level);
  }

  watchView<T>(viewName: string, ready$: Observable<T | null>): void {
    const start = performance.now();
    ready$
      .pipe(filter((v): v is T => v !== null), take(1))
      .subscribe(() => {
        const duration_ms = Math.round(performance.now() - start);
        const exceeded = duration_ms > LATENCY_THRESHOLD_MS;
        this.log({
          event_type: exceeded ? 'latency' : 'render_complete',
          severity: exceeded ? 'warning' : 'info',
          view_name: viewName,
          duration_ms,
          threshold_exceeded: exceeded,
        });
      });
  }
}
