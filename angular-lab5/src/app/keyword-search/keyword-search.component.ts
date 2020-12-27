import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment'

@Component({
  selector: 'keyword-search',
  templateUrl: './keyword-search.component.html',
  styleUrls: ['./keyword-search.component.css']
})

/* Component to allow keyword searching for users */
export class KeywordSearchComponent {

  constructor(private http: HttpClient) {};

  apiUrl = environment.apiUrl;

  courseQueryShow = false;
  noQueries = false; // For displaying "no results" message
  moreChars = false; // For not entering enough characters indicator
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

    this.http.get(this.apiUrl + `/coursekeywordsearch/${courseCode}/${courseName}`)
    .subscribe((courseData) => {
      this.courses = courseData;
      console.log(this.courses);
      if (this.courses.length == 0 && !this.moreChars)
        this.noQueries = true;
      this.courseQueryShow = true;
    });
  }

}
