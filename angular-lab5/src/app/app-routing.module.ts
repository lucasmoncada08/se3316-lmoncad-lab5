import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Routes } from '@angular/router';
import { CourseListsComponent } from './course-lists/course-lists.component';
import { LoginComponent } from './login/login.component';
import { LogInComponent } from './auth/log-in/log-in.component'

const routes: Routes = [
  {
    path: '',
    component: LogInComponent
  }
]

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule {}
