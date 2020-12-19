import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private token: string;
  private authStatusListener = new Subject<boolean>();

  constructor(private http: HttpClient) {}

  getToken() {
    return this.token;
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

    this.http.post<{token: string}>('http://localhost:3000/api/users/login',
     JSON.stringify(authData), options)
      .subscribe(res => {
        this.token = res.token;
        console.log('this.token: ', this.token);
        this.authStatusListener.next(true);
      })
  }

}
