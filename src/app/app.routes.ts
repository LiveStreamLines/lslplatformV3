import { Routes } from '@angular/router';
import { ProjectsComponent } from './pages/projects/projects.component';
import { CommunitiesComponent } from './pages/communities/communities.component';

export const routes: Routes = [
  { path: '', redirectTo: '/communities', pathMatch: 'full' },
  { path: 'projects', component: ProjectsComponent },
  { path: 'communities', component: CommunitiesComponent },
  { path: '**', redirectTo: '/communities' }
];

