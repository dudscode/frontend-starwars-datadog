import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import {
  Observable,
  Subject,
  catchError,
  map,
  merge,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import { SwapiService } from '../../core/services/swapi.service';
import { FilmDisplayItem, toFilmDisplayItem } from '../../models/film.model';

@Component({
  selector: 'app-films',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    NgIf,
    NgFor,
    MatCardModule,
    MatProgressSpinnerModule,
    MatButtonModule,
  ],
  templateUrl: './films.component.html',
  styleUrl: './films.component.scss',
})
export class FilmsComponent {
  private swapiService = inject(SwapiService);

  films$: Observable<FilmDisplayItem[] | null> = this.swapiService.getFilms().pipe(
    map((page) => page.results.map(toFilmDisplayItem)),
    catchError(() => of<FilmDisplayItem[] | null>(null)),
    shareReplay(1)
  );

  isLoading$: Observable<boolean> = this.swapiService.getFilms().pipe(
    map((): boolean => false),
    catchError((): Observable<boolean> => of(false)),
    startWith(true)
  );

  error$: Observable<string | null> = this.swapiService.getFilms().pipe(
    map((): string | null => null),
    catchError((err: Error) => of<string | null>(err.message)),
    startWith<string | null>(null)
  );

  retry(): void {
    window.location.reload();
  }
}
