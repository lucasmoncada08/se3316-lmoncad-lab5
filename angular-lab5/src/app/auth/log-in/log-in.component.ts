import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'log-in',
  templateUrl: './log-in.component.html',
  styleUrls: ['./log-in.component.css']
})

export class LogInComponent {

  constructor(private http: HttpClient) {};

  isLoading = false;

  onLogin(form: NgForm) {
    console.log(form.value);
    if (form.invalid)
      return;

    const authData = {
      email: form.value.email,
      password: form.value.password
    }

    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(authData)
    }

    // console.log(authData);

    this.http.post('http://localhost:3000/api/users/login',
     JSON.stringify(authData), options)
      .subscribe(res => {
        console.log(res);
      })

  }

}
