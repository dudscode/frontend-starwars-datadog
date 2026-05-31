import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Character } from '../../models/character.model';
import { Film } from '../../models/film.model';

@Injectable({ providedIn: 'root' })
export class SwapiService {
  private readonly apiUrl = environment.apiUrl;
  private charactersCache$: Observable<Character[]> | null = null;
  private filmsCache$: Observable<Film[]> | null = null;

  constructor(private http: HttpClient) {}

  getCharacters(): Observable<Character[]> {
    if (!this.charactersCache$) {
      this.charactersCache$ = this.http
        .get<Character[]>(`${this.apiUrl}/people`)
        .pipe(
          shareReplay(1),
          catchError(() => throwError(() => new Error('Failed to load characters')))
        );
    }
    return this.charactersCache$;
  }

  getFilms(): Observable<Film[]> {
    if (!this.filmsCache$) {
      this.filmsCache$ = this.http
        .get<Film[]>(`${this.apiUrl}/films`)
        .pipe(
          shareReplay(1),
          catchError(() => throwError(() => new Error('Failed to load films')))
        );
    }
    return this.filmsCache$;
  }
}
