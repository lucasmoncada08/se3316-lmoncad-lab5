import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'sign-up',
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})

export class SignUpComponent {

  constructor(private http: HttpClient) {};

  isLoading = false;

  onSignUp(form: NgForm) {

    if (form.invalid)
      return;

    const authData = {
      email: form.value.email,
      username: form.value.username,
      password: form.value.password,
      admin: false,
      deactivated: false
    }

    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(authData)
    }

    console.log(authData);

    this.http.post('http://localhost:3000/api/users/signup',
     JSON.stringify(authData), options)
      .subscribe(res => {
        console.log(res);
      })

  }

}
