import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment'

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'course-review',
  templateUrl: './course-review.component.html',
  styleUrls: ['./course-review.component.css']
})

/* Component for course review functionality, including getting and creating reviews */
export class CourseReviewComponent implements OnInit {

  apiUrl = environment.apiUrl;

  userIsAuthenticated = false;
  private authListenerSubs: Subscription;

  courseReviews;

  constructor(private http: HttpClient, public authService: AuthService) {};

  ngOnInit() {
    this.userIsAuthenticated = this.authService.getIsAuth();
  }

  onGetReviews(subjCode, courseCode) {
    this.http.get(this.apiUrl + `/coursereviews/view/${subjCode}/${courseCode}`)
    .subscribe(courseRevs => {
      this.courseReviews = courseRevs
    })
  }

  onCreateReview(subjCode, courseCode, rating, reviewText) {

    // Check if the rating is not a number value
    if (!Number(rating))
      alert('Incorrect rating value');

    else if (confirm('Are you sure you would like to add this review')) {

      if (rating > 5)
        rating = 5;
      else if (rating < 0.5)
        rating = 0.5;

      const data = {
        "courseCode": courseCode,
        "subjCode": subjCode,
        "rating": rating,
        "reviewText": reviewText
      }

      const options = {
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
      }

      this.http.post(this.apiUrl + '/coursereviews/add', JSON.stringify(data),
      options).subscribe(res => console.log(res));
    }
  }

}
