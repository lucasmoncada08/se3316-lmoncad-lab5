import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private isAuthenticated = false;
  private token: string;
  private authStatusListener = new Subject<boolean>();

  constructor(private http: HttpClient) {}

  getToken() {
    return this.token;
  }

  getIsAuth() {
    return this.isAuthenticated;
  }

  getAuthStatusListener() {
    return this.authStatusListener.asObservable();
  }

  async loginUser(authData) {
    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(authData)
    }

    // console.log(authData);

    this.http.post<{token: string}>('http://localhost:3000/api/users/login',
     JSON.stringify(authData), options)
      .subscribe(res => {
        this.token = res.token;
        if (res.token) {
          if (res.token == 'Deactivated')
            alert('Account is deactivated, please contact timetableadmin@uwo.ca');
          else {
            this.isAuthenticated = true;
            this.authStatusListener.next(true);
          }
        }
      })
  }

}
