import { Component } from "@angular/core";
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment'

@Component({
  selector: 'admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})

/* Component with the admin functionalities */
export class AdminComponent {

  constructor(private http: HttpClient) {}

  apiUrl = environment.apiUrl;

  onGrantAccess(adUsername) {

    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: adUsername})
    }

    this.http.post(this.apiUrl + '/admin/grantaccess', JSON.stringify({username: adUsername}), options)
    .subscribe(res => {
      console.log('Updated user to admin access');
    });
  }

  onDeactivate(adDeactUsername) {
    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: adDeactUsername})
    }

    this.http.post(this.apiUrl + '/admin/deactivate', JSON.stringify({username: adDeactUsername}), options)
    .subscribe(res => {
      console.log('Deactivated user');
    });
  }

  onReactivate(adReactUsername) {
    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({username: adReactUsername})
    }

    this.http.post(this.apiUrl + '/admin/reactivate', JSON.stringify({username: adReactUsername}), options)
    .subscribe(res => {
      console.log('Reactivated user');
    });
  }

  onHideReview(username, subjCode, courseCode) {

    const data = {
      username: username,
      subjCode: subjCode,
      courseCode: courseCode
    }

    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    }

    this.http.post(this.apiUrl + '/admin/hidereview', JSON.stringify(data), options)
    .subscribe(res => {
      console.log('Hide review');
    });
  }

  onShowReview(username, subjCode, courseCode) {

    const data = {
      username: username,
      subjCode: subjCode,
      courseCode: courseCode
    }

    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    }

    this.http.post(this.apiUrl + '/admin/showreview', JSON.stringify(data), options)
    .subscribe(res => {
      console.log('Shown review');
    });

  }

}
