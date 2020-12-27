import { HttpClient } from "@angular/common/http";
import { Component } from "@angular/core";
import { environment } from '../../../environments/environment'

@Component({
  selector: 'update-pass',
  templateUrl: './update-pass.component.html',
  styleUrls: ['./update-pass.component.css']
})

/* Component for allowing users to update their password */
export class UpdatePassComponent {

  constructor(private http: HttpClient) {}

  apiUrl = environment.apiUrl;

  onUpdatePass(newPass) {

    const data = {
      newPass: newPass
    };

    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    };

    this.http.post(this.apiUrl + '/users/updatepassword', JSON.stringify(data), options)
      .subscribe(res => {
        console.log('Update user password');
      });

  }

}
