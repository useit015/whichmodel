import type { ModelEntry } from "../types.js";

export interface CatalogSource {
  readonly sourceId: string;
  fetch(): Promise<ModelEntry[]>;
}
