import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CourseListsComponent } from './course-lists/course-lists.component';
import { LogInComponent } from './auth/log-in/log-in.component'
import { CourseSearchComponent } from './course-search/course-search.component';
import { KeywordSearchComponent } from './keyword-search/keyword-search.component';
import { SignUpComponent } from './auth/sign-up/sign-up.component';
import { CourseReviewComponent } from './course-review/course-review.component';
import { AdminComponent } from './admin/admin.component';
import { UpdatePassComponent } from './auth/update-pass/update-pass.component';
import { CopyrightComponent } from './copyright/copyright.component';


/* Routing module to allowing users to be directed to other components */
const routes: Routes = [
  {
    path: '',
    component: LogInComponent
  },
  {
    path: 'coursesearch',
    component: CourseSearchComponent
  },
  {
    path: 'keywordsearch',
    component: KeywordSearchComponent
  },
  {
    path: 'courselists',
    component: CourseListsComponent
  },
  {
    path: 'coursereviews',
    component: CourseReviewComponent
  },
  {
    path: 'signup',
    component: SignUpComponent
  },
  {
    path: 'login',
    component: LogInComponent
  },
  {
    path: 'admin',
    component: AdminComponent
  },
  {
    path: 'account',
    component: UpdatePassComponent
  },
  {
    path: 'copyright',
    component: CopyrightComponent
  }
]

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule {}
