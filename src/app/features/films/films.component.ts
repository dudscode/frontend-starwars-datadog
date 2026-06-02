import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import {
  Observable,
  catchError,
  filter,
  map,
  of,
  shareReplay,
  startWith,
  take,
  tap,
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
export class FilmsComponent implements OnInit, OnDestroy {
  private obs = inject(ObservabilityService);
  private swapiService = inject(SwapiService);
  private destroyRef = inject(DestroyRef);

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

  constructor() {
    // Inicia o timer quando o componente é instanciado pelo Angular.
    // Para medir desde o clique de navegação, chame startTimer('films')
    // no guard ou resolver desta rota antes da criação do componente.
    this.obs.startTimer('films');
  }

  ngOnInit(): void {
    // Encerra a medição quando os dados chegam (caminho normal).
    // takeUntilDestroyed cancela a subscription se o componente for destruído
    // antes dos dados chegarem — evita subscription órfã.
    this.films$
      .pipe(
        filter((v): v is FilmDisplayItem[] => v !== null),
        take(1),
        tap(() => this.obs.logViewReady('films')),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    // Garante que o timer seja encerrado mesmo que os dados nunca tenham chegado
    // (usuário saiu antes, erro de rede, timeout). Se logViewReady já foi chamado
    // pelo tap() acima, esta chamada retorna silenciosamente.
    this.obs.logViewReady('films');
  }

  retry(): void {
    window.location.reload();
  }
}
