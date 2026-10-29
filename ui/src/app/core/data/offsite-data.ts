import type {
  CopyPage,
  CopyQuery,
  DailyTotals,
  JobRun,
  Provider,
  ProviderTotals,
  RemoteProviderId,
  Restore,
  Space,
  UiConfig,
} from '../models';

/**
 * Everything the screens read and do. The live build talks to the API (ApiData); the Pages demo
 * swaps in DemoData (mock data in the browser), so components never know which one they have.
 */
export abstract class OffsiteData {
  abstract config(): Promise<UiConfig>;
  abstract providers(): Promise<Provider[]>;
  abstract checkSpace(id: RemoteProviderId): Promise<Space>;
  abstract totals(): Promise<ProviderTotals[]>;
  abstract daily(days: number): Promise<DailyTotals[]>;
  abstract copies(query: CopyQuery): Promise<CopyPage>;
  abstract restores(): Promise<Restore[]>;
  abstract restore(copyId: number): Promise<Restore>;
  abstract jobs(): Promise<JobRun[]>;
}
