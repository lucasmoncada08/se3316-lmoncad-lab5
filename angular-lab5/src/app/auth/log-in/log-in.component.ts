import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { AuthService } from '../auth.service';

@Component({
  selector: 'log-in',
  templateUrl: './log-in.component.html',
  styleUrls: ['./log-in.component.css']
})

export class LogInComponent {

  // constructor(private http: HttpClient) {};

  constructor(public authService: AuthService) {}

  public token = "";

  isLoading = false;

  onLogin(form: NgForm) {
    console.log(form.value);
    if (form.invalid)
      return;

    const authData = {
      email: form.value.email,
      password: form.value.password
    }

    this.authService.loginUser(authData);

  }

}
