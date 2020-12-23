import { Component, OnDestroy, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'course-lists',
  templateUrl: './course-lists.component.html',
  styleUrls: ['./course-lists.component.css']
})

export class CourseListsComponent implements OnInit, OnDestroy {

  userIsAuthenticated = false;
  // private authListenerSubs: Subscription;
  // private reqListenerSubs: Subscription;

  courselists;
  newCourseList;
  myCourseLists;

  // readonly url = 'http://localhost:3000'

  constructor(private http: HttpClient, public authService: AuthService) {};

  ngOnInit() {
    this.onRun();

    this.userIsAuthenticated = this.authService.getIsAuth();

  }

  ngOnDestroy() {

  }

  onRun() {
    this.http.get('http://localhost:3000/api/courselists/public')
    .subscribe(courselists => {
      this.courselists = courselists
      console.log(this.courselists);
    })
    // console.log('User authenticated: ', this.userIsAuthenticated);
    this.http.get('http://localhost:3000/api/courselists/mycourselists')
    .subscribe(courselists => {
      this.myCourseLists = courselists
      console.log(this.myCourseLists);
    })
  }

  addCourseList(name, descr, priv, courseId1, subjCode1, courseId2,
      subjCode2, courseId3, subjCode3, courseId4, subjCode4, courseId5, subjCode5) {

    var privacy = '';
    var numOfCourses = 0;

    if (priv)
      privacy = 'Private';
    else
      privacy = 'Public'

    var courseCodes = [courseId1, courseId2, courseId3, courseId4, courseId5];
    var subjCodes = [subjCode1, subjCode2, subjCode3, subjCode4, subjCode5];

    for (var i=0; i<5; i++) {
      if (courseCodes[i]!='' && courseCodes[i]!='Course Code' && subjCodes[i]!='' && subjCodes[i]!='Subject Code')
        numOfCourses++;
    }

    this.newCourseList = {
      "name": name,
      "descr": descr,
      "privacy": privacy,
      "numOfCourses": numOfCourses,
      "courses": [
        {
          "courseId": courseId1,
          "subjCode": subjCode1
        },
        {
          "courseId": courseId2,
          "subjCode": subjCode2
        },
        {
          "courseId": courseId3,
          "subjCode": subjCode3
        },
        {
          "courseId": courseId4,
          "subjCode": subjCode4
        },
        {
          "courseId": courseId5,
          "subjCode": subjCode5
        }
      ]
    }

    const data = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(this.newCourseList)
    }

    this.http.post('http://localhost:3000/api/courselists/add',
    JSON.stringify(this.newCourseList), data).subscribe(cList => {
      console.log(cList)
    })

  }

  onEditCourseList(name, descr, priv, courseId1, subjCode1, courseId2,
    subjCode2, courseId3, subjCode3, courseId4, subjCode4, courseId5, subjCode5) {
    var privacy = '';
    var numOfCourses = 0;

    if (priv)
      privacy = 'Private';
    else
      privacy = 'Public'

    var courseCodes = [courseId1, courseId2, courseId3, courseId4, courseId5];
    var subjCodes = [subjCode1, subjCode2, subjCode3, subjCode4, subjCode5];

    for (var i=0; i<5; i++) {
      if (courseCodes[i]!='' && courseCodes[i]!='Course Code' && subjCodes[i]!='' && subjCodes[i]!='Subject Code')
        numOfCourses++;
    }

    this.newCourseList = {
      "name": name,
      "descr": descr,
      "privacy": privacy,
      "numOfCourses": numOfCourses,
      "courses": [
        {
          "courseId": courseId1,
          "subjCode": subjCode1
        },
        {
          "courseId": courseId2,
          "subjCode": subjCode2
        },
        {
          "courseId": courseId3,
          "subjCode": subjCode3
        },
        {
          "courseId": courseId4,
          "subjCode": subjCode4
        },
        {
          "courseId": courseId5,
          "subjCode": subjCode5
        }
      ]
    }

    const data = {
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(this.newCourseList)
    }

    this.http.post('http://localhost:3000/api/courselists/edit',
    JSON.stringify(this.newCourseList), data).subscribe(cList => {
      console.log(cList)
    })
  }

  onDeleteCourseList(clName) {

    if (confirm('Are you sure you would like to delete the course list: ' + clName)) {

    const options = {
      headers: new HttpHeaders({'Content-Type': 'application/json'}),
      body: {"name": clName}
    }

    this.http.delete(`http://localhost:3000/api/courselists/delete`, options).subscribe(res => {
      console.log(res)
    })

    }
  }
}

// {
//   "name": "Lucas 3rd Sem Course List",
//   "creator": "Lucas Moncada",
//   "descr": "For my 3rd semester in software engineering",
//   "privacy": "Public",
//   "courses": [
//   {
//       "courseId": "2053",
//       "subjCode": "ACTURSCI"
//   },
//   {
//       "courseId": "2553A",
//       "subjCode": "ACTURSCI"
//   },
//   {
//       "courseId": "3429A",
//       "subjCode": "ACTURSCI"
//   },
//   {
//       "courseId": "4823A",
//       "subjCode": "ACTURSCI"
//   },
//   {
//       "courseId": "4824A",
//       "subjCode": "ACTURSCI"
//   }
//   ]
// }
