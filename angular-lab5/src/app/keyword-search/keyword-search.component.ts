import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'keyword-search',
  templateUrl: './keyword-search.component.html',
  styleUrls: ['./keyword-search.component.css']
})

export class KeywordSearchComponent {

  constructor(private http: HttpClient) {};

  courseQueryShow = false;
  noQueries = false;
  moreChars = false;
  courses;

  onKeySearchCourses(courseCode, courseName) {
    this.noQueries = false;
    this.moreChars = false;

    if (courseCode == '')
      courseCode = 'null';
    else if (courseCode.length < 4)
      this.moreChars = true;

    if (courseName == '')
      courseName = 'null';
    else if(courseName.length < 4)
      this.moreChars = true;

    this.http.get(`http://localhost:3000/api/coursekeywordsearch/${courseCode}/${courseName}`)
    .subscribe((courseData) => {
      this.courses = courseData;
      console.log(this.courses);
      if (this.courses.length == 0 && !this.moreChars)
        this.noQueries = true;
      this.courseQueryShow = true;
    });
  }

}
