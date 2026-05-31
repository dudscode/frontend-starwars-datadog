import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { DdLogsInterceptor } from './dd-logs.interceptor';
import { ObservabilityService } from '../services/observability.service';

describe('DdLogsInterceptor', () => {
  let httpMock: HttpTestingController;
  let http: HttpClient;
  let obsMock: jest.Mocked<Pick<ObservabilityService, 'log'>>;

  beforeEach(() => {
    obsMock = { log: jest.fn() };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: ObservabilityService, useValue: obsMock },
        { provide: HTTP_INTERCEPTORS, useClass: DdLogsInterceptor, multi: true },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should NOT call obs.log on a successful (200) response', () => {
    http.get('/api/test').subscribe();
    httpMock.expectOne('/api/test').flush({ data: 'ok' });
    expect(obsMock.log).not.toHaveBeenCalled();
  });

  it('should call obs.log with request_error on HTTP 500', (done) => {
    http.get('/api/people').subscribe({
      error: () => {
        expect(obsMock.log).toHaveBeenCalledWith(
          expect.objectContaining({
            event_type: 'request_error',
            severity: 'error',
            http_status: 500,
            endpoint: '/api/people',
          })
        );
        done();
      },
    });
    httpMock
      .expectOne('/api/people')
      .flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
  });

  it('should set http_status to 0 on network (status 0) errors', (done) => {
    http.get('/api/films').subscribe({
      error: () => {
        expect(obsMock.log).toHaveBeenCalledWith(
          expect.objectContaining({ http_status: 0 })
        );
        done();
      },
    });
    httpMock
      .expectOne('/api/films')
      .flush('Network Error', { status: 0, statusText: 'Unknown Error' });
  });

  it('should re-throw the error so subscribers receive it', (done) => {
    http.get('/api/people').subscribe({
      error: (err) => {
        expect(err).toBeTruthy();
        done();
      },
    });
    httpMock
      .expectOne('/api/people')
      .flush('Error', { status: 500, statusText: 'Internal Server Error' });
  });
});
