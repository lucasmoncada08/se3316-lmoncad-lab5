import { Component } from "@angular/core";
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})

export class AdminComponent {

  constructor(private http: HttpClient) {}

  onGrantAccess(adUsername) {

    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: adUsername})
    }

    this.http.post('http://localhost:3000/api/admin/grantaccess', JSON.stringify({username: adUsername}), options)
    .subscribe(res => {
      console.log('Updated user to admin access');
    });
  }

  onDeactivate(adDeactUsername) {

  }

}
