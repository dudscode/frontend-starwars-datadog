import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import {
  Observable,
  catchError,
  combineLatest,
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
import { CharacterDisplayItem, toCharacterDisplayItem } from '../../models/character.model';

export interface CharactersPageView {
  items: CharacterDisplayItem[];
  total: number;
}

const PAGE_SIZE = 10;

@Component({
  selector: 'app-characters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    NgIf,
    NgFor,
    MatListModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatButtonModule,
  ],
  templateUrl: './characters.component.html',
  styleUrl: './characters.component.scss',
})
export class CharactersComponent implements OnInit, OnDestroy {
  private obs = inject(ObservabilityService);
  private swapiService = inject(SwapiService);
  private destroyRef = inject(DestroyRef);

  readonly pageSize = PAGE_SIZE;
  currentPage = signal(0);

  private allCharacters$: Observable<CharacterDisplayItem[]> = this.swapiService
    .getCharacters()
    .pipe(
      map((chars) => chars.map(toCharacterDisplayItem)),
      shareReplay(1)
    );

  pageView$: Observable<CharactersPageView | null> = combineLatest([
    this.allCharacters$,
    toObservable(this.currentPage),
  ]).pipe(
    map(([all, page]) => ({
      items: all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
      total: all.length,
    })),
    startWith<CharactersPageView | null>(null)
  );

  isLoading$: Observable<boolean> = this.allCharacters$.pipe(
    map((): boolean => false),
    catchError((): Observable<boolean> => of(false)),
    startWith(true)
  );

  error$: Observable<string | null> = this.swapiService.getCharacters().pipe(
    map((): string | null => null),
    catchError((err: Error) => of<string | null>(err.message)),
    startWith<string | null>(null)
  );

  constructor() {
    // Inicia o timer no momento em que o componente é criado pelo Angular.
    // Para uma medição ainda mais precisa (desde o clique de navegação),
    // chame obs.startTimer('characters') no guard ou resolver desta rota.
    this.obs.startTimer('characters');
  }

  ngOnInit(): void {
    // Encerra a medição quando os dados chegam (caminho normal).
    // takeUntilDestroyed cancela a subscription se o componente for destruído
    // antes dos dados chegarem — evita subscription órfã.
    this.pageView$
      .pipe(
        filter((v): v is CharactersPageView => v !== null),
        take(1),
        tap(() => this.obs.logViewReady('characters')),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    // Garante que o timer seja encerrado mesmo que os dados nunca tenham chegado
    // (usuário saiu antes, erro de rede, timeout). Se logViewReady já foi chamado
    // pelo tap() acima, esta chamada retorna silenciosamente.
    this.obs.logViewReady('characters');
  }

  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex);
  }

  retry(): void {
    const current = this.currentPage();
    this.currentPage.set(-1);
    this.currentPage.set(current);
  }
}
