import { Component } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';


@Component({
  selector: 'course-review',
  templateUrl: './course-review.component.html',
  styleUrls: ['./course-review.component.css']
})

export class CourseReviewComponent {

  courseReviews;

  onGetReviews(subjCode, courseCode) {
    this.http.get(`http://localhost:3000/api/coursereviews/view/${subjCode}/${courseCode}`)
    .subscribe(courseRevs => {
      this.courseReviews = courseRevs
    })
  }

  constructor(private http: HttpClient) {};

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
