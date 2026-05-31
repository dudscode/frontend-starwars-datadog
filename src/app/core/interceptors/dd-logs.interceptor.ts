import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { ObservabilityService } from '../services/observability.service';

@Injectable()
export class DdLogsInterceptor implements HttpInterceptor {
  constructor(private obs: ObservabilityService) {}

  intercept(
    req: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        this.obs.log({
          event_type: 'request_error',
          severity: 'error',
          http_status: error.status,
          endpoint: req.url,
          error_message: error.message,
        });
        return throwError(() => error);
      })
    );
  }
}
