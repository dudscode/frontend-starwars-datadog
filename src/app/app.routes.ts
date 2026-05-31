import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'characters',
    loadComponent: () =>
      import('./features/characters/characters.component').then(
        (m) => m.CharactersComponent
      ),
  },
  {
    path: 'films',
    loadComponent: () =>
      import('./features/films/films.component').then((m) => m.FilmsComponent),
  },
  { path: '', redirectTo: 'characters', pathMatch: 'full' },
  { path: '**', redirectTo: 'characters' },
];
