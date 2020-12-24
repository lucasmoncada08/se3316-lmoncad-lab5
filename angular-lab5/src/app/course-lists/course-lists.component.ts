import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ScheduleComponent, WorkWeekService } from '@syncfusion/ej2-angular-schedule';

import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'course-lists',
  providers: [WorkWeekService],
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

  courseReviews;

  // readonly url = 'http://localhost:3000'

  @ViewChild("scheduleObj") schedObj: ScheduleComponent;
  eventsCurrentlyInTimetable = 0;

  public selectedDate: Date = new Date(2021, 8, 6);

  constructor(private http: HttpClient, public authService: AuthService) {};

  ngOnInit() {
    this.userIsAuthenticated = this.authService.getIsAuth();

    this.onRun();
  }

  ngOnDestroy() {

  }

  onRun() {
    this.http.get('http://localhost:3000/api/courselists/public')
    .subscribe(courselists => {
      this.courselists = courselists
    })
    // console.log('User authenticated: ', this.userIsAuthenticated);
    if (this.userIsAuthenticated) {
      this.http.get('http://localhost:3000/api/courselists/mycourselists')
      .subscribe(courselists => {
        this.myCourseLists = courselists
      })
    }
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

  onGetReviews(subjCode, courseCode) {
    this.http.get(`http://localhost:3000/api/coursereviews/view/${subjCode}/${courseCode}`)
    .subscribe(courseRevs => {
      this.courseReviews = courseRevs
    })
  }

  onAddToTimetable(clist) {

    for (var i=0; i<=this.eventsCurrentlyInTimetable; i++) {
      this.schedObj.deleteEvent(0);
    }

    var dayToNumDict = {
      "M": 6,
      "Tu": 7,
      "W": 8,
      "Th": 9,
      "F": 10
    };

    var timeToHourDict = {
      "8:30 AM": 8, "9:00 AM": 9,
      "9:30 AM": 9, "10:00 AM": 10,
      "10:30 AM": 10, "11:00 AM":11,
      "11:30 AM": 11, "12:00 PM": 12,
      "12:30 PM": 12, "1:00 PM": 13,
      "1:30 PM": 13, "2:00 PM": 14,
      "2:30 PM": 14, "3:00 PM": 15,
      "3:30 PM": 15, "4:00 PM": 16,
      "4:30 PM": 16, "5:00 PM": 17,
      "5:30 PM": 17, "6:00 PM": 18,
      "6:30 PM": 18, "7:00 PM": 19,
      "7:30 PM": 19, "8:00 PM": 20,
      "8:30 PM": 20, "9:00 PM": 21,
      "9:30 PM": 21, "10:00 PM": 22
    };

    var timeToMinDict = {
      "8:30 AM": 30, "9:00 AM": 0,
      "9:30 AM": 30, "10:00 AM": 0,
      "10:30 AM": 30, "11:00 AM":0,
      "11:30 AM": 30, "12:00 PM": 0,
      "12:30 PM": 30, "1:00 PM": 0,
      "1:30 PM": 30, "2:00 PM": 0,
      "2:30 PM": 30, "3:00 PM": 0,
      "3:30 PM": 30, "4:00 PM": 0,
      "4:30 PM": 30, "5:00 PM": 0,
      "5:30 PM": 30, "6:00 PM": 0,
      "6:30 PM": 30, "7:00 PM": 0,
      "7:30 PM": 30, "8:00 PM": 0,
      "8:30 PM": 30, "9:00 PM": 0,
      "9:30 PM": 30, "10:00 PM": 0
    };

    const data = {
      name: clist
    }

    const options = {
      headers: new HttpHeaders({'Content-Type': 'application/json'}),
      body: JSON.stringify(data)
    }

    this.http.post('http://localhost:3000/api/timetable/getcourses', JSON.stringify(data), options)
    .subscribe(r => {
      // console.log(r[0]);

      var counter = 0;

      for (var x=0; x<5; x++) {
        if (r[x].courseId!='' && r[x].courseId!='Course Code' && r[x].subjCode!='' && r[x].subjCode!='Subject Code') {
          this.http.get(`http://localhost:3000/api/coursesearch/${r[x].courseId}/${r[x].subjCode}`).subscribe(res => {
            console.log(res);
            if (res) {

              var sTimeHr = timeToHourDict[res[0].course_info[0].start_time];
              var sTimeMin = timeToMinDict[res[0].course_info[0].start_time];
              var eTimeHr = timeToHourDict[res[0].course_info[0].end_time];
              var eTimeMin = timeToMinDict[res[0].course_info[0].end_time];

              for (var i=0; i<res[0].course_info[0].days.length; i++) {
                var day = dayToNumDict[res[0].course_info[0].days[i]];

                this.schedObj.addEvent([{
                  id: counter,
                  Subject: `${res[0].subject} - ${res[0].catalog_nbr}`,
                  StartTime: new Date(2021, 8, dayToNumDict[res[0].course_info[0].days[i]], sTimeHr, sTimeMin),
                  EndTime: new Date(2021, 8, dayToNumDict[res[0].course_info[0].days[i]], eTimeHr, eTimeMin),
                  isAllDay: false
                }])
                counter++;
                this.eventsCurrentlyInTimetable = counter;
                console.log(this.eventsCurrentlyInTimetable);
              }
            }
          })
        }
      }
    })

  }
}


