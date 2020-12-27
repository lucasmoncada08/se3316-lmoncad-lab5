import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment'

@Component({
  selector: 'course-search',
  templateUrl: './course-search.component.html',
  styleUrls: ['./course-search.component.css']
})

export class CourseSearchComponent {

  constructor(private http: HttpClient) {};

  apiUrl = environment.apiUrl;

  courseQueryShow = false;
  noQueries = false; // for displaying "found no results message"
  courses;

  onSearchCourses(subjCode, courseCode) {
    this.noQueries = false;

    if (subjCode == '') {
      subjCode = 'null';
    }

    if (courseCode == '') {
      courseCode = 'null';
    }

    this.http.get(this.apiUrl + `/coursesearch/${courseCode}/${subjCode}`)
    .subscribe((courseData) => {
      this.courses = courseData;
      console.log(this.courses);
      if (this.courses.length == 0)
        this.noQueries = true;
      this.courseQueryShow = true;
    });

    this.http.get(this.apiUrl + '/courselists/public')
    .subscribe(courselists => {
      console.log(courselists);
    })
  }

}
