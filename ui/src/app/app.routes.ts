import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    title: 'Overview · Offsite backups',
    loadComponent: () => import('./features/overview/overview.page').then((m) => m.OverviewPage),
  },
  {
    path: 'copies',
    title: 'Copies · Offsite backups',
    loadComponent: () => import('./features/copies/copies.page').then((m) => m.CopiesPage),
  },
  {
    path: 'restores',
    title: 'Restores · Offsite backups',
    loadComponent: () => import('./features/restores/restores.page').then((m) => m.RestoresPage),
  },
  {
    path: 'jobs',
    title: 'Jobs · Offsite backups',
    loadComponent: () => import('./features/jobs/jobs.page').then((m) => m.JobsPage),
  },
  { path: '**', redirectTo: 'overview' },
];
