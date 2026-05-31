import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LogPayload } from '../types/dd-logs.types';

const LATENCY_THRESHOLD_MS = 5000;

@Injectable({ providedIn: 'root' })
export class ObservabilityService {
  private timers = new Map<string, number>();

  constructor() {
    if (!window.DD_LOGS) return;
    window.DD_LOGS.setGlobalContextProperty('app_version', environment.appVersion);
    window.DD_LOGS.setGlobalContextProperty('deploy_type', environment.deployType);
  }

  /**
   * Marca o início da medição de uma tela.
   * Chame quando a navegação para a tela começa — ex: constructor do componente,
   * guard de rota, ou qualquer ponto que represente "o usuário pediu esta tela".
   */
  startTimer(viewName: string): void {
    const start = performance.now();
    this.timers.set(viewName, start);
    console.log(`[DD] ⏱ timer iniciado: ${viewName}`);
  }

  /**
   * Encerra a medição e envia o evento de latência.
   * Chame quando a tela estiver completamente renderizada com dados visíveis —
   * ex: tap no primeiro valor não-nulo do observable de dados.
   */
  logViewReady(viewName: string): void {
    const start = this.timers.get(viewName);
    if (start === undefined) {
      console.warn(`[DD] logViewReady chamado sem startTimer para: ${viewName}`);
      return;
    }

    this.timers.delete(viewName);
    const duration_ms = Math.round(performance.now() - start);
    const exceeded = duration_ms > LATENCY_THRESHOLD_MS;

    if (exceeded) {
      console.warn(`[DD] ⚠️ render LENTO: ${viewName} — ${duration_ms} ms (> ${LATENCY_THRESHOLD_MS} ms)`);
    } else {
      console.log(`[DD] ✅ render OK: ${viewName} — ${duration_ms} ms`);
    }

    this.log({
      event_type: exceeded ? 'latency' : 'render_complete',
      severity: exceeded ? 'warning' : 'info',
      view_name: viewName,
      duration_ms,
      threshold_exceeded: exceeded,
    });
  }

  log(payload: LogPayload): void {
    const consoleFn =
      payload.severity === 'error'
        ? console.error
        : payload.severity === 'warning'
        ? console.warn
        : console.log;

    consoleFn('[DD]', payload.event_type, payload);

    if (!window.DD_LOGS) return;
    const level =
      payload.severity === 'error'
        ? 'error'
        : payload.severity === 'warning'
        ? 'warn'
        : 'info';
    window.DD_LOGS.logger.log(payload.event_type, { ...payload }, level);
  }
}
