import { Component } from '@angular/core';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'log-in',
  templateUrl: './log-in.component.html',
  styleUrls: ['./log-in.component.css']
})

export class LogInComponent {

  isLoading = false;

  onLogin(form: NgForm) {
    console.log(form.value);
  }

}
