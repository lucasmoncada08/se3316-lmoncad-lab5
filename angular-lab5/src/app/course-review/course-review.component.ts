import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'course-review',
  templateUrl: './course-review.component.html',
  styleUrls: ['./course-review.component.css']
})

// /Users/lucasmoncada/Desktop/SE-3316/se3316-lmoncad-lab5/angular-lab5/src/app/timetable/timetable.component.ts

export class CourseReviewComponent implements OnInit, OnDestroy {

  userIsAuthenticated = false;
  private authListenerSubs: Subscription;

  courseReviews;

  constructor(private http: HttpClient, public authService: AuthService) {};

  ngOnInit() {
    this.userIsAuthenticated = this.authService.getIsAuth();
    // this.authListenerSubs = this.authService.getAuthStatusListener().subscribe(isAuth => {
    //   this.userIsAuthenticated = isAuth;
    // })
  }

  ngOnDestroy() {
    // this.authListenerSubs.unsubscribe();
  }

  onGetReviews(subjCode, courseCode) {
    this.http.get(`http://localhost:3000/api/coursereviews/view/${subjCode}/${courseCode}`)
    .subscribe(courseRevs => {
      this.courseReviews = courseRevs
    })
  }

  onCreateReview(subjCode, courseCode, rating, reviewText, username) {

    const data = {
      "courseCode": courseCode,
      "subjCode": subjCode,
      "rating": rating,
      "reviewText": reviewText,
      "username": username
    }

    const options = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data)
    }

    this.http.post('http://localhost:3000/api/coursereviews/add', JSON.stringify(data),
    options).subscribe(res => console.log(res));
  }

}
