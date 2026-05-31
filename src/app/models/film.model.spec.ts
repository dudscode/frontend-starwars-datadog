import { Film, FilmDisplayItem, toFilmDisplayItem } from './film.model';

describe('Film model', () => {
  const mockFilm: Film = {
    episode_id: 4,
    title: 'A New Hope',
    director: 'George Lucas',
    producer: 'Gary Kurtz, Rick McCallum',
    release_date: '1977-05-25',
    opening_crawl: 'It is a period of civil war...',
    characters: ['https://swapi.dev/api/people/1/'],
    url: 'https://swapi.dev/api/films/1/',
  };

  describe('toFilmDisplayItem', () => {
    it('should map all display fields correctly', () => {
      const result: FilmDisplayItem = toFilmDisplayItem(mockFilm);
      expect(result.episode_id).toBe(4);
      expect(result.title).toBe('A New Hope');
      expect(result.director).toBe('George Lucas');
      expect(result.release_date).toBe('1977-05-25');
    });

    it('should not include non-display fields', () => {
      const result = toFilmDisplayItem(mockFilm) as unknown as Record<string, unknown>;
      expect(result['producer']).toBeUndefined();
      expect(result['opening_crawl']).toBeUndefined();
      expect(result['characters']).toBeUndefined();
      expect(result['url']).toBeUndefined();
    });

    it('should be a pure function — not mutate the input', () => {
      const original = { ...mockFilm };
      toFilmDisplayItem(mockFilm);
      expect(mockFilm).toEqual(original);
    });

    it('should preserve numeric episode_id type', () => {
      const result = toFilmDisplayItem(mockFilm);
      expect(typeof result.episode_id).toBe('number');
    });
  });
});
