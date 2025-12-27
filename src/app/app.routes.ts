import { Routes } from '@angular/router';
import { ProjectsComponent } from './pages/projects/projects.component';
import { CommunitiesComponent } from './pages/communities/communities.component';
import { ProjectDetailComponent } from './pages/project-detail/project-detail.component';
import { CameraDetailComponent } from './pages/camera-detail/camera-detail.component';

export const routes: Routes = [
  { path: '', redirectTo: '/communities', pathMatch: 'full' },
  { path: 'projects', component: ProjectsComponent },
  { path: 'project/:id', component: ProjectDetailComponent },
  { path: 'camera/:cameraId', component: CameraDetailComponent },
  { path: 'communities', component: CommunitiesComponent },
  { path: '**', redirectTo: '/communities' }
];

