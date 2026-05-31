export interface Character {
  name: string;
  birth_year: string;
  gender: string;
  height: string;
  mass: string;
  homeworld: string;
  films: string[];
  url: string;
}

export interface CharacterDisplayItem {
  name: string;
  birth_year: string;
  gender: string;
  height: string;
  mass: string;
}

export function toCharacterDisplayItem(c: Character): CharacterDisplayItem {
  return {
    name: c.name,
    birth_year: c.birth_year,
    gender: c.gender,
    height: c.height,
    mass: c.mass,
  };
}
