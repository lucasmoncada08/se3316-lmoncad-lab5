import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';


@Component({
  selector: 'course-lists',
  templateUrl: './course-lists.component.html',
  styleUrls: ['./course-lists.component.css']
})

export class CourseListsComponent implements OnInit {

  courselists;

  constructor(private http: HttpClient) {};

  ngOnInit() {
    this.onRun();
  }

  onRun() {
    this.http.get('http://localhost:3000/api/courselists/public')
    .subscribe(courselists => {
      this.courselists = courselists
      // console.log(this.courselists);
    })
  }

}
