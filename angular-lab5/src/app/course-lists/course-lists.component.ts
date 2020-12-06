import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';


@Component({
  selector: 'course-lists',
  templateUrl: './course-lists.component.html',
  styleUrls: ['./course-lists.component.css']
})

export class CourseListsComponent implements OnInit {

  courselists;
  newCourseList;

  // readonly url = 'http://localhost:3000'

  constructor(private http: HttpClient) {};

  ngOnInit() {
    this.onRun();
  }

  onRun() {
    this.http.get('http://localhost:3000/api/courselists/public')
    .subscribe(courselists => {
      this.courselists = courselists
      console.log(this.courselists);
    })
  }

  addCourseList(name, creator, descr, priv, courseId1, subjCode1, courseId2,
      subjCode2, courseId3, subjCode3, courseId4, subjCode4, courseId5, subjCode5) {

    var privacy = '';

    if (priv)
      privacy = 'Private';
    else
      privacy = 'Public'

    console.log(privacy)

    this.newCourseList = {
      "name": name,
      "creator": creator,
      "descr": descr,
      "privacy": privacy,
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

  onDeleteCourseList(clName) {

    const options = {
      headers: new HttpHeaders({'Content-Type': 'application/json'}),
      body: {"name": clName}
    }

    this.http.delete(`http://localhost:3000/api/courselists/delete`, options).subscribe(res => {
      console.log(res)
    })
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
