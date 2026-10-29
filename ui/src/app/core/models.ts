// API shapes, generated from the back end's OpenAPI (npm run api-types). Never hand-edit these.
import type { components } from './api/schema';

type S = components['schemas'];

export type UiConfig = S['UiConfigDto'];
export type Provider = S['ProviderDto'];
export type Space = S['SpaceDto'];
export type Copy = S['CopyDto'];
export type CopyPage = S['CopyPageDto'];
export type ProviderTotals = S['ProviderTotalsDto'];
export type DailyTotals = S['DailyTotalsDto'];
export type Restore = S['RestoreDto'];
export type JobRun = S['JobRunDto'];

export type ProviderId = Copy['provider'];
export type RemoteProviderId = Provider['id'];

export interface CopyQuery {
  provider?: ProviderId;
  q?: string;
  skip: number;
  take: number;
}
