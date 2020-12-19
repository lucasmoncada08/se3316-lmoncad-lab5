import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CourseListsComponent } from './course-lists/course-lists.component';
import { LogInComponent } from './auth/log-in/log-in.component'
import { CourseSearchComponent } from './course-search/course-search.component';
import { KeywordSearchComponent } from './keyword-search/keyword-search.component';
import { SignUpComponent } from './auth/sign-up/sign-up.component';
import { TimetableComponent } from './timetable/timetable.component';
import { CourseReviewComponent } from './course-review/course-review.component';
import { AdminComponent } from './admin/admin.component';

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
    path: 'timetable',
    component: TimetableComponent
  },
  {
    path: 'courselists',
    component: TimetableComponent,
    outlet: 'outlet-2'
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
  }
]

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})

export class AppRoutingModule {}
