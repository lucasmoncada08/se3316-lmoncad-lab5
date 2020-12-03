import { Component } from '@angular/core';

@Component({
  selector: 'course-search',
  templateUrl: './course-search.component.html',
  styleUrls: ['./course-search.component.css']
})

export class CourseSearchComponent {

  courseQueryShow = false;

  posts = [
  {
    "catalog_nbr": "1021B",
    "subject": "ACTURSCI",
    "className": "INTRO TO FINANCIAL SECURE SYS",
    "course_info": [
      {
        "class_nbr": 5538,
        "start_time": "8:30 AM",
        "descrlong": "",
        "end_time": "9:30 AM",
        "campus": "Main",
        "facility_ID": "PAB-106",
        "days": [
          "M",
          "W",
          "F"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Not full",
        "descr": "RESTRICTED TO YR 1 STUDENTS."
      }
    ],
    "catalog_description": "The nature and cause of financial security and insecurity; public, private and employer programs and products to reduce financial insecurity, including social security, individual insurance and annuities along with employee pensions and benefits.\n\nExtra Information: 3 lecture hours."
  },
  {
    "catalog_nbr": 2053,
    "subject": "ACTURSCI",
    "className": "MATH FOR FINANCIAL ANALYSIS",
    "course_info": [
      {
        "class_nbr": 1592,
        "start_time": "11:30 AM",
        "descrlong": "Prerequisite(s):1.0 course or two 0.5 courses at the 1000 level or higher from Applied Mathematics, Calculus, or Mathematics.",
        "end_time": "12:30 PM",
        "campus": "Main",
        "facility_ID": "NCB-113",
        "days": [
          "M",
          "W",
          "F"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Full",
        "descr": ""
      }
    ],
    "catalog_description": "Simple and compound interest, annuities, amortization, sinking funds, bonds, bond duration, depreciation, capital budgeting, probability, mortality tables, life annuities, life insurance, net premiums and expenses. Cannot be taken for credit in any module in Statistics or Actuarial Science, Financial Modelling or Statistics, other than the minor in Applied Financial Modeling.\n\nAntirequisite(s): Actuarial Science 2553A/B.\n\nExtra Information: 3 lecture hours."
  }
  ]

  onSearchCourses(subjCode, courseCode) {
    // this.subjectCode = subjCode;
    // this.courCode = courseCode;

    this.courseQueryShow = true;


  }

}
