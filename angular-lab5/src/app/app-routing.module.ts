import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/core';
import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';

const routes: Routes = [
  {
    path: '',
    component: LoginComponent
  }
]

@NgModule({
  imports: [RouterModule.forRoot(routes)]
})
export class AppRoutingModule {}
