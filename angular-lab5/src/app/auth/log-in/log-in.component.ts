import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { AuthService } from '../auth.service';

@Component({
  selector: 'log-in',
  templateUrl: './log-in.component.html',
  styleUrls: ['./log-in.component.css']
})

/* Component that works with auth.service to provide the login functionalities */
export class LogInComponent {

  constructor(public authService: AuthService) {}

  public token = "";

  isLoading = false;

  onLogin(form: NgForm) {
    if (form.invalid)
      return;

    const authData = {
      email: form.value.email,
      password: form.value.password
    }

    this.authService.loginUser(authData);

  }

}
