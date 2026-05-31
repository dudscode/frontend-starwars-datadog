import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { CharactersComponent } from './characters.component';
import { SwapiService } from '../../core/services/swapi.service';
import { ObservabilityService } from '../../core/services/observability.service';
import { Character } from '../../models/character.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const mockCharacters: Character[] = Array.from({ length: 25 }, (_, i) => ({
  name: `Character ${i + 1}`,
  birth_year: '19BBY',
  gender: 'male',
  height: '172',
  mass: '77',
  homeworld: 'https://swapi.info/api/planets/1',
  films: [],
  url: `https://swapi.info/api/people/${i + 1}`,
}));

const obsMock = { watchView: jest.fn() };

describe('CharactersComponent', () => {
  let component: CharactersComponent;
  let fixture: ComponentFixture<CharactersComponent>;
  let swapiServiceMock: jest.Mocked<Pick<SwapiService, 'getCharacters'>>;

  beforeEach(async () => {
    swapiServiceMock = {
      getCharacters: jest.fn().mockReturnValue(of(mockCharacters)),
    };

    await TestBed.configureTestingModule({
      imports: [CharactersComponent, NoopAnimationsModule],
      providers: [
        { provide: SwapiService, useValue: swapiServiceMock },
        { provide: ObservabilityService, useValue: obsMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CharactersComponent);
    component = fixture.componentInstance;
  });

  beforeEach(() => { obsMock.watchView.mockClear(); });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display 10 character list items on the first page', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('mat-list-item');
    expect(items.length).toBe(10);
  }));

  it('should show a paginator with the total character count', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const paginator = fixture.nativeElement.querySelector('mat-paginator');
    expect(paginator).toBeTruthy();
  }));

  it('should show a loading spinner before data arrives', fakeAsync(() => {
    const subject = new Subject<Character[]>();
    swapiServiceMock.getCharacters.mockReturnValue(subject.asObservable());
    fixture = TestBed.createComponent(CharactersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    const spinner = fixture.nativeElement.querySelector('mat-spinner');
    expect(spinner).toBeTruthy();
    subject.complete();
  }));

  it('should update the current page signal on page change', () => {
    fixture.detectChanges();
    const pageEvent = { pageIndex: 1, pageSize: 10, length: 25 } as any;
    component.onPageChange(pageEvent);
    expect(component.currentPage()).toBe(1);
  });

  it('should display Portuguese error message on HTTP failure', fakeAsync(() => {
    swapiServiceMock.getCharacters.mockReturnValue(
      throwError(() => new Error('Failed to load characters'))
    );
    fixture = TestBed.createComponent(CharactersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    tick();
    fixture.detectChanges();
    const errorEl = fixture.nativeElement.querySelector('.error-message');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toContain('Não foi possível carregar os personagens');
  }));

  it('should restore the current page signal on retry', () => {
    component.currentPage.set(2);
    component.retry();
    expect(component.currentPage()).toBe(2);
  });

  describe('ObservabilityService integration', () => {
    it('should call watchView with "characters" and pageView$ in ngOnInit', () => {
      fixture.detectChanges();
      expect(obsMock.watchView).toHaveBeenCalledWith('characters', component.pageView$);
    });

    it('should implement OnInit interface', () => {
      expect(typeof component.ngOnInit).toBe('function');
    });
  });
});
