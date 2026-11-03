/** Read-only local review. This is not the scientific analysis contract. */
export interface CatalogVideo {
  id: string;
  title: string;
  duration_seconds: number;
  width: number;
  height: number;
  size_bytes: number;
  edited: boolean;
  media_url: string;
  poster_url: string | null;
}
export interface LocalCatalog { version: 1; videos: CatalogVideo[] }

export interface ReviewVideo extends CatalogVideo {
  origin: "catalog" | "file";
}

/** Manual observation, measured in the edited file's playback seconds. */
export interface Moment {
  id: string;
  time_seconds: number;
  note: string;
}
