import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    title: 'node-collab · observatory',
  },
  {
    path: 'r/:room',
    loadComponent: () => import('./features/room/room').then((m) => m.Room),
  },
  {
    path: 'about',
    loadComponent: () => import('./features/about/about').then((m) => m.About),
    title: 'node-collab · architecture',
  },
  { path: '**', redirectTo: '' },
];
