import { HttpClient } from "@angular/common/http";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../environments/environment'

@Component({
  selector: 'copyright',
  templateUrl: './copyright.component.html',
  styleUrls: ['./copyright.component.css']
})

/* Component for handling all copyright displaying and creating/updating */
export class CopyrightComponent implements OnInit, OnDestroy {

  apiUrl = environment.apiUrl;

  userIsAdmin = false;
  private adminListenerSubs: Subscription;

  secAndPrivPolicy;
  DMCAPolicy;
  AUPPolicy;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit() {
    this.userIsAdmin = this.authService.getIsAdmin();
    this.adminListenerSubs = this.authService.getAdminStatusListener().subscribe(isAdmin => {
      this.userIsAdmin = isAdmin;
    });
    this.http.get<{secAndPrivPolicy: String}>(this.apiUrl + '/copyright/getcusecpolicy').subscribe(res => {
      this.secAndPrivPolicy = res.secAndPrivPolicy;
    });
    this.http.get<{DMCAPolicy: String}>(this.apiUrl + '/copyright/getcuDMCAPolicy').subscribe(res => {
      this.DMCAPolicy = res.DMCAPolicy;
    });
    this.http.get<{AUPPolicy: String}>(this.apiUrl + '/copyright/getcuAUPPolicy').subscribe(res => {
      this.AUPPolicy = res.AUPPolicy;
    });
  }

  ngOnDestroy() {
    this.adminListenerSubs.unsubscribe();
  }

  onCUSecAndPrivPolicy(text) {
    const data = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({'secAndPrivPolicy': text})
    }

    this.http.post(this.apiUrl + '/copyright/cusecpolicy', JSON.stringify({'secAndPrivPolicy': text}), data)
    .subscribe(res => {})
  }

  onCUDMCAPolicy(text) {

    const data = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({'DMCAPolicy': text})
    }

    this.http.post(this.apiUrl + '/copyright/cuDMCAPolicy', JSON.stringify({'DMCAPolicy': text}), data)
    .subscribe(res => {})
  }

  onCUAUPPolicy(text) {
    const data = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({'AUPPolicy': text})
    }

    this.http.post(this.apiUrl + '/copyright/cuAUPPolicy', JSON.stringify({'AUPPolicy': text}), data)
    .subscribe(res => {})
  }

}
