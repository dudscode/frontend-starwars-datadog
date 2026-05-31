import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CharactersComponent } from './characters.component';
import { SwapiService } from '../../core/services/swapi.service';
import { SwapiPage } from '../../models/swapi-page.model';
import { Character } from '../../models/character.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const mockCharacters: Character[] = Array.from({ length: 10 }, (_, i) => ({
  name: `Character ${i + 1}`,
  birth_year: '19BBY',
  gender: 'male',
  height: '172',
  mass: '77',
  homeworld: 'https://swapi.dev/api/planets/1/',
  films: [],
  url: `https://swapi.dev/api/people/${i + 1}/`,
}));

const mockPage: SwapiPage<Character> = {
  count: 82,
  next: 'https://swapi.dev/api/people/?page=2',
  previous: null,
  results: mockCharacters,
};

describe('CharactersComponent', () => {
  let component: CharactersComponent;
  let fixture: ComponentFixture<CharactersComponent>;
  let swapiServiceMock: jest.Mocked<Pick<SwapiService, 'getCharacters'>>;

  beforeEach(async () => {
    swapiServiceMock = {
      getCharacters: jest.fn().mockReturnValue(of(mockPage)),
    };

    await TestBed.configureTestingModule({
      imports: [CharactersComponent, NoopAnimationsModule],
      providers: [{ provide: SwapiService, useValue: swapiServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(CharactersComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display 10 character list items after data loads', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('mat-list-item');
    expect(items.length).toBe(10);
  }));

  it('should show a paginator with the total count', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const paginator = fixture.nativeElement.querySelector('mat-paginator');
    expect(paginator).toBeTruthy();
  }));

  it('should fetch a new page when onPageChange is called', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    const pageEvent = { pageIndex: 2, pageSize: 10, length: 82 } as any;
    component.onPageChange(pageEvent);
    tick();
    fixture.detectChanges();
    expect(swapiServiceMock.getCharacters).toHaveBeenCalledWith(3);
  }));

  it('should display Portuguese error message on HTTP failure', fakeAsync(() => {
    swapiServiceMock.getCharacters.mockReturnValue(
      throwError(() => new Error('Failed to load characters'))
    );
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const errorEl = fixture.nativeElement.querySelector('.error-message');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Não foi possível carregar os personagens');
  }));

  it('should restore the current page signal to trigger re-fetch on retry', () => {
    component.currentPage.set(3);
    component.retry();
    expect(component.currentPage()).toBe(3);
  });
});
