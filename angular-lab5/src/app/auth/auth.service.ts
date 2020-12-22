import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private isAuthenticated = false;
  private token: string;
  private tokenTimer: any;
  private authStatusListener = new Subject<boolean>();

  constructor(private http: HttpClient, private router: Router) {}

  getToken() {
    return this.token;
  }

  getIsAuth() {
    return this.isAuthenticated;
  }

  getAuthStatusListener() {
    return this.authStatusListener.asObservable();
  }

  loginUser(authData) {
    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(authData)
    }

    // console.log(authData);

    this.http.post<{token: string, expiresIn: number}>('http://localhost:3000/api/users/login',
     JSON.stringify(authData), options)
      .subscribe(res => {
        this.token = res.token;
        if (res.token && res.token != '[object Object]') {
          if (res.token == 'Deactivated')
            alert('Account is deactivated, please contact timetableadmin@uwo.ca');
          else {
            const expiresInDuration = res.expiresIn
            this.tokenTimer = setTimeout(() => {
              this.logout();
            }, expiresInDuration*1000);
            this.isAuthenticated = true;
            this.authStatusListener.next(true);
            this.router.navigate(['/courselists']);
          }
        }
        else
          alert('Login Credentials were incorrect please try again');
      })
  }

  logout() {
    this.token = null;
    this.isAuthenticated = false;
    this.authStatusListener.next(false);
    clearTimeout(this.tokenTimer);
    this.router.navigate(['/login']);
  }

}
