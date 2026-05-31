import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import {
  Observable,
  catchError,
  map,
  of,
  shareReplay,
  startWith,
} from 'rxjs';
import { SwapiService } from '../../core/services/swapi.service';
import { ObservabilityService } from '../../core/services/observability.service';
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
export class FilmsComponent implements OnInit {
  private readonly viewStart = performance.now();
  private obs = inject(ObservabilityService);
  private swapiService = inject(SwapiService);

  films$: Observable<FilmDisplayItem[] | null> = this.swapiService.getFilms().pipe(
    map((films) => films.map(toFilmDisplayItem)),
    catchError((): Observable<FilmDisplayItem[] | null> => of(null)),
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

  ngOnInit(): void {
    this.obs.watchView('films', this.films$);
  }

  retry(): void {
    window.location.reload();
  }
}
