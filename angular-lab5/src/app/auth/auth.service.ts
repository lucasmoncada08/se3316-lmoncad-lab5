import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private isAuthenticated = false;
  private isAdmin = false;
  private token: string;
  private tokenTimer: any;
  private authStatusListener = new Subject<boolean>();
  private adminStatusListener = new Subject<boolean>();

  constructor(private http: HttpClient, private router: Router) {}

  getToken() {
    return this.token;
  }

  getIsAdmin() {
    return this.isAdmin;
  }

  getAdminStatusListener() {
    return this.adminStatusListener.asObservable();
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

    this.http.post<{token: string, expiresIn: number, admin: boolean}>('http://localhost:3000/api/users/login',
     JSON.stringify(authData), options)
      .subscribe(res => {
        this.token = res.token;
        if (res.token && res.token != '[object Object]') {
          if (res.token == 'Deactivated')
            alert('Account is deactivated, please contact timetableadmin@uwo.ca');
          else {
            const expiresInDuration = res.expiresIn
            this.setAuthTimer(expiresInDuration);
            this.isAuthenticated = true;
            if (res.admin) {
              this.isAdmin = true;
              this.adminStatusListener.next(true);
            }
            this.authStatusListener.next(true);
            const now = new Date();
            const expirationDate = new Date(now.getTime() + expiresInDuration * 1000);
            this.saveAuthData(res.token, expirationDate, this.isAdmin);
            this.router.navigate(['/courselists']);
          }
        }
        else
          alert('Login Credentials were incorrect please try again');
      })
  }

  autoAuthUser() {
    const authInfo = this.getAuthData();
    if (!authInfo) {
      return;
    }
    const now = new Date();
    const expiresIn = authInfo.expirationDate.getTime() - now.getTime();
    if (expiresIn > 0) {
      this.token = authInfo.token;
      this.isAuthenticated = true;
      this.setAuthTimer(expiresIn / 1000)
      this.authStatusListener.next(true);
      if (authInfo.isAdmin) {
        this.isAdmin = authInfo.isAdmin;
        this.adminStatusListener.next(true);
      }
    }
  }

  private saveAuthData(token: string, expirationDate: Date, isAdmin: boolean) {
    localStorage.setItem('token', token);
    localStorage.setItem('expiration', expirationDate.toISOString());
    var admin = isAdmin==true ? 'true' : 'false';
    localStorage.setItem('admin', admin);
  }

  private clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('expiration');
    localStorage.removeItem('admin');
  }

  private getAuthData() {
    const token = localStorage.getItem('token');
    const expirationDate = localStorage.getItem('expiration');
    const admin = localStorage.getItem('admin');
    var isAdmin = admin=='true' ? true : false;
    if (!token || !expirationDate || !admin) {
      return;
    }
    return {
      token: token,
      expirationDate: new Date(expirationDate),
      isAdmin: isAdmin
    }
  }

  private setAuthTimer(duration: number) {
    console.log('Setting timer: ' + duration);
    this.tokenTimer = setTimeout(() => {
      this.logout();
    }, duration*1000);
  }

  logout() {
    this.token = null;
    this.isAuthenticated = false;
    this.isAdmin = false;
    this.authStatusListener.next(false);
    this.adminStatusListener.next(false);
    clearTimeout(this.tokenTimer);
    this.clearAuthData();
    this.router.navigate(['/login']);
  }

}
