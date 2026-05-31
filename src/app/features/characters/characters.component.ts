import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { toObservable } from '@angular/core/rxjs-interop';
import { signal } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { MatListModule } from '@angular/material/list';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import {
  Observable,
  catchError,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import { SwapiService } from '../../core/services/swapi.service';
import { SwapiPage } from '../../models/swapi-page.model';
import { Character, CharacterDisplayItem, toCharacterDisplayItem } from '../../models/character.model';

interface PageState {
  data: SwapiPage<CharacterDisplayItem> | null;
  loading: boolean;
  error: string | null;
}

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
export class CharactersComponent {
  private swapiService = inject(SwapiService);

  currentPage = signal(1);

  pageData$: Observable<SwapiPage<CharacterDisplayItem>> = toObservable(
    this.currentPage
  ).pipe(
    switchMap((page) =>
      this.swapiService.getCharacters(page).pipe(
        map((p) => ({
          ...p,
          results: p.results.map(toCharacterDisplayItem),
        }))
      )
    ),
    shareReplay(1)
  );

  isLoading$: Observable<boolean> = this.pageData$.pipe(
    map((): boolean => false),
    catchError((): Observable<boolean> => of(false)),
    startWith(true)
  );

  error$: Observable<string | null> = toObservable(this.currentPage).pipe(
    switchMap((page) =>
      this.swapiService.getCharacters(page).pipe(
        map((): string | null => null),
        catchError((err: Error) => of<string | null>(err.message))
      )
    ),
    startWith<string | null>(null)
  );

  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
  }

  retry(): void {
    const current = this.currentPage();
    this.currentPage.set(0);
    this.currentPage.set(current);
  }
}
