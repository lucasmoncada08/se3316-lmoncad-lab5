import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';


@Component({
  selector: 'sign-up',
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})

/* Component that allows users to sign up with the app */
export class SignUpComponent {

  constructor(private http: HttpClient) {};

  apiUrl = environment.apiUrl;

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

    this.http.post(this.apiUrl + '/users/signup', JSON.stringify(authData), options)
      .subscribe(res => {
        if (res)
          alert('Email or Username is already taken');
      })

  }

}
