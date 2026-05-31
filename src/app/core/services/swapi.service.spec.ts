import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SwapiService } from './swapi.service';
import { environment } from '../../../environments/environment';
import { Character } from '../../models/character.model';
import { Film } from '../../models/film.model';

const mockCharacter: Character = {
  name: 'Luke Skywalker',
  birth_year: '19BBY',
  gender: 'male',
  height: '172',
  mass: '77',
  homeworld: 'https://swapi.info/api/planets/1',
  films: [],
  url: 'https://swapi.info/api/people/1',
};

const mockFilm: Film = {
  episode_id: 4,
  title: 'A New Hope',
  director: 'George Lucas',
  producer: 'Gary Kurtz',
  release_date: '1977-05-25',
  opening_crawl: '...',
  characters: [],
  url: 'https://swapi.info/api/films/1',
};

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
    it('should request the people endpoint', () => {
      service.getCharacters().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/people`);
      expect(req.request.method).toBe('GET');
      req.flush([mockCharacter]);
    });

    it('should return a flat Character array', (done) => {
      service.getCharacters().subscribe((chars) => {
        expect(Array.isArray(chars)).toBe(true);
        expect(chars[0].name).toBe('Luke Skywalker');
        done();
      });
      httpMock.expectOne(`${environment.apiUrl}/people`).flush([mockCharacter]);
    });

    it('should return the same observable reference on multiple calls', () => {
      const first = service.getCharacters();
      const second = service.getCharacters();
      expect(first).toBe(second);
      service.getCharacters().subscribe();
      httpMock.expectOne(`${environment.apiUrl}/people`).flush([mockCharacter]);
    });

    it('should emit Error("Failed to load characters") on HTTP failure', (done) => {
      service.getCharacters().subscribe({
        error: (err: Error) => {
          expect(err.message).toBe('Failed to load characters');
          done();
        },
      });
      httpMock
        .expectOne(`${environment.apiUrl}/people`)
        .flush('error', { status: 500, statusText: 'Server Error' });
    });
  });

  describe('getFilms', () => {
    it('should request the films endpoint', () => {
      service.getFilms().subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/films`);
      expect(req.request.method).toBe('GET');
      req.flush([mockFilm]);
    });

    it('should return a flat Film array', (done) => {
      service.getFilms().subscribe((films) => {
        expect(Array.isArray(films)).toBe(true);
        expect(films[0].title).toBe('A New Hope');
        done();
      });
      httpMock.expectOne(`${environment.apiUrl}/films`).flush([mockFilm]);
    });

    it('should return the same observable reference on multiple calls', () => {
      const first = service.getFilms();
      const second = service.getFilms();
      expect(first).toBe(second);
      service.getFilms().subscribe();
      httpMock.expectOne(`${environment.apiUrl}/films`).flush([mockFilm]);
    });

    it('should emit Error("Failed to load films") on HTTP failure', (done) => {
      service.getFilms().subscribe({
        error: (err: Error) => {
          expect(err.message).toBe('Failed to load films');
          done();
        },
      });
      httpMock
        .expectOne(`${environment.apiUrl}/films`)
        .flush('error', { status: 500, statusText: 'Server Error' });
    });
  });
});
