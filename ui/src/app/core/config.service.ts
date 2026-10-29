import { Injectable, inject, signal } from '@angular/core';
import { OffsiteData } from './data/offsite-data';
import type { UiConfig } from './models';

/** Runtime config from api/config, loaded once before the app starts. */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly data = inject(OffsiteData);
  readonly config = signal<UiConfig | null>(null);

  async load(): Promise<void> {
    this.config.set(await this.data.config());
  }
}
