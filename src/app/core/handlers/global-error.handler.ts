import { ErrorHandler, Injectable, Injector } from '@angular/core';
import { ObservabilityService } from '../services/observability.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error: unknown): void {
    console.error(error);
    try {
      const obs = this.injector.get(ObservabilityService);
      obs.log({
        event_type: 'js_error',
        severity: 'error',
        error_message: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // Injector not yet ready or ObservabilityService unavailable — console.error already called above
    }
  }
}
