import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { FilmsComponent } from './films.component';
import { SwapiService } from '../../core/services/swapi.service';
import { SwapiPage } from '../../models/swapi-page.model';
import { Film } from '../../models/film.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const mockFilms: Film[] = [
  { episode_id: 4, title: 'A New Hope', director: 'George Lucas', producer: 'Gary Kurtz', release_date: '1977-05-25', opening_crawl: '...', characters: [], url: 'https://swapi.dev/api/films/1/' },
  { episode_id: 5, title: 'The Empire Strikes Back', director: 'Irvin Kershner', producer: 'Gary Kurtz', release_date: '1980-05-17', opening_crawl: '...', characters: [], url: 'https://swapi.dev/api/films/2/' },
  { episode_id: 6, title: 'Return of the Jedi', director: 'Richard Marquand', producer: 'Howard Kazanjian', release_date: '1983-05-25', opening_crawl: '...', characters: [], url: 'https://swapi.dev/api/films/3/' },
];

const mockPage: SwapiPage<Film> = {
  count: 3,
  next: null,
  previous: null,
  results: mockFilms,
};

describe('FilmsComponent', () => {
  let component: FilmsComponent;
  let fixture: ComponentFixture<FilmsComponent>;
  let swapiServiceMock: jest.Mocked<Pick<SwapiService, 'getFilms'>>;

  beforeEach(async () => {
    swapiServiceMock = {
      getFilms: jest.fn().mockReturnValue(of(mockPage)),
    };

    await TestBed.configureTestingModule({
      imports: [FilmsComponent, NoopAnimationsModule],
      providers: [{ provide: SwapiService, useValue: swapiServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(FilmsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display film cards after data loads', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('mat-card');
    expect(cards.length).toBe(3);
  }));

  it('should show a loading spinner before data arrives', fakeAsync(() => {
    const subject = new Subject<SwapiPage<Film>>();
    swapiServiceMock.getFilms.mockReturnValue(subject.asObservable());
    // Re-create component so it binds to the new Subject mock
    fixture = TestBed.createComponent(FilmsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const spinner = fixture.nativeElement.querySelector('mat-spinner');
    expect(spinner).toBeTruthy();
    subject.complete();
  }));

  it('should display Portuguese error message on HTTP failure', fakeAsync(() => {
    swapiServiceMock.getFilms.mockReturnValue(
      throwError(() => new Error('Failed to load films'))
    );
    // Re-create component with error mock
    fixture = TestBed.createComponent(FilmsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const errorEl = fixture.nativeElement.querySelector('.error-message');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Não foi possível carregar os filmes');
  }));

  it('should emit null from films$ when getFilms errors', (done) => {
    swapiServiceMock.getFilms.mockReturnValue(
      throwError(() => new Error('Failed to load films'))
    );
    fixture = TestBed.createComponent(FilmsComponent);
    component = fixture.componentInstance;
    component.films$.subscribe((result) => {
      expect(result).toBeNull();
      done();
    });
  });

  it('should call window.location.reload on retry', () => {
    const reloadMock = jest.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    });
    component.retry();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
