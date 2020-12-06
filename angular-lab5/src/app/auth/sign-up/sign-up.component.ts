import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'sign-up',
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.css']
})

export class SignUpComponent {

  isLoading = false;

  onSignUp(form: NgForm) {
    console.log(form.value);
  }

}
