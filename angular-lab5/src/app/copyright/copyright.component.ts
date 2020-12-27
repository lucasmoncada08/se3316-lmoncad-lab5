import { HttpClient } from "@angular/common/http";
import { Component, OnInit, OnDestroy } from "@angular/core";
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'copyright',
  templateUrl: './copyright.component.html',
  styleUrls: ['./copyright.component.css']
})

export class CopyrightComponent implements OnInit, OnDestroy {

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
    this.http.get<{secAndPrivPolicy: String}>('http://localhost:3000/api/copyright/getcusecpolicy').subscribe(res => {
      this.secAndPrivPolicy = res.secAndPrivPolicy;
    });
    this.http.get<{DMCAPolicy: String}>('http://localhost:3000/api/copyright/getcuDMCAPolicy').subscribe(res => {
      this.DMCAPolicy = res.DMCAPolicy;
    });
    this.http.get<{AUPPolicy: String}>('http://localhost:3000/api/copyright/getcuAUPPolicy').subscribe(res => {
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

    this.http.post('http://localhost:3000/api/copyright/cusecpolicy', JSON.stringify({'secAndPrivPolicy': text}), data)
    .subscribe(res => {})
  }

  onCUDMCAPolicy(text) {

    const data = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({'DMCAPolicy': text})
    }

    this.http.post('http://localhost:3000/api/copyright/cuDMCAPolicy', JSON.stringify({'DMCAPolicy': text}), data)
    .subscribe(res => {})
  }

  onCUAUPPolicy(text) {
    const data = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({'AUPPolicy': text})
    }

    this.http.post('http://localhost:3000/api/copyright/cuAUPPolicy', JSON.stringify({'AUPPolicy': text}), data)
    .subscribe(res => {})
  }

}
