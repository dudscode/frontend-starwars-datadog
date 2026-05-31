import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SwapiPage } from '../../models/swapi-page.model';
import { Character } from '../../models/character.model';
import { Film } from '../../models/film.model';

@Injectable({ providedIn: 'root' })
export class SwapiService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCharacters(page: number = 1): Observable<SwapiPage<Character>> {
    return this.http
      .get<SwapiPage<Character>>(`${this.apiUrl}/people/?page=${page}`)
      .pipe(
        catchError(() => throwError(() => new Error('Failed to load characters')))
      );
  }

  getFilms(): Observable<SwapiPage<Film>> {
    if (!this.filmsCache$) {
      this.filmsCache$ = this.http
        .get<SwapiPage<Film>>(`${this.apiUrl}/films/`)
        .pipe(
          catchError(() => throwError(() => new Error('Failed to load films')))
        );
    }
    return this.filmsCache$;
  }

  private filmsCache$: Observable<SwapiPage<Film>> | null = null;
}
