import { Character, CharacterDisplayItem, toCharacterDisplayItem } from './character.model';

describe('Character model', () => {
  const mockCharacter: Character = {
    name: 'Luke Skywalker',
    birth_year: '19BBY',
    gender: 'male',
    height: '172',
    mass: '77',
    homeworld: 'https://swapi.dev/api/planets/1/',
    films: ['https://swapi.dev/api/films/1/'],
    url: 'https://swapi.dev/api/people/1/',
  };

  describe('toCharacterDisplayItem', () => {
    it('should map all display fields correctly', () => {
      const result: CharacterDisplayItem = toCharacterDisplayItem(mockCharacter);
      expect(result.name).toBe('Luke Skywalker');
      expect(result.birth_year).toBe('19BBY');
      expect(result.gender).toBe('male');
      expect(result.height).toBe('172');
      expect(result.mass).toBe('77');
    });

    it('should not include non-display fields', () => {
      const result = toCharacterDisplayItem(mockCharacter) as unknown as Record<string, unknown>;
      expect(result['homeworld']).toBeUndefined();
      expect(result['films']).toBeUndefined();
      expect(result['url']).toBeUndefined();
    });

    it('should be a pure function — not mutate the input', () => {
      const original = { ...mockCharacter };
      toCharacterDisplayItem(mockCharacter);
      expect(mockCharacter).toEqual(original);
    });

    it('should handle unknown values without error', () => {
      const unknownChar: Character = {
        ...mockCharacter,
        birth_year: 'unknown',
        gender: 'n/a',
        height: 'unknown',
        mass: 'unknown',
      };
      const result = toCharacterDisplayItem(unknownChar);
      expect(result.birth_year).toBe('unknown');
      expect(result.gender).toBe('n/a');
    });
  });
});
