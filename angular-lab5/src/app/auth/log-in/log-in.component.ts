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

    // const options = {
    //   headers: {'Content-Type': 'application/json'},
    //   body: JSON.stringify(authData)
    // }

    // // console.log(authData);

    // this.http.post<{token: string}>('http://localhost:3000/api/users/login',
    //  JSON.stringify(authData), options)
    //   .subscribe(res => {
    //     console.log(res);
    //     const token = res.token;
    //     this.token = token;
    //   })
  }

}
