import { Routes } from '@angular/router';
import { ProjectsComponent } from './pages/projects/projects.component';
import { CommunitiesComponent } from './pages/communities/communities.component';
import { ProjectDetailComponent } from './pages/project-detail/project-detail.component';
import { CameraDetailComponent } from './pages/camera-detail/camera-detail.component';
import { LoginComponent } from './pages/login/login.component';
import { TestComponent } from './pages/test/test.component';
import { CameraPicsS3TestComponent } from './pages/camera-pics-s3-test/camera-pics-s3-test.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { 
    path: '', 
    redirectTo: '/communities', 
    pathMatch: 'full'
  },
  { path: 'projects', component: ProjectsComponent, canActivate: [authGuard] },
  { path: 'project/:id', component: ProjectDetailComponent, canActivate: [authGuard] },
  { path: 'camera/:cameraId', component: CameraDetailComponent, canActivate: [authGuard] },
  { path: 'communities', component: CommunitiesComponent, canActivate: [authGuard] },
  { path: 'test', component: TestComponent, canActivate: [authGuard] },
  { path: 'camera-pics-s3-test', component: CameraPicsS3TestComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/communities' }
];

