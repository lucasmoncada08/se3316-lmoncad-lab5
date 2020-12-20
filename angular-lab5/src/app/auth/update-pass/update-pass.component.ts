import { HttpClient } from "@angular/common/http";
import { Component } from "@angular/core";

@Component({
  selector: 'update-pass',
  templateUrl: './update-pass.component.html',
  styleUrls: ['./update-pass.component.css']
})

export class UpdatePassComponent {

  constructor(private http: HttpClient) {}

  onUpdatePass(username, newPass) {

    const data = {
      username: username,
      newPass: newPass
    };

    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    };

    this.http.post('http://localhost:3000/api/users/updatepassword', JSON.stringify(data), options)
      .subscribe(res => {
        console.log('Update user password ', newPass, ' ', username);
      });

  }

}
