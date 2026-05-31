export interface Film {
  episode_id: number;
  title: string;
  director: string;
  producer: string;
  release_date: string;
  opening_crawl: string;
  characters: string[];
  url: string;
}

export interface FilmDisplayItem {
  episode_id: number;
  title: string;
  director: string;
  release_date: string;
}

export function toFilmDisplayItem(f: Film): FilmDisplayItem {
  return {
    episode_id: f.episode_id,
    title: f.title,
    director: f.director,
    release_date: f.release_date,
  };
}
