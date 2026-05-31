import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { ObservabilityService } from './app/core/services/observability.service';

bootstrapApplication(AppComponent, appConfig)
  .then((appRef) => {
    const obs = appRef.injector.get(ObservabilityService);
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      obs.log({
        event_type: 'js_error',
        severity: 'error',
        error_message:
          event.reason instanceof Error
            ? event.reason.message
            : String(event.reason ?? 'Unhandled rejection'),
      });
    });
  })
  .catch((err: unknown) => console.error(err));
