import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  ConnectResult,
  ConnectStart,
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
import { OffsiteData } from './offsite-data';

/** The live data source: relative api/... calls, resolved against <base href>. */
@Injectable()
export class ApiData extends OffsiteData {
  private readonly http = inject(HttpClient);

  private get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== '') p = p.set(k, v);
    return firstValueFrom(this.http.get<T>(`api/${path}`, { params: p }));
  }

  private post<T>(path: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`api/${path}`, body));
  }

  config = () => this.get<UiConfig>('config');
  providers = () => this.get<Provider[]>('providers');
  checkSpace = (id: RemoteProviderId) => this.post<Space>(`providers/${id}/space`);
  connectStart = (id: RemoteProviderId) => this.post<ConnectStart>(`providers/${id}/connect`);
  connectFinish = (id: RemoteProviderId, url: string) =>
    this.post<ConnectResult>(`providers/${id}/connect/finish`, { url });
  totals = () => this.get<ProviderTotals[]>('copies/totals');
  daily = (days: number) => this.get<DailyTotals[]>('copies/daily', { days });
  copies = (q: CopyQuery) => this.get<CopyPage>('copies', { ...q });
  restores = () => this.get<Restore[]>('restores');
  restore = (copyId: number) => this.post<Restore>('restores', { copyId });
  jobs = () => this.get<JobRun[]>('jobs');
}
