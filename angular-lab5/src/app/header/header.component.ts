import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: "header",
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})

// Component for allowing access to different functionalities and routing users through the app
export class HeaderComponent implements OnInit, OnDestroy {
  userIsAuthenticated = false;
  private authListenerSubs: Subscription;
  userIsAdmin = false;
  private adminListenerSubs: Subscription;

  constructor(private authService: AuthService) {};

  ngOnInit() {
    this.userIsAuthenticated = this.authService.getIsAuth();
    this.authListenerSubs = this.authService.getAuthStatusListener().subscribe(isAuthenticated => {
      this.userIsAuthenticated = isAuthenticated;
    });
    this.userIsAdmin = this.authService.getIsAdmin();
    this.adminListenerSubs = this.authService.getAdminStatusListener().subscribe(isAdmin => {
      this.userIsAdmin = isAdmin;
    });
  }

  ngOnDestroy() {
    this.authListenerSubs.unsubscribe();
    this.adminListenerSubs.unsubscribe();
  }

  onLogout() {
    this.authService.logout();
  }

}
