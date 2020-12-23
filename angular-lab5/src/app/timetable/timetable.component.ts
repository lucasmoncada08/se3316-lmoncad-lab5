import { Component, ViewChild } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ScheduleComponent, WorkWeekService } from '@syncfusion/ej2-angular-schedule';

@Component({
  selector: 'timetable',
  providers: [WorkWeekService],
  templateUrl: './timetable.component.html',
  styleUrls: ['./timetable.component.css']
})

export class TimetableComponent {

  constructor(private http: HttpClient) {};

  @ViewChild("scheduleObj") schedObj: ScheduleComponent;
  eventsCurrentlyInTimetable = 0;

  public selectedDate: Date = new Date(2021, 8, 6);

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
    })

  }

}


