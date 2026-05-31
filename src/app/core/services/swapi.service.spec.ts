import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SwapiService } from './swapi.service';
import { environment } from '../../../environments/environment';
import { SwapiPage } from '../../models/swapi-page.model';
import { Character } from '../../models/character.model';

describe('SwapiService', () => {
  let service: SwapiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SwapiService],
    });
    service = TestBed.inject(SwapiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getCharacters', () => {
    it('should request page 1 by default', () => {
      service.getCharacters().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/people/?page=1`);
      expect(req.request.method).toBe('GET');
      req.flush({ count: 82, next: null, previous: null, results: [] });
    });

    it('should request a specific page number', () => {
      service.getCharacters(3).subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/people/?page=3`);
      expect(req.request.method).toBe('GET');
      req.flush({ count: 82, next: null, previous: null, results: [] });
    });

    it('should return SwapiPage<Character> data', (done) => {
      const mockPage: SwapiPage<Character> = {
        count: 1,
        next: null,
        previous: null,
        results: [{
          name: 'Luke Skywalker',
          birth_year: '19BBY',
          gender: 'male',
          height: '172',
          mass: '77',
          homeworld: 'https://swapi.dev/api/planets/1/',
          films: [],
          url: 'https://swapi.dev/api/people/1/',
        }],
      };

      service.getCharacters(1).subscribe((page) => {
        expect(page.count).toBe(1);
        expect(page.results[0].name).toBe('Luke Skywalker');
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/people/?page=1`);
      req.flush(mockPage);
    });

    it('should emit an error with message "Failed to load characters" on HTTP failure', (done) => {
      service.getCharacters(1).subscribe({
        error: (err: Error) => {
          expect(err.message).toBe('Failed to load characters');
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/people/?page=1`);
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('getFilms', () => {
    it('should request the films endpoint', () => {
      service.getFilms().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/films/`);
      expect(req.request.method).toBe('GET');
      req.flush({ count: 6, next: null, previous: null, results: [] });
    });

    it('should return the same observable reference on multiple calls', () => {
      const first = service.getFilms();
      const second = service.getFilms();
      expect(first).toBe(second);
      // Flush to prevent pending requests error
      service.getFilms().subscribe();
      httpMock.expectOne(`${environment.apiUrl}/films/`).flush({ count: 0, next: null, previous: null, results: [] });
    });

    it('should emit an error with message "Failed to load films" on HTTP failure', (done) => {
      service.getFilms().subscribe({
        error: (err: Error) => {
          expect(err.message).toBe('Failed to load films');
          done();
        },
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/films/`);
      req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });
    });
  });
});
