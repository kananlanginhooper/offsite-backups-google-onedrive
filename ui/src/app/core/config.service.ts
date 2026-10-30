import { Injectable, inject, signal } from '@angular/core';
import { OffsiteData } from './data/offsite-data';
import type { UiConfig } from './models';

let loaded: UiConfig | null = null;

/** The origins allowed to frame this app (FRAME_ANCESTORS), for code that runs outside injection. */
export function frameParents(): readonly string[] {
  return loaded?.frameParents ?? [];
}

/** Runtime config from api/config, loaded once before the app starts. */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly data = inject(OffsiteData);
  readonly config = signal<UiConfig | null>(null);

  async load(): Promise<void> {
    loaded = await this.data.config();
    this.config.set(loaded);
  }
}
