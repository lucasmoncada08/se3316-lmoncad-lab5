import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'course-search',
  templateUrl: './course-search.component.html',
  styleUrls: ['./course-search.component.css']
})

export class CourseSearchComponent {

  constructor(private http: HttpClient) {};

  courseQueryShow = false;
  noQueries = false;
  courses;

  onSearchCourses(subjCode, courseCode) {
    this.noQueries = false;

    if (subjCode == '') {
      subjCode = 'null';
    }

    if (courseCode == '') {
      courseCode = 'null';
    }

    this.http.get(`http://localhost:3000/api/coursesearch/${courseCode}/${subjCode}`)
    .subscribe((courseData) => {
      this.courses = courseData;
      console.log(this.courses);
      if (this.courses.length == 0)
        this.noQueries = true;
      this.courseQueryShow = true;
    });

    this.http.get('http://localhost:3000/api/courselists/public')
    .subscribe(courselists => {
      // this.courselists = courselists
      console.log(courselists);
    })
  }

}
