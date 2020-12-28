/* The REST Api that communicates with the application */

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const https = require('https');

// Storing data models
const CourseList = require('./models/course-lists');
const User = require('./models/users');
const CourseReview = require('./models/course-reviews');

const checkAuth = require('./middleware/check-auth');
const { EWOULDBLOCK } = require('constants');

const app = express();

var salt = bcrypt.genSaltSync();

var secAndPrivPolicy;
var DMCAPolicy;
var AUPPolicy;

// Connect to the MongoDB database
mongoose.connect('mongodb+srv://lucas:RNjKc3mfU4p9gQDN@cluster0.3syua.mongodb.net/test?retryWrites=true&w=majority&ssl=true', {useNewUrlParser: true})
  .then(() => {
    console.log('Connection successful!');
  })
  .catch(err => {
    console.log("Error connecting to database: ", err);
  })

app.use(bodyParser.json());

// For cors headers
app.use(cors({
  origin: ['52.23.169.231:3000'],
  credentials: true
}));

// Setting headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader('Access-Control-Allow-Headers',
   'GET, POST, PATCH, DELETE, OPTIONS'
  );
  next();
})

// Adding a course review
app.post('/api/coursereviews/add', checkAuth, (req, res, next) => {
  console.log('Posting course review');

  // Getting current date
  var date = new Date();
  var d = date.getUTCDate() - 1;
  var m = date.getUTCMonth() + 1;
  var yr = date.getUTCFullYear();

  const courseReview = new CourseReview({
    courseCode: req.body.courseCode,
    subjCode: req.body.subjCode,
    rating: req.body.rating,
    reviewText: req.body.reviewText,
    username: req.userData.userId,
    day: d,
    month: m,
    year: yr,
    hidden: false
  })

  courseReview.save();

  res.send(courseReview);

})

// Get course reviews with specified subject code and course code
app.get('/api/coursereviews/view/:subjCode/:courseCode', (req, res, next) => {
  CourseReview.find({subjCode: req.params.subjCode, courseCode: req.params.courseCode, hidden: false}).then(reviews => {
    res.send(reviews);
  })
})

// Adding a course list
app.post('/api/courselists/add', checkAuth, (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  console.log('Posting to course list');

  // Getting the current date
  var date = new Date();
  var day = date.getUTCDate();
  var month = date.getUTCMonth() + 1;
  var year = date.getUTCFullYear();

  const courseList = new CourseList({
    name: req.body.name,
    creator: req.userData.userId,
    descr: req.body.descr,
    day: day,
    month: month,
    year: year,
    courses: req.body.courses,
    privacy: req.body.privacy,
    numOfCourses: req.body.numOfCourses
  })

  courseList.save();

  res.send(courseList);

})

// Editing a course list
app.post('/api/courselists/edit', checkAuth, (req, res, next) => {
  console.log('Editing a course list');

  // Getting the current date
  var date = new Date();
  var day = date.getUTCDate();
  var month = date.getUTCMonth() + 1;
  var year = date.getUTCFullYear();

  var courses = req.body.courses;
  var allMatches = true;

  var subjFlag;
  var courseFlag;

  // Checking for invalid course codes and subject codes
  for (var j=0; j<5; j++) {
    // If user leaves preset field value or deletes the field entirely ignore that
    if (!(courses[j].subjCode=='' || courses[j].subjCode=='Subject Code' || courses[j].courseId=='' || courses[j].courseId=='Course Code')) {
      subjFlag = false;
      courseFlag = false;
      for (var i=0; i<courseData.length; i++) {
        if (String(courseData[i].subject).toLowerCase().includes(courses[j].subjCode.toLowerCase()))
          subjFlag = true;
        if (String(courseData[i].catalog_nbr).toLowerCase().includes(courses[j].courseId.toLowerCase()))
          courseFlag = true;
        if (subjFlag && courseFlag)
          break;
      }
      // If one of subject code or course id is invalid, the whole edit is voided
      if (!subjFlag || !courseFlag) {
        allMatches = false;
        break;
      }
    }
  }

  if (allMatches) {
    mongoose.set('useFindAndModify', false);

    var cond = {
      'creator': req.userData.userId, 'name': req.body.name
    };

    var settings = {
      descr: req.body.descr,
      day: day, month: month, year: year,
      courses: req.body.courses, privacy: req.body.privacy,
      numOfCourses: req.body.numOfCourses
    }

    CourseList.findOneAndUpdate(cond, { $set: settings }, {upsert: false}, function(err, doc) {
      if (err) {
        return res.status(500).json({error: err, message: 'err in findOneAndUpdate'});
      }
      else {
        return res.status(200).json({ message: 'updated course list' });
      }
    });
  }
  else
    res.send('One or more courses are invalid');
})

// Signing a user up
app.post('/api/users/signup', (req, res, next) => {
  console.log('Creating new user');

  var copy = false

  User.findOne({$or: [
    {email: req.body.email},
    {username: req.body.username}
  ]}).then(result => {
    if (!result) {
      bcrypt.hash(req.body.password, 10)
        .then(hash => {
        const user = new User({
          username: req.body.username,
          email: req.body.email,
          password: hash,
          admin: req.body.admin,
          deactivated: req.body.deactivated
        })
        user.save()
        .then(result => {
          res.send(copy);
        })
        .catch(err => {
          res.send('Email or username error');
        });
      });
    }
    else {
      copy = true;
      res.send(copy);
    }
  })
  .catch(err => {
    res.send('Error in findOne')
  })

});

// Logging a user into the app or declining an unknown user
app.post('/api/users/login', (req, res, next) => {
  let fetchedUser;
  User.findOne({ email: req.body.email })
    .then(user => {
      if (!user) {
        return res.status(200).json({
          message: 'Auth failed at !user'
        });
      }

      // Accounting for admin deactivated accounts
      if (user.deactivated) {
        return 'Deactivate'
      }

      fetchedUser = user;
      return bcrypt.compare(req.body.password, user.password);
    })
    .then(result => {
      if (!result) {
        return res.status(200).json({
          message: 'Auth failed at !result'
        });
      }

      if (result == 'Deactivate') {
        console.log('Deactivated Account');
        res.status(200).json({
          token: 'Deactivated'
        });
      }
      else {
        const token = jwt.sign({email: fetchedUser.email, userId: fetchedUser.username}, 'secret_this_should_be_longer',
        { expiresIn: "1h"} ); // Setting the login token to expire in 1 hour

        res.status(200).json({
          token: token,
          expiresIn: 3600,
          admin: fetchedUser.admin
        });
      }
    })
    .catch(err => {
      return res.status(401).json({
        error: err,
        message: 'Auth failed at then result'
      });
  });
})

// Updating a users password
app.post('/api/users/updatepassword', checkAuth, (req, res, next) => {
  mongoose.set('useFindAndModify', false);

  var newPass;
  var cond = { 'username': req.userData.userId };
  bcrypt.hash(req.body.newPass, 10)
    .then(hash => {
      newPass = hash
      User.findOneAndUpdate(cond, { $set: {password: newPass} }, {upsert: false}, function(err, doc) {
        if (err)
          return res.send(500, {error: err});
        return res.status(200).json({ message: 'updated password' });
      });
    })
    .catch(err => {
      res.status(500).json({
        message: "in catch err"
      });
    });
})

// Getting all public course lists
app.get('/api/courselists/public', (req, res, next) => {
  CourseList.find({privacy: 'Public'}).sort({year: -1, month: -1, day: -1}) // sorted by date
  .then(lists => {
    res.send(lists);
  })
})

// Getting all course lists belonging to the current user
app.get('/api/courselists/mycourselists', checkAuth, (req, res, next) => {
  CourseList.find({creator: req.userData.userId}).sort({year: -1, month: -1, day: -1})
  .then(lists => {
    res.send(lists);
  })
})

// Getting the courses from a specified course list for the timetable displaying
app.post('/api/timetable/getcourses', (req, res, next) => {
  console.log(req.body.name);
  CourseList.findOne({name: req.body.name})
  .then(courselist => {
    res.send(courselist.courses);
  });
})

// Get a list of all courses that meet the course code and/or subject code specifications
app.get('/api/coursesearch/:courseCode/:subjCode', (req, res, next) => {

  var courseCodeFilteredCourses = [];
  var fullyFilteredCourses = [];
  var csCourseCode = req.params.courseCode;
  var csSubjCode = req.params.subjCode;

  console.log(`course search with ${csSubjCode} and ${csCourseCode}`);

  if (csCourseCode != 'null') {
    if (csCourseCode.length >= 4) {
      for (var i=0; i<courseData.length; i++) {
        if (String(courseData[i].catalog_nbr).toLowerCase().includes(csCourseCode.toLowerCase())) {
          courseCodeFilteredCourses = courseCodeFilteredCourses.concat(courseData[i]);
        }
      }
    }
  }
  else if (csSubjCode != 'null')
    courseCodeFilteredCourses = courseData;

  if (csSubjCode != 'null') {
    for (var i=0; i<courseCodeFilteredCourses.length; i++) {
      if (courseCodeFilteredCourses[i].subject == csSubjCode) {
        fullyFilteredCourses = fullyFilteredCourses.concat(courseCodeFilteredCourses[i]);
      }
    }
  }
  else if (courseCodeFilteredCourses.length < 1) {
    // pass
  }
  else
    fullyFilteredCourses = courseCodeFilteredCourses;

  res.send(fullyFilteredCourses);
})

// Get a list of all courses that meet the keyword course code and/or keyword course name specifications
app.get('/api/coursekeywordsearch/:courseCode/:courseName', (req, res, next) => {

  var courseCodeFilteredCourses = [];
  var fullyFilteredCourses = [];
  var ksCourseCode = req.params.courseCode;
  var ksCourseName = req.params.courseName;

  console.log(`keyword course search with ${ksCourseCode} and ${ksCourseName}`);

  if (ksCourseCode != 'null') {
    if (ksCourseCode.length >= 4) {
      for (var i=0; i<courseData.length; i++) {
        if (String(courseData[i].catalog_nbr).toLowerCase().includes(ksCourseCode.toLowerCase())) {
          courseCodeFilteredCourses = courseCodeFilteredCourses.concat(courseData[i]);
        }
      }
    }
  }
  else if (ksCourseName != 'null')
    courseCodeFilteredCourses = courseData;

  if (ksCourseName != 'null') {
    if (ksCourseName.length >= 4) {
      for (var i=0; i<courseCodeFilteredCourses.length; i++) {
        if (courseCodeFilteredCourses[i].className.toLowerCase().includes(ksCourseName.toLowerCase())) {
          fullyFilteredCourses = fullyFilteredCourses.concat(courseCodeFilteredCourses[i]);
        }
      }
  }
  }
  else if (courseCodeFilteredCourses.length < 1) {
    // pass
  }
  else
    fullyFilteredCourses = courseCodeFilteredCourses;

  res.send(fullyFilteredCourses);
})

// Delete a specified course list
app.delete('/api/courselists/delete', checkAuth, (req, res, next) => {
  console.log('Deleting course list: ' + req.body.name);
  CourseList.deleteOne({ name: req.body.name }).then(result => {
    console.log(result);
  })
  res.send(req.body.name);
})

// Promoting a regular user into an admin user
app.post('/api/admin/grantaccess', (req, res, next) => {
  mongoose.set('useFindAndModify', false);
  var cond = { 'username': req.body.username };
  User.findOneAndUpdate(cond, { $set: {admin: true}}, {upsert: false}, function(err, doc) {
    if (err)
      return res.send(500, {error: err});
    return res.status(200).json({
      message: 'updated to admin'
    });
 })
})

// Deactivating a users account
app.post('/api/admin/deactivate', (req, res, next) => {
  mongoose.set('useFindAndModify', false);
  var cond = { 'username': req.body.username };
  User.findOneAndUpdate(cond, { $set: {deactivated: true}}, {upsert: false}, function(err, doc) {
    if (err)
      return res.send(500, {error: err});
    return res.status(200).json({
      message: 'deactivated account'
    });
 })
})

// Reactivating a users account
app.post('/api/admin/reactivate', (req, res, next) => {
  mongoose.set('useFindAndModify', false);
  var cond = { 'username': req.body.username };
  User.findOneAndUpdate(cond, { $set: {deactivated: false}}, {upsert: false}, function(err, doc) {
    if (err)
      return res.send(500, {error: err});
    return res.status(200).json({
      message: 'reactivated account'
    });
 })
})

// Hiding a specified review from users
app.post('/api/admin/hidereview', (req, res, next) => {
  mongoose.set('useFindAndModify', false);
  var cond = { 'username': req.body.username, 'subjCode': req.body.subjCode, 'courseCode': req.body.courseCode };
  CourseReview.findOneAndUpdate(cond, { $set: {hidden: true}}, {upsert: false}, function (err, doc) {
    if (err)
      return res.send(500, {error: err});
    return res.status(200).json({
      message: 'review is hidden'
    });
  })
})

// Revealing a specified hidden review to the users
app.post('/api/admin/showreview', (req, res, next) => {
  mongoose.set('useFindAndModify', false);
  var cond = { 'username': req.body.username, 'subjCode': req.body.subjCode, 'courseCode': req.body.courseCode };
  CourseReview.findOneAndUpdate(cond, { $set: {hidden: false}}, {upsert: false}, function (err, doc) {
    if (err)
      return res.send(500, {error: err});
    return res.status(200).json({
      message: 'review is shown'
    });
  })
})

// Create/Update the security and privacy policy
app.post('/api/copyright/cusecpolicy', (req, res, next) => {
  secAndPrivPolicy = req.body.secAndPrivPolicy;
  res.status(200).json({
    message: 'security and privacy policy was created/updated'
  });
})

// Get the current security and privacy policy
app.get('/api/copyright/getcusecpolicy', (req, res, next) => {
  res.send({secAndPrivPolicy: secAndPrivPolicy});
})

// Create/Update the DMCA policy
app.post('/api/copyright/cuDMCAPolicy', checkAuth, (req, res, next) => {
  DMCAPolicy = req.body.DMCAPolicy;
  res.status(200).json({
    message: 'DMCA Policy was created/updated'
  });
})

// Get the current DMCA policy
app.get('/api/copyright/getcuDMCAPolicy', (req, res, next) => {
  res.send({DMCAPolicy: DMCAPolicy});
})

// Create/Update the acceptable use policy
app.post('/api/copyright/cuAUPPolicy', checkAuth, (req, res, next) => {
  AUPPolicy = req.body.AUPPolicy;
  res.status(200).json({
    message: 'Acceptable Use Policy was created/updated'
  });
})

// Get the current acceptable use policy
app.get('/api/copyright/getcuAUPPolicy', (req, res, next) => {
  res.send({AUPPolicy: AUPPolicy});
})

module.exports = app

// The data provided with all the course information
var courseData = [
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
  },
  {
    "catalog_nbr": "2427B",
    "subject": "ACTURSCI",
    "className": "LONG TERM ACTUARIAL MATH I",
    "course_info": [
      {
        "class_nbr": 2663,
        "start_time": "12:30 PM",
        "descrlong": "Prerequisite(s): A minimum mark of 60% in each of Actuarial Science 2553A/B, either Calculus 2402A/B or Calculus 2502A/B, and Statistical Sciences 2857A/B. Restricted to students enrolled in any Actuarial Science module.",
        "end_time": "1:30 PM",
        "campus": "Main",
        "facility_ID": "MC-105B",
        "days": [
          "M",
          "W",
          "F"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Not full",
        "descr": ""
      }
    ],
    "catalog_description": "Models for the time until death, single life annuity and life insurance present values and their probability distributions; introduction to equivalence principle and premium calculations.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
  },
  {
    "catalog_nbr": "2553A",
    "subject": "ACTURSCI",
    "className": "MATHEMATICS OF FINANCE",
    "course_info": [
      {
        "class_nbr": 1494,
        "start_time": "9:30 AM",
        "descrlong": "Prerequisite(s): A minimum mark of 60% in Calculus 1501A/B or Applied Mathematics 1413, or Calculus 1301A/B with a minimum mark of 85%.",
        "end_time": "10:30 AM",
        "campus": "Main",
        "facility_ID": "WSC-55",
        "days": [
          "M",
          "W",
          "F"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Not full",
        "descr": "PRIORITY TO STUDENTS ENROLLED IN A MODULE OFFERED BY THE DEPARTMENTS OF APPLIED MATHEMATICS; MATHEMATICS; AND STATISTICAL AND ACTUARIAL SCIENCES."
      }
    ],
    "catalog_description": "Time value of money, accumulation and discount functions, effective rates of interest and discount and present values, as applied to annuities and other financial products, and/or applications including loan repayment schedules and methods.\n\nAntirequisite(s): Actuarial Science 2053.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
  },
  {
    "catalog_nbr": "3424B",
    "subject": "ACTURSCI",
    "className": "SHORT TERM ACTUARIAL MATH I",
    "course_info": [
      {
        "class_nbr": 2811,
        "start_time": "9:30 AM",
        "descrlong": "Prerequisite(s): A minimum mark of 60% in Statistical Sciences 3657A/B. Restricted to students enroled in any Actuarial Science module, or those registered in the Honours Specialization module in Statistics or the Honours Specialization in Financial Modelling module.",
        "end_time": "10:30 AM",
        "campus": "Main",
        "facility_ID": "AHB-1B02",
        "days": [
          "M",
          "W",
          "F"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Not full",
        "descr": ""
      }
    ],
    "catalog_description": "Insurance loss frequency and severity models; aggregate loss models; risk measures; ruin theory; coverage modifications.\n\nExtra Information: 3 lecture hours."
  },
  {
    "catalog_nbr": "3429A",
    "subject": "ACTURSCI",
    "className": "LONG TERM ACTUARIAL MATH II",
    "course_info": [
      {
        "class_nbr": 2812,
        "start_time": "10:30 AM",
        "descrlong": "Prerequisite(s): A minimum mark of 60% in each of Actuarial Science 2427A/B and Statistical Sciences 2858A/B.\nCorequisite(s): Statistical Sciences 3657A/B.",
        "end_time": "11:30 AM",
        "campus": "Main",
        "facility_ID": "SEB-2100",
        "days": [
          "M",
          "W",
          "F"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Not full",
        "descr": ""
      }
    ],
    "catalog_description": "Single life annuity and life insurance loss random variables and their distributions, with applications to the analysis of benefit premiums and reserves; survival model estimates; mortality Improvement and longevity models.\n\nExtra Information: 3 lecture hours."
  },
  {
    "catalog_nbr": "3431B",
    "subject": "ACTURSCI",
    "className": "LONG TERM ACTUARIAL MATH III",
    "course_info": [
      {
        "class_nbr": 2813,
        "start_time": "8:30 AM",
        "descrlong": "Prerequisite(s): A minimum mark of 60% in each of Actuarial Science 3429A/B and in Statistical Sciences 3657A/B. Restricted to students enrolled in any Actuarial Science module.",
        "end_time": "9:30 AM",
        "campus": "Main",
        "facility_ID": "WSC-240",
        "days": [
          "M",
          "W",
          "F"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Not full",
        "descr": ""
      }
    ],
    "catalog_description": "Analysis of probability distributions and present values associated with multiple life models, multiple decrement models and more general multi-state models and applications to life Insurance and other long term coverages including disability Income and other health care coverages.\n\nExtra Information: 3 lecture hours."
  },
  {
    "catalog_nbr": "4426F",
    "subject": "ACTURSCI",
    "className": "ACTUARIAL PRACTICE I",
    "course_info": [
      {
        "class_nbr": 1715,
        "start_time": "8:30 AM",
        "descrlong": "Prerequisite(s): A minimum mark of 60% in Actuarial Science 2427A/B. Restricted to students who have completed all courses specifically mentioned in the Major in Actuarial Science module.",
        "end_time": "10:30 AM",
        "campus": "Main",
        "facility_ID": "WSC-240",
        "days": [
          "Tu",
          "Th"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Not full",
        "descr": ""
      }
    ],
    "catalog_description": "Introduction to the major areas and issues of actuarial practice, including insurance and annuity product design, pricing and valuation, analysis of the cost of pensions and other employee benefits, asset liability management and professionalism.\n\nExtra Information: 3 lecture hours."
  },
  {
    "catalog_nbr": "4823A",
    "subject": "ACTURSCI",
    "className": "SURVIVAL ANALYSIS",
    "course_info": [
      {
        "class_nbr": 2814,
        "start_time": "2:30 PM",
        "descrlong": "Prerequisite(s): A minimum mark of 60% in Statistical Sciences 3858A/B.",
        "end_time": "4:30 PM",
        "campus": "Main",
        "facility_ID": "WSC-248",
        "days": [
          "M"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Not full",
        "descr": ""
      }
    ],
    "catalog_description": "Survival models, nonparametric estimation of the survival function, one and two or more sample hypothesis tests, inference for semiparametric regression models, inference for parametric regression models.\n\nExtra Information: 3 lecture hours."
  },
  {
    "catalog_nbr": "4824A",
    "subject": "ACTURSCI",
    "className": "SHORT TERM ACTUARIAL MATH II",
    "course_info": [
      {
        "class_nbr": 2815,
        "start_time": "10:30 AM",
        "descrlong": "Prerequisite(s): A minimum mark of 60% in Statistical Sciences 3858A/B. Restricted to students enroled in any Actuarial Science module, or those registered in the Honours Specialization module in Statistics or the Honours Specialization in Financial Modelling module.",
        "end_time": "11:30 AM",
        "campus": "Main",
        "facility_ID": "WSC-240",
        "days": [
          "Tu"
        ],
        "instructors": [],
        "class_section": "001",
        "ssr_component": "LEC",
        "enrl_stat": "Not full",
        "descr": ""
      }
    ],
    "catalog_description": "Selection, calibration, and validation of parametric models for insurance losses; credibility theory; short term reserving and pricing; reinsurance coverages.\n\nExtra Information: 3 lecture hours."
  },
    {
      "catalog_nbr": "2310F",
      "subject": "AMERICAN",
      "className": "AMERICAN NIGHTMARE",
      "course_info": [
        {
          "class_nbr": 7515,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1250",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH HISTORY 2310F."
        }
      ],
      "catalog_description": "In the increasingly polarized culture of the US, one American’s dream often seems to be another American’s nightmare. This course introduces key ideas in American culture (the American Dream, American Exceptionalism, and American Identity), and examines recent socio-political movements such as #Black Lives Matter, #Me Too, and White Nationalism.\n\nAntirequisite(s): History 2310F/G.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "3310F",
      "subject": "AMERICAN",
      "className": "ADVANCED AMERICAN STUDIES",
      "course_info": [
        {
          "class_nbr": 9565,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 1.0 History course at the 2200 level or above OR enrolment in an American\nStudies module.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-100",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH HISTORY 3310F."
        }
      ],
      "catalog_description": "What defines being “American”? How is the American identity constructed, and how and why is it frequently contested? This course employs an interdisciplinary approach to explore the meaning(s) and definition(s) of American identity from multiple viewpoints, and within the context of US history, politics, regions, values, and culture.\n\nAntirequisite(s): History 3310F/G.\n\nExtra Information: 2 seminar hours."
    },
    {
      "catalog_nbr": "1201B",
      "subject": "APPLMATH",
      "className": "CALC & PROBABILITY W BIO APPS",
      "course_info": [
        {
          "class_nbr": 3575,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): One or more of Calculus 1000A/B, Calculus 1500A/B or Mathematics 1225A/B.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "TUTORIAL HELP SESSIONS HELD MON-FRI 3:30-4:30 & 4:30-5:30 IN MC 204."
        }
      ],
      "catalog_description": "Applications of integration, integration using mathematical software packages. Scaling and allometry. Basic probability theory. Fundamentals of linear algebra: vectors, matrices, matrix algebra. Difference and differential equations. Each topic will be illustrated by examples and applications from the biological sciences, such as population growth, predator-prey dynamics, age-structured populations.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1411A",
      "subject": "APPLMATH",
      "className": "LNR ALG NUM ANALYSIS FOR ENG",
      "course_info": [
        {
          "class_nbr": 1419,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Ontario Secondary School MHF4U or MCV4U, or Mathematics 0110A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Matrix operations, systems of linear equations, linear spaces and transformations, determinants, eigenvalues and eigenvectors, applications of interest to Engineers including diagonalization of matrices, quadratic forms, orthogonal transformations; introduction to MATLAB with applications from linear algebra. \n\nAntirequisite(s): Mathematics 1600A/B. \n\nExtra Information: 3 lecture hours, 2 computer lab or tutorial hours. Restricted to students in the Faculty of Engineering."
    },
    {
      "catalog_nbr": "1411B",
      "subject": "APPLMATH",
      "className": "LNR ALG NUM ANALYSIS FOR ENG",
      "course_info": [
        {
          "class_nbr": 1702,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Ontario Secondary School MHF4U or MCV4U, or Mathematics 0110A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Matrix operations, systems of linear equations, linear spaces and transformations, determinants, eigenvalues and eigenvectors, applications of interest to Engineers including diagonalization of matrices, quadratic forms, orthogonal transformations; introduction to MATLAB with applications from linear algebra. \n\nAntirequisite(s): Mathematics 1600A/B. \n\nExtra Information: 3 lecture hours, 2 computer lab or tutorial hours. Restricted to students in the Faculty of Engineering."
    },
    {
      "catalog_nbr": 1413,
      "subject": "APPLMATH",
      "className": "APP MATH FOR ENGRS I",
      "course_info": [
        {
          "class_nbr": 1422,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): One or more of Ontario Secondary School MHF4U, MCV4U, or Mathematics 0110A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "TC-141",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Limits, continuity, differentiation of functions of one variable with applications, extreme values, integration, the fundamental theorem of calculus, methods and applications of integration to areas, volumes and engineering applications. Sequences and series, convergence, power series. Vector functions, partial differential calculus, gradients, directional derivatives and applications.\n \nAntirequisite(s): Calculus 1000A/B, Calculus 1301A/B, Calculus 1500A/B, Calculus 1501A/B, Mathematics 1225A/B, Mathematics 1230A/B.\n\nExtra Information: 3 lecture hours, 1 tutorial hour. Applied Mathematics 1413 is a suitable prerequisite for any course which lists Calculus 1000A/B plus Calculus 1501A/B. Restricted to students in the Faculty of Engineering."
    },
    {
      "catalog_nbr": "2270A",
      "subject": "APPLMATH",
      "className": "APPLIED MATH FOR ENGINEER II",
      "course_info": [
        {
          "class_nbr": 4473,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1411A/B and Applied Mathematics 1413.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "MC-110",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ENGINEERING STUDENTS. YEAR 2 MME STUDENTS MUST REGISTER IN SECTION 001."
        }
      ],
      "catalog_description": "Topics include first order ODE's of various types, higher order ODE's and methods of solving them, initial and boundary value problems, applications to mass-spring systems and electrical RLC circuits, Laplace transforms and their use for solving differential equations, systems of linear ODE's, orthogonal functions and Fourier.\n\nAntirequisite(s): Applied Mathematics 2402A, the former Applied Mathematics 2411, the former Applied Mathematics 2413, the former Applied Mathematics 2415.\n\nExtra Information: 3 lecture hours, 1 tutorial hour. Restricted to students in the Faculty of Engineering."
    },
    {
      "catalog_nbr": "2270B",
      "subject": "APPLMATH",
      "className": "APPLIED MATH FOR ENGINEER II",
      "course_info": [
        {
          "class_nbr": 4675,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1411A/B and Applied Mathematics 1413.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "UCC-56",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESERVED FOR STUDENTS REPEATING THE COURSE."
        }
      ],
      "catalog_description": "Topics include first order ODE's of various types, higher order ODE's and methods of solving them, initial and boundary value problems, applications to mass-spring systems and electrical RLC circuits, Laplace transforms and their use for solving differential equations, systems of linear ODE's, orthogonal functions and Fourier.\n\nAntirequisite(s): Applied Mathematics 2402A, the former Applied Mathematics 2411, the former Applied Mathematics 2413, the former Applied Mathematics 2415.\n\nExtra Information: 3 lecture hours, 1 tutorial hour. Restricted to students in the Faculty of Engineering."
    },
    {
      "catalog_nbr": "2276B",
      "subject": "APPLMATH",
      "className": "APP MATH ELEC & MEC ENG III",
      "course_info": [
        {
          "class_nbr": 4481,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Applied Mathematics 2270A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ELECTRICAL, MECHANICAL, COMPUTER, SOFTWARE, MECHATRONICS, OR INTEGRATED ENGINEERING. YR 2 MME STUDENTS MUST REGISTER IN SECTION 001."
        }
      ],
      "catalog_description": "Topics covered include a review of orthogonal expansions of functions and Fourier series and transforms, multiple integration with methods of evaluation in different systems of coordinates, vector fields, line integrals, surface and flux integrals, the Green, Gauss and Stokes theorems with applications. \n\nAntirequisite(s): Calculus 2302A/B, Calculus 2303A/B, Calculus 2502A/B, Calculus 2503A/B, Applied Mathematics 2277A/B, the former Applied Mathematics 2411, the former Applied Mathematics 2413, the former Applied Mathematics 2415.\n\nExtra Information: 3 lecture hours, 1 tutorial hour. Restricted to students in the Faculty of Engineering."
    },
    {
      "catalog_nbr": "2277B",
      "subject": "APPLMATH",
      "className": "APPL MATH CHEM & CIVIL ENG III",
      "course_info": [
        {
          "class_nbr": 4486,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Applied Mathematics 2270A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "MC-110",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL, CIVIL OR GREEN PROCESS ENGINEERING."
        }
      ],
      "catalog_description": "Topics covered include a review of orthogonal expansions of functions and Fourier series, partial differential equations and Fourier series solutions, boundary value problems, the wave, diffusion and Laplace equations, multiple integration with methods of evaluation in different systems of coordinates, vector fields, line integrals, surface and flux integrals, the Green, Gauss and Stokes theorems with applications.\n\nAntirequisite(s): Calculus 2302A/B, Calculus 2303A/B, Calculus 2502A/B, Calculus 2503A/B, Applied Mathematics 2276A/B, the former Applied Mathematics 2411, the former Applied Mathematics 2413, the former Applied Mathematics 2415.\n\nExtra Information: 3 lecture hours, 1 tutorial hour. Restricted to students in the Faculty of Engineering."
    },
    {
      "catalog_nbr": "2402A",
      "subject": "APPLMATH",
      "className": "ORDINARY DIFF EQUATIONS",
      "course_info": [
        {
          "class_nbr": 3020,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): A minimum mark of 60% in Calculus 1301A/B, or a minimum mark of 55% in Calculus 1501A/B or Applied Mathematics 1413. \n\nPre-or Corequisite(s): Mathematics 1600A/B or the former Linear Algebra 1600A/B.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-3210",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Introduction to first order differential equations, linear second and higher order differential equations with applications, complex numbers including Euler's formula, series solutions, Bessel and Legendre equations, existence and uniqueness, introduction to systems of linear differential equations.\n \nAntirequisite(s): The former Differential Equations 2402A. \n\nExtra Information: 3 lecture hours, 1 laboratory hour."
    },
    {
      "catalog_nbr": "2811B",
      "subject": "APPLMATH",
      "className": "LINEAR ALGEBRA II",
      "course_info": [
        {
          "class_nbr": 1428,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1413 or Calculus 1301A/B or Calculus 1501A/B and a minimum mark of 60% in Mathematics 1600A/B or the former Linear Algebra 1600A/B, or Applied Mathematics 1411A/B.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1240",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Vector space examples. Inner products, orthogonal sets including Legendre polynomials, trigonometric functions, wavelets. Projections, least squares, normal equations, Fourier approximations. Eigenvalue problems, diagonalization, defective matrices. Coupled difference and differential equations; applications such as predator-prey, business competition, coupled oscillators. Singular value decomposition, image approximations. Linear transformations, graphics.\n \nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2814G",
      "subject": "APPLMATH",
      "className": "NUMERICAL ANALYSIS",
      "course_info": [
        {
          "class_nbr": 4150,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): A minimum mark of 55% in Mathematics 1600A/B.\nPre-or Corequisite(s): Calculus 2302A/B, Calculus 2402A/B or Calculus 2502A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "PAB-148",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Introduction to numerical analysis; polynomial interpolation, numerical integration, matrix computations, linear systems, nonlinear equations and optimization, the initial value problem. Assignments using a computer and the software package, Matlab, are an important component of this course. \n\nAntirequisite(s): The former Applied Mathematics 2413. \n\nExtra Information:3 lecture hours, 1 laboratory hour."
    },
    {
      "catalog_nbr": 1030,
      "subject": "ARABIC",
      "className": "ARABIC FOR BEGINNERS",
      "course_info": [
        {
          "class_nbr": 1720,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-61",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH ARABIC 1035 001."
        }
      ],
      "catalog_description": "For students with no previous knowledge of Arabic, this course introduces spoken and written Modern Standard Arabic with emphasis on the development of communicative skills. Prepares students for progression directly to Arabic 2250. \n\nAntirequisite(s): Grade 12U Arabic and Arabic 1035. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": 1035,
      "subject": "ARABIC",
      "className": "BEGINNER ARABIC",
      "course_info": [
        {
          "class_nbr": 4198,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-61",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH ARABIC 1030 001"
        }
      ],
      "catalog_description": "For students with some background in Arabic (heritage speakers), this course develops communicative skills and the ability to use Modern Standard Arabic. Prepares students for progression into Arabic 2250. Students are enrolled on the basis of a placement test.\n\nAntirequisite(s): Grade 12U Arabic and Arabic 1030. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "1070A",
      "subject": "ARABIC",
      "className": "QURANIC ARABIC FOR BEGINNERS",
      "course_info": [
        {
          "class_nbr": 8363,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-A1",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to Quranic Arabic for beginners with no previous knowledge of the Arabic language. Learn the script of the Qur’an, acquire core vocabulary necessary to understand short Quranic chapters, and dive into basic grammar of classical Arabic.\n\nExtra Information: 3 hours.\nNote: Those with any Arabic language background must see Instructor to determine eligibility for course."
    },
    {
      "catalog_nbr": "2080B",
      "subject": "ARABIC",
      "className": "INTERMEDIATE QURANIC ARABIC",
      "course_info": [
        {
          "class_nbr": 11320,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Arabic 1070A/B, or permission of the instructor.",
          "end_time": "6:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-A1",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course builds upon Quranic Arabic for Beginners 1070A/B. The focus is to expand Quranic vocabulary and to acquire a familiarity with more complex grammatical structures through studying Quranic texts. By the end of this course, students will have acquired the key principles of Quranic grammar.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 2250,
      "subject": "ARABIC",
      "className": "INTERMEDIATE ARABIC",
      "course_info": [
        {
          "class_nbr": 2203,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Arabic 1030, Arabic 1035 or Grade 12U Arabic, or permission of the Department.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-59",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is designed to build upon skills in reading and speaking Arabic developed in earlier courses. Students will gain increased vocabulary and a greater understanding of more complex grammatical structures. They will be able to approach prose, fiction, and non-fiction written in the language. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "1642A",
      "subject": "AH",
      "className": "HISTORY OF ART & VISUAL CULTUR",
      "course_info": [
        {
          "class_nbr": 9900,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "MC-110",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 200,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "BLENDED COURSE: IN PERSON LECTURES AND ONLINE TUTORIALS."
        }
      ],
      "catalog_description": "An introductory visual and historical survey with a focus on Western art from the Baroque period to Contemporary times. The course provides a study of painting, sculpture, architecture, and other forms of media through considerations of the cultural environments within which they were produced. Students will gain a working knowledge of terms, methodologies, and themes in art history.\n\nAntirequisite(s): Art History 1640, the former VAH 1040.\n\nExtra Information: 2 lecture hours and 1 tutorial hour, or blended/online format."
    },
    {
      "catalog_nbr": "1648B",
      "subject": "AH",
      "className": "COLLECTING ART AND CULTURE",
      "course_info": [
        {
          "class_nbr": 9893,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "MC-110",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 200,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "BLENDED COURSE: IN PERSON LECTURES AND ONLINE TUTORIALS."
        }
      ],
      "catalog_description": "This introductory course serves as a starting point to study the foundations of art history. It focuses on historical and contemporary practices of collecting art and cultural objects and introduces key principles of museum and curatorial studies.\n\nAntirequisite(s): the former VAH 1045A/B.\n\nExtra Information: 2 lecture hours and 1 tutorial hour, or blended/online format."
    },
    {
      "catalog_nbr": "2600F",
      "subject": "AH",
      "className": "THEORIES & PRAC OF ART HIST",
      "course_info": [
        {
          "class_nbr": 10434,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Registration in years 2 - 4 of a Department of Visual Arts Module, or permission of the department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-114",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YRS 2,3 & 4 IN A DEPARTMENT OF VISUAL ARTS MODULE, OR PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "A brief introduction to historical and contemporary theories, methods, and practices for the study of art history and visual culture. \n\nAntirequisite(s): Studio Art 2600F/G, the former VAH2241F/G.\n\nExtra Information: 3 hours: lecture, blended or online format."
    },
    {
      "catalog_nbr": "2632G",
      "subject": "AH",
      "className": "CANADIAN ART",
      "course_info": [
        {
          "class_nbr": 9903,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): 1.0 from Art History 1640 or two of Art History 1641A/B-1648A/B, or the former VAH 1040 or two of the former VAH 1041A/B–1045A/B, or 1.0 essay course from Arts and Humanities, FIMS, or Social Science, or permission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-117",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 200,
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "An introduction to the visual arts of Canada in the 20th century, including First Nations and Inuit art, cultural policy, and collecting and curatorial practices in Canada. Key movements in Canadian art are discussed in relation to the social and political context.\n\nAntirequisite(s): the former VAH 2272F/G, the former VAH 2276E.\n\nExtra Information: 3 hours: lecture, blended or online format."
    },
    {
      "catalog_nbr": "2636F",
      "subject": "AH",
      "className": "BAROQUE IN EUROPE & IBERIAN",
      "course_info": [
        {
          "class_nbr": 10435,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): 1.0 from Art History 1640 or two of Art History 1641A/B-1648A/B, or the former VAH 1040 or two of the former VAH 1041A/B–1045A/B, or Medieval Studies 1022, Medieval Studies 1025A/B or Medieval Studies 1026A/B, or 1.0 essay course from Arts and Humanities, FIMS, or Social Science, or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-117",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A survey of Baroque and Iberian colonial-era art and architecture. Lectures will consider cultural connections between the Spanish and Portuguese Baroque styles and the colonial exchanges linking Europe, the Americas, Asia and other continental connections.\n\nAntirequisite(s): the former VAH 2260E, the former VAH 2262F/G, or the former VAH 2263F/G.\n\nExtra Information: 3 hours: lecture, blended or online format."
    },
    {
      "catalog_nbr": "2676F",
      "subject": "AH",
      "className": "INTRODUCTION TO DESIGN",
      "course_info": [
        {
          "class_nbr": 11271,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 1.0 from Art History 1640 or two of Art History 1641A/B-1648A/B, or the former VAH 1040 or two of the former VAH 1041A/B–1045A/B, or 1.0 essay course from Arts and Humanities, FIMS, or Social Science, or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "MC-105B",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines the history and practice of modern design from the end of the 19th century to the present day. It outlines some of the fundamental principles of design, as well as looking at its political and sociocultural impact.\n\nExtra Information: 3 hours: lecture, blended or online format."
    },
    {
      "catalog_nbr": "3660G",
      "subject": "AH",
      "className": "HOLLYWOOD AND ART",
      "course_info": [
        {
          "class_nbr": 10438,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 1.0 from Art History 1640 or two of Art History 1641A/B-1648A/B, or the former VAH 1040 or two of the former VAH 1041A/B–1045A/B, or 1.0 essay course from Arts and Humanities, FIMS, or Social Science, or permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-58",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course explores the relationship between film and the visual arts, from the invention of cinema to contemporary visual artists who have made Hollywood film the subject of their work. \n\nExtra Information: 3 hours: lecture, blended, or online format."
    },
    {
      "catalog_nbr": "3694F",
      "subject": "AH",
      "className": "SPECIAL TOPICS IN ART HISTORY",
      "course_info": [
        {
          "class_nbr": 10440,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Visual Art Module or Permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-249",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH ARTHUM 3393F. TOPIC: THE LIVING ARCHIVE: ARTIST AS WITNESS."
        }
      ],
      "catalog_description": "Please consult Department for current offerings.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "4640G",
      "subject": "AH",
      "className": "SEMINAR IN MODERN/CONTEMPORARY",
      "course_info": [
        {
          "class_nbr": 9908,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Registration in years 3 or 4 of a Department of Visual Arts Module, or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "VAC-247",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO STUDENTS IN YRS 3&4 OF A MODULE IN ART HISTORY, OR PERMISSION OF THE DEPARTMENT. TOPIC: ARTISTIC MOMENTS AT THE CENTER OF THE VOID: MILAN, JANUARY 2, 1957."
        }
      ],
      "catalog_description": "Please consult Department for current offerings.\n\nExtra Information: 3 hours: seminar, workshop, blended or online format."
    },
    {
      "catalog_nbr": "4650G",
      "subject": "AH",
      "className": "SEMINAR IN PHOTOGRAPHY",
      "course_info": [
        {
          "class_nbr": 10441,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Registration in years 3 or 4 of a Department of Visual Arts Module, or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-247",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO STUDENTS IN YRS 3&4 OF A MODULE IN ART HISTORY, OR PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "Please consult Department for current offerings.\n\nExtra Information: 3 hours: seminar, workshop, blended or online format."
    },
    {
      "catalog_nbr": "4660F",
      "subject": "AH",
      "className": "SEMINAR IN FILM, MOVING IMAGE",
      "course_info": [
        {
          "class_nbr": 9907,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Registration in years 3 or 4 of a Department of Visual Arts Module, or permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-247",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO STUDENTS IN YRS 3&4 OF A MODULE IN ART HISTORY, OR PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "Please consult Department for current offerings.\n\nExtra Information: 3 hours: seminar, workshop, blended or online format."
    },
    {
      "catalog_nbr": "4682A",
      "subject": "AH",
      "className": "INTERNSHIP IN ART HISTORY",
      "course_info": [
        {
          "class_nbr": 11610,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Third or fourth-year honours students with a departmental average of at least 75% have the opportunity for experiential learning in the field of Art History. Students work closely with a professor and the Undergraduate Chair on a visual cultural project at a gallery, museum, or other location in London's region."
    },
    {
      "catalog_nbr": "4682B",
      "subject": "AH",
      "className": "INTERNSHIP IN ART HISTORY",
      "course_info": [
        {
          "class_nbr": 11611,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Third or fourth-year honours students with a departmental average of at least 75% have the opportunity for experiential learning in the field of Art History. Students work closely with a professor and the Undergraduate Chair on a visual cultural project at a gallery, museum, or other location in London's region."
    },
    {
      "catalog_nbr": "4696F",
      "subject": "AH",
      "className": "INDEPENDENT PROJ IN ART HIST",
      "course_info": [
        {
          "class_nbr": 11580,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "A fourth-year student with a cumulative grade average in the Department of at least 80% may apply for an independent study as one of the half-year courses chosen from the 4000 series. The student must obtain the Undergraduate Chair’s and the supervising professor’s approval before being allowed to register. Students must provide a detailed plan of study as part of the application process."
    },
    {
      "catalog_nbr": 1021,
      "subject": "ASTRONOM",
      "className": "GENERAL ASTRONOMY",
      "course_info": [
        {
          "class_nbr": 1245,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A general survey of astronomy including: the solar system and its constituents; stars, their basic properties and evolution; systems of stars including clusters, the milky way and other galaxies; the universe, its past, present and future structure; astronomical instruments; topics of current interest including pulsars, quasars, black holes.\n\nAntirequisite(s): Astronomy 1011A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2020F",
      "subject": "ASTRONOM",
      "className": "TWO-EYED SEEING AND ASTRONOMY",
      "course_info": [
        {
          "class_nbr": 11337,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B02",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PERMISSION OF DEPARTMENT REQUIRED. 15 SPACES ARE RESERVED FOR STUDENTS REGISTERED IN THE FIRST NATIONS STUDIES PROGRAM. COURSE OUTLINE WILL BE AVAILABLE IN SEPTEMBER."
        }
      ],
      "catalog_description": "An introduction to the intersection between Indigenous and Western astronomy, particularly as it relates to naked-eye observations of the night sky; using astronomy as a gateway to learn more about Indigenous culture, history, and the process of decolonization and reconciliation.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2021A",
      "subject": "ASTRONOM",
      "className": "SEARCH FOR LIFE IN THE UNIVERS",
      "course_info": [
        {
          "class_nbr": 4141,
          "start_time": "6:30 PM",
          "descrlong": "",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "NOT AVAILABLE TO STUDENTS REGISTERED IN THE FACULTY OF SCIENCE EXCEPT THOSE REGISTERED IN ANY ENVIRONMENTAL SCIENCE MODULE, MINOR IN CONCEPTUAL ASTRONOMY, OR MINOR IN PLANETARY SCIENCE AND SPACE EXPLORATION."
        }
      ],
      "catalog_description": "This course is designed for non-science students as an introduction to current scientific thinking on the possibility of extraterrestrial life and intelligence. Ideas, observations, and experiments from the frontiers of many areas of science converge in this unique interdisciplinary field. Emphasis will be on topics of current interest, including searches for life in our Solar System, detection of extrasolar planets, and the origins of life on Earth.\n\nAntirequisite(s): Physics 1028A/B, Physics 1301A/B, Physics 1401A/B, Physics 1501A/B or the former Physics 1020, the former Physics 1024, the former Physics 1026. \n\nExtra Information: 3 lecture hours. May not be taken for credit by students in the Faculty of Science."
    },
    {
      "catalog_nbr": "2022B",
      "subject": "ASTRONOM",
      "className": "THE ORIGIN OF THE UNIVERSE",
      "course_info": [
        {
          "class_nbr": 3441,
          "start_time": "4:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "WSC-55",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "MAY NOT BE TAKEN FOR CREDIT BY STUDENTS IN THE FACULTY OF SCIENCE."
        }
      ],
      "catalog_description": "This course is designed for non-science students as an introduction to current ideas about the universe. Topics include the Big Bang, cosmic microwave background, origin of elements, and origin of galaxies, stars, and planetary systems.\n\nAntirequisite(s): Earth Sciences 1086F/G, Physics 1028A/B, Physics 1301A/B, Physics 1401A/B, Physics 1501A/B or the former Physics 1020, the former Physics 1024, the former Physics 1026.\n\nExtra Information: 2 lecture hours. May not be taken for credit by students in the Faculty of Science."
    },
    {
      "catalog_nbr": "2201B",
      "subject": "ASTRONOM",
      "className": "PLANETARY SYSTEMS",
      "course_info": [
        {
          "class_nbr": 10045,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): (Physics 1028A/B or Physics 1301A/B or Physics 1401A/B or Physics 1501A/B) and (Physics 1029A/B or Physics 1302A/B or Physics 1402A/B or Physics 1502A/B); Calculus 1000A/B or Calculus 1500A/B, and Calculus 1501A/B (or Calculus 1301A/B with a minimum mark of 85%). Integrated Science 1001X with a minimum mark of 60% can be used in place of Physics 1302A/B and Calculus 1301A/B.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "PAB-148",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of planets and their environments, both in our own Solar System and in planetary systems around other stars. Celestial mechanics; dynamics of the Earth; the Earth-Moon System; planets, including atmospheres and interiors; satellites; comets; meteors; the interplanetary medium; detection, origin and evolution of planetary systems.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2801A",
      "subject": "ASTRONOM",
      "className": "OBSERVING THE STARS",
      "course_info": [
        {
          "class_nbr": 10042,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): (Physics 1028A/B or Physics 1301A/B or Physics 1401A/B or Physics 1501A/B) and (Physics 1029A/B or Physics 1302A/B or Physics 1402A/B or Physics 1502A/B); Calculus 1000A/B or Calculus 1500A/B, and Calculus 1501A/B (or Calculus 1301A/B with a minimum mark of 85%). Integrated Science 1001X with a minimum mark of 60% can be used in place of Physics 1302A/B and Calculus 1301A/B.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "PAB-148",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "The properties of stars, the building blocks of the universe, and how we obtain their characteristics. The night sky, coordinates, detectors, telescopes, stellar magnitudes and fluxes, spectra, interaction of light and matter, Hertzsprung-Russell diagram, stellar evolution, and the Sun. Introduction to astrophysics, order of magnitude estimates, astronomical nomenclature and observations.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "3302A",
      "subject": "ASTRONOM",
      "className": "ASTROPHYSICS INTRSTLLR SPACE",
      "course_info": [
        {
          "class_nbr": 11146,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Physics 2101A/B, Physics 2102A/B.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "PAB-106",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "The physics of interstellar space - the gas, dust, electromagnetic radiation, cosmic rays, and magnetic fields - present between the stars in a galaxy and between galaxies. Star formation, the interaction of light and matter, and the physical processes that determine the properties, dynamics, and behavior of the interstellar medium.\n\nExtra Information: 3 lecture/tutorial hours. Typically offered in alternate years only."
    },
    {
      "catalog_nbr": "4602B",
      "subject": "ASTRONOM",
      "className": "GRAVITATNL ASTROPHYS & COSMLGY",
      "course_info": [
        {
          "class_nbr": 10044,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Physics 2101A/B and Physics 2102A/B, or the former Physics 2128A/B and the former Physics 2129A/B; Calculus 2503A/B.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Introduction to gravity in astrophysics. Application of Newtonian gravitation to basic galactic dynamics and galactic structure. An introduction to general relativity with applications to black holes, cosmology, and the early universe.\n\nExtra Information: 3 lecture hours. Typically offered in alternate years only."
    },
    {
      "catalog_nbr": "5110A",
      "subject": "BIBLSTUD",
      "className": "INTRO TO BIBLE AS SCRIPTURE",
      "course_info": [
        {
          "class_nbr": 8122,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W2",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5116B",
      "subject": "BIBLSTUD",
      "className": "THE NEW TESTAMENT WRITINGS",
      "course_info": [
        {
          "class_nbr": 8121,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite: the former Biblical Studies 5103A/B or Biblical Studies 5110A/B",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W17",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5120B",
      "subject": "BIBLSTUD",
      "className": "INTRO TO THE HEBREW BIBLE",
      "course_info": [
        {
          "class_nbr": 8195,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W106",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5220B",
      "subject": "BIBLSTUD",
      "className": "NEW TESTAMENT THEOLOGY",
      "course_info": [
        {
          "class_nbr": 10510,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite: the former Biblical Studies 5103A and the former Biblical Studies 5106B; or Biblical Studies 5110A/B and 5116A/B",
          "end_time": "1:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W4",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "5236B",
      "subject": "BIBLSTUD",
      "className": "OLD TESTAMENT THEOLOGY",
      "course_info": [
        {
          "class_nbr": 10511,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisites: the former Biblical Studies 5104B and the former Biblical Studies 5222A; or Biblical Studies 5112A/B and Biblical Studies 5114A/B",
          "end_time": "4:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W108",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "3201A",
      "subject": "BME",
      "className": "FUNDAMENTALS OF BME DESIGN",
      "course_info": [
        {
          "class_nbr": 10210,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Completion of the first-year curriculum in the Faculty of Engineering with a year-weighted average of at least 80%.",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1450",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PERMISSION OF DEPARTMENT REQUIRED."
        }
      ],
      "catalog_description": "The objective of this course is to develop design skills and tools used in Biomedical Engineering. Integration of the engineering and life sciences will be illustrated by presenting design principles for medical devices and systems. Emphasis will be placed on engineering design for the cardiovascular and musculoskeletal systems.\n\nAntirequisite(s): MME 4470A/B.\n\nExtra Information: 3 lecture hours, 2 tutorial hours.\nRestricted to students registered in a Biomedical Engineering degree program."
    },
    {
      "catalog_nbr": "3100A",
      "subject": "BIOSTATS",
      "className": "BIOSTATISTICAL METHODS",
      "course_info": [
        {
          "class_nbr": 1059,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Biology 2244A/B or Statistical Sciences 2244A/B, and Epidemiology 2200A/B, with a minimum mark of 75% in each.\nPre-or Corequisite(s): Epidemiology 3200A.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "KB-K203",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY INFORMATION IS ON BMSc WEBSITE: http://www.schulich.uwo.ca/bmsc/academic_resources/courses/access_to_courses.html"
        }
      ],
      "catalog_description": "Epidemiologists work with categorical data (e.g. healthy, sick, dead) and with time to event data (e.g. time to death). This course introduces analytic methods of such data, expanding on aspects of study design and analysis introduced in Epidemiology 2200A/B. It requires a prior introduction to analyses of continuous data.\r\n\r\nExtra Information: 2 lecture hours and 1 laboratory hour."
    },
    {
      "catalog_nbr": "3110B",
      "subject": "BIOSTATS",
      "className": "MULTIVARIABLE METHODS",
      "course_info": [
        {
          "class_nbr": 3989,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Biostatistics 3100A and Epidemiology 3200A, with a minimum mark of 70% in each.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "MSB-190",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course covers frequently used multivariable regression models (linear for continuous outcomes and logistic for binary outcomes) in health research. By the end of the course students will (i) understand and critique applications of regression models appearing in the biomedical literature and (ii) carry out their own analyses.\r\n\r\nExtra Information: 2 lecture hours and 1 laboratory hour."
    },
    {
      "catalog_nbr": "1220E",
      "subject": "BUSINESS",
      "className": "INTRODUCTION TO BUSINESS",
      "course_info": [
        {
          "class_nbr": 1213,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "SH-2316",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "AN INTRODUCTORY TO BUSINESS FUNDAMENTALS, OVERVIEW OF IVEY’S CASE TEACHING METHOD AND THE IVEY HBA BUSINESS PROGRAM."
        }
      ],
      "catalog_description": "Business Administration 1220E, offered by the Ivey Business School, gives students from all faculties the opportunity to learn business fundamentals in finance, marketing, operations, organizational behavior and general management. The course is delivered using Ivey's renowned case method, which challenges students to learn by doing, within an active class environment of no more than 85 students. Students explore real business issues, make management decisions, defend their position, and take action. This course will be particularly appealing to those students who want a glimpse of Ivey's unique learning experience.\n \nAntirequisite(s): Business Administration 1299E, Business Administration 2295F/G, Business Administration 2299E, the former Business Administration 1220, the former Business Administration 2299. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1299E",
      "subject": "BUSINESS",
      "className": "BUSINESS FOR ENGINEERS",
      "course_info": [
        {
          "class_nbr": 5333,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SH-3317",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 1 ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Students learn business fundamentals in finance, marketing, engineering economics, organizational behaviour and general management. Students are taught business decisionmaking using the case method, wherein students explore real business issues, make management decisions, defend their position, and take action, within an active class environment of no more than 85 students.\n\nAntirequisite(s): Business Administration 1220E or the former Business Administration 1220, Business Administration 2295F/G, Business Administration 2299E or the former Business Administration 2299.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 2257,
      "subject": "BUSINESS",
      "className": "ACCOUNTING & BUSINESS ANA",
      "course_info": [
        {
          "class_nbr": 1221,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Five courses at University level.",
          "end_time": "11:00 AM",
          "campus": "Main",
          "facility_ID": "SH-2316",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "MUST HAVE 5 CREDITS TO REGISTER IN THIS COURSE. LIMITED TO MAIN CAMPUS STUDENTS ONLY."
        }
      ],
      "catalog_description": "Prerequisite for entry to Honours Business Administration. Course Divisions: (1) Financial Accounting - development of financial statements, and the assessment of their uses and limitations. (2) Business Analysis and Management Accounting - using case studies with an emphasis on smaller businesses, students learn various quantitative decision-making tools highlighted by an entrepreneurial feasibility study. \n \nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1000A",
      "subject": "CALCULUS",
      "className": "CALCULUS I",
      "course_info": [
        {
          "class_nbr": 3370,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Ontario Secondary School MCV4U or Mathematics 0110A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "UCC-146",
          "days": [
            "M",
            "Tu",
            "W",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Review of limits and derivatives of exponential, logarithmic and rational functions. Trigonometric functions and their inverses. The derivatives of the trig functions and their inverses. L'Hospital's rules. The definite integral. Fundamental theorem of Calculus. Simple substitution. Applications including areas of regions and volumes of solids of revolution.\n\nAntirequisite(s): Calculus 1500A/B, the former Calculus 1100A/B, Applied Mathematics 1413.\n\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "1000B",
      "subject": "CALCULUS",
      "className": "CALCULUS I",
      "course_info": [
        {
          "class_nbr": 1071,
          "start_time": "7:00 PM",
          "descrlong": "Prerequisite(s): Ontario Secondary School MCV4U or Mathematics 0110A/B.",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "SEB-1059",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Review of limits and derivatives of exponential, logarithmic and rational functions. Trigonometric functions and their inverses. The derivatives of the trig functions and their inverses. L'Hospital's rules. The definite integral. Fundamental theorem of Calculus. Simple substitution. Applications including areas of regions and volumes of solids of revolution.\n\nAntirequisite(s): Calculus 1500A/B, the former Calculus 1100A/B, Applied Mathematics 1413.\n\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "1301A",
      "subject": "CALCULUS",
      "className": "CALCULUS II",
      "course_info": [
        {
          "class_nbr": 10122,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): A final mark of at least 55% in either Calculus 1000A/B or Calculus 1500A/B.",
          "end_time": "3:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-SA150",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "For students requiring the equivalent of a full course in calculus at a less rigorous level than Calculus 1501A/B. Integration by parts, partial fractions, integral tables, geometric series, harmonic series, Taylor series with applications, arc length of parametric and polar curves, first order linear and separable differential equations with applications.\r\n\r\nAntirequisite(s): Calculus 1501A/B, Applied Mathematics 1413. \r\n\r\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "1301B",
      "subject": "CALCULUS",
      "className": "CALCULUS II",
      "course_info": [
        {
          "class_nbr": 1073,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): A minimum mark of 55% in one of Calculus 1000A/B, Calculus 1500A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-146",
          "days": [
            "M",
            "Tu",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "REQUIRES FINAL MARK OF AT LEAST 55% IN CALC 1000A/B OR 1100A/B."
        }
      ],
      "catalog_description": "For students requiring the equivalent of a full course in calculus at a less rigorous level than Calculus 1501A/B. Integration by parts, partial fractions, integral tables, geometric series, harmonic series, Taylor series with applications, arc length of parametric and polar curves, first order linear and separable differential equations with applications.\r\n\r\nAntirequisite(s): Calculus 1501A/B, Applied Mathematics 1413. \r\n\r\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "1500A",
      "subject": "CALCULUS",
      "className": "CALCULUS I FOR MATH SCIENCES",
      "course_info": [
        {
          "class_nbr": 3308,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Ontario Secondary School MCV4U or Mathematics 0110A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "B&GS-0165",
          "days": [
            "M",
            "Tu",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An enriched version of Calculus 1000A/B. Basic set theory and an introduction to mathematical rigour. The precise definition of limit. Derivatives of exponential, logarithmic, rational trigonometric functions. L'Hospital's rule. The definite integral. Fundamental theorem of Calculus. Integration by substitution. Applications.\n\nAntirequisite(s): Calculus 1000A/B, Applied Mathematics 1413. \n\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "1501B",
      "subject": "CALCULUS",
      "className": "CALCULUS II",
      "course_info": [
        {
          "class_nbr": 1072,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): A minimum mark of 60% in one of Calculus 1000A/B, Calculus 1500A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "SH-3345",
          "days": [
            "M",
            "Tu",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "REQUIRES FINAL MARK OF AT LEAST 60% IN CALC 1000A/B OR 1100A/B."
        }
      ],
      "catalog_description": "Students who intend to pursue a degree in Actuarial Science, Applied Mathematics, Astronomy, Mathematics, Physics, or Statistics should take this course. Techniques of integration; The Mean Value Theorem and its consequences; series, Taylor series with applications; parametric and polar curves with applications; first order linear and separable differential equations with applications.\r\n\r\nAntirequisite(s): Calculus 1301A/B, Applied Mathematics 1413. \r\n\r\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "2302A",
      "subject": "CALCULUS",
      "className": "INTERMEDIATE CALCULUS I",
      "course_info": [
        {
          "class_nbr": 1078,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): A minimum mark of 55% in Calculus 1501A/B or Calculus 1301A/B, or Applied Mathematics 1413.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-2B04",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Three dimensional analytic geometry: dot and cross product; equations for lines and planes; quadric surfaces; vector functions and space curves; arc length; curvature; velocity; acceleration. Differential calculus of functions of several variables: level curves and surfaces; limits; continuity; partial derivatives; tangent planes; differentials; chain rule; implicit functions; extrema; Lagrange multipliers.\n\nAntirequisite(s): Calculus 2502A/B. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2303B",
      "subject": "CALCULUS",
      "className": "INTERMEDIATE CALCULUS II",
      "course_info": [
        {
          "class_nbr": 1079,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Calculus 2502A/B or Calculus 2302A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2028",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Integral calculus of functions of several variables: double, triple and iterated integrals; applications; surface area. Vector integral calculus: vector fields; line integrals in the plane; Green's theorem; independence of path; simply connected and multiply connected domains; parametric surfaces and their areas; divergence and Stokes' theorem.\n\nAntirequisite(s): Calculus 2503A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2402A",
      "subject": "CALCULUS",
      "className": "CALCULUS W/ ANALYSIS FOR STATS",
      "course_info": [
        {
          "class_nbr": 2692,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Calculus 1301A/B or Calculus 1501A/B or Applied Mathematics 1413, in each case with a minimum mark of 55%.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "SH-3345",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Functions of multiple variables and their differential calculus. The gradient and the Hessian. Constrained and unconstrained optimization of scalar-valued functions of many variables: Lagrange multipliers. Multidimensional Taylor series. Integrating scalar-valued functions of several variables: Jacobian transformations. Pointwise and uniform convergence. Power series.\r\n\r\nAntirequisite(s): Calculus 2302A/B, Calculus 2502A/B. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2502A",
      "subject": "CALCULUS",
      "className": "ADVANCED CALCULUS I",
      "course_info": [
        {
          "class_nbr": 1076,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): A minimum mark of 60% in Calculus 1501A/B or Applied Mathematics 1413, or Calculus 1301A/B with a mark of at least 85%.\nPre-or Corequisite(s): Mathematics 1600A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3022",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Differential calculus of functions of several variables: level curves and surfaces; limits; continuity; partial derivatives; total differentials; Jacobian matrix; chain rule; implicit functions; inverse functions; curvilinear coordinates; derivatives; the Laplacian; Taylor Series; extrema; Lagrange multipliers; vector and scalar fields; divergence and curl.\r\n\r\nAntirequisite(s): Calculus 2302A/B. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2503B",
      "subject": "CALCULUS",
      "className": "ADVANCED CALCULUS II",
      "course_info": [
        {
          "class_nbr": 1077,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): A minimum mark of 60% in Calculus 2502A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "HELD M 1:30-2:30 IN SSC 2028 & WF 1:30-2:30 IN SSC 2024."
        }
      ],
      "catalog_description": "Integral calculus of functions of several variables: multiple integrals; Leibnitz' rule; arc length; surface area; Green's theorem; independence of path; simply connected and multiply connected domains; three dimensional theory and applications; divergence theorem; Stokes' theorem.\n\nAntirequisite(s): Calculus 2303A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1021F",
      "subject": "CGS",
      "className": "INTRO TO GLOBAL CULTURE",
      "course_info": [
        {
          "class_nbr": 8217,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V210",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course explores how studies of our world are shaped by practices of and cultural contestations in mapping, narration, definition, classification, and aesthetic production, informed by historical experiences and politics of knowing. Students learn to gain critical perspectives on contemporary ideas of the world and their own locations in it.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1021G",
      "subject": "CGS",
      "className": "INTRO TO GLOBAL CULTURE",
      "course_info": [
        {
          "class_nbr": 8372,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V208",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course explores how studies of our world are shaped by practices of and cultural contestations in mapping, narration, definition, classification, and aesthetic production, informed by historical experiences and politics of knowing. Students learn to gain critical perspectives on contemporary ideas of the world and their own locations in it.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1022F",
      "subject": "CGS",
      "className": "INTRODUCTION TO GLOBALIZATION",
      "course_info": [
        {
          "class_nbr": 8204,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V208",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course offers an interdisciplinary introduction to the dominant material and cultural trends under the conditions of economic globalization. Key topics are labour in the global economy, the globalization of the capitalist mode of production, transnational resource flows, responses to inequality and resistance. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1022G",
      "subject": "CGS",
      "className": "INTRODUCTION TO GLOBALIZATION",
      "course_info": [
        {
          "class_nbr": 8083,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V208",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course offers an interdisciplinary introduction to the dominant material and cultural trends under the conditions of economic globalization. Key topics are labour in the global economy, the globalization of the capitalist mode of production, transnational resource flows, responses to inequality and resistance. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1023F",
      "subject": "CGS",
      "className": "INTRO TO GLOBAL DEVELOPMENT",
      "course_info": [
        {
          "class_nbr": 8084,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V210",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH CGS 2001F."
        }
      ],
      "catalog_description": "This course is an introduction to the interdisciplinary field of international development studies with the focus on investigating the notion of 'poverty'. It will examine the roles of development organizations, states and civil society in addressing globally identified development issues through the negotiation of global development agendas.\n \nAntirequisite(s): Centre for Global Studies 2001F/G. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1023G",
      "subject": "CGS",
      "className": "INTRO TO GLOBAL DEVELOPMENT",
      "course_info": [
        {
          "class_nbr": 8095,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V210",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is an introduction to the interdisciplinary field of international development studies with the focus on investigating the notion of 'poverty'. It will examine the roles of development organizations, states and civil society in addressing globally identified development issues through the negotiation of global development agendas.\n \nAntirequisite(s): Centre for Global Studies 2001F/G. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2002F",
      "subject": "CGS",
      "className": "PROBLEMS OF GLOBAL DEVELOPMENT",
      "course_info": [
        {
          "class_nbr": 8140,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Centre for Global Studies 1023F/G or Centre for Global Studies 2001F/G, or permission of the Centre for Global Studies.",
          "end_time": "1:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V208",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN A CGS MODULE. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "This course provides a comparative and theoretical examination of societies and cultures undergoing significant change and of the complex global relations between developing and industrialized areas. It offers an interdisciplinary perspective on such issues as economic development, development indicators, gender, foreign policy, development aid, participatory development and post-development.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2003F",
      "subject": "CGS",
      "className": "DISCOURSES OF GLOBAL STUDIES",
      "course_info": [
        {
          "class_nbr": 9293,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-A1",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN A CGS MODULE. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "This course investigates how methods and objects of inquiry in global studies are formed in the limiting and productive interplay of ideas, language, and social/political force. Students examine how our studies of global problems are made possible in systems of communication that render us responsible for their formation and address.\n \nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2004G",
      "subject": "CGS",
      "className": "CRITIQUE OF CAPITALISM",
      "course_info": [
        {
          "class_nbr": 8100,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V210",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN A CGS MODULE. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "This course explores the socio-economic form of 'capitalism', and examines the development and spread of the key features of capitalist social organization - the division of labour, private property, primitive accumulation - and examines their functioning in a rapidly globalizing world. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3001F",
      "subject": "CGS",
      "className": "COLLABORATIVE & PARTICIPATORY",
      "course_info": [
        {
          "class_nbr": 8052,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 0.5 course from Centre for Global Studies 2002F/G - 2004F/G, or permission of the Centre for Global Studies.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W18",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN CGS."
        }
      ],
      "catalog_description": "This course examines the work of formulating and collaborating in community-based projects. Students learn to recognize and respond to ethical, socio-political, institutional and epistemological dimensions of collaboration, participation and research practice in contexts characterized by forms of inequality. Students prepare a research proposal, funding application and ethics review.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3001G",
      "subject": "CGS",
      "className": "COLLABORATIVE & PARTICIPATORY",
      "course_info": [
        {
          "class_nbr": 8112,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 0.5 course from Centre for Global Studies 2002F/G - 2004F/G, or permission of the Centre for Global Studies.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V207",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines the work of formulating and collaborating in community-based projects. Students learn to recognize and respond to ethical, socio-political, institutional and epistemological dimensions of collaboration, participation and research practice in contexts characterized by forms of inequality. Students prepare a research proposal, funding application and ethics review.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3005G",
      "subject": "CGS",
      "className": "THEORISING SUBJECTIVITY&POWER",
      "course_info": [
        {
          "class_nbr": 9294,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): 0.5 course from Centre for Global Studies 2002F/G - 2004F/G, or permission of the Centre for Global Studies.",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course surveys and investigates recent and contemporary efforts to critically understand human subjectivity and agency in the power relations in which these things are realised. Students will examine theories and analyses of subjectivity and subjectification in terms of material conditions, language and symbolic economies, ideology, bodies, difference, and domination.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3006F",
      "subject": "CGS",
      "className": "CRTCL & ANTI-OPPRESSIVE METHOD",
      "course_info": [
        {
          "class_nbr": 8194,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 0.5 course from Centre for Global Studies 2002F/G - 2004F/G, or permission of the Centre for Global Studies.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W18",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course addresses collective and community approaches to knowledge production in the service of protecting and promoting cultural, political, and territorial integrity and self-determination. Students learn to engage with empirical research based on emancipatory goals and are introduced to how notions of antioppression, `cosmovision', and interculturalism are mobilized in research.\n\nAntirequisite(s): the former Centre for Global Studies 3002A/B.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3202G",
      "subject": "CGS",
      "className": "SEMINAR IN GLOBAL STUDIES",
      "course_info": [
        {
          "class_nbr": 9295,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 0.5 course from Centre for Global Studies 2002F/G, Centre for Global Studies 2003F/G, Centre for Global Studies 2004F/G, or permission of the Centre for Global Studies.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V208",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "REGISTRATION BY PERMISSION OF INSTRUCTOR. TOPIC: FEMINIST AND ANTI-RACIST WORK FROM ACADEMY TO COMMUNITY"
        }
      ],
      "catalog_description": "Organized around participation in colloquia, workshops, and presentations with community– based organizations, movements, and professionals, this course gives students opportunities to deepen understandings and insights into community–driven learning and scholarship around problems at stake in Centre for Global Studies academic programming. Consult with the Centre for this year's topic."
    },
    {
      "catalog_nbr": "3203F",
      "subject": "CGS",
      "className": "GLOBAL STUDIES PARTICIPATORY",
      "course_info": [
        {
          "class_nbr": 11681,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Centre for Global Studies.",
          "end_time": "",
          "campus": "Huron",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Students will participate for at least one month with community based or non-governmental organisations on projects pertaining to problems concerning Global Studies, emphasizing the cultivation of critical and practical insights into these problems. Students will engage in pre-departure preparation and post-return critical reflection, completing major academic assignments at both stages."
    },
    {
      "catalog_nbr": "3203G",
      "subject": "CGS",
      "className": "GLOBAL STUDIES PARTICIPATORY",
      "course_info": [
        {
          "class_nbr": 8208,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Permission of the Centre for Global Studies.",
          "end_time": "9:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W2",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "REGISTRATION BY PERMISSION OF INSTRUCTOR."
        }
      ],
      "catalog_description": "Students will participate for at least one month with community based or non-governmental organisations on projects pertaining to problems concerning Global Studies, emphasizing the cultivation of critical and practical insights into these problems. Students will engage in pre-departure preparation and post-return critical reflection, completing major academic assignments at both stages."
    },
    {
      "catalog_nbr": "3509F",
      "subject": "CGS",
      "className": "INDIGENOUS PPL & GLBL DISPOSS",
      "course_info": [
        {
          "class_nbr": 9296,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W18",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of the impact of global capitalism and neo-colonialism on territories Indigenous Peoples use and claim. The course examines strategies to secure land-based community autonomy against global dispossession. The question of the coexistence of dominant practices of global development with Indigenous ways of knowing is addressed.\n \nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3513F",
      "subject": "CGS",
      "className": "NON-HEGEMONIC ECON FORMS",
      "course_info": [
        {
          "class_nbr": 9297,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W18",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of the function and socio-political outcomes of informal, subsistence, land-based and other allied economies in the context of global capitalism. Themes include the production of communitybased\neconomic autonomy, localization, place-making and alternative economic development.\n \nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3514G",
      "subject": "CGS",
      "className": "GLOBAL RESISTANCE MOVEMENTS",
      "course_info": [
        {
          "class_nbr": 9298,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W18",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of the political, social and cultural foundations of resistance movements that claim a transnational, global or international scale. Cases may include: anti-globalization, environmentalism, indigenous people's rights, women's rights, human rights, Fair Trade, and alternative trade organizations.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3515F",
      "subject": "CGS",
      "className": "GLOBAL CULTURES OF GENDERING",
      "course_info": [
        {
          "class_nbr": 9299,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W108",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines how material and social orders of our world are organised in practices of gendering and the normalising of social and bodily orientations. Students will engage contemporary feminist and queer theory, practical deployments of gender and orientation globally, and problems of resistance pertinent to the politics of both.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3516F",
      "subject": "CGS",
      "className": "ECONOMIES OF DEVELOPMENT",
      "course_info": [
        {
          "class_nbr": 8183,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W101",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines alternative tools for assessing development, such as development indicators and indices (GNP/GDP, Human Development/Poverty Indices, Physical Quality of Life Index, Gender Empowerment Measure), community-based indicators, and explanations of economic development in micro and macro contexts.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3517G",
      "subject": "CGS",
      "className": "DECOLONIALITY",
      "course_info": [
        {
          "class_nbr": 9306,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W18",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course explores decoloniality as a practical and analytical orientation to confrontations with the entrenched injustices identified with coloniality. The course considers decoloniality through characteristic projects, practices \nand globalized movements to decolonize knowledge, livelihoods, politics and community. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3519F",
      "subject": "CGS",
      "className": "GLBL INEQUAL BASED SEXUAL DIFF",
      "course_info": [
        {
          "class_nbr": 10974,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "9:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W18",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines core ways in which persons and populations are situated in positions of inequality under globalization and development contexts on bases of sexual difference and differences in sexuality. Students will study the significance of these differences and will gain practice in research methods appropriate to such a focus.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3520G",
      "subject": "CGS",
      "className": "OVERCOMING MGMT PARADIGMS",
      "course_info": [
        {
          "class_nbr": 8205,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "9:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V207",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course critically examines how practices of Global Development are typically reduced to problems of management and how such paradigms are problematic and incompetent with respect to the global inequalities that provoke development as a question. Students will explore alternative approaches, seeking greater practical address of responsibilities in development work.\n\nAntirequisite(s): the former Centre for Global Studies 3004A/B.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3522F",
      "subject": "CGS",
      "className": "GLOBAL MOBILITIES",
      "course_info": [
        {
          "class_nbr": 9301,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-V208",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines how we may analyse human life, globally, as in movement and as different forms of mobilities, and how it is that social, political, economic, legal, and cultural orders in the world are conditioned, at fundamental levels, by efforts to manage, shape, objectify, and discipline movement.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3523G",
      "subject": "CGS",
      "className": "LAW GLBL RLTNS & LANG OF PWR",
      "course_info": [
        {
          "class_nbr": 9302,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W18",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines struggles to define subjects of law and establish just rules of behaviour between them within global contexts. Students will examine and critically evaluate often conflicting efforts of movements, actors, institutions, and social groups to make lawful specific ideals or, alternatively, to delegitimise the world views of others. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3526G",
      "subject": "CGS",
      "className": "CHALLENGING RGMS GLB CITIZENS",
      "course_info": [
        {
          "class_nbr": 9303,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-V207",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Examines how practices to promote global citizenship and internationalize learning respond to relations of power. Focus is given to pedagogical strategies initiated by universities, charities, and civil society organizations to situate their memberships within orders of difference. Emphasis is placed on learning critical practices of de-internationalization in global awareness.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3527G",
      "subject": "CGS",
      "className": "GLOBLZD CAPITALIST AGRICULTURE",
      "course_info": [
        {
          "class_nbr": 8245,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): 0.5 Centre for Global Studies course at the 1000-1099 level, or permission of the Centre for Global Studies.",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W101",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of the deployment and consumption of labour, natural resources, manufactured inputs, and transportation regimes in the production of agricultural products. This course examines each of these broad themes as it is shaped by and produces capitalist social, political, and material relations.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "4010F",
      "subject": "CGS",
      "className": "HONORS SEMINAR: POVERTY",
      "course_info": [
        {
          "class_nbr": 9304,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 0.5 course from Centre for Global Studies 3001F/G-3005F/G or permission of the Centre for Global Studies.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W104",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Examinations of social, environmental and political sources of structural economic inequality. For core themes and cases in the current session, please see the Centre for Global Studies.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "4015G",
      "subject": "CGS",
      "className": "HONS SEM: POWER & RESISTANCE",
      "course_info": [
        {
          "class_nbr": 9305,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 0.5 course from Centre for Global Studies 3001F/G-3005F/G or permission of the Centre for Global Studies.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W104",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Examination of the relations of power and resistance, including studies of forms of oppression, hegemonic structures, and forms of organizing. For core themes in the current session, please see the Centre for Global Studies.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2206A",
      "subject": "CBE",
      "className": "INTRO INDUSTRIAL ORGANIC CHEM",
      "course_info": [
        {
          "class_nbr": 2564,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Chemistry 1302A/B or the former Chemistry 1024A/B.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "SSC-3028",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL AND GREEN PROCESS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "This course presents the fundamental principles governing the structure and reactivity of organic molecules. Organic molecules form the basis of industrial chemical and environmental processes. The laboratory section focuses on bench scale processing of organic chemical products, and the use of modern instruments for analysis of organic materials and monitoring of chemical processes.\n\nAntirequisite(s): Chemistry 2213A/B.\n\nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "2207B",
      "subject": "CBE",
      "className": "APPLIED INDUSTRIAL ORG CHEM",
      "course_info": [
        {
          "class_nbr": 2567,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): CBE 2206A/B.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "PAB-148",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "This course applies previously learned concepts in organic chemistry to describe chemical transformations that form the basis of industrial and environmental processes. The laboratory section focuses on the bench scale synthesis of organic chemical products, and the use of modern instruments for their analysis and quality control.\n\nAntirequisite(s): Chemistry 2223B or the former CBE 2216. \n\nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "2214A",
      "subject": "CBE",
      "className": "ENGINEERING THERMODYNAMICS",
      "course_info": [
        {
          "class_nbr": 1710,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1411A/B.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "FNB-1220",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL AND GREEN PROCESS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Properties of a pure substance, first law of thermodynamics, processes in open and closed systems, second law of thermodynamics; ideal gases, mixture of ideal gases, and psychometry, compressors and energy conversion systems.\r\n\r\nAntirequisite(s): MME 2204A/B.\r\n\r\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "2220A",
      "subject": "CBE",
      "className": "CHEMICAL PROCESS CALCULATIONS",
      "course_info": [
        {
          "class_nbr": 2022,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1411A/B, Applied Mathematics 1413, Chemistry 1302A/B or the former Chemistry 1024A/B, Physics 1401A/B and Physics 1402A/B.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-1200",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL, INTEGRATED AND GREEN PROCESS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "The objective of this course is to introduce the fundamental concepts of\nmaterial and energy balances which form the basis of chemical and biochemical engineering processes. Calculations related to specific problems in these fields are carried out. New directions in chemical and biochemical engineering are introduced.\n\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "2221B",
      "subject": "CBE",
      "className": "FLUID FLOW",
      "course_info": [
        {
          "class_nbr": 1525,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1413.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-67",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL, INTEGRATED AND GREEN PROCESS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "To introduce chemical engineering students to the basics of momentum transfer and fluid flow; their application to the solution of engineering problems. Topics include: conservation of mass, momentum and energy, flow of fluids, measurement of fluid flow, laminar and turbulent flow, compressible and incompressible flow, pumps, nozzles, flow meters, turbines. \r\n\r\nExtra Information: 3 lecture hours, 3 tutorial/lab hours."
    },
    {
      "catalog_nbr": "2224B",
      "subject": "CBE",
      "className": "CHEMICAL ENG THERMODYNAMICS",
      "course_info": [
        {
          "class_nbr": 2024,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): CBE 2214A/B or MME 2204A/B, Applied Mathematics 1413.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SSC-2028",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL AND GREEN PROCESS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Provides the basics of the thermodynamics involved in chemical engineering with emphasis on material and energy balances, thermo physics, thermo chemistry, and thermodynamics of chemical processes. Emphasis is placed on the application of thermodynamics to practical problems in phase equilibria and on solutions and reaction equilibria in separations and reaction engineering.\r\n\r\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "2290A",
      "subject": "CBE",
      "className": "FUNDAMENTALS OF BIOCHEM AND EN",
      "course_info": [
        {
          "class_nbr": 1543,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Chemistry 1302A/B or the former Chemistry 1024A/B.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "UCC-67",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL, GREEN PROCESS AND INTEGRATED ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "The overall objective of the course is to apply the principles of microbiology, biochemistry to understand and solve environmental problems. This course covers the fundamental concepts of biological processes that are important in natural and engineered environmental systems. Students will gain basic skills of biochemistry and microbiology in laboratory section.\n\nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "2291B",
      "subject": "CBE",
      "className": "COMPUTATNL METHD FOR ENGINEERS",
      "course_info": [
        {
          "class_nbr": 1545,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Engineering Science 1036A/B or Computer Science 1026A/B.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "HSB-35",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL, INTEGRATED AND GREEN PROCESS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "This course is designed to introduce the student to technical computing for Engineers and Scientists using the high level, interactive, computational tools provided by the Matlab-Simulink Environment. Students will learn both the object oriented programming and command line modes of Matlab and apply them to the solution of a variety of problems involving optimization and dynamic simulation of Engineering processes.\r\n\r\nAntirequisite(s): CEE 2219A/B. \r\n\r\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "3310B",
      "subject": "CBE",
      "className": "PROCESS DYNAMICS & CONTROL",
      "course_info": [
        {
          "class_nbr": 2572,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 2277A/B, CBE 2291A/B.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1270",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL, INTEGRATED OR GREEN PROCESS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "The course covers the dynamic behavior, modeling and control of chemical processes. The principles of feedback control of commonly-encountered systems such as level, flow, temperature, pressure, are described. Theory is introduced to illustrate current practice. Simulations of dynamic behavior of processes will make use of the MATLAB/Simulink programming environment.\n\nAntirequisite(s): The former CBE 4410A/B.\n\nExtra Information: 3 lecture hours, 1 laboratory hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "3315A",
      "subject": "CBE",
      "className": "REACTION ENGINEERING",
      "course_info": [
        {
          "class_nbr": 1546,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1413, CBE 2224A/B, Chemistry 1302A/B or the former Chemistry 1024A/B.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1410",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Chemical kinetics as applied to the large-scale manufacture of chemicals. An introduction to the factors which affect the design and size of chemical reactors, as well as the conditions under which they are to be operated for maximum efficiency.\r\n\r\nExtra Information: 3 lecture hours, 1.5 laboratory hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "3318A",
      "subject": "CBE",
      "className": "INTRO TO CHEMICAL PROCESS SIM",
      "course_info": [
        {
          "class_nbr": 3847,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Engineering Science 1050, CBE 2220A/B, CBE 2221A/B, and either CBE 2224A/B.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1415",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL OR GREEN PROCESS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "This course aims to introduce and to develop student skills on modern methods for simulation of chemical process units. Differential heat balance, mass balance. Energy and material balance methods in process units. Executive systems for overall balance methods. Physical properties, computer packages.\n\nExtra Information: 2 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "4500E",
      "subject": "CHEMBIO",
      "className": "RESEARCH PROJECT IN CHEM BIO",
      "course_info": [
        {
          "class_nbr": 3448,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Biochemistry 3380G, Biochemistry 3381A and Biochemistry 3382A with marks of at least 70% in each; Chemistry 2271A, Chemistry 2272F, Chemistry 2273A, Chemistry 2374A, Chemistry 2281G, Chemistry 2283G, Chemistry 2384B; 1.0 course from: Chemistry 3371F, Chemistry 3372F/G, Chemistry 3373F, Chemistry 3374A/B; and registration in Year 4 of the Honours Specialization in Chemical Biology.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YEAR 4 HONORS SPECIALIZATION IN CHEMICAL BIOLOGY."
        }
      ],
      "catalog_description": "The major laboratory course for students in the Honours Specialization in Chemical Biology. Under the supervision of a faculty member, students will work on an independent research project, submit reports, write a thesis describing research findings and present and defend their findings in an oral seminar. Professional development activities include: skills for critical analysis of research, writing technical reports, ethics.\n\nAntirequisite(s): Biochemistry 4483E, Biochemistry 4486E, Chemistry 4491E, the former Biochemistry 4485E.\n\nExtra Information: 15 laboratory hours/week."
    },
    {
      "catalog_nbr": "0011A",
      "subject": "CHEM",
      "className": "INTRODUCTORY CHEMISTRY I",
      "course_info": [
        {
          "class_nbr": 7959,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): High School Chemistry (Grade 11 Advanced Level or equivalent) or permission of the Dean, and registration in a Preliminary Year program at Brescia University College.",
          "end_time": "2:30 PM",
          "facility_ID": "BR-18",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN PRELIMINARY YEAR."
        }
      ],
      "catalog_description": "This course will explore the foundations of matter through atomic theory, investigate chemical reactions with stoichiometry, predict bonding and structure of compounds, and examine the properties, reactions and structures of organic molecules. Chemistry 0011A/B and Chemistry 0012A/B in combination are equivalent to the Ontario Grade 12U level chemistry.\n\nAntirequisite(s): Ontario High School SCH4U or equivalent, Chemistry 0010, any university-level Chemistry course.\n\nExtra Information: 2 lecture hours, 3 laboratory/tutorial hours."
    },
    {
      "catalog_nbr": "0012B",
      "subject": "CHEM",
      "className": "INTRODUCTORY CHEMISTRY II",
      "course_info": [
        {
          "class_nbr": 7961,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "5:30 PM",
          "facility_ID": "BR-202",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN PRELIMINARY YEAR."
        }
      ],
      "catalog_description": "This course explores thermodynamics, kinetics and equilibrium of chemical reactions, behaviour of ideal gases, and interpretation of redox reactions. Students will engage in problem solving and apply laws and theories to analyze chemical reactions that support our society with heat, batteries, buffers, and important materials. Chemistry 0011A/B and Chemistry 0012A/B in combination are equivalent to the Ontario Grade 12U level chemistry.\n\nAntirequisite(s): Ontario High School SCH4U or equivalent, Chemistry 0010, any university-level Chemistry course.\n\nExtra Information: 2 lecture hours, 3 laboratory/tutorial hours."
    },
    {
      "catalog_nbr": "1027A",
      "subject": "CHEM",
      "className": "EVERYWHERE & EVERYTHING",
      "course_info": [
        {
          "class_nbr": 5542,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "CHB-9",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course provides the background knowledge required to make informed decisions about how chemistry is presented to the public through various media. Topics will include environmental concerns, forensic chemistry, sources of energy, the chemistry of drugs. No chemistry background required; intended primarily for students from Faculties other than Science.\n\nAntirequisite(s): Chemistry 1301A/B, Chemistry 1302A/B. \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "1301A",
      "subject": "CHEM",
      "className": "DISCOVERING CHEMICAL STRUCTURE",
      "course_info": [
        {
          "class_nbr": 3708,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Grade 12U Chemistry (SCH4U) or equivalent.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "STUDENTS CANNOT BE ADDED TO A LAB THAT IS ALREADY FULL. STUDENTS ENROLLING IN BOTH 1301A AND 1302B DO NOT NEED TO BE IN THE SAME SECTIONS FOR BOTH COURSES."
        }
      ],
      "catalog_description": "An introduction to the foundational principles of chemical structure and properties, emphasizing their relevance to modern science. Topics include: atomic structure, theories of chemical bonding, structure and stereochemistry of organic molecules, and structure of coordination complexes.\n\nAntirequisite(s): The former Chemistry 1024A/B.\n\nExtra Information: 3 lecture hours, 1.5 laboratory hours (3 hours every other week)."
    },
    {
      "catalog_nbr": "1302A",
      "subject": "CHEM",
      "className": "DISCOVERING CHEMICAL ENERGETIC",
      "course_info": [
        {
          "class_nbr": 4526,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Grade 12U Chemistry (SCH4U) or equivalent. Grade 12U Advanced Functions (MHF4U) or Calculus & Vectors (MCV4U), or Mathematics 0110A/B or 0105A/B, is strongly recommended.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "An examination of how the fundamentals of energetics influence chemical processes. Topics include: gases, thermodynamics and thermochemistry, chemical equilibria, solubility, weak acids and bases, electrochemistry, and chemical kinetics.\n\nAntirequisite(s): The former Chemistry 1024A/B.\n\nExtra Information: 3 lecture hours, 1.5 laboratory hours (3 hours every other week)."
    },
    {
      "catalog_nbr": "1302B",
      "subject": "CHEM",
      "className": "DISCOVERING CHEMICAL ENERGETIC",
      "course_info": [
        {
          "class_nbr": 3733,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Grade 12U Chemistry (SCH4U) or equivalent. Grade 12U Advanced Functions (MHF4U) or Calculus & Vectors (MCV4U), or Mathematics 0110A/B or 0105A/B, is strongly recommended.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "002",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "STUDENTS CANNOT BE ADDED TO A LAB THAT IS ALREADY FULL. STUDENTS ENROLLING IN BOTH 1301A AND 1302B DO NOT NEED TO BE IN THE SAME SECTIONS FOR BOTH COURSES."
        }
      ],
      "catalog_description": "An examination of how the fundamentals of energetics influence chemical processes. Topics include: gases, thermodynamics and thermochemistry, chemical equilibria, solubility, weak acids and bases, electrochemistry, and chemical kinetics.\n\nAntirequisite(s): The former Chemistry 1024A/B.\n\nExtra Information: 3 lecture hours, 1.5 laboratory hours (3 hours every other week)."
    },
    {
      "catalog_nbr": 1150,
      "subject": "CHINESE",
      "className": "BEGINNERS' CHINESE I",
      "course_info": [
        {
          "class_nbr": 8185,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Permission of the department.",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W103",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "FULL STATUS INDICATES PLACEMENT/SPECIAL PERMISSION REQUIRED AT https://huronuc.ca/chinese-placement-request-form"
        }
      ],
      "catalog_description": "An introduction to oral and written standard Chinese for students with no previous knowledge of the language and no previous exposure to Chinese culture. Students will learn approximately 400 characters, 40 sentence structures, basic grammar, and will be able to write short passages and conduct brief, informal dialogues. The pinyin romanization system will be introduced. Prepares students for progression to Chinese 2250. \n\nAntirequisite(s): Chinese 1151, Chinese 1152A/B, Chinese 1153A/B, Grade 12U Chinese or equivalent.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "1650G",
      "subject": "CHINESE",
      "className": "PERSPECTIVES ON CHINA",
      "course_info": [
        {
          "class_nbr": 8344,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W101",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of China as it emerges in the era of globalization. Contents include territory, people, society, language, science and technology, development and sustainability. Analysis of dominant and diverse realities will provide an essential basis for an appreciation of continuity and change in China. Students will learn how to access major sources of information and critically to evaluate perspectives and debates. Taught in English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1651F",
      "subject": "CHINESE",
      "className": "CHINESE SYMBOLS & ICONS",
      "course_info": [
        {
          "class_nbr": 8251,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W101",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course surveys traditional symbols and icons still prevalent in China's everyday life, ranging from \"yin-yang\", \"dragon\", \"mandarin ducks\" and \"the double-happiness\", to \"the three stars\", \"Lord Guan\" and \"Avalokitesvara\" (Guanyin). Treating these symbols and icons as image-signifiers, the course illustrates the socio-historical contexts that have shaped major symbolism in China. Students will gain a basic understanding of Chinese culture and develop skills in critical examination of cultural phenomena. Taught in English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2240F",
      "subject": "CHINESE",
      "className": "UNDRSTNDNG CHNSE BUS CULTURE 1",
      "course_info": [
        {
          "class_nbr": 8252,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W101",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON UNIVERSITY COLLEGE STUDENTS OR STUDENTS ENROLLED IN CHINESE STUDIES, CHINA STUDIES, CHINESE BUSINESS COMMUNICATIONS, OR EAST ASIA STUDIES MODULES. OPEN JULY 19 TO ALL STUDENTS. WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "An intensive study of contemporary language and socio-cultural issues and topics involved in domestic and international businesses in China. Discussion of selected readings from print and internet resources will help the student to gain language and cultural skills crucial to understanding business interactions in China. \r\n \r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2241G",
      "subject": "CHINESE",
      "className": "UNDRSTNDNG CHNSE BUS CULTURE 2",
      "course_info": [
        {
          "class_nbr": 8253,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W101",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON UNIVERSITY COLLEGE STUDENTS OR STUDENTS ENROLLED IN CHINESE STUDIES, CHINA STUDIES, CHINESE BUSINESS COMMUNICATIONS, OR EAST ASIA STUDIES MODULES. OPEN JULY 19 TO ALL STUDENTS. WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "An intensive study of spoken and non-verbal communication and practices in the cultural context of contemporary Chinese business. Discussion of real cases will help the student to develop an awareness of cultural nuances involved in doing business with the Chinese in China.\r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2242F",
      "subject": "CHINESE",
      "className": "RPRSNTV WRKS IN TRAD CHNSE LIT",
      "course_info": [
        {
          "class_nbr": 8096,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W112",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON UNIVERSITY COLLEGE STUDENTS OR STUDENTS ENROLLED IN CHINESE STUDIES, CHINA STUDIES, CHINESE BUSINESS COMMUNICATIONS, OR EAST ASIA STUDIES MODULES. OPEN JULY 19 TO ALL STUDENTS. WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "A survey of major works of prose by pre-modern Chinese writers. This course focuses on reading texts and analyzing their textual structure, aesthetic values, and historical contexts. Attention will also be paid to the evolution of the Chinese language from the Classical to the vernacular.\r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2244G",
      "subject": "CHINESE",
      "className": "RPRSNTATV WRKS MOD CHINESE LIT",
      "course_info": [
        {
          "class_nbr": 9322,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W112",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON UNIVERSITY COLLEGE STUDENTS OR STUDENTS ENROLLED IN CHINESE STUDIES, CHINA STUDIES, CHINESE BUSINESS COMMUNICATIONS, OR EAST ASIA STUDIES MODULES. OPEN JULY 19 TO ALL STUDENTS. WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "A survey of major works of prose by modern Chinese writers. Selected works will be discussed in relation to the writers' ideas of political involvement, social change, revolution and the function of literature. Events that have shaped modern Chinese history and society will also be examined.\r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2245F",
      "subject": "CHINESE",
      "className": "CINEMA IN THE CHINESE MAINLAND",
      "course_info": [
        {
          "class_nbr": 9346,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W103",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON UNIVERSITY COLLEGE STUDENTS OR STUDENTS ENROLLED IN CHINESE STUDIES, CHINA STUDIES, CHINESE BUSINESS COMMUNICATIONS, OR EAST ASIA STUDIES MODULES. OPEN JULY 19 TO ALL STUDENTS. WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "This course examines representative films produced in major historical periods in the Chinese Mainland, with an emphasis on issues of nationalism and national identity, as well as cultural, social, and political changes occurred and are occurring in 20th century and contemporary China.\r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2246G",
      "subject": "CHINESE",
      "className": "CHINESE CINEMA IN TAIWAN & HK",
      "course_info": [
        {
          "class_nbr": 9345,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W103",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON UNIVERSITY COLLEGE STUDENTS OR STUDENTS ENROLLED IN CHINESE STUDIES, CHINA STUDIES, CHINESE BUSINESS COMMUNICATIONS, OR EAST ASIA STUDIES MODULES. OPEN JULY 19 TO ALL STUDENTS. WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "This course examines representative films produced in major historical periods in Taiwan and Hong Kong, with an emphasis on issues of nationalism and national identity, as well as cultural, social, and political changes occurred and are occurring in 20th century and contemporary Taiwan and Hong Kong.\r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2247G",
      "subject": "CHINESE",
      "className": "CHINESE CITIES & CHINESE CLTR",
      "course_info": [
        {
          "class_nbr": 8254,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-A1",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON UNIVERSITY COLLEGE STUDENTS OR STUDENTS ENROLLED IN CHINESE STUDIES, CHINA STUDIES, CHINESE BUSINESS COMMUNICATIONS, OR EAST ASIA STUDIES MODULES. OPEN JULY 19 TO ALL STUDENTS. WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "In an interdisciplinary approach, this course will examine major ancient and modern Chinese cities, with a focus on the city's form and function as an aesthetic symbol in Chinese culture, exploring the city's significant role in the making of China's cultural identity.\r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": 2250,
      "subject": "CHINESE",
      "className": "BEGINNERS' CHINESE 2",
      "course_info": [
        {
          "class_nbr": 8250,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Chinese 1150 or Chinese 1151, or permission of the department.",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W101",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "FULL STATUS INDICATES PLACEMENT/SPECIAL PERMISSION REQUIRED AT https://huronuc.ca/chinese-placement-request-form"
        }
      ],
      "catalog_description": "A course in standard Chinese and a continuation of Chinese 1150. Students will build on skills in reading, writing, and speaking developed in earlier courses. They will gain an increased vocabulary (approximately 1000 characters) and a greater understanding of more complex grammatical structures. The pinyin romanization system will be used.\n \nAntirequisite(s): Chinese 2251, Chinese 2252A/B, Chinese 2253A/B. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "2271G",
      "subject": "CHINESE",
      "className": "SPECIAL TOPICS",
      "course_info": [
        {
          "class_nbr": 9323,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-A1",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "This course is intended for students who can read and write in Modern Standard Chinese and will include studies in Chinese language and culture.\r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2601A",
      "subject": "CHINESE",
      "className": "POL & SCL-ECON FND MOD CHINA",
      "course_info": [
        {
          "class_nbr": 9324,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V208",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "A survey of the social, political, and economic factors that shape modern China. Taught in English.\r\n \r\nAntirequisite(s): The former Centre of Global Studies 2202A/B. \r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2602B",
      "subject": "CHINESE",
      "className": "CULTURAL FND OF MODERN CHINA",
      "course_info": [
        {
          "class_nbr": 9325,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W108",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "A survey of the artistic, philosophical, and religious factors that shape modern China. Taught in English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3340A",
      "subject": "CHINESE",
      "className": "BUSINESS CHINESE I",
      "course_info": [
        {
          "class_nbr": 8186,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W108",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON UNIVERSITY COLLEGE STUDENTS OR STUDENTS ENROLLED IN CHINESE STUDIES, CHINA STUDIES, CHINESE BUSINESS COMMUNICATIONS, OR EAST ASIA STUDIES MODULES. OPEN JULY 19 TO ALL STUDENTS. WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "This course is intended for students who can read and write Modern Standard Chinese. Students will develop specific knowledge and skills in business communication in Chinese. Business etiquette and protocol will be discussed. Translation and competence in interpretation will be fostered by the study of business terms, documents, and practices. \n \nExtra Information: 4 hours"
    },
    {
      "catalog_nbr": "3341B",
      "subject": "CHINESE",
      "className": "BUSINESS CHINESE 2",
      "course_info": [
        {
          "class_nbr": 9326,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W108",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON UNIVERSITY COLLEGE STUDENTS OR STUDENTS ENROLLED IN CHINESE STUDIES, CHINA STUDIES, CHINESE BUSINESS COMMUNICATIONS, OR EAST ASIA STUDIES MODULES. OPEN JULY 19 TO ALL STUDENTS. WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "This course is intended for students who can read and write Modern Standard Chinese. Students will study business terms, communication styles and formats, and acquire linguistic and cultural knowledge for conducting business in Chinese. Students will develop competence through practical experience in reading and writing market reports and analysing contracts. \n\nExtra Information: 4 hours"
    },
    {
      "catalog_nbr": 3350,
      "subject": "CHINESE",
      "className": "CHINESE 3",
      "course_info": [
        {
          "class_nbr": 9327,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Chinese 2250 or Chinese 2251 or permission of the department.",
          "end_time": "3:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W17",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "FULL STATUS INDICATES PLACEMENT/SPECIAL PERMISSION REQUIRED AT https://huronuc.ca/chinese-placement-request-form"
        }
      ],
      "catalog_description": "A third-level course in standard Chinese. Advanced conversation, written composition, listening and speaking skills, and translation techniques will be emphasized. Students will learn all the basic grammatical patterns and gain a larger vocabulary (approximately 1600 characters). Selections from newspapers and short essays will be incorporated.\n \nAntirequisite(s): Chinese 3352A/B, Chinese 3353A/B. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "3650F",
      "subject": "CHINESE",
      "className": "THE CHINESE SHORT STORY",
      "course_info": [
        {
          "class_nbr": 9328,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): 1.0 Essay course from Category A or B.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W106",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "A survey of major developments in the history and art of the Chinese short story that examines selected works in classical and vernacular languages representing a variety of narrative forms. Taught in English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3651G",
      "subject": "CHINESE",
      "className": "THE CHINESE NOVEL",
      "course_info": [
        {
          "class_nbr": 9329,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): 1.0 Essay course from Category A or B.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W106",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "A study of the Chinese novel from the 16th to the 20th century that addresses the historical background, the social and cultural context, the aesthetic values, and achievements of individual authors. Taught in English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "4440A",
      "subject": "CHINESE",
      "className": "BUSINESS TRANSLATION 1",
      "course_info": [
        {
          "class_nbr": 8234,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Chinese 3340A/B or Chinese 3341A/B or permission of the department.",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W103",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "WAIT LIST OPTION AVAILABLE JULY 19."
        }
      ],
      "catalog_description": "English and Chinese translation with fundamentals of theory and practice for oral and written business-oriented communication. Reflective conversation and intensive practice sessions help students obtain insights and techniques to avoid common translation pitfalls and to develop the skills for more natural and accurate translations in business Chinese and English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "5104A",
      "subject": "CHURCH",
      "className": "EARLY CHURCH TO LATE MID AGES",
      "course_info": [
        {
          "class_nbr": 8123,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W104",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5106B",
      "subject": "CHURCH",
      "className": "LATE MID AGES TO MOD PERIOD",
      "course_info": [
        {
          "class_nbr": 8124,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5227A",
      "subject": "CHURCH",
      "className": "HISTORY OF ANGLICANISM",
      "course_info": [
        {
          "class_nbr": 9555,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W2",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "2202A",
      "subject": "CEE",
      "className": "MECHANICS OF MATERIALS",
      "course_info": [
        {
          "class_nbr": 1523,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Engineering Science 1022A/B/Y, Applied Mathematics 1413.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1250",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CIVIL OR INTEGRATED ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Concept of stress and strain; axially loaded members; second moment of area; elastic torsion of circular shafts; bending and shearing stresses in beams; transformation of stress and strain; stresses in thin-walled pressure vessels; design of beams and introduction to beam deflection. \n\nAntirequisite(s): MME 2202A/B. \n\nExtra Information: 3 lecture hours, 3 tutorial hours."
    },
    {
      "catalog_nbr": "2217A",
      "subject": "CEE",
      "className": "INTRO TO ENVIRONMENTAL ENG",
      "course_info": [
        {
          "class_nbr": 1725,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Chemistry 1302A/B or the former Chemistry 1024A/B.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1415",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "A course introducing the application of chemistry and engineering principles to an understanding of environmental issues associated with human activity. Topics include mass and energy transfer, environmental chemistry, water and air pollution, pollutant transport modeling, pollution management, and risk assessment. \n\nAntirequisite(s): Chemistry 2210A/B. \n\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "2219B",
      "subject": "CEE",
      "className": "COMPUTATNL METHD FOR CIV ENG",
      "course_info": [
        {
          "class_nbr": 2776,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Engineering Science 1036A/B, Applied Mathematics 1411A/B, Applied Mathematics 1413, Applied Mathematics 2270A/B.\nCorequisite(s): Applied Mathematics 2277A/B.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "A first course in numerical methods for civil and environmental engineers, emphasizing problem formulation, solution algorithm design and programming application. Methods for solving nonlinear algebraic equations, ordinary differential equations, and differential-algebraic systems. Introduction to the systems approach, and system analysis terminology, for application to engineering planning, design and operations.\n\nAntirequisite(s): CBE 2291A/B, the former CEE 2218A/B. \n\nExtra Information: 3 lecture hours, 3 design lab/tutorial hours."
    },
    {
      "catalog_nbr": "2220A",
      "subject": "CEE",
      "className": "INTRO TO STRUCTURAL ENG",
      "course_info": [
        {
          "class_nbr": 1529,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Engineering Science 1022A/B/Y, Applied Mathematics 1413. \nCorequisite(s): CEE 2202A/B, Applied Mathematics 2270A/B.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SEB-3109",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CIVIL OR INTEGRATED ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "A first course in Structural Theory and Design, including a consolidation of material concerning static equilibrium. Free body diagrams; behaviour, analysis and design of steel and wooden trusses and statically determinate steel and wooden beams; Euler buckling; force effect envelopes; snow and static wind loads. \r\n\r\nExtra Information: 3 lecture hours, 1 laboratory hour, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2221B",
      "subject": "CEE",
      "className": "STRUCTURAL THEORY & DESIGN",
      "course_info": [
        {
          "class_nbr": 1532,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): CEE 2202A/B, CEE 2220A/B, Applied Mathematics 2270A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-3210",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CIVIL OR INTEGRATED ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "A consolidation of the analysis and design of statically determinate structures, and an introduction to the analysis of indeterminate structures. Analysis and design of statically determinate beams and frames; bending of unsymmetric sections; virtual work and energy methods, introduction to indeterminate structural analysis. \n\nExtra Information: 3 lecture hours, 1 laboratory hour, 1 tutorial hour."
    },
    {
      "catalog_nbr": 2224,
      "subject": "CEE",
      "className": "ENGINEERING FLUID MECHANICS",
      "course_info": [
        {
          "class_nbr": 1614,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): ES 1022A/B/Y, Physics 1401A/B or the former Physics 1026.\nCorequisite(s): Applied Mathematics 2270A/B.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2100",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Basic concepts of fluid mechanics: fluid statics; continuity, momentum and energy equations; vortex flow; flow of real fluids and boundary layers; dimensional analysis. These principles are applied to pipe and open channel flows: steady pipe flows, uniform and gradually-varied flow in open channels; sluice gates, weirs and hydraulic jumps, unsteady flows. \n\nExtra Information: 3 lecture hours, 1 laboratory hour, 2 tutorial hours."
    },
    {
      "catalog_nbr": "3321A",
      "subject": "CEE",
      "className": "SOIL MECHANICS & HYDROGEOLOGIC",
      "course_info": [
        {
          "class_nbr": 3957,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): CEE 2202A/B, CEE 2224.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-41",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YRS 3 & 4 CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Soil classification, clay mineralogy, effective stress principle, site investigation practice, soil compaction, and one and two dimensional steady state flow in natural and engineered systems.\n\nExtra Information: 2 lecture hours, 3.5 tutorial/laboratory hours."
    },
    {
      "catalog_nbr": "3322B",
      "subject": "CEE",
      "className": "INTRO TO GEOTECH ENGINEERING",
      "course_info": [
        {
          "class_nbr": 3959,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): CEE 3321A/B.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-3109",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YRS 3 & 4 CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "One dimensional settlement and consolidation theories for clayey soils, shear strength models, and assessment of slope stability. \n\nExtra Information: 3 lecture hours, 2.5 tutorial/laboratory hours."
    },
    {
      "catalog_nbr": "3324A",
      "subject": "CEE",
      "className": "SURVEYING",
      "course_info": [
        {
          "class_nbr": 1549,
          "start_time": "",
          "descrlong": "Prerequisite(s): Enrolled in Civil Engineering.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CIVIL ENGINEERING STUDENTS. RUNS AUG, 2019. HELD IN SEB 3109 9 AM-4 PM."
        }
      ],
      "catalog_description": "The fundamental theory and procedures of plane surveying with application to engineering construction. This course runs in the summer for a period of 15 days (usually three weeks preceding the start of term). Limited enrollment. Preference will be given to students who have completed term 4 of the Civil Engineering program. (26 lecture hours, 52 field work/laboratory hours). \n\nExtra Information: 2 lecture hours, 4 laboratory hours. \nStudents must attend the first class in order to be enrolled in the class because of the concise nature of the course, and the last date for dropping the course is at the end of classes on the fourth day."
    },
    {
      "catalog_nbr": "3327A",
      "subject": "CEE",
      "className": "INTERNATIONAL DEV FOR ENG",
      "course_info": [
        {
          "class_nbr": 4628,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Admission to the Environmental Engineering with International Development Option or Structural Engineering with International Development Option",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-2440",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YRS 3 & 4 CIVIL ENGINEERING OPTION F & G."
        }
      ],
      "catalog_description": "The course will assist students to achieve a broad understanding of international development to enable the effective use of engineering in developing countries. The course covers what works and does not work in international development, the results targeted in development work, and effective approaches and methodologies to achieve those ends.\n\nExtra Information: 2 lecture hours; 2 tutorial hours."
    },
    {
      "catalog_nbr": "3328B",
      "subject": "CEE",
      "className": "APPROP TECH FOR INTER DEV",
      "course_info": [
        {
          "class_nbr": 4629,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Admission to the Environmental Engineering with International Development Option or Structural Engineering with International Development Option",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2094",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YRS 3 & 4 CIVIL ENGINEERING OPTION F & G."
        }
      ],
      "catalog_description": "The course will introduce the concept of appropriate technology in the context of international development to students. It will examine the application of technologies to critical human needs in development, such as housing, transportation, provision of safe water and sanitation, waste management, and as energy.\n\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "3340A",
      "subject": "CEE",
      "className": "ANALYSIS OF INDETERMINATE STR",
      "course_info": [
        {
          "class_nbr": 1552,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): CEE 2221A/B",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-3220",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 3 & 4 CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "A continuation of CEE 2221A/B. Methods of analysis of structures having a high degree of statistical indeterminacy such as frames, continuous beams and arches. Matrix formulation of the displacement methods and computer oriented analysis. Influence lines for indeterminate structures. \r\n\r\nExtra Information: 3 lecture hours, 2 laboratory/tutorial hours"
    },
    {
      "catalog_nbr": "3343B",
      "subject": "CEE",
      "className": "FINITE ELEMENT METHODS & APPL",
      "course_info": [
        {
          "class_nbr": 3961,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): CEE 2221A/B, CEE 3340A/B",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "SSC-3018",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YRS 3 & 4 CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Introduces the basis of the finite method and its application in solving problems in solid mechanics. Application of the finite element method in the modelling and analysis of buildings as well as coverage of approximate methods for estimating the response of buildings to lateral loads are introduced in the course. \n\nExtra Information: 3 lecture hours, 3.0 tutorial/laboratory hours."
    },
    {
      "catalog_nbr": "3344A",
      "subject": "CEE",
      "className": "STRUCTURAL DYNAMICS I",
      "course_info": [
        {
          "class_nbr": 3963,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): CEE 2221A/B \r\nCorequisite(s): CEE 3340A/B",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-3109",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YRS 3 & 4 CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Students are introduced to concepts of structural dynamics and the response of civil engineering structures to time-varying loads, including those due to wind and earthquakes. Topics include: the effects of the mass and damping; random dynamic loads; the design of dynamically sensitive structures that can be approximated as a (generalized) single-degree-of-freedom system. \n\nAntirequisite(s): the former CEE 4490. \n\nExtra Information: 2 lecture hours, 2 tutorial/laboratory hours."
    },
    {
      "catalog_nbr": "3346B",
      "subject": "CEE",
      "className": "STEEL DESIGN",
      "course_info": [
        {
          "class_nbr": 1554,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): CEE 3340A/B",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "SEB-3109",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 3 & 4 CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Behaviour and Limit States Design of tension members, columns, beams, beam-columns, and connections. P-delta analyses for unbraced frames. Building systems. Current professional issues in steel construction. Health and safety issues are discussed. \r\n\r\nExtra Information: 3 lecture hours, 3 design laboratory/tutorial hours"
    },
    {
      "catalog_nbr": "3347A",
      "subject": "CEE",
      "className": "REINFORCED CONCRETE DESIGN",
      "course_info": [
        {
          "class_nbr": 1556,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): CEE 2202A/B, CEE 2221A/B",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2200",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 3 & 4 CIVIL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Introduction to reinforced concrete design including serviceability and ultimate limit states; analysis and design of reinforced concrete beams and one-way slabs for flexure and shear; bar cutoffs in flexural members; deflections; short columns.\n\nExtra Information: 3 lecture hours, 3 tutorial/laboratory hours."
    },
    {
      "catalog_nbr": 1000,
      "subject": "CLASSICS",
      "className": "ANCIENT GREECE AND ROME",
      "course_info": [
        {
          "class_nbr": 1336,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-3110",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to the ancient world, with emphasis on the cultural and social life and achievements of Greece and Rome. Among the topics to be considered are: magic, religion, philosophy, literature, archaeology, architecture, art, the structure of society and the position of women, slavery, everyday life, law, sport, warfare, medicine. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": 2200,
      "subject": "CLASSICS",
      "className": "CLASSICAL MYTHOLOGY",
      "course_info": [
        {
          "class_nbr": 1339,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "NS-145",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A study of Greek and Roman mythology, with some reference to its influence in modern European literature. \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": 2300,
      "subject": "CLASSICS",
      "className": "SPORT&RECREATION ANCIENT WRLD",
      "course_info": [
        {
          "class_nbr": 1338,
          "start_time": "7:00 PM",
          "descrlong": "WAIT LIST OPTION AVAILABLE JULY 19.",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "NS-145",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "A study of the nature of sport and recreation, and of the attitudes towards them in the societies of the ancient world, principally Greece and Rome. \n\nAntirequisite(s): Classical Studies 3903F/G if taken in Winter 2009.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2301A",
      "subject": "CLASSICS",
      "className": "CRIME AND PUNISHMENT",
      "course_info": [
        {
          "class_nbr": 3950,
          "start_time": "10:30 AM",
          "descrlong": "WAIT LIST OPTION AVAILABLE JULY 19.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "This course is an introduction to crime and criminal law in ancient Greece and Rome. Modern criminology may provide comparison and perspective. Readings may include law, rhetoric, philosophy, drama, and/or historiography. No previous knowledge of Greece and Rome is necessary and all readings are in English.\n\nAntirequisite(s): The former CS 2905A/B (if taken in 2011-12, 2012-13). \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2301B",
      "subject": "CLASSICS",
      "className": "CRIME AND PUNISHMENT",
      "course_info": [
        {
          "class_nbr": 9446,
          "start_time": "",
          "descrlong": "WAIT LIST OPTION AVAILABLE JULY 19.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course is an introduction to crime and criminal law in ancient Greece and Rome. Modern criminology may provide comparison and perspective. Readings may include law, rhetoric, philosophy, drama, and/or historiography. No previous knowledge of Greece and Rome is necessary and all readings are in English.\n\nAntirequisite(s): The former CS 2905A/B (if taken in 2011-12, 2012-13). \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2440A",
      "subject": "CLASSICS",
      "className": "ALEXANDER THE GREAT",
      "course_info": [
        {
          "class_nbr": 9447,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "SH-2355",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Alexander III of Macedon, although only thirty-two when he died in 323 BC, is arguably one of the most significant figures in all recorded history. This course examines his background, campaigns, plans and personality. It also considers reasons for the very divergent views about him today. \n\nAntirequisite(s): The former CS 2902B (if taken in 2008-09, 2009-10), CS 2905B (if taken in 2010-11) and CS 2904B (if taken 2011-12, 2012-13). \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2500B",
      "subject": "CLASSICS",
      "className": "ANCIENT CITIES",
      "course_info": [
        {
          "class_nbr": 6232,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course looks at the growth of urbanization in the Near East and Mediterranean from the Neolithic through the Roman Imperial periods. The course uses archaeological remains and historical sources to understand organization, social structure and evolution of early cities.\n\nAntirequisite(s): The former CS 2902A/B (if taken in 2011-12, 2012-13). \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2525A",
      "subject": "CLASSICS",
      "className": "EGYPTIAN ART AND ARCHITECTURE",
      "course_info": [
        {
          "class_nbr": 6452,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SH-2355",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is a broad introduction to the world of Egyptian art and architecture. Starting with the Predynastic period, we will trace the major trends of Egyptian visual culture and conclude with the New Kingdom. Emphasis will be placed on learning these trends within their cultural and historical context.\n\nAntirequisite(s): The former Classical Studies 2908A (if taken in 2013-14. 2014-15, 2015-16, 2016-17) and the former Classical Studies 2908B (if taken in 2013-14, 2015-16).\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2525B",
      "subject": "CLASSICS",
      "className": "EGYPTIAN ART AND ARCHITECTURE",
      "course_info": [
        {
          "class_nbr": 6364,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-240",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is a broad introduction to the world of Egyptian art and architecture. Starting with the Predynastic period, we will trace the major trends of Egyptian visual culture and conclude with the New Kingdom. Emphasis will be placed on learning these trends within their cultural and historical context.\n\nAntirequisite(s): The former Classical Studies 2908A (if taken in 2013-14. 2014-15, 2015-16, 2016-17) and the former Classical Studies 2908B (if taken in 2013-14, 2015-16).\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2700B",
      "subject": "CLASSICS",
      "className": "TECH/ENG IN ANCIENT WORLD",
      "course_info": [
        {
          "class_nbr": 9473,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "SSC-2020",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "A survey of technological and engineering principles in antiquity; of materials including their development and applications; of machinery in all its variety and of \"missed opportunities\". \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2800A",
      "subject": "CLASSICS",
      "className": "GREEK & LATIN ELEMENTS IN ENG",
      "course_info": [
        {
          "class_nbr": 6453,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "SH-2355",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is intended as a practical means of enhancing English vocabulary through a systematic study of the contribution of the Classical languages to modern English, including the vocabulary of the sciences.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2840A",
      "subject": "CLASSICS",
      "className": "CLEOPATRA",
      "course_info": [
        {
          "class_nbr": 9474,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines the life and times of Cleopatra in Egyptian and Roman history, ancient art and coinage. The Cleopatra we know is the Cleopatra of myth and fantasy as well. We also look at the reception of her image from antiquity to the present in literature, art, and film.\n\nAntirequisite(s): The former Classical Studies 2902B (if taken in 2015-16, 2016-17).\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2902A",
      "subject": "CLASSICS",
      "className": "SP TOPICS IN CLASSICAL STUDIES",
      "course_info": [
        {
          "class_nbr": 9475,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "MC-105B",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "TOPIC: ANCIENT HUMOUR."
        }
      ],
      "catalog_description": "Extra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "3050G",
      "subject": "CLASSICS",
      "className": "STUDY TOUR TO ITALY",
      "course_info": [
        {
          "class_nbr": 9476,
          "start_time": "",
          "descrlong": "Prerequisite(s): Any Classical Studies course on the 1000-2999 level and permission of the instructor.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "STUDY TOUR TO ITALY. SPECIAL PERMISSION REQUIRED."
        }
      ],
      "catalog_description": "This intensive 3-week long study tour to Italy offers students a unique international learning experience. Roman history, literature and culture will be discussed in direct relation to the physical remains in museums and archaeological sites, such as the Forum Romanum, the Colosseum, the Vatican Museum and Pompeii. \n\nExtra Information: Field trip to Italy, minimum of 39 lecture hours."
    },
    {
      "catalog_nbr": "3110G",
      "subject": "CLASSICS",
      "className": "GREEK EPIC",
      "course_info": [
        {
          "class_nbr": 9477,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UC-3220",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will consider the tradition of epic poetry in Ancient Greece through a reading of the central texts, focusing on the Iliad and the Odyssey. The lectures will seek not only to examine the particular characteristics of each poem, but also to situate these texts within the larger framework of literary and cultural history.\n\nAntirequisite(s): Classical Studies 3906F/G if taken in 2009. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3130F",
      "subject": "CLASSICS",
      "className": "ATHENIAN DRAMA",
      "course_info": [
        {
          "class_nbr": 10296,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "WSC-240",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A close study of a selection of plays composed for the classical Athenian theatre, including discussions of their socio-historical context in democratic Athens, their place in the ancient Greek literary and philosophical traditions, questions of performance, and the continuing importance of these plays throughout history.\n\nAntirequisite(s): Classical Studies 3903F/G if taken in 2017-18.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3300G",
      "subject": "CLASSICS",
      "className": "ANCIENT GREEK & ROMAN SEXUALTY",
      "course_info": [
        {
          "class_nbr": 9478,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "MC-17",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is designed to give students insight into ancient Greek and Roman sexuality using the artistic evidence of erotic vase-paintings, sculpture, wall-paintings, and everyday objects in combination with ancient literary sources on sexual themes. Topics examined include phallic symbolism, homosexuality, prostitution, male-to-female lovemaking, hermaphrodites, and transvestism. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3350F",
      "subject": "CLASSICS",
      "className": "WOMEN IN ANCIENT ROME",
      "course_info": [
        {
          "class_nbr": 9479,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-54B",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An investigation of the construction of gender and the lives of women in ancient Rome. The evidence of texts and images from Roman antiquity will be considered from a variety of theoretical perspectives. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3410E",
      "subject": "CLASSICS",
      "className": "GREEK HISTORY",
      "course_info": [
        {
          "class_nbr": 9480,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-61",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "(Classical Studies 3410E, Classical Studies 3450E or the former Classical Studies 3400E counts as a principal course towards the Honours Specialization in History) A survey of the history of Greece from the Bronze Age to the death of Cleopatra. By analyzing the social and political structures we will explore the reasons for the tremendous success of this civilization. Special emphasis will be given to interpreting and understanding the ancient source material.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3530E",
      "subject": "CLASSICS",
      "className": "GREEK ART & ARCHAEOLOGY",
      "course_info": [
        {
          "class_nbr": 5948,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Classical Studies 1000 or permission of instructor.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "LWH-2210",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A survey of the art and archaeology of ancient Greece from the Dark Ages through the Classical period (1050 - 323 BCE), focusing on the architecture, sculpture, and painting of the 6th and 5th centuries (c. 600 - 400 BCE), and the meaning and function of material culture in ancient Greek society.\n\nAntirequisite(s): The former CS 3900E (if taken in 2011-12) and Visual Arts History 2247E. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3555E",
      "subject": "CLASSICS",
      "className": "ARCHAEOLOGY OF THE ROMAN",
      "course_info": [
        {
          "class_nbr": 9481,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Classical Studies 1000 or permission of instructor.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1225",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of the archaeological evidence from the provinces of the Roman Empire. The course considers the historical background of Roman conquest and examines the archaeological remains of the cities and monuments in the eastern and western Roman provinces.\n\nAntirequisite(s): CS 3901E (if taken in 2012-13). \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3800G",
      "subject": "CLASSICS",
      "className": "CLASSICS AND POP CULTURE",
      "course_info": [
        {
          "class_nbr": 9482,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1225",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH ARTHUM 3391G."
        }
      ],
      "catalog_description": "An examination of how pop culture in the 20th and 21st centuries has explored, adapted, and appropriated topics and themes from ancient Greece and Rome. Media considered may include: films, TV, novels, comic books, music, video games, online media, or anything falling within a broad definition of “pop culture”.\n\nAntirequisite(s): The former Classical Studies 3906G (if taken in 2015-16).\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3903F",
      "subject": "CLASSICS",
      "className": "SP TOPICS IN CLASSICAL STUDIES",
      "course_info": [
        {
          "class_nbr": 9484,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1225",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "TOPIC: THE AGE OF NERO."
        }
      ],
      "catalog_description": "Extra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3904F",
      "subject": "CLASSICS",
      "className": "SP TOPICS IN CLASSICAL STUDIES",
      "course_info": [
        {
          "class_nbr": 5949,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1225",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "TOPIC: SPARTA."
        }
      ],
      "catalog_description": "Extra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4585F",
      "subject": "CLASSICS",
      "className": "VINDOLANDA RESEARCH PROJECT",
      "course_info": [
        {
          "class_nbr": 9485,
          "start_time": "",
          "descrlong": "Prerequisite(s): CS 4580F/G and permission of the instructor.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PERMISSION REQUIRED."
        }
      ],
      "catalog_description": "The course comprises the research component of the Vindolanda Field School. Students will write a research paper focused on some aspect of Roman history or archaeology. These papers should be related to or inspired by the student's experiences at Vindolanda but need not be about the site itself.\n\nExtra Information: 1 tutorial hour."
    },
    {
      "catalog_nbr": "4999E",
      "subject": "CLASSICS",
      "className": "HONORS THESIS",
      "course_info": [
        {
          "class_nbr": 3880,
          "start_time": "",
          "descrlong": "Prerequisite(s): At least 1.0 course at the 3000-level in the discipline area of the thesis topic and permission of Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PERMISSION OF DEPARTMENT REQUIRED."
        }
      ],
      "catalog_description": "Instruction in selection of topic, directed readings, research and writing of thesis. Restricted to fourth year students normally registered in the Honours Specialization in Classical Studies with a modular average of at least 80%. Application to the Undergraduate Chair of Classical Studies will be required by the April preceding the student's final year.\n\nExtra Information: 1 tutorial hour."
    },
    {
      "catalog_nbr": "3317A",
      "subject": "COMMSCI",
      "className": "HUMAN RHYTHMS",
      "course_info": [
        {
          "class_nbr": 9245,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Completion of two years of an undergraduate degree.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "EC-1548",
          "days": [
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "The human body produces many rhythms from the brain, heart, muscles, ears, and voice. This course introduces the basics of working with physiological signals measured from the human body to assess function. Beginners will develop programming skills useful in diverse areas like neuroscience, psychology, medical sciences, audiology, health, and rehabilitation.\n\nExtra Information: 2 lecture hours per week, 1 laboratory hour per week."
    },
    {
      "catalog_nbr": "4411A",
      "subject": "COMMSCI",
      "className": "INTRO SPEECH/LANG DISORDS",
      "course_info": [
        {
          "class_nbr": 1495,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Completion of two years of an undergraduate degree.",
          "end_time": "4:00 PM",
          "campus": "Main",
          "facility_ID": "FNB-1250",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "OPEN TO ALL STUDENTS."
        }
      ],
      "catalog_description": "A survey course focusing on the incidence, etiology, and symptomatology of speech and language disorders in children and adults. Designed to provide students with a general understanding of the types of speech, voice, and language disorders identified and treated by speech-language pathologists.\n\nAntirequisite(s): The former Communication Disorders 4411F/G. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4417A",
      "subject": "COMMSCI",
      "className": "HEARING SCIENCE",
      "course_info": [
        {
          "class_nbr": 5377,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Completion of two years of an undergraduate degree.",
          "end_time": "2:00 PM",
          "campus": "Main",
          "facility_ID": "EC-1547",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "The study of human hearing from acoustics to the physiological and psychological correlates of sound. Topics include physical acoustics, anatomy, physiology, sensitivity, masking, loudness, pitch, binaural phenomena, and auditory streams. Course activities provide experience in acoustical calculations and psychoacoustic experimentation and data analysis. \n\nExtra Information: 3 lecture hours, 1 laboratory/tutorial hour."
    },
    {
      "catalog_nbr": 1060,
      "subject": "COMPLIT",
      "className": "BACK TO THE FUTURE",
      "course_info": [
        {
          "class_nbr": 11524,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "TC-205",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "How has the “the future” been imagined ever since antiquity and in ever more contemporary and global visions? Conceiving of time and visions for tomorrow, past and present thinkers, artists, and scientists contemplate the unknown: utopias and dystopias, being human in an age of the machine, AI, the Anthropocene and beyond.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2105A",
      "subject": "COMPLIT",
      "className": "SP TOPICS COMP LIT & CULTURE",
      "course_info": [
        {
          "class_nbr": 11215,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-56",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH ITALIAN 2280A AND FILM 2197A. TOPIC: SPAGHETTI WESTERNS (ORIGINS, LEGACY AND POPULAR CINEMA, FROM SERGIO LEONE TO QUENTIN TARANTINO)"
        }
      ],
      "catalog_description": "Please consult the Department for current offerings.\n\nAntirequisite(s): The former CLC 2191F/G - 2194F/G.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2141B",
      "subject": "COMPLIT",
      "className": "HEALTH IN MIDDLE AGES",
      "course_info": [
        {
          "class_nbr": 9817,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "LWH-2210",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH MEDIEVAL STUDIES 2024B."
        }
      ],
      "catalog_description": "Discover the fascinating world of medieval food culture and explore the role nutrition played in the theory of health and wellness. Study the presumed medicinal properties of the foodstuffs available in pre-Columbian Europe, their preparation and consumption, and try your hands on period recipes from the different regions.\n\nExtra Information: 3 lecture hours, counts towards Medieval Studies module."
    },
    {
      "catalog_nbr": "2291G",
      "subject": "COMPLIT",
      "className": "SPEC TOPIC IN COMP LIT & CULTR",
      "course_info": [
        {
          "class_nbr": 11225,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): World Literatures and Cultures 1030, CLC 1010, or CLC 1040 or CLC 1050E or the former CLC 1020 or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH ICC 2200G AND GERMAN 2260G. TOPIC: NOT \"LOST IN TRANSLATION\": PRACTICE & THEORY OF INTERCULTURAL COMMUNICATION."
        }
      ],
      "catalog_description": "Please consult Department for current offering. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2500F",
      "subject": "COMPLIT",
      "className": "BRIDGING CLASSROOM & COMMUNITY",
      "course_info": [
        {
          "class_nbr": 5894,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): World Literatures and Cultures 1030, CLC 1010, or CLC 1040 or CLC 1050E or the former CLC 1020 or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH ICC 2500F/GERMAN 2500F/ITALIAN 2500F/SPANISH 2500F."
        }
      ],
      "catalog_description": "Develop intercultural competence by examining individual experiences of learning and maintaining language and of integrating cultural heritage. Connect in-class learning about language acquisition, identity, memory and related issues with service-learning projects in London or the surrounding region.\n\nAntirequisite(s): German 2500F/G, Italian 2500F/G, Spanish 2500F/G, ICC 2500F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2700G",
      "subject": "COMPLIT",
      "className": "WORLD CULTURES, GLOBAL SCREENS",
      "course_info": [
        {
          "class_nbr": 10544,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "PAB-106",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH SPAN 2700G AND FILM 2191G."
        }
      ],
      "catalog_description": "Looking at a body of audiovisual texts from the Middle East, Asia, Latin America, Africa and Oceania, this course aims to expose students to a wide range of questions and debates about culture, identity and representation, while also relating these matters to ideas about transnational media and global (art) cinemas.\n\nAntirequisite(s): Spanish 2700F/G; Comparative Literature and Culture 2107A/B or Spanish 2901A/B or Film Studies 2195A/B offered in Fall 2017.\n\nExtra Information: 2-hour Lecture + Screenings. Taught in English."
    },
    {
      "catalog_nbr": "3340F",
      "subject": "COMPLIT",
      "className": "MEDIEVAL LITERATURE & CULTURE",
      "course_info": [
        {
          "class_nbr": 9809,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): World Literatures and Cultures 1030, or CLC 1010, or CLC 1040 or CLC 1050E or the former CLC 1020, or Medieval Studies 1022, Medieval Studies 1025A/B or Medieval Studies 1026A/B or permission of the Department.\nPre-or Corequisite(s): CLC 2200F/G, CLC 3300F/G, or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "LWH-2205",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH GERMAN 3341F AND MEDIEVAL STUDIES 2022F."
        }
      ],
      "catalog_description": "Study the renaissance of the 12th century which revitalized intellectual life in Europe, and the first great works of chivalry and romantic love in their cultural context. Gain knowledge of medieval castle architecture, fashion, food, travel, medicine, sexuality, courtly love, and the hunt in text and image.\n\nAntirequisite(s): The former German 4451F/G.\n\nExtra Information: 3 lecture hours. Counts towards Medieval Studies modules."
    },
    {
      "catalog_nbr": "3350G",
      "subject": "COMPLIT",
      "className": "WOMEN FILMMAKERS",
      "course_info": [
        {
          "class_nbr": 9795,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UC-1401",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH WOMEN'S STUDIES 3357G, SPAN 3350G AND FILM 3311G."
        }
      ],
      "catalog_description": "This course explores the notion of women’s cinema in relation to the work of women directors, with an emphasis on contemporary voices. While offering a critical overview of feminist scholarship within film studies, a wide range of case studies are discussed in light of questions about gender and representation.\n\nAntirequisite(s): Spanish 3350F/G; Special Topics in Spanish 3901F/G or Film Studies 3311F/G or Women’s Studies 3375F/G offered in Winter 2018.\n\nExtra Information: 2-hour Lecture + Screenings. Taught in English."
    },
    {
      "catalog_nbr": "1025A",
      "subject": "COMPSCI",
      "className": "COMP SCI FUNDAMENTALS I",
      "course_info": [
        {
          "class_nbr": 11754,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "The nature of Computer Science as a discipline; the design and analysis of algorithms and their implementation as modular, reliable, well-documented programs written in a modern programming language. Intended for students with significant programming experience in at least one high-level block-structured or object-oriented language. \n\nAntirequisite(s): Computer Science 1026A/B, Computer Science 2120A/B, Engineering Science 1036A/B, Digital Humanities 2220A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1026A",
      "subject": "COMPSCI",
      "className": "COMP SCI FUNDAMENTALS I",
      "course_info": [
        {
          "class_nbr": 1340,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "NO PREVIOUS PROGRAMMING EXPERIENCE IS REQUIRED."
        }
      ],
      "catalog_description": "The nature of Computer Science as a discipline; the design and analysis of algorithms and their implementation as modular, reliable, well-documented programs written in a modern programming language. Intended for students with little or no background in programming. \n\nAntirequisite(s): Computer Science 1025A/B, Computer Science 2120A/B, Engineering Science 1036A/B, Digital Humanities 2220A/B.\n\nExtra Information: 3 lecture hours, 2 laboratory/tutorial hours."
    },
    {
      "catalog_nbr": "1026B",
      "subject": "COMPSCI",
      "className": "COMP SCI FUNDAMENTALS I",
      "course_info": [
        {
          "class_nbr": 1341,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "WSC-55",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "NO PREVIOUS PROGRAMMING EXPERIENCE IS REQUIRED."
        }
      ],
      "catalog_description": "The nature of Computer Science as a discipline; the design and analysis of algorithms and their implementation as modular, reliable, well-documented programs written in a modern programming language. Intended for students with little or no background in programming. \n\nAntirequisite(s): Computer Science 1025A/B, Computer Science 2120A/B, Engineering Science 1036A/B, Digital Humanities 2220A/B.\n\nExtra Information: 3 lecture hours, 2 laboratory/tutorial hours."
    },
    {
      "catalog_nbr": "1027A",
      "subject": "COMPSCI",
      "className": "COMP SCI FUNDAMENTALS II",
      "course_info": [
        {
          "class_nbr": 5455,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Computer Science 1025A/B, Computer Science 1026A/B, or Engineering Science 1036A/B, (in each case with a mark of at least 65%).",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-236",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "A continuation for both Computer Science 1025A/B and Computer Science 1026A/B. Data organization and manipulation; abstract data types and their implementations in a modern programming language; lists, stacks, queues, trees; pointers; recursion; file handling and storage. \n\nAntirequisite(s): Computer Science 1037A/B, Computer Science 2121A/B, Digital Humanities 2221A/B.\n\nExtra Information: 3 lecture hours, 1 laboratory/tutorial hour."
    },
    {
      "catalog_nbr": "2174A",
      "subject": "DANCE",
      "className": "DANCE BASICS",
      "course_info": [
        {
          "class_nbr": 10978,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN YRS 2 & 3."
        }
      ],
      "catalog_description": "Students with no previous dance training develop movement awareness, coordination and skill through practice and analysis of basic movements and combinations from dance types such as modern, ballet, theatre, character and ballroom. Learning will include rhythm components associated with step and movement patterns.\n\nExtra Information: 6 lecture/laboratory hours."
    },
    {
      "catalog_nbr": "2270A",
      "subject": "DANCE",
      "className": "DANCE IMPROVISATION",
      "course_info": [
        {
          "class_nbr": 2016,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO ALL YRS 2, 3 & 4 DANCE MINOR, KINESIOLOGY AND MUSIC STUDENTS (10 SEATS RESERVED FOR DANCE MINOR STUDENTS). OPEN JULY 19 TO ALL SENIOR STUDENTS."
        }
      ],
      "catalog_description": "Students will explore improvisation as a process that facilitates the spontaneous response to cues and stimuli for the purpose of opening doorways to their own movement creativity. Topics will consider relaxation, improvisational states, structures for improvisations, participant and leader roles, building group trust, and the progression from spontaneity to form. \r\n\r\nExtra Information: 1 lecture hour, 3 laboratory hours."
    },
    {
      "catalog_nbr": "2274B",
      "subject": "DANCE",
      "className": "MOVEMENT MAKING",
      "course_info": [
        {
          "class_nbr": 3467,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Previous movement training or experience is recommended.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO ALL YRS 2, 3 & 4 DANCE MINOR, KINESIOLOGY AND MUSIC STUDENTS (10 SEATS RESERVED FOR DANCE MINOR STUDENTS). OPEN JULY 19 TO ALL SENIOR STUDENTS."
        }
      ],
      "catalog_description": "The ability to create movement combinations, patterns, and sequences based on specific guidelines or components is essential for those who work in applied movement fields such as fitness, recreation, and teaching. The building process, understanding and use of essential and accessory ingredients, and development of instructor skills will be considered. \n\nExtra Information: 4 lecture/laboratory hours."
    },
    {
      "catalog_nbr": "2275A",
      "subject": "DANCE",
      "className": "INTRO MODERN DANCE TECH",
      "course_info": [
        {
          "class_nbr": 2015,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Previous dance training or experience required.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "Development of movement skills and application of theoretical knowledge that will assist the student in understanding and appreciating Modern Dance as a physical activity and an art form. \n\nExtra Information: 6 lecture/laboratory hours."
    },
    {
      "catalog_nbr": "2275B",
      "subject": "DANCE",
      "className": "INTRO MODERN DANCE TECH",
      "course_info": [
        {
          "class_nbr": 3685,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Previous dance training or experience required.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "Development of movement skills and application of theoretical knowledge that will assist the student in understanding and appreciating Modern Dance as a physical activity and an art form. \n\nExtra Information: 6 lecture/laboratory hours."
    },
    {
      "catalog_nbr": "2276B",
      "subject": "DANCE",
      "className": "ELEM MODERN DANCE TECH",
      "course_info": [
        {
          "class_nbr": 4619,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Dance 2275A/B",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO ALL YRS 2, 3 & 4 DANCE MINOR, KINESIOLOGY AND MUSIC STUDENTS (10 SEATS RESERVED FOR DANCE MINOR STUDENTS). OPEN JULY 19 TO ALL SENIOR STUDENTS."
        }
      ],
      "catalog_description": "Studies begun in Dance 2275A/B are continued and developed to give a deeper understanding of the movement skills and theoretical materials that apply to the technical study of Modern Dance. \r\n\r\nExtra Information: 6 lecture/laboratory hours."
    },
    {
      "catalog_nbr": "2375B",
      "subject": "DANCE",
      "className": "BALLET FUNDAMENTALS",
      "course_info": [
        {
          "class_nbr": 3113,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Dance 2275A/B",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Development of classical ballet techniques through in-depth study of body line, posture and weight placement, coordinated use of arms and eyeline, and the relationship between musicality and dynamics. Sessions will be comprised of rigorous ballet classes where the foundations of techniques and movement combinations are discussed as part of the class.\n\nExtra Information: 6 hours lecture/laboratory."
    },
    {
      "catalog_nbr": "2476B",
      "subject": "DANCE",
      "className": "INTRO TO THEATRE DANCE",
      "course_info": [
        {
          "class_nbr": 4620,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 1.0 credit from Dance 2275A/B, Dance 2276A/B, Dance 2375A/B, or permission of Music.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Development of movement skills and application of theoretical knowledge that will assist the student in understanding and appreciating various dance types and styles that are used in musical and theatre productions including modern, tap, jazz, ballroom and Latin American dance.\n\nExtra Information: 6 hours lecture/laboratory."
    },
    {
      "catalog_nbr": "3371A",
      "subject": "DANCE",
      "className": "BEGINNING DANCE COMP & PROD",
      "course_info": [
        {
          "class_nbr": 4617,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Dance 2270A/B, Dance 2274A/B or permission of Music.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "Individual creative movement exploration and problem solving, using the elements of dance to express ideas, feelings and/or images in the finished product of a dance composition. \n\nExtra Information: 2 lecture hours, 2 laboratory hours"
    },
    {
      "catalog_nbr": "3372B",
      "subject": "DANCE",
      "className": "INTERMED DANCE COMP",
      "course_info": [
        {
          "class_nbr": 4616,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Dance 3371A/B",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Group creative movement exploration and problem solving using form and structure of movement to express ideas, feelings and/or images in the finished product of a dance composition. \n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "4472B",
      "subject": "DANCE",
      "className": "SPECIAL TOPICS IN DANCE",
      "course_info": [
        {
          "class_nbr": 11722,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Selected topics in the area of dance. Topics and course descriptions will be available at the Undergraduate Program office. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4491A",
      "subject": "DANCE",
      "className": "INDEPENDENT STUDY IN DANCE",
      "course_info": [
        {
          "class_nbr": 3892,
          "start_time": "11:00 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "AH-17",
          "days": [
            "M",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS IN THE DANCE MINOR."
        }
      ],
      "catalog_description": "Reading and discussion on, or field experience in, selected topics in Dance agreed upon through consultation between the student and the supervising professor."
    },
    {
      "catalog_nbr": "4492A",
      "subject": "DANCE",
      "className": "INDEPENDENT STUDY IN DANCE",
      "course_info": [
        {
          "class_nbr": 6367,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "TOPIC: DANCE CHOREOGRAPHY."
        }
      ],
      "catalog_description": "Reading and discussion on, or field experience in, selected topics in Dance agreed upon through consultation between the student and the supervising professor."
    },
    {
      "catalog_nbr": "4492B",
      "subject": "DANCE",
      "className": "INDEPENDENT STUDY IN DANCE",
      "course_info": [
        {
          "class_nbr": 2081,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "INDEPENDENT STUDY."
        }
      ],
      "catalog_description": "Reading and discussion on, or field experience in, selected topics in Dance agreed upon through consultation between the student and the supervising professor."
    },
    {
      "catalog_nbr": "2001A",
      "subject": "DIGICOMM",
      "className": "SOCIAL MEDIA",
      "course_info": [
        {
          "class_nbr": 3499,
          "start_time": "2:30 PM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-63",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "A study of the principles and production of social media through which students will gain an understanding of online information architecture and organization. Students will learn the techniques and critical skills required for creating and managing content on a variety of platforms including, but not limited to, web sites, blogs, twitter, and Facebook. \r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2001B",
      "subject": "DIGICOMM",
      "className": "SOCIAL MEDIA",
      "course_info": [
        {
          "class_nbr": 6338,
          "start_time": "2:30 PM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-60",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "A study of the principles and production of social media through which students will gain an understanding of online information architecture and organization. Students will learn the techniques and critical skills required for creating and managing content on a variety of platforms including, but not limited to, web sites, blogs, twitter, and Facebook. \r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2002B",
      "subject": "DIGICOMM",
      "className": "VIRTUAL WORLDS",
      "course_info": [
        {
          "class_nbr": 3498,
          "start_time": "7:00 PM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "FNB-1220",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "A study of principles and production through which students will gain an understanding of theoretical and practical applications of virtual worlds and simulation spaces. Students will learn the techniques and critical skills required for creating and managing communities, identities and interactivity in virtual and online worlds.\r\n\r\nExtra Information: 3 hours"
    },
    {
      "catalog_nbr": "2200G",
      "subject": "DIGICOMM",
      "className": "SOCIAL NETWORKING",
      "course_info": [
        {
          "class_nbr": 4634,
          "start_time": "2:30 PM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1200",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "In today's online environment, social networking sites (SNSs) have altered the social landscape. Students will become fluent in the theoretical and practical aspects of social networking, in addition to understanding its contexts and social issues such as bullying, anonymity, addiction, anxiety, and narcissism. This course will introduce the conceptual tools required to carry out a group work component.\n\nAntirequisite(s): The former MIT 2374F/G, MIT 3375F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2203A",
      "subject": "DIGICOMM",
      "className": "INTRO TO WEB DESIGN & DIGITAL",
      "course_info": [
        {
          "class_nbr": 3869,
          "start_time": "9:30 AM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "NCB-105",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "This course focuses on the design and production of information for websites. While learning the basics of information architecture and usability, students will also discover how to use XHTML and CSS for the creation of static websites. Key concepts in digital imaging, such as image compression will also be introduced.\r\n\r\nAntirequisite(s): MIT 2570A/B, Registration in the MTP Program. \r\n\r\nExtra Information: 1 lecture hour, 3 laboratory hours"
    },
    {
      "catalog_nbr": "2203B",
      "subject": "DIGICOMM",
      "className": "INTRO TO WEB DESIGN & DIGITAL",
      "course_info": [
        {
          "class_nbr": 4219,
          "start_time": "2:30 PM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-105",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "This course focuses on the design and production of information for websites. While learning the basics of information architecture and usability, students will also discover how to use XHTML and CSS for the creation of static websites. Key concepts in digital imaging, such as image compression will also be introduced.\r\n\r\nAntirequisite(s): MIT 2570A/B, Registration in the MTP Program. \r\n\r\nExtra Information: 1 lecture hour, 3 laboratory hours"
    },
    {
      "catalog_nbr": "2204A",
      "subject": "DIGICOMM",
      "className": "INTRO TO GRAPHIC DESIGN",
      "course_info": [
        {
          "class_nbr": 7474,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-2070",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS."
        }
      ],
      "catalog_description": "This course introduces the student to the concepts of visual literacy. Study concentrates on the elements and principles of basic two dimensional designs, visual communication and its objective theoretical application. Current industry standard vector-based, bitmap-based and presentation software applications are introduced to allow the student to practice and exercise visual literacy. Emphasis will be fall on the professional and applied applications of this topic.\r\n\r\nAntirequisite(s): MIT 2600A/B, Registration in the MTP Program. \r\n\r\nExtra Information: 3 lecture hours"
    },
    {
      "catalog_nbr": "2305F",
      "subject": "DIGICOMM",
      "className": "SPECIAL TOPICS",
      "course_info": [
        {
          "class_nbr": 11340,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-9",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS. TOPIC: FUNDAMENTALS OF DIGITAL MARKETING."
        }
      ],
      "catalog_description": "Extra Information: 3 hours."
    },
    {
      "catalog_nbr": "2305G",
      "subject": "DIGICOMM",
      "className": "SPECIAL TOPICS",
      "course_info": [
        {
          "class_nbr": 11341,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-11",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS. TOPIC: FUNDAMENTALS OF DIGITAL MARKETING."
        }
      ],
      "catalog_description": "Extra Information: 3 hours."
    },
    {
      "catalog_nbr": "3204F",
      "subject": "DIGICOMM",
      "className": "SEARCH ENGINES & WEB DATA",
      "course_info": [
        {
          "class_nbr": 10454,
          "start_time": "10:30 AM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-2070",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "The course will examine how search engines are built, how they work, and how to evaluate them. The course will introduce basic concepts and techniques of Web data mining including Web hyperlink analysis, Web traffic analysis and Web server log analysis. Emphasis will be fall on the professional and applied applications of this topic.\n\nExtra Information: 2 lecture hours, 1 laboratory hour."
    },
    {
      "catalog_nbr": "3205F",
      "subject": "DIGICOMM",
      "className": "NET-WORK: LABOUR & PROFIT",
      "course_info": [
        {
          "class_nbr": 11281,
          "start_time": "9:30 AM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-65",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course will explore the impact that User-Generated Content, Social Networks have had on contemporary conceptions of labour and work. Through the lens of Autonomist Marxism and related theory, the course will consider the changes taking place in labour processes and the products being produced by this shift to immaterial work. Emphasis will be on the professional and applied applications of this topic, with special attention payed to ethics of and exploitation within knowledge work and digital labour.\r\n\r\nAntirequisite(s): MIT 3133F/G.\r\n\r\nExtra Information: 3 lecture hours"
    },
    {
      "catalog_nbr": "3206G",
      "subject": "DIGICOMM",
      "className": "VIDEO GAME CULTURE",
      "course_info": [
        {
          "class_nbr": 10456,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1105",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS. CROSS-LISTED WITH MIT 3371G."
        }
      ],
      "catalog_description": "Video games have a profound influence on popular culture, digital technology, and the entertainment industry. This course examines the fundamentals of video games, their role in culture and society, how they are used for different ends, and the benefits and concerns associated with their use.\n\nAntirequisite(s): MIT 3371F/G. \n\nExtra Information: 3 lecture hours"
    },
    {
      "catalog_nbr": "3209F",
      "subject": "DIGICOMM",
      "className": "SOCIAL MEDIA & ORGANIZATIONS",
      "course_info": [
        {
          "class_nbr": 7446,
          "start_time": "12:30 PM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B06",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course provides hands-on experience with building, evaluating, and using social media tools such as blogs, wikis, and social networking websites within an organizational context. Relevant issues such as user privacy, social media policies, effective planning and implementation, and organizational impact will be addressed. Emphasis will be fall on the professional and applied applications of this topic.\r\n\r\nAntirequisite(s): MIT 3373F/G. \r\n\r\nExtra Information: 3 lecture hours"
    },
    {
      "catalog_nbr": "3209G",
      "subject": "DIGICOMM",
      "className": "SOCIAL MEDIA & ORGANIZATIONS",
      "course_info": [
        {
          "class_nbr": 3876,
          "start_time": "9:30 AM",
          "descrlong": "PRIORITY TO DIGITAL COMMUNICATION CERTIFICATE/DIPLOMA STUDENTS. OPEN JULY 19 TO ALL SENIOR STUDENTS.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-2B04",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course provides hands-on experience with building, evaluating, and using social media tools such as blogs, wikis, and social networking websites within an organizational context. Relevant issues such as user privacy, social media policies, effective planning and implementation, and organizational impact will be addressed. Emphasis will be fall on the professional and applied applications of this topic.\r\n\r\nAntirequisite(s): MIT 3373F/G. \r\n\r\nExtra Information: 3 lecture hours"
    },
    {
      "catalog_nbr": "3306B",
      "subject": "DIGICOMM",
      "className": "SPECIAL TOPICS",
      "course_info": [
        {
          "class_nbr": 11344,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-2070",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "REGISTRATION IS THROUGH THE FACULTY OF INFORMATION AND MEDIA STUDIES. MIT 2570A/B OR DIGICOMM 2203A/B REQUIRED. CONTACT FIMS@UWO.CA FOR PERMISSION TO ENROL. TOPIC: ADVANCED WEB DESIGN AND CONTENT STRATEGY."
        }
      ],
      "catalog_description": "Extra Information: 3 hours."
    },
    {
      "catalog_nbr": "2120G",
      "subject": "DIGIHUM",
      "className": "DIGITAL CREATIVITY",
      "course_info": [
        {
          "class_nbr": 11039,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "FNB-2210",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "002",
          "ssr_component": "LAB",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "From recent work in arts, neuroscience and business to exemplary cases of present-day creativity, this course studies and fosters innovation. It provides hands-on experience and collaborative work that will lead to the development of a creative idea into a business plan.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2126F",
      "subject": "DIGIHUM",
      "className": "ETHICS FOR A DIGITAL WORLD",
      "course_info": [
        {
          "class_nbr": 9515,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "WSC-55",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 200,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "BLENDED COURSE: BOTH ONLINE AND IN PERSON INSTRUCTION. CROSS-LISTED WITH PHIL 2078F."
        }
      ],
      "catalog_description": "Through social media, computer gaming, and virtual communities, we spend a considerable portion of our lives in the digital world. What moral considerations ought to guide our conduct as digital citizens? This class will explore cases of online ethical challenges and theories that might provide some answers. \n\nAntirequisite(s): Philosophy 2078F/G. \n\nExtra Information: 3 hours, blended format."
    },
    {
      "catalog_nbr": "2144B",
      "subject": "DIGIHUM",
      "className": "DATA ANALYTICS: PRINCIPLES",
      "course_info": [
        {
          "class_nbr": 4661,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH COMP SCI 2034B."
        }
      ],
      "catalog_description": "A comprehensive and interdisciplinary introduction to data analytics using modern computing systems, with equal attention to fundamentals and practical aspects. Topics include sources of data, data formats and transformation, usage of spreadsheets and databases, statistical analysis, pattern recognition, data mining, big data, and methods for data presentation and visualization. \n\nAntirequisite(s): Computer Science 2034A/B.\n\nExtra Information: 2 lecture hours, 2 laboratory/tutorial hours."
    },
    {
      "catalog_nbr": "2220A",
      "subject": "DIGIHUM",
      "className": "COMPUTING & INFORMATICS I",
      "course_info": [
        {
          "class_nbr": 3653,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Computer Science 1033A/B or Digital Humanities 1011A/B.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "B&GS-0165",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH COMP SCI 2120A."
        }
      ],
      "catalog_description": "Essential information processing skills for humanities students. Includes an introduction to programming; creating programs and scripts to address problems that arise in applied research; examples of data sets and projects drawn from different areas of the humanities and social science. No previous formal programming background required.\n\nAntirequisite(s): Computer Science 1025A/B or Computer Science 1026A/B, Engineering Science 1036A/B, Computer Science 2120A/B. \n\nExtra Information: 3 lecture hours, 1 laboratory/tutorial hour."
    },
    {
      "catalog_nbr": "2221B",
      "subject": "DIGIHUM",
      "className": "MODERN SURVIVAL SKILLS II",
      "course_info": [
        {
          "class_nbr": 3657,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Digital Humanities 2220A/B.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-114",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH COMP SCI 2121B."
        }
      ],
      "catalog_description": "An overview of core data structures and algorithms in computing, with a focus on applications to informatics and analytics in a variety of disciplines. Includes lists, stacks, queues, trees, graphs, and their associated algorithms; sorting, searching, and hashing techniques. Suitable for non-Computer Science students.\n\nAntirequisite(s): Computer Science 2210A/B, Software Engineering 2205A/B, Computer Science 2121A/B. \n\nExtra Information: 3 lecture hours, 1 laboratory/tutorial hour."
    },
    {
      "catalog_nbr": "3220A",
      "subject": "DIGIHUM",
      "className": "DATABASES FOR THE HUMANITIES",
      "course_info": [
        {
          "class_nbr": 4252,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Digital Humanities 2221A/B.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "TC-141",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH CS 3319A AND CS 3120A."
        }
      ],
      "catalog_description": "A study of modern database systems and their applications to and use in humanities and social science projects. Topics include database design, querying, administration, security, and privacy.\n\nAntirequisite(s): Computer Science 3319A/B, Software Engineering 3352A/B, Computer Science 3120A/B. \n\nExtra Information: 2 lecture hours, 2 laboratory/tutorial hours."
    },
    {
      "catalog_nbr": "3600G",
      "subject": "DIGIHUM",
      "className": "INTERNSHIP DIGITAL HUMANITIES",
      "course_info": [
        {
          "class_nbr": 11659,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department. Registration in the third or fourth year of a module in Digital Humanities, with a minimum cumulative modular average of 75%. Approval of, and acceptance into, an internship placement.\n\nPre-or Corequisite(s): Students must have completed or are completing the required courses and at least 50% of the module.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "The Academic Internship is an unpaid, credit internship with minimum of 60 hours. The internship will require students to make connections with academic study while undertaking supervised duties in organizations, businesses or community groups with interests related to Digital Humanities.\n\nExtra Information: Pass or Fail. Students accepted for an internship will arrange individual programs with supervising faculty. The student is required to a) maintain a suitable level of performance in the position as verified by the employer through evaluations and b) submit a mid-term as well as a final report, demonstrating how the experience gained through the internship\nrelates to his/her coursework and program of study."
    },
    {
      "catalog_nbr": "1022A",
      "subject": "EARTHSCI",
      "className": "EARTH ROCKS!",
      "course_info": [
        {
          "class_nbr": 1919,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "NOT AVAILABLE TO YRS 3 & 4 EARTH SCIENCE MODULES."
        }
      ],
      "catalog_description": "What our planet is made of, how it works, and how it affects us. Framed on the interactions of the lithosphere, hydrosphere, atmosphere and biosphere. Specific topics include: geological time and earth history; formation of rocks and minerals; rock deformation; volcanoes and earthquakes; plate tectonics and mountain building; natural resources. \n\nAntirequisite(s): Earth Sciences 1070A/B, Earth Sciences 1081A/B. \n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "1022B",
      "subject": "EARTHSCI",
      "className": "EARTH ROCKS!",
      "course_info": [
        {
          "class_nbr": 1924,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "NOT AVAILABLE TO YRS 3 & 4 EARTH SCIENCE MODULES."
        }
      ],
      "catalog_description": "What our planet is made of, how it works, and how it affects us. Framed on the interactions of the lithosphere, hydrosphere, atmosphere and biosphere. Specific topics include: geological time and earth history; formation of rocks and minerals; rock deformation; volcanoes and earthquakes; plate tectonics and mountain building; natural resources. \n\nAntirequisite(s): Earth Sciences 1070A/B, Earth Sciences 1081A/B. \n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "1023A",
      "subject": "EARTHSCI",
      "className": "PLANET EARTH: SHAKEN & STIRRED",
      "course_info": [
        {
          "class_nbr": 1929,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "WSC-55",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH EARTH SCIENCES 2123F. NOT AVAILABLE TO YRS 3 & 4 EARTH SCIENCE MODULES."
        }
      ],
      "catalog_description": "An overview of the origin and development of Earth and solar system; constitution and active processes of Earth interior; how these processes have shaped Earth evolution in the past and how they continue to control surface phenomena such as earthquake and volcanic activity. Labs will introduce the main resource exploration techniques. \n\nAntirequisite(s): Earth Sciences 2123F/G or the former Earth Sciences 2123A/B.\n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "1023B",
      "subject": "EARTHSCI",
      "className": "PLANET EARTH: SHAKEN & STIRRED",
      "course_info": [
        {
          "class_nbr": 3978,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-146",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH EARTH SCIENCES 2123G. NOT AVAILABLE TO YRS 3 & 4 EARTH SCIENCE MODULES."
        }
      ],
      "catalog_description": "An overview of the origin and development of Earth and solar system; constitution and active processes of Earth interior; how these processes have shaped Earth evolution in the past and how they continue to control surface phenomena such as earthquake and volcanic activity. Labs will introduce the main resource exploration techniques. \n\nAntirequisite(s): Earth Sciences 2123F/G or the former Earth Sciences 2123A/B.\n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "1070A",
      "subject": "EARTHSCI",
      "className": "GEOLOGY & RESOURCES OF EARTH",
      "course_info": [
        {
          "class_nbr": 4648,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "ONLINE COURSE. NOT AVAILABLE TO YRS 3 & 4 EARTH SCIENCE MODULES."
        }
      ],
      "catalog_description": "An introduction to geology covering rock forming minerals and rock forming processes. Emphasis will be placed on how mineral and hydrocarbon resources develop. A survey of the geological record is carried out to illustrate how resources are classified and distributed through time.\n\nAntirequisite(s): Earth Sciences 1022A/B, Earth Sciences 1081A/B. \n\nExtra Information: Only available online, purchase of Rock and Mineral Kit required."
    },
    {
      "catalog_nbr": "1070B",
      "subject": "EARTHSCI",
      "className": "GEOLOGY & RESOURCES OF EARTH",
      "course_info": [
        {
          "class_nbr": 3337,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "ONLINE COURSE. NOT AVAILABLE TO YRS 3 & 4 EARTH SCIENCE MODULES."
        }
      ],
      "catalog_description": "An introduction to geology covering rock forming minerals and rock forming processes. Emphasis will be placed on how mineral and hydrocarbon resources develop. A survey of the geological record is carried out to illustrate how resources are classified and distributed through time.\n\nAntirequisite(s): Earth Sciences 1022A/B, Earth Sciences 1081A/B. \n\nExtra Information: Only available online, purchase of Rock and Mineral Kit required."
    },
    {
      "catalog_nbr": "1083F",
      "subject": "EARTHSCI",
      "className": "LIFE ON PLANET EARTH",
      "course_info": [
        {
          "class_nbr": 1395,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SSC-3022",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "NOT AVAILABLE TO YRS 3 & 4 EARTH SCIENCE MODULES."
        }
      ],
      "catalog_description": "Concepts of the development of life on Earth. Darwinian evolution and modern concepts of evolution. Genetics and evolution. Mode and rate of evolution. A survey of the vertebrate fossil record with focus on particular groups, including dinosaurs. Major extinction events in the fossil record. Origin of the geological time scale.\n\nAntirequisite(s): Earth Sciences 2265A/B,Earth Sciences 2266F/G.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1086F",
      "subject": "EARTHSCI",
      "className": "ORIGIN & GEOLOGY OF SOLAR SYST",
      "course_info": [
        {
          "class_nbr": 3188,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "ONLINE COURSE. NOT AVAILABLE TO YRS 3 & 4 EARTH SCIENCE MODULES."
        }
      ],
      "catalog_description": "Our best perception of the origin of the Universe, the Milky Way Galaxy, and our Solar System, meteorites, asteroids, comets and the formation of planets. The slow growth of Planetary Science reason and analysis of hypotheses. Why and how Earth evolved along a path radically different than the other planets. \n\nAntirequisite(s): Earth Sciences 2232F/G, Astronomy 2201A/B, Astronomy 2232F/G, or the former Earth Sciences 2001F/G.\n\nExtra Information: The equivalent of 3 lecture hours per week. Offered only online (see Western Distance Studies)."
    },
    {
      "catalog_nbr": "1086G",
      "subject": "EARTHSCI",
      "className": "ORIGIN & GEOLOGY OF SOLAR SYST",
      "course_info": [
        {
          "class_nbr": 7307,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE."
        }
      ],
      "catalog_description": "Our best perception of the origin of the Universe, the Milky Way Galaxy, and our Solar System, meteorites, asteroids, comets and the formation of planets. The slow growth of Planetary Science reason and analysis of hypotheses. Why and how Earth evolved along a path radically different than the other planets. \n\nAntirequisite(s): Earth Sciences 2232F/G, Astronomy 2201A/B, Astronomy 2232F/G, or the former Earth Sciences 2001F/G.\n\nExtra Information: The equivalent of 3 lecture hours per week. Offered only online (see Western Distance Studies)."
    },
    {
      "catalog_nbr": "1089G",
      "subject": "EARTHSCI",
      "className": "EARTH, ART & CULTURE",
      "course_info": [
        {
          "class_nbr": 1933,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "B&GS-0153",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "NOT AVAILABLE TO YRS 3 & 4 EARTH SCIENCE MODULES."
        }
      ],
      "catalog_description": "An examination of Earth materials used over the history of human culture. Topics include: Earth materials as media in the Visual Arts (pigments, stone and clay); rocks, minerals and fossils as motifs in famous works of art; landscape photography; gemstones and jewelry; earth materials in wine and cuisine, and modern technology. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2123F",
      "subject": "EARTHSCI",
      "className": "THE DYNAMIC EARTH",
      "course_info": [
        {
          "class_nbr": 1932,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "WSC-55",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH EARTH SCIENCES 1023A."
        }
      ],
      "catalog_description": "An introduction to the Earth as a large heat engine; topics will focus on large scale dynamic processes that occur in the deep interior (mantle and core convection) and their relation to activity and phenomena on the face of the Earth (tectonic plate motions, plate interactions, earth magnetic field, etc.). \n\nAntirequisite(s): Earth Sciences 1023A/B. \n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "2123G",
      "subject": "EARTHSCI",
      "className": "THE DYNAMIC EARTH",
      "course_info": [
        {
          "class_nbr": 3981,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-146",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH EARTH SCIENCES 1023B."
        }
      ],
      "catalog_description": "An introduction to the Earth as a large heat engine; topics will focus on large scale dynamic processes that occur in the deep interior (mantle and core convection) and their relation to activity and phenomena on the face of the Earth (tectonic plate motions, plate interactions, earth magnetic field, etc.). \n\nAntirequisite(s): Earth Sciences 1023A/B. \n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "2200A",
      "subject": "EARTHSCI",
      "className": "PLATE TECTNIC THRY, ENVIR & PR",
      "course_info": [
        {
          "class_nbr": 1396,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Any 0.5 Earth Sciences course at the 1000 level or registration in a Major, Specialization, Honours Specialization or Professional program in the Faculty of Science or in the Basic Medical Sciences.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-114",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Rock types and their distribution within the Earth's crust are a result of tectonics, including continental rifting, seafloor spreading, subduction, obduction, and orogenic uplift and collapse. Lectures synthesize and explain major rock types in primary and secondary tectonic settings. Laboratories examine rocks and textures in hand specimens. \n\nExtra Information: 2 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "0011A",
      "subject": "ECONOMIC",
      "className": "INTRODUCTION MICROECONOMICS",
      "course_info": [
        {
          "class_nbr": 7847,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "1:30 PM",
          "facility_ID": "BR-304",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS IN PRELIMINARY YEAR."
        }
      ],
      "catalog_description": "This course introduces students to current Canadian and international economic issues. Students will explore basic economic concepts and reasoning; demand, supply and price; and markets, production and costs.\n\nAntirequisite(s): Ontario High School CIA4U or equivalent.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "0012B",
      "subject": "ECONOMIC",
      "className": "INTRODUCTION TO MACROECONOMICS",
      "course_info": [
        {
          "class_nbr": 7848,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "4:30 PM",
          "facility_ID": "BR-304",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS IN PRELIMINARY YEAR."
        }
      ],
      "catalog_description": "This course introduces students to current Canadian and international economic issues with a focus on large scale economic performance and measuring economic performance, including topics in economic instability and fiscal policy, banking and monetary policy, and international trade and economic growth.\n\nAntirequisite(s): Ontario High School CIA4U or equivalent.\n\nExtra Information: 3 hours.\nStudents are strongly advised to take Economic 0011A/B before taking Economics 0012A/B."
    },
    {
      "catalog_nbr": "1021A",
      "subject": "ECONOMIC",
      "className": "PRINCIPLES OF MICROECONOMICS",
      "course_info": [
        {
          "class_nbr": 2450,
          "start_time": "5:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "The problem of scarcity and its implications, choice; opportunity cost, specialization and exchange; supply and demand; economic choices of households and firms; competition and monopoly; resource markets; public policy; income distribution. \n \nAntirequisite(s): The former Economics 1020. \n\nExtra Information: 2 lecture hours, 1 tutorial hour (Main), 3 lecture hours (Brescia, Huron, King's)"
    },
    {
      "catalog_nbr": "2205A",
      "subject": "ECE",
      "className": "ELECTRIC CIRCUITS",
      "course_info": [
        {
          "class_nbr": 1527,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Physics 1402A/B, Applied Mathematics 1411A/B, Applied Mathematics 1413, Engineering Science 1036A/B or Computer Science 1026A/B. \nCorequisite(s): Applied Mathematics 2270A/B.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2200",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 2 ELECTRICAL, COMPUTER OR MECHATRONIC SYSTEMS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Basic resistive circuits, Ohm's, Kirchhoff's Laws. DC analyis: nodal and mesh analysis. Network theorems: linearity, superposition, Thévenin's and Norton's theorems. Time-domain analysis: first and second order circuits, source-free and forced response. Sinusoidal steady-state analysis: phasors, complex power. Basic OpAmp circuitry. \n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2208B",
      "subject": "ECE",
      "className": "ELECT MEASUREMNT & INSTRMNTATN",
      "course_info": [
        {
          "class_nbr": 2588,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Engineering Science 1036A/B or Computer Science 1026A/B, Physics 1402A/B. \nPre-or-Corequisite(s): Applied Mathematics 2270A/B.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1410",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Measurements: System of units, errors. Basic resistive circuits: Ohm's, Kirchhoff's Laws; DC analyis: nodal and mesh analysis, superposition, Thévenin's/Norton's theorems; Sinusoidal steady-state analysis: phasors, complex power; Basic OpAmp circuitry; Boolean circuits; Transducers.\n\nAntirequisite(s): ECE 2205A/B. \n\nExtra Information: 3 lecture hours, 1 laboratory hour."
    },
    {
      "catalog_nbr": "2231B",
      "subject": "ECE",
      "className": "INTRO TO ELECTRONICS",
      "course_info": [
        {
          "class_nbr": 2403,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): ECE 2205A/B, Physics 1402B or the former Physics 1026",
          "end_time": "8:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1420",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ELECTRICAL AND COMPUTER ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Electronic properties of semiconductors. The P-N junction. Diodes and light-emitting diodes; bipolar and field-effect transistors. Biasing, small signal analysis, large signal analysis. Single transistor amplifiers.\n\nExtra Information: 3 lecture hours, 1 tutorial hour, 1 laboratory hour."
    },
    {
      "catalog_nbr": "2233B",
      "subject": "ECE",
      "className": "CIRCUITS AND SYSTEMS",
      "course_info": [
        {
          "class_nbr": 1534,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 2270A/B, ECE 2205A/B. \nCorequisite(s): Applied Mathematics 2276A/B.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1450",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Introduction to a system level analysis of electrical circuits. The S-Plane and frequency response of circuits, frequency selective circuits, state variables, introduction to Fourier analysis, Fourier transform and Laplace transform techniques. Transfer functions and system functions.\n\nAntirequisite(s): MSE 2233A/B.\n\nExtra Information: 3 lecture hours, 1 tutorial hour, 1 laboratory hour."
    },
    {
      "catalog_nbr": "2236B",
      "subject": "ECE",
      "className": "MAGNTC CRCTS & TRANSMSSN LINES",
      "course_info": [
        {
          "class_nbr": 1538,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 2270A/B, ECE 2205A/B,Physics 1402A/B. \nCorequisite(s): Applied Mathematics 2276A/B.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1240",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Three phase circuits, magnetic coupling and circuits, transformers. Transmission lines and the telegrapher equation.\n\nExtra Information: 3 lecture hours, 3 hour lab sessions (4 labs per term)."
    },
    {
      "catalog_nbr": "2238B",
      "subject": "ECE",
      "className": "INTRO TO ELECTRICAL ENGINEERNG",
      "course_info": [
        {
          "class_nbr": 2590,
          "start_time": "5:30 PM",
          "descrlong": "Prerequisite(s): Engineering Science 1036A/B or Computer Science 1026A/B, Physics 1402A/B.\nPre-Corequisite(s): Applied Mathematics 2270A/B.",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2200",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO SOFTWARE, GREEN PROCESS AND INTEGRATED ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "DC circuit analysis, fundamentals of DC circuit analysis, Ohm's Law, KCL, KVL, Thévenin and Norton Equivalent circuits, maximum power transfer; linear analog circuits, diodes, transistors, operational amplifiers, biasing, gain, frequency response.\n\nAntirequisite(s): ECE 2205A/B, ECE 2231A/B. \n\nExtra Information: 3 lecture hours, 1 tutorial hour, 1 laboratory hour."
    },
    {
      "catalog_nbr": "2240A",
      "subject": "ECE",
      "className": "ELECTRICAL LABORATORY I",
      "course_info": [
        {
          "class_nbr": 1805,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Computer Science 1026A/B or Engineering Science 1036A/B.\n\nCorequisite(s): ECE 2205A/B.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2100",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Laboratory experiments associated with ECE 2205A/B, as well as laboratory experiments in instrumentation and measurement; the lecture component includes review of laboratory practice, health and safety issues, simulation software, data collecting methods; errors and their calculus; accuracy; averaging, signal conditioning, and data interpolation. \n\nExtra Information: 1 lecture hour, 3 laboratory hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2242B",
      "subject": "ECE",
      "className": "PRINCIPLES OF DESIGN",
      "course_info": [
        {
          "class_nbr": 6891,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): ECE 2240A/B, ECE 2277A/B, ECE 2205A/B.\nCorequisite(s): ECE 2231A/B.",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1410",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Introduction to electrical engineering design. Topics include the engineering design process, review of sensors and signal conditioning, digital system design, analog system design, programmable logic controllers (PLCs).\n\nExtra Information: 2 lecture hour, 3 laboratory hours."
    },
    {
      "catalog_nbr": "2277A",
      "subject": "ECE",
      "className": "DIGITAL LOGIC SYSTEMS",
      "course_info": [
        {
          "class_nbr": 2388,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Physics 1402A/B or the former Physics 1026.\nCorequisite(s): ECE 2205A/B or registration in Integrated Engineering or Software Engineering Program.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO INTEGRATED, SOFTWARE, ELECTRICAL, COMPUTER AND MECHATRONIC SYSTEMS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Theory of Boolean algebra, switching circuits, Venn diagrams; Karnaugh maps; logic and memory systems, design of combinational and sequential switching machines; electronic switching circuits; data coding, storage, transmission; basic design of digital computers.\n\nAntirequisite(s): The former ECE 3339A/B. \n\nExtra Information: 3 lecture hours, 2 laboratory hours, 1 tutorial."
    },
    {
      "catalog_nbr": "1021A",
      "subject": "ENGSCI",
      "className": "PROPERTIES OF MATERIALS",
      "course_info": [
        {
          "class_nbr": 1585,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "NS-145",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "An introduction to the relationship between the microstructure and engineering properties of metals, ceramics, polymers, semi-conductors and composites. \n\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "1021B",
      "subject": "ENGSCI",
      "className": "PROPERTIES OF MATERIALS",
      "course_info": [
        {
          "class_nbr": 1586,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "NS-145",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "An introduction to the relationship between the microstructure and engineering properties of metals, ceramics, polymers, semi-conductors and composites. \n\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "1022Y",
      "subject": "ENGSCI",
      "className": "ENGINEERING STATICS",
      "course_info": [
        {
          "class_nbr": 3382,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "TC-141",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Analysis of forces on structures and machines, including addition and resolution of forces and moments in two and three-dimensions. The application of the principles of equilibrium. Topics: trusses; frames; friction; and centroids. \n\nExtra Information: 2 lecture hours/week; 1 tutorial hour/week for ten weeks each term - this is equivalent to 3 lecture hours/week and 2 tutorial hours/week over one term."
    },
    {
      "catalog_nbr": "1036A",
      "subject": "ENGSCI",
      "className": "PRGRMMNG FUNDAMNTLS FOR ENGNRS",
      "course_info": [
        {
          "class_nbr": 2115,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "NS-7",
          "days": [
            "M",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Designing, implementing and testing computer programs using Java and MATLAB to fulfill given specifications for small problems using sound engineering principles and processes. Awareness of the engineering aspects of the process of constructing a computer program.\n\nAntirequisite(s): Computer Science 1025A/B, Computer Science 1026A/B. \n\nExtra Information: 3 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "1036B",
      "subject": "ENGSCI",
      "className": "PRGRMMNG FUNDAMNTLS FOR ENGNRS",
      "course_info": [
        {
          "class_nbr": 2121,
          "start_time": "1:30 PM",
          "descrlong": "RESTRICTED TO ENGINEERING STUDENTS.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Designing, implementing and testing computer programs using Java and MATLAB to fulfill given specifications for small problems using sound engineering principles and processes. Awareness of the engineering aspects of the process of constructing a computer program.\n\nAntirequisite(s): Computer Science 1025A/B, Computer Science 1026A/B. \n\nExtra Information: 3 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": 1050,
      "subject": "ENGSCI",
      "className": "FOUNDATIONS OF ENG PRACTICE",
      "course_info": [
        {
          "class_nbr": 1836,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ENGINEERING STUDENTS. TU 1:30-3:30 PM HELD SEPT-DEC IN 3M 3250 AND JAN-APRIL IN HSB 35."
        }
      ],
      "catalog_description": "Introduction to the principles and practices of professional engineering. The design studio fosters innovative thinking, improves problem solving, and provides context. Includes elements of need recognition, conceptualization, prototyping, and engineering design to satisfy commercial specifications. Emphasis on creativity, teamwork, communication and engineering skills necessary to practice in any engineering discipline.\n\nExtra Information: 3 lecture hours, 4 laboratory/tutorial hours."
    },
    {
      "catalog_nbr": "0005W",
      "subject": "ENGLISH",
      "className": "ENGLISH FOR ACADEMIC PURPOSES",
      "course_info": [
        {
          "class_nbr": 11571,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "12:30 PM",
          "facility_ID": "BR-MRW152",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Combines communication skills through a cross-curricular approach. Students explore complex content from a range of subject areas to gain the foundation required to purposefully read in order to present information and formulate written arguments. Students engage in critical and analytical thinking through readings, and develop listening strategies through class discussions.\n\nExtra Information: 8 class/lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "0005X",
      "subject": "ENGLISH",
      "className": "ENGLISH FOR ACADEMIC PURPOSES",
      "course_info": [
        {
          "class_nbr": 11573,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "12:30 PM",
          "facility_ID": "BR-19",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Combines communication skills through a cross-curricular approach. Students explore complex content from a range of subject areas to gain the foundation required to purposefully read in order to present information and formulate written arguments. Students engage in critical and analytical thinking through readings, and develop listening strategies through class discussions.\n\nExtra Information: 8 class/lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "0011A",
      "subject": "ENGLISH",
      "className": "POETRY AND DRAMA",
      "course_info": [
        {
          "class_nbr": 10966,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "9:30 PM",
          "facility_ID": "BR-203",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is designed to introduce the student to the study of literature with a focus on poetry and drama, and may include examples from film. The course will encourage a critical approach to literature, with special attention to essay-writing skills.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "0012B",
      "subject": "ENGLISH",
      "className": "SHORT STORIES AND NOVELS",
      "course_info": [
        {
          "class_nbr": 10967,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "9:30 PM",
          "facility_ID": "BR-203",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is designed to introduce the student to the study of literature with a focus on short stories and novels. The course will encourage a critical approach to literature, with special attention to essay-writing skills.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1010G",
      "subject": "ENGLISH",
      "className": "THIS UNIVERSITY",
      "course_info": [
        {
          "class_nbr": 9675,
          "start_time": "",
          "descrlong": "Prerequisite(s): Grade 12U English or permission of the Department. For part time students who have been admitted without the OSSD, this permission will be granted as a matter of course.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "ONLINE COURSE."
        }
      ],
      "catalog_description": "Learn about Western, its story, its architecture, academic calendar, governance, codes of conduct, research; and learn about universities, their origins in the Middle Ages, their development and current campus issues. Read a short story by Western’s own Nobel prizewinner Alice Munro, and think about universities in the world today.\n\nExtra Information: 3 hours. Taught in a flexible hybrid format. May not be used as a prerequisite for modules or upper-year courses in English."
    },
    {
      "catalog_nbr": "1020E",
      "subject": "ENGLISH",
      "className": "UNDERSTANDING LITERATURE TODAY",
      "course_info": [
        {
          "class_nbr": 1364,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Grade 12U English or permission of the Department. For part time students who have been admitted without the OSSD, this permission will be granted as a matter of course.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "By studying a broad range of exciting and important literary works from the past and present, this course will increase your understanding and appreciation not just of the richness and power of the works themselves, but also of the role of literature in reflecting and shaping our perceptions of the world and of ourselves.\n\nAntirequisite(s): English 1022E, English 1035E.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1022E",
      "subject": "ENGLISH",
      "className": "ENRICHED INTRO TO ENGLISH LIT",
      "course_info": [
        {
          "class_nbr": 1367,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): 85% or better in Grade 12U English or permission of the Department.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2032",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course provides an enriched survey of the major genres, historical periods, and critical approaches to English for students with a particular interest in literature and culture. In lecture and small group tutorials, you will study poetry, prose, and drama with special emphasis on developing superior analytical and writing skills.\n\nAntirequisite(s): English 1020E, English 1035E. \n\n Extra Information: 3 hours."
    },
    {
      "catalog_nbr": "1024E",
      "subject": "ENGLISH",
      "className": "FORMS OF FICTION",
      "course_info": [
        {
          "class_nbr": 8449,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Grade 12U English or permission of the Department. For part time students who have been admitted without the OSSD, this permission will be granted as a matter of course.",
          "end_time": "11:30 AM",
          "campus": "Kings",
          "facility_ID": "KC-SA060",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "An introduction to the study of a selection of fiction ranging from the Greek epic to the modern novel, including both short and longer forms; and a variety of fictional modes and narrative techniques. Major authors studied include Homer, Swift, Austen, Dickens, Dostoevsky, and Virginia Woolf.\n\nAntirequisite(s): English 1027F/G, English 1028F/G, English 1036E. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1027F",
      "subject": "ENGLISH",
      "className": "STORYTELLER'S ART I:INTRO TO N",
      "course_info": [
        {
          "class_nbr": 2821,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Grade 12U English or permission of the Department. For part time students who have been admitted without the OSSD, this permission will be granted as a matter of course.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "WSC-55",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Storytelling defines who we are and our relation to the community, the nation, and the world. This course explores the rich and diverse traditions of storytelling: such as, oral tales, short stories, classic fiction, and graphic novels. Instruction by lecture and tutorials; emphasis on developing strong analytical and writing skills.\n\nAntirequisite(s): English 1024E, English 1036E. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "4900E",
      "subject": "EPIDEMIO",
      "className": "RESEARCH PROJECT & SEMINAR",
      "course_info": [
        {
          "class_nbr": 4420,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Biostatistics 3110B and Epidemiology 3210B, with marks of at least 70% in each; and registration in an Honours Specialization in Epidemiology and Biostatistics.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "KB-K203",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YEAR 4 HONORS SPECIALIZATION IN EPIDEMIOLOGY AND BIOSTATISTICS."
        }
      ],
      "catalog_description": "An applied research course in which students use skills in identifying and clarifying a research question, methodologically critical review of literature, identifying data sources, conducting appropriate statistical analyses, interpreting results, and presenting findings orally, in posters, and in written technical reports or journal manuscripts.\n\nExtra Information: 10 hours per week."
    },
    {
      "catalog_nbr": "3999A",
      "subject": "FIMS",
      "className": "INTERNSHIP",
      "course_info": [
        {
          "class_nbr": 11248,
          "start_time": "",
          "descrlong": "Prerequisite(s): Registration in the third or fourth year of either a Major or Honours Specialization module within the Faculty of Information & Media Studies, with a cumulative average of at least 70%, no more than 1.0 failure in a non-FIMS course, and no documented academic offences. Approval of, and acceptance into, an internship placement from the Faculty of Information and Media Studies. This course will count towards a Bachelor of Arts degree but will not count towards a module in FIMS.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PERMISSION OF FACULTY REQUIRED."
        }
      ],
      "catalog_description": "The FIMS Internship is a for-credit internship for up to four months, or a minimum of 140 hours. The internship will require students to make connections with academic study while undertaking supervised duties in organizations and businesses with media-related or information-related interests, public service organizations, and community groups. \n\nExtra Information: Pass/Fail.\nThe student is required to a) complete an Internship Experience Proposal b) submit three reflection papers c) complete an internship project and portfolio, demonstrating how the experience gained through the internship relates to his/her degree coursework and d) maintain a satisfactory level of performance in the position as verified by the employer through evaluations."
    },
    {
      "catalog_nbr": "3999B",
      "subject": "FIMS",
      "className": "INTERNSHIP",
      "course_info": [
        {
          "class_nbr": 11249,
          "start_time": "",
          "descrlong": "Prerequisite(s): Registration in the third or fourth year of either a Major or Honours Specialization module within the Faculty of Information & Media Studies, with a cumulative average of at least 70%, no more than 1.0 failure in a non-FIMS course, and no documented academic offences. Approval of, and acceptance into, an internship placement from the Faculty of Information and Media Studies. This course will count towards a Bachelor of Arts degree but will not count towards a module in FIMS.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PERMISSION OF FACULTY REQUIRED."
        }
      ],
      "catalog_description": "The FIMS Internship is a for-credit internship for up to four months, or a minimum of 140 hours. The internship will require students to make connections with academic study while undertaking supervised duties in organizations and businesses with media-related or information-related interests, public service organizations, and community groups. \n\nExtra Information: Pass/Fail.\nThe student is required to a) complete an Internship Experience Proposal b) submit three reflection papers c) complete an internship project and portfolio, demonstrating how the experience gained through the internship relates to his/her degree coursework and d) maintain a satisfactory level of performance in the position as verified by the employer through evaluations."
    },
    {
      "catalog_nbr": 1022,
      "subject": "FILM",
      "className": "INTRODUCTION TO FILM STUDIES",
      "course_info": [
        {
          "class_nbr": 4260,
          "start_time": "6:30 PM",
          "descrlong": "",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2200",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "What is a blockbuster? What is a cult film? What is digital cinema? Discover the answers to these questions and others in a broad introduction to the study of cinema. Students will learn the basic vocabulary of film studies and gain an informed understanding of the different critical approaches to film analysis. \n\nAntirequisite(s): Film Studies 1020E.\n\nExtra Information: 5 hours including screening."
    },
    {
      "catalog_nbr": "2159B",
      "subject": "FILM",
      "className": "DISNEY",
      "course_info": [
        {
          "class_nbr": 6002,
          "start_time": "11:30 AM",
          "descrlong": "WAIT LIST OPTION AVAILABLE JULY 19.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1405",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course offers students a survey of Disney's animated features, non-theatrical films and propaganda film shorts. Students will study Disney film's relationship to art, society and politics and examine constructions of race, class, gender, and sexuality in Disney's filmmaking.\n\nAntirequisite(s): Film Studies 2196A/B, if taken in 2016-2017.\n\nExtra Information: 2 lecture/seminar hours, 1 3-hour lecture/screening."
    },
    {
      "catalog_nbr": "2191G",
      "subject": "FILM",
      "className": "SPECIAL TOPICS IN FILM STUDIES",
      "course_info": [
        {
          "class_nbr": 10550,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "PAB-106",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH SPAN 2700G AND CLC 2700G. TOPIC: WORLD CULTURES, GLOBAL SCREENS."
        }
      ],
      "catalog_description": "Please consult Department for current offerings.\r\n\r\nExtra Information: 2 lecture/tutorial hours, 1 3-hour screening."
    },
    {
      "catalog_nbr": "2195B",
      "subject": "FILM",
      "className": "SPECIAL TOPICS IN FILM STUDIES",
      "course_info": [
        {
          "class_nbr": 6413,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1405",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "TOPIC: THE HORROR FILM."
        }
      ],
      "catalog_description": "Please consult Department for current offerings. \r\n\r\nExtra Information: 2 lecture/tutorial hours, 1 3-hour screening."
    },
    {
      "catalog_nbr": "2197A",
      "subject": "FILM",
      "className": "SPECIAL TOPICS IN FILM STUDIES",
      "course_info": [
        {
          "class_nbr": 11219,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-56",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH ITALIAN 2280A AND CLC 2105A. TOPIC: SPAGHETTI WESTERNS (ORIGINS, LEGACY AND POPULAR CINEMA, FROM SERGIO LEONE TO QUENTIN TARANTINO)"
        }
      ],
      "catalog_description": "Please consult Department for current offerings. \r\n\r\nExtra Information: 2 lecture/tutorial hours, 1 3-hour screening."
    },
    {
      "catalog_nbr": "2198A",
      "subject": "FILM",
      "className": "SPECIAL TOPICS IN FILM STUDIES",
      "course_info": [
        {
          "class_nbr": 9717,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1405",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "TOPIC: CINEMAS OF DYSTOPIA."
        }
      ],
      "catalog_description": "Please consult Department for current offerings. \r\n\r\nExtra Information: 2 lecture/tutorial hours, 1 3-hour screening."
    },
    {
      "catalog_nbr": "2230G",
      "subject": "FILM",
      "className": "CRITICAL READING AND WRITING",
      "course_info": [
        {
          "class_nbr": 11166,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): At least 60% in Film Studies 1020E or Film Studies 1022 or permission of the Department.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1405",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will build on skills and knowledge acquired in Film 1022 to engage students in the critical practices involved in reading various genres of writing in Film Studies. In addition to writing their own film reviews, students will learn research skills that prepare them for writing critical essays on cinema.\n\nExtra Information: 2 lecture hours; 3 screening hours."
    },
    {
      "catalog_nbr": "2254F",
      "subject": "FILM",
      "className": "CLASSICAL HOLLYWOOD CINEMA",
      "course_info": [
        {
          "class_nbr": 6860,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): At least 60% in Film Studies 1020E or Film Studies 1022 or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1405",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course traces a history of American film from the silent period to the end of the studio era. Topics include the establishment of the Hollywood style, major directors/genres, as well as key industrial, technological, and cultural factors in the development of Hollywood cinema.\n\nAntirequisite(s): The former Film Studies 2253E.\n\nExtra Information: 2 lecture/seminar hours, 1 3-hour lecture/screening."
    },
    {
      "catalog_nbr": "2258F",
      "subject": "FILM",
      "className": "CDN CINEMA: DOCS,STORYTELL,EXP",
      "course_info": [
        {
          "class_nbr": 9719,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): At least 60% in Film Studies 1020E or Film Studies 1022 or permission of the Department.",
          "end_time": "7:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1401",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course looks at Canadian cinema in relation to the category label, national cinema. What is the value of a national cinema? What is the popular imagination? How do the films speak to us about Canada, its history, its people and its politics? \n\nExtra Information: 2 lecture/seminar hours, 1 3-hour lecture/screening."
    },
    {
      "catalog_nbr": "3309F",
      "subject": "FILM",
      "className": "FILM AND POPULAR CULTURE",
      "course_info": [
        {
          "class_nbr": 9721,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): At least 60% in Film Studies 1020E or Film Studies 1022 or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1401",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "In this course students are encouraged to develop a critical understanding of the role film plays in shaping popular culture. Topics may include: children's film, dystopian film, and fantasy film.\n\nExtra Information: 2 lecture/seminar hours, 1 3-hour lecture/screening."
    },
    {
      "catalog_nbr": "3311G",
      "subject": "FILM",
      "className": "SPECIAL TOPICS IN FILM STUDIES",
      "course_info": [
        {
          "class_nbr": 5973,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): At least 60% in Film Studies 1020E or Film Studies 1022 or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UC-1401",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH SPANISH 3350G, CLC 3350G AND WOMEN'S STUDIES 3357G. TOPIC: WOMEN FILMMAKERS."
        }
      ],
      "catalog_description": "Please consult the Department for current offerings.\r\n\r\nExtra Information: 2 lecture/seminar hours and a 3-hour lecture/screening."
    },
    {
      "catalog_nbr": "3342G",
      "subject": "FILM",
      "className": "POSTCLASSICAL HOLLYWOOD CINEMA",
      "course_info": [
        {
          "class_nbr": 9723,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): At least 60% in Film Studies 1020E or Film Studies 1022 or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1401",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines the economic, aesthetic, and ideological transformations in American film from the social upheavals of the 1960s and 1970s to the contemporary era of conglomeration, globalization, and digital media. Topics include the fall of the Production Code, the Hollywood Renaissance, American independent cinema, and the global blockbuster.\n\nAntirequisite(s): Film Studies 2242F/G in 2017; Film Studies 2254E in 2013-2015.\n\nExtra Information: 2 lecture/seminar hours, 1 3-hour lecture/screening."
    },
    {
      "catalog_nbr": "3357F",
      "subject": "FILM",
      "className": "SCIENCE FICTION CINEMA",
      "course_info": [
        {
          "class_nbr": 11168,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): At least 60% in Film Studies 1020E or Film Studies 1022 or permission of the Department.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1405",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course explores the history and development of Science Fiction cinema from the silent period to today’s CGI-saturated spectacles. Major themes include: the aesthetics of science fiction, modernity and social change, utopias/dystopias, technophobia/technophilia, identity/otherness, biopolitics, afrofuturism, set design, special effects and the “cinema of attractions”.\n\nAntirequisite(s): The former Film Studies 2257F/G; the former Film Studies 2260F/G, if taken in 2015-2016 or 2016- 2017.\n\nExtra Information: 2 lecture/seminar hours, 1 3-hour lecture/screening."
    },
    {
      "catalog_nbr": "3368F",
      "subject": "FILM",
      "className": "FILM PRODUCTION",
      "course_info": [
        {
          "class_nbr": 7454,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): At least 60% in Film Studies 1020E or Film Studies 1022 or permission of the Department.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1401",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course will explore the stylistic functions of basic film elements, e.g., camera movement, editing, sound, and colour, \n through the analysis and production of films.\n\nAntirequisite(s): The former Film Studies 2270F/G.\n\nExtra Information: 1 3-hour lecture/screening, 2 lecture/seminar hours."
    },
    {
      "catalog_nbr": "3371G",
      "subject": "FILM",
      "className": "FILM THEORY",
      "course_info": [
        {
          "class_nbr": 5969,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): At least 60% in Film Studies 1020E or Film Studies 1022 or permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1405",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will investigate major writings in classical and contemporary film theory, including the realism-formalism debate, auteurism, semiotics, psychoanalysis, structuralism, post-structuralism, feminist film theory, cultural studies, affect theory, and digital culture.\n\nExtra Information: 1-3 hour lecture/screening, 2 lecture/seminar hours."
    },
    {
      "catalog_nbr": "2555A",
      "subject": "FINMOD",
      "className": "CORPORATE FINANCE",
      "course_info": [
        {
          "class_nbr": 4187,
          "start_time": "6:30 PM",
          "descrlong": "Pre-or Corequisite(s): Actuarial Science 2553A/B or Actuarial Science 2053.",
          "end_time": "8:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-113",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS ENROLLED IN A MODULE OFFERED BY THE DEPARTMENTS OF APPLIED MATHEMATICS; MATHEMATICS; AND STATISTICAL AND ACTUARIAL SCIENCES."
        }
      ],
      "catalog_description": "Goal and governance of firms, bond and stock pricing, risk and return, portfolio theory, Capital Asset Pricing Model, capital budgeting, market efficiency, corporate financing. \n\nAntirequisite(s): Management and Organizational Studies 2310A/B, Management and Organizational Studies 3310A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2557B",
      "subject": "FINMOD",
      "className": "FINANCIAL MARKETS & INVEST",
      "course_info": [
        {
          "class_nbr": 4188,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): A minimum mark of 60% in Calculus 1501A/B or Applied Mathematics 1413, or Calculus 1301A/B with a minimum mark of 85%.",
          "end_time": "8:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-113",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS ENROLLED IN A MODULE OFFERED BY THE DEPARTMENTS OF APPLIED MATHEMATICS; MATHEMATICS; AND STATISTICAL AND ACTUARIAL SCIENCES."
        }
      ],
      "catalog_description": "Interest rate determinants. Duration, convexity and immunization. Basic securities, financial market conventions, swaps, arbitrage pricing and hedging of forwards/futures, equity options, bonds, theories of the term structure, factors affecting option prices, arbitrage relations of calls and puts, trading strategies involving options.\n\nAntirequisite(s): Business Administration 4413A/B. \n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "3520A",
      "subject": "FINMOD",
      "className": "FINANCIAL MODELLING I",
      "course_info": [
        {
          "class_nbr": 10430,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): A minimum mark of 60% in one of Business Administration 4413A/B, Financial Modelling 2557A/B; and a minimum mark of 60% in Statistical Sciences 2857A/B.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "WSC-240",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Discrete-time market models, option pricing and replication, risk-neutral valuation and martingale measures, and the fundamental theorem of asset pricing. Discrete-time Black-Scholes. Value-at-risk, mean-variance portfolio analysis, binomial pricing model. Discrete-time interest rate models. Simulation. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3613B",
      "subject": "FINMOD",
      "className": "MATHEMATICS OF FINANCIAL OPT",
      "course_info": [
        {
          "class_nbr": 4353,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 2402A or the former Differential Equations 2402A; or Statistical Sciences 2503A/B.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "PAB-148",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to modern financial mathematics using a differential equations approach. Stochastic differential equations and their related partial differential equations. The Fokker-Planck and Kolmogorov PDEs. No-arbitrage pricing, the Black-Scholes equation and its solutions. American options. Exotic options.\n\nExtra Information:3 lecture hours."
    },
    {
      "catalog_nbr": "3817B",
      "subject": "FINMOD",
      "className": "OPTIMIZATION METHODS",
      "course_info": [
        {
          "class_nbr": 4042,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Mathematics 1600A/B and one of Calculus 2302A/B, Calculus 2502A/B or Calculus 2402A/B.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "WSC-240",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to linear programming, simplex method, duality theory and sensitivity analysis, formulating linear programming models, nonlinear optimization, unconstrained and constrained optimization, quadratic programming. Applications in financial modelling (investment portfolio selection).\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4521B",
      "subject": "FINMOD",
      "className": "ADV FINANCIAL MODELLING",
      "course_info": [
        {
          "class_nbr": 4191,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): A minimum mark of 60% in either Financial Modelling 3520A/B, or Financial Modelling 3613A/B and a minimum mark of 60% in Statistical Sciences 2857A/B.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "WSC-240",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Continuous-time models, Brownian motion, stochastic integrals, Ito's lemma. Black-Scholes-Merton market model, arbitrage and market completeness, Black-Scholes PDE, risk-neutral pricing and martingale measures. Greeks and hedging, extensions of Black-Scholes model, implied volatility, American option valuation. Vasicek and Cox-Ingersoll-Ross interest rate models.\n\nAntirequisite(s): The former Financial Modelling 4521F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4998F",
      "subject": "FINMOD",
      "className": "PROJECT IN FINANCIAL MODELLING",
      "course_info": [
        {
          "class_nbr": 11525,
          "start_time": "",
          "descrlong": "Prerequisite(s): Registration in the fourth year of the Honours Specialization in Actuarial Science, Statistics, or Financial Modelling. Students must have a modular course average of at least 80% and must find a faculty member to supervise the project.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "The student will work on a project under faculty supervision. The project may involve an extension, or more detailed coverage, of material presented in other courses. Credit for the course will involve a written report as well as an oral presentation. \n\nAntirequisite(s): Actuarial Science 4997F/G/Z, Statistical Sciences 4999F/G/Z."
    },
    {
      "catalog_nbr": "4998Z",
      "subject": "FINMOD",
      "className": "PROJECT IN FINANCIAL MODELLING",
      "course_info": [
        {
          "class_nbr": 4723,
          "start_time": "",
          "descrlong": "Prerequisite(s): Registration in the fourth year of the Honours Specialization in Actuarial Science, Statistics, or Financial Modelling. Students must have a modular course average of at least 80% and must find a faculty member to supervise the project.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "The student will work on a project under faculty supervision. The project may involve an extension, or more detailed coverage, of material presented in other courses. Credit for the course will involve a written report as well as an oral presentation. \n\nAntirequisite(s): Actuarial Science 4997F/G/Z, Statistical Sciences 4999F/G/Z."
    },
    {
      "catalog_nbr": "0011A",
      "subject": "FOODNUTR",
      "className": "INTRO TO F&N: HEALTHY EATING",
      "course_info": [
        {
          "class_nbr": 7825,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): High School Biology (Grade 11 Advanced Level or equivalent) and registration in the Preliminary Year Program at Brescia University College.",
          "end_time": "9:30 PM",
          "facility_ID": "BR-201",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN PRELIMINARY YEAR."
        }
      ],
      "catalog_description": "An introductory course about the basic aspects of Healthy Eating. Emphasis will be placed on how students can use credible resources to find information about the nutrient content of foods, read food labels, nutrition recommendations (including Canada's Food Guide) and the eating habits for their life stage and make healthy food choices for themselves.\n\nAntirequisite(s): Grade 12U Nutrition in Perspective (HFA 4U) or any university level Nutrition course.\n\nExtra Information: 3 lecture hours (includes in-class activities)/ week."
    },
    {
      "catalog_nbr": "0012B",
      "subject": "FOODNUTR",
      "className": "INTRO TO F&N: LIFE CYCLE NUTR",
      "course_info": [
        {
          "class_nbr": 7826,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): High School Biology (Grade 11 Advanced Level or equivalent), FN 0011 A/B and registration in the Preliminary Year Program at Brescia University College.",
          "end_time": "9:30 PM",
          "facility_ID": "BR-203",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN PRELIMINARY YEAR."
        }
      ],
      "catalog_description": "An introductory course about the basic aspects of Life Cycle Nutrition. Emphasis will be placed on how students can use credible resources to find information about nutrition recommendations and eating habits of Canadians of all ages and life stages, nutrition and disease prevention, nutrition and physical activity, safe food handling procedures, food biotechnology and global hunger. \n\nAntirequisite(s): Grade 12U Nutrition in Perspective (HFA 4U) or any university level Nutrition course.\n\nExtra Information: 3 lecture hours (includes in-class activities)/ week."
    },
    {
      "catalog_nbr": "1070A",
      "subject": "FOODNUTR",
      "className": "INTRODUCTORY HUMAN NUTRITION",
      "course_info": [
        {
          "class_nbr": 11070,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "facility_ID": "BR-2001",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An introductory study of food and nutrition, with a particular emphasis on nutrient sources, physiological roles, including dietary requirements, and impact on health.\n\nAntirequisite(s): Foods and Nutrition 2070A/B or Foods and Nutrition 1030E or Foods and Nutrition 1021 or Foods and Nutrition 2121.\n\nExtra Information: 3 lecture hours. Grade 11 (or higher) Biology and Chemistry are highly recommended as preparation for this course.\n\nNOTE: This course will count as a Category C course for Brescia students and also main campus\nstudents who are enrolled in the Foods and Nutrition modules."
    },
    {
      "catalog_nbr": "1070B",
      "subject": "FOODNUTR",
      "className": "INTRODUCTORY HUMAN NUTRITION",
      "course_info": [
        {
          "class_nbr": 11074,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "facility_ID": "BR-2001",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introductory study of food and nutrition, with a particular emphasis on nutrient sources, physiological roles, including dietary requirements, and impact on health.\n\nAntirequisite(s): Foods and Nutrition 2070A/B or Foods and Nutrition 1030E or Foods and Nutrition 1021 or Foods and Nutrition 2121.\n\nExtra Information: 3 lecture hours. Grade 11 (or higher) Biology and Chemistry are highly recommended as preparation for this course.\n\nNOTE: This course will count as a Category C course for Brescia students and also main campus\nstudents who are enrolled in the Foods and Nutrition modules."
    },
    {
      "catalog_nbr": "1241B",
      "subject": "FOODNUTR",
      "className": "LIFECYCLE NUTRITION",
      "course_info": [
        {
          "class_nbr": 11205,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Foods and Nutrition 1070A/B or Foods and Nutrition 2070A/B or Foods and Nutrition 1030E or Foods and Nutrition 1021 or Foods and Nutrition 2121.",
          "end_time": "5:30 PM",
          "facility_ID": "BR-2001",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A study of nutritional requirements from conception to senescence. Discussion of food habits and nutrition intervention programs in relation to the stages of the lifecycle.\n\nAntirequisite(s): Foods and Nutrition 1241A/B, Foods and Nutrition 2245A/B.\n\nExtra Information: 3 lecture hours.\n\nNOTE: This course will count as a Category C course for Brescia students and also main campus\nstudents who are enrolled in the Foods and Nutrition modules."
    },
    {
      "catalog_nbr": "2070A",
      "subject": "FOODNUTR",
      "className": "FUNDAMENTALS OF HUMAN NUTRIT'N",
      "course_info": [
        {
          "class_nbr": 11079,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "facility_ID": "BR-2001",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An introductory study of food and nutrition, with a particular emphasis on the role of diet and nutrients in supporting health and preventing the development of nutritional deficiencies and disease. Students have the opportunity to independently explore and conduct an analysis of a nutrient-health relationship.\n\nAntirequisite(s): Foods and Nutrition 1070A/B, Foods and Nutrition 1030E, Foods and Nutrition 1021, Foods and Nutrition 2121.\n\nExtra Information: 3 lecture hours. Grade 11 (or higher) Biology and Chemistry are highly recommended as preparation for this course."
    },
    {
      "catalog_nbr": "2070B",
      "subject": "FOODNUTR",
      "className": "FUNDAMENTALS OF HUMAN NUTRIT'N",
      "course_info": [
        {
          "class_nbr": 11080,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "facility_ID": "BR-2001",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An introductory study of food and nutrition, with a particular emphasis on the role of diet and nutrients in supporting health and preventing the development of nutritional deficiencies and disease. Students have the opportunity to independently explore and conduct an analysis of a nutrient-health relationship.\n\nAntirequisite(s): Foods and Nutrition 1070A/B, Foods and Nutrition 1030E, Foods and Nutrition 1021, Foods and Nutrition 2121.\n\nExtra Information: 3 lecture hours. Grade 11 (or higher) Biology and Chemistry are highly recommended as preparation for this course."
    },
    {
      "catalog_nbr": "2132A",
      "subject": "FOODNUTR",
      "className": "INTRODUCTION TO FOODS",
      "course_info": [
        {
          "class_nbr": 7718,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Registration in the Nutrition and Families or Management and Organizational Studies modules (Honours Specialization, Specialization, Major)",
          "end_time": "11:30 AM",
          "facility_ID": "BR-302",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO NUTRITION AND FAMILIES MODULES."
        }
      ],
      "catalog_description": "A study of the scientific principles relating to foods and their preparation with emphasis on nutritional concepts in food preparation. An experimental approach will demonstrate the principles and methods of food preparation. \n \nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": 2232,
      "subject": "FOODNUTR",
      "className": "PRINCIPLES OF FOOD SCI",
      "course_info": [
        {
          "class_nbr": 7637,
          "start_time": "3:30 PM",
          "descrlong": "Pre-or Corequisite(s): Foods and Nutrition 1030 or Foods and Nutrition 1070A/B and Foods and Nutrition 1241A/B, Chemistry 2003A/B or Chemistry 2213A/B.",
          "end_time": "6:30 PM",
          "facility_ID": "BR-303",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN FOODS & NUTRITION PROGRAMS. MAY MATCH ANY LAB WITH ANY LECTURE."
        }
      ],
      "catalog_description": "A study of the physical structure, chemical composition and nutritive value of foods with emphasis on the effect on a finished product of the physical and chemical conditions, the proportion of ingredients and manipulative techniques. Discussion of aesthetic qualities and food economics. \n \nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "2241B",
      "subject": "FOODNUTR",
      "className": "NUTRITION THRO HUMN LIFE CYCLE",
      "course_info": [
        {
          "class_nbr": 7640,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Foods and Nutrition 1070A/B or Foods and Nutrition 1030E or Foods and Nutrition 1021 or Foods and Nutrition 2121.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-2001",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN THE FOODS & NUTRITION PROGRAM OR BSC FAMILY STUDIES."
        }
      ],
      "catalog_description": "A study of nutritional requirements from conception to senescence. Discussion of food habits and nutrition intervention programs in relation to life-cycle. \n\nAntirequisite(s): Foods and Nutrition 1241A/B, Foods and Nutrition 2245A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2245B",
      "subject": "FOODNUTR",
      "className": "NUTRITION: A LIFESPAN APPROACH",
      "course_info": [
        {
          "class_nbr": 7941,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Foods and Nutrition 1021 or Foods and Nutrition 1030E or Foods and Nutrition 2121; registration in the Nutrition and Families modules (Honours Specialization, Specialization, Major).",
          "end_time": "5:30 PM",
          "facility_ID": "BR-302",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A study of nutritional requirements from infancy to old age. Description of food habits, special conditions and nutritional interventions in relation to the various stages of the life span, including preconception nutrition.\n \nAntirequisite(s): Foods and Nutrition 2241A/B. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3310A",
      "subject": "FOODNUTR",
      "className": "FOOD PRODUCT DEVELOPMENT",
      "course_info": [
        {
          "class_nbr": 11082,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Foods and Nutrition 2130, or Foods and Nutrition 2232.",
          "end_time": "2:30 PM",
          "facility_ID": "BR-2001A",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN THE FOODS & NUTRITION, NUTRITION & FAMILIES AND FOOD MANAGEMENT MODULES."
        }
      ],
      "catalog_description": "Examines the food product development process from concept to market. Discusses challenges, importance to the food industry, methods and techniques as well as new advancements and developments. Students will complete a product development project.\n\nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "3339A",
      "subject": "FOODNUTR",
      "className": "EXERCISE NUTRITION",
      "course_info": [
        {
          "class_nbr": 7674,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Foods and Nutrition 1030E or Foods and Nutrition 1021 (with a mark of at least 70%) or Foods and Nutrition 2121 (with a mark of at least 70%). Recommended: Foods and Nutrition 3373A/B. Registration in the Foods and Nutrition modules (Honours Specialization, Specialization, Major, Minor).",
          "end_time": "12:30 PM",
          "facility_ID": "HSB-40",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED IN FOOD & NUTRITION AT BRESCIA. CROSS-LISTED WITH KIN 3339A. HELD ON MAIN CAMPUS."
        }
      ],
      "catalog_description": "This course investigates the important food/food components for individuals involved in chronic (regular) exercise programs and/or competition, i.e., athletes. The focus is on understanding how dietary needs are affected by regular, vigorous physical activity and the mechanisms responsible for any performance enhancement/decrement resulting from the supplementation of specific foods or food components.\n \nAntirequisite(s): Kinesiology 3339A/B and the former Kinesiology 4439A/B, the former Foods and Nutrition 4439A/B. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3342A",
      "subject": "FOODNUTR",
      "className": "ADVANCED FOOD SCIENCE",
      "course_info": [
        {
          "class_nbr": 7641,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Chemistry 2003A/B or Chemistry 2213A/B and Foods and Nutrition 2232.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-2001A",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN THE FOODS & NUTRITION PROGRAM."
        }
      ],
      "catalog_description": "Selected processing methods and their effect on the nutritive value and acceptability of a product; properties and uses of food carbohydrates, fats and enzymes used in the food industry. \n \nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "3342B",
      "subject": "FOODNUTR",
      "className": "ADVANCED FOOD SCIENCE",
      "course_info": [
        {
          "class_nbr": 7792,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Chemistry 2003A/B or Chemistry 2213A/B and Foods and Nutrition 2232.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-2001A",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS IN THE FOODS & NUTRITION PROGRAM."
        }
      ],
      "catalog_description": "Selected processing methods and their effect on the nutritive value and acceptability of a product; properties and uses of food carbohydrates, fats and enzymes used in the food industry. \n \nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "3344A",
      "subject": "FOODNUTR",
      "className": "NUTRITIONAL ASSESSMENT",
      "course_info": [
        {
          "class_nbr": 7675,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Foods and Nutrition 1030E and Foods and Nutrition 2241A/B or Foods and Nutrition 1070A/B and Foods and Nutrition 1241A/B, and Foods and Nutrition 2230A/B. Registration in the Honours Specialization in Nutrition and Dietetics module.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-135",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS IN THE FOODS & NUTRITION PROGRAM."
        }
      ],
      "catalog_description": "A critical survey of the methods used in the assessment of food and nutrient intakes and nutritional status of groups and individuals, in both health and disease. \n \nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3348A",
      "subject": "FOODNUTR",
      "className": "FOOD PRODUCTION MANAGEMEN",
      "course_info": [
        {
          "class_nbr": 7748,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Foods and Nutrition 2449A/B.\n\nPre-or Corequisite(s): Foods and Nutrition 3342A/B.",
          "end_time": "5:30 PM",
          "facility_ID": "BR-302",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN FOODS & NUTRITION AND FAMILIES AND NUTRITION MODULES. MAY MATCH ANY LAB WITH ANY LECTURE."
        }
      ],
      "catalog_description": "The application of scientific principles to the procurement, storage, processing and service of institutional food. Menu- planning to meet nutritional requirements while working under the constraints of budgets and the available food supplies, equipment and staff. Food trends, sanitation and safety. \n\nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "3348B",
      "subject": "FOODNUTR",
      "className": "FOOD PRODUCTION MANAGEMEN",
      "course_info": [
        {
          "class_nbr": 7667,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Foods and Nutrition 2449A/B.\n\nPre-or Corequisite(s): Foods and Nutrition 3342A/B.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-302",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN FOODS & NUTRITION AND FAMILIES AND NUTRITION MODULES."
        }
      ],
      "catalog_description": "The application of scientific principles to the procurement, storage, processing and service of institutional food. Menu- planning to meet nutritional requirements while working under the constraints of budgets and the available food supplies, equipment and staff. Food trends, sanitation and safety. \n\nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "3351A",
      "subject": "FOODNUTR",
      "className": "CLINICAL NUTRITION I",
      "course_info": [
        {
          "class_nbr": 7645,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Foods and Nutrition 1030E and Foods and Nutrition 2241A/B or Foods and Nutrition 1070A/B and Foods and Nutrition 1241A/B, and Foods and Nutrition 2230A/B. Registration in the Honours Specialization in Nutrition and Dietetics.\n\nPre-or Corequisite(s): Foods & Nutrition 3344A/B.",
          "end_time": "5:30 PM",
          "facility_ID": "BR-201",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS IN FOODS & NUTRITION PROGRAMS."
        }
      ],
      "catalog_description": "Introduction to the profession of nutrition and dietetics, medical nutrition therapy and the nutrition care process including modifications of regular diets to meet special nutritional needs, menu planning and documentation of nutritional care. \n \nExtra Information: 3 lecture hours, 3 tutorial hours."
    },
    {
      "catalog_nbr": 1100,
      "subject": "GEOGRAPH",
      "className": "FUNDAMENTALS OF GEOGRAPHY",
      "course_info": [
        {
          "class_nbr": 8487,
          "start_time": "6:30 PM",
          "descrlong": "",
          "end_time": "9:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-LH101",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "A systematic descriptive introduction to the diverse elements of landscape including geomorphic, climatic, and biotic elements, human settlement and land-use patterns; cartographic approaches to the analysis of selected processes of landscape change; an introduction to the synthesis of elements and processes in spatial systems models. \n \nAntirequisite(s): Geography 1300A/B, Geography 1400F/G. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1300B",
      "subject": "GEOGRAPH",
      "className": "INTRO TO PHYSICAL ENVIRONMENT",
      "course_info": [
        {
          "class_nbr": 2165,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-56",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RECOMMENDED FOR STUDENTS WANTING TO PURSUE A MAJOR OR AN HONORS SPECIALIZATION PROGRAM."
        }
      ],
      "catalog_description": "Introduction to the phenomena and processes of the Earth-atmosphere system that underlie human environment interactions and environmental change: the physical geography of Earth. Topics include: the atmosphere and fundamentals of weather and climate, water in the environment, Earth surface processes, biogeography, and human appropriation and modification of earth-atmosphere systems\n \nAntirequisite(s): Geography 1100, Geography 2131A/B. \n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "1400G",
      "subject": "GEOGRAPH",
      "className": "INTRO TO THE HUMAN ENVIRONMENT",
      "course_info": [
        {
          "class_nbr": 2169,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "TC-141",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RECOMMENDED FOR STUDENTS WANTING TO PURSUE A MAJOR OR AN HONORS SPECIALIZATION PROGRAM."
        }
      ],
      "catalog_description": "This course introduces students to the central problems, concepts, methods and applications of human geography. It pays particular attention to the ways humans interact with the world; for example, population growth, use of natural resources, culturally-based activities, urbanization and settlements, agricultural activities, and industrialization. \n\nAntirequisite(s): Geography 1100.\n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "1500F",
      "subject": "GEOGRAPH",
      "className": "ENVIRONMENT & DEV CHALLENGES",
      "course_info": [
        {
          "class_nbr": 2157,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "WSC-55",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RECOMMENDED FOR STUDENTS WANTING TO PURSUE A MAJOR OR AN HONORS SPECIALIZATION PROGRAM."
        }
      ],
      "catalog_description": "Examines environmental change over long periods of earth history, considering both physical processes and human impacts. An integrative approach provides a basis for understanding some of the world's most pressing environment and development challenges, such as biodiversity loss, desertification, climate change, energy consumption, and persistent hunger and malnourishment. \n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2010A",
      "subject": "GEOGRAPH",
      "className": "GEOGRAPHY OF CANADA",
      "course_info": [
        {
          "class_nbr": 1813,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-146",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An overview of the regional geography of Canada. Topics considered may include demographics, culture, the economy, resources and environmental issues. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2010B",
      "subject": "GEOGRAPH",
      "className": "GEOGRAPHY OF CANADA",
      "course_info": [
        {
          "class_nbr": 2035,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-146",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An overview of the regional geography of Canada. Topics considered may include demographics, culture, the economy, resources and environmental issues. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2011A",
      "subject": "GEOGRAPH",
      "className": "ONT AND THE GREAT LAKES",
      "course_info": [
        {
          "class_nbr": 1812,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "A detailed examination of the province as part of the Great Lakes region, with special reference to its historical development, natural resources and patterns of human and economic activity. \r\n\r\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2011B",
      "subject": "GEOGRAPH",
      "className": "ONT AND THE GREAT LAKES",
      "course_info": [
        {
          "class_nbr": 2541,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "UCC-146",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "A detailed examination of the province as part of the Great Lakes region, with special reference to its historical development, natural resources and patterns of human and economic activity. \r\n\r\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2030A",
      "subject": "GEOGRAPH",
      "className": "AFRICA SOUTH OF THE SAHARA",
      "course_info": [
        {
          "class_nbr": 2668,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "SSC-2020",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course provides an introduction to the geography of Africa south of the Sahara. The course will take a systematic approach. Economic, political, social and environmental issues will be examined with a focus on contemporary patterns of change within the context of the global economy.\r\n\r\nExtra Information: 2 hours."
    },
    {
      "catalog_nbr": "2041A",
      "subject": "GEOGRAPH",
      "className": "GEOGRAPHY OF CHINA",
      "course_info": [
        {
          "class_nbr": 5321,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-56",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course adopts a geographic approach to understanding contemporary China. It examines how transformations of China's land, people, economy, and society are recasting internal regional divisions and repositioning China in a rapidly changing world. \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2041B",
      "subject": "GEOGRAPH",
      "className": "GEOGRAPHY OF CHINA",
      "course_info": [
        {
          "class_nbr": 3347,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UCC-56",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course adopts a geographic approach to understanding contemporary China. It examines how transformations of China's land, people, economy, and society are recasting internal regional divisions and repositioning China in a rapidly changing world. \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2060A",
      "subject": "GEOGRAPH",
      "className": "WORLD CITIES",
      "course_info": [
        {
          "class_nbr": 11186,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2202",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "A global perspective on urbanism. In each session a selected city is used to emphasize a particular urban problem, urban spatial structure or world region. \r\n\r\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2090A",
      "subject": "GEOGRAPH",
      "className": "SPACE EXPLORATION",
      "course_info": [
        {
          "class_nbr": 10446,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE."
        }
      ],
      "catalog_description": "Survey of human activity in outer space, including history of spaceflight, scientific exploration, economic and military uses of space, natural resources and hazards, legal and ethical implications, and plausible future developments.\r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2131B",
      "subject": "GEOGRAPH",
      "className": "THE NATURAL ENVIRONMENT",
      "course_info": [
        {
          "class_nbr": 10000,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "SH-3345",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of the characteristics, origins and history of selected natural environments with particular reference to North America. \n \nAntirequisite(s): Geography 1300A/B. \n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2133B",
      "subject": "GEOGRAPH",
      "className": "CLIMATE CHANGE",
      "course_info": [
        {
          "class_nbr": 3563,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2028",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines the processes that underlie natural and human-induced climate change at global and regional scales and describes the resultant climates that have existed, those projected to occur in the future, and what impacts climate change has and will have on the physical and human environment. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2143A",
      "subject": "GEOGRAPH",
      "className": "FOUNDATNS OF GEOG OF WRLD BUS",
      "course_info": [
        {
          "class_nbr": 4363,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "MC-110",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Geographical theories of local and international trade; relationships between the location of production and flows of goods, services and factors of production among countries and regions; the geographical patterns of world commerce. \r\n\r\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2143B",
      "subject": "GEOGRAPH",
      "className": "FOUNDATNS OF GEOG OF WRLD BUS",
      "course_info": [
        {
          "class_nbr": 11187,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-1200",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Geographical theories of local and international trade; relationships between the location of production and flows of goods, services and factors of production among countries and regions; the geographical patterns of world commerce. \r\n\r\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2144B",
      "subject": "GEOGRAPH",
      "className": "GEOGRAPHY OF TOURISM",
      "course_info": [
        {
          "class_nbr": 2353,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "NS-145",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Examination of tourism as a global, national and local phenomenon, with economic, social, and environmental impacts; emphasis on tourism in developing countries; hosts, guests, and tourism operators; tourism trends; mass versus alternative tourism; relationship between 'ecotourism' and nature protection.\n\nAntirequisite(s): the former Geography 2144F/G.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2152F",
      "subject": "GEOGRAPH",
      "className": "GEOGRAPHY OF HAZARDS",
      "course_info": [
        {
          "class_nbr": 2650,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "NS-145",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A survey of the methods and models used to understand human responses to hazards. The course reviews the rich tradition of hazards research in geography, particularly through the lens of social science. The course will include discussions of both so-called \"natural hazards\" (e.g., floods, fires, earthquakes) and \"technological hazards\" (e.g., nuclear technology, genetically modified organisms, terrorism, war) as examples.\r\n \r\nAntirequisite(s): The former Geography 2152A/B. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2152G",
      "subject": "GEOGRAPH",
      "className": "GEOGRAPHY OF HAZARDS",
      "course_info": [
        {
          "class_nbr": 3302,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-146",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "A survey of the methods and models used to understand human responses to hazards. The course reviews the rich tradition of hazards research in geography, particularly through the lens of social science. The course will include discussions of both so-called \"natural hazards\" (e.g., floods, fires, earthquakes) and \"technological hazards\" (e.g., nuclear technology, genetically modified organisms, terrorism, war) as examples.\r\n \r\nAntirequisite(s): The former Geography 2152A/B. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2156B",
      "subject": "GEOGRAPH",
      "className": "ANIMAL GEOGRAPHIES",
      "course_info": [
        {
          "class_nbr": 6630,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-1200",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Investigates the fast-changing geographies of animals in relation to global environmental change. The initial focus is on extinctions, endangerment, and broad population declines occurring among many wild animal species. The subsequent focus is on the soaring populations and conditions of life for a few species of domesticated animals.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2160B",
      "subject": "GEOGRAPH",
      "className": "HEALTHY CITIES",
      "course_info": [
        {
          "class_nbr": 11350,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-37",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "ONE HOUR LAB INCLUDED IN LECTURE TIMES."
        }
      ],
      "catalog_description": "A survey course exploring the connections between urban environments, health, and wellbeing, including key historical developments, theories, problems, and solutions. Hands-on activities throughout will teach skills and knowledge suitable for careers in planning, urban development, public health, medicine, business, civil engineering, and municipal government.\n\nExtra Information: 2 instructional hours, 1 lab hour."
    },
    {
      "catalog_nbr": "2162A",
      "subject": "GEOGRAPH",
      "className": "PLANNING SUSTAINABLE CITIES",
      "course_info": [
        {
          "class_nbr": 4359,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3018",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Principles and processes of land use planning for urban and regional development; current issues and case studies. \n \nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2210B",
      "subject": "GEOGRAPH",
      "className": "INTRO TO STATS FOR GEOGRAPHERS",
      "course_info": [
        {
          "class_nbr": 1388,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): 1.0 course from Geography 1100, Geography 1300A/B, Geography 1400F/G, Geography 1500F/G, Geography 2131A/B, Geography 2132A/B, Geography 2133A/B, Geography 2142A/B, Geography 2152F/G, Geography 2153A/B, Environmental Science 1021F/G; or enrolment in the Major in Physical Geography or in an Honours Earth Science Program for Professional Registration.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-37",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to the nature of geographical analysis of data and the application of statistical techniques and computing systems to in Geography: data collection, research design, sampling; models of spatial data, probability, distributions, hypothesis testing, correlations and regression.\n \nAntirequisite(s): Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Health Sciences 3801A/B,MOS 2242A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2143A/B, Statistical Sciences 2244A/B, Statistical Sciences 2858A/B, Statistical Sciences 2037A/B if taken prior to Fall 2010, former Psychology 2885 (Brescia), former Statistical Sciences 2122A/B, former Social Work 2205. \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2001F",
      "subject": "GLE",
      "className": "INTRODUCTION TO GOVERNANCE",
      "course_info": [
        {
          "class_nbr": 8302,
          "start_time": "6:30 PM",
          "descrlong": "",
          "end_time": "9:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W116",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Governance is about collective action and shared decision-making in a complex, interdependent, and uncertain world. Investigating organizational efficiency, policy legitimacy, and strategic objectives, this course introduces students to the theories and models of contemporary governance and explores their implementation in organizational settings across the public, private, and community sectors.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2002G",
      "subject": "GLE",
      "className": "GLE test",
      "course_info": [
        {
          "class_nbr": 11755,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Huron",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This quarter course will provide students with a basic understanding of the (i) core concepts and molecular principles of polymeric materials and polymer-based hydrogels, (ii) structure-property relationships of polymers, (iii) strategies used to rationally design polymeric platforms for effective cell/drug delivery and tissue engineering. Towards that goal, the course will focus on topics at the interface of science, engineering, and medicine such as polymer chemistry, biomaterials, tissue engineering and bioprinting, mass transport, and pharmacokinetics. Special emphasis will be given to understand the surface and bulk properties of the polymers. This knowledge will help develop polymers with desired chemical, interfacial, mechanical and biological functions."
    },
    {
      "catalog_nbr": "2003G",
      "subject": "GLE",
      "className": "INTRODUCTION TO LEADERSHIP",
      "course_info": [
        {
          "class_nbr": 8303,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V214",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course introduces students to principled leadership as a foundation for decision-making and evaluation. A theory-to-practice approach is applied providing a coherent framework for action, taking into account authority, power, influence, followership, competencies, personality, role, and citizenship. Students learn diagnostic tools for analysis, constituent responsibilities, and strategic action.\n\nAntirequisite(s): Dimensions of Leadership 1000A/B, Dimensions of Leadership 1031.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 1000,
      "subject": "GREEK",
      "className": "INTRODUCTORY ANCIENT GREEK",
      "course_info": [
        {
          "class_nbr": 1935,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UC-1105",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introductory course in Ancient Greek covering the major points of grammar and syntax. \n \nAntirequisite(s): Those students with Grade 12U level Ancient Greek must consult the Department before registering for this course. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1103A",
      "subject": "GREEK",
      "className": "INTRO TO BIBLICAL GREEK I",
      "course_info": [
        {
          "class_nbr": 11194,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Tu",
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to the writing system and grammar of biblical Greek, for those with little to no previous knowledge of the language.\n\nAntirequisite(s): The former Religious Studies 1029; Greek 5103A/B.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "1104B",
      "subject": "GREEK",
      "className": "INTRO TO BIBLICAL GREEK II",
      "course_info": [
        {
          "class_nbr": 11195,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Greek 1103A/B, Greek 5103A/B or its equivalent, or permission of the instructor.",
          "end_time": "1:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Tu",
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A continuation of the study of biblical Greek grammar and syntax, with an emphasis on the acquisition of basic reading skills for studying the Septuagint or New Testament.\n\nAntirequisite(s): the former Religious Studies 1029; Greek 5104A/B.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": 2000,
      "subject": "GREEK",
      "className": "ADVANCED ANCIENT GREEK",
      "course_info": [
        {
          "class_nbr": 1936,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Greek 1000 or the former Greek 002.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "LWH-2205",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A continuation of Ancient Greek grammar and an introduction to the works of Ancient Greek authors. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3100A",
      "subject": "GREEK",
      "className": "ANCIENT GREEK PROSE SELECTIONS",
      "course_info": [
        {
          "class_nbr": 10297,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Greek 2000 or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "STVH-2166",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH GREEK 4903A."
        }
      ],
      "catalog_description": "A selection of Ancient Greek prose. Some prose composition. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3200B",
      "subject": "GREEK",
      "className": "ANCIENT GREEK POETRY SELECTNS",
      "course_info": [
        {
          "class_nbr": 10299,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Greek 2000 or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "STVH-2166",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH GREEK 4904B."
        }
      ],
      "catalog_description": "A selection of Ancient Greek poetry. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4903A",
      "subject": "GREEK",
      "className": "SPECIAL TOPCS IN ANCIENT GREEK",
      "course_info": [
        {
          "class_nbr": 10298,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Any 3000-level course in Ancient Greek or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "STVH-2166",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH GREEK 3100A."
        }
      ],
      "catalog_description": "Extra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4904B",
      "subject": "GREEK",
      "className": "SPECIAL TOPCS IN ANCIENT GREEK",
      "course_info": [
        {
          "class_nbr": 10300,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Any 3000-level course in Ancient Greek or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "STVH-2166",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH GREEK 3200B."
        }
      ],
      "catalog_description": "Extra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "5103A",
      "subject": "GREEK",
      "className": "INTRODUCTORY GRAMMAR",
      "course_info": [
        {
          "class_nbr": 8079,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Tu",
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY STUDENTS AT HURON. BACHELOR'S STUDENTS TAKE RS 1029."
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "5104B",
      "subject": "GREEK",
      "className": "CONT GRAMMR & NEW TESTMNT RDGS",
      "course_info": [
        {
          "class_nbr": 8080,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Tu",
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY STUDENTS AT HURON. BACHELOR'S STUDENTS TAKE RS 1029."
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "1001A",
      "subject": "HEALTSCI",
      "className": "PERSONAL DETERMINANT OF HEALTH",
      "course_info": [
        {
          "class_nbr": 6082,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "395 RESERVED FOR YR 1 BHSC. 25 SPACES RESERVED FOR BRESCIA YR 1 BHSC. REMAINING SEATS AVAILABLE FOR STUDENTS IN OTHER FACULTIES."
        }
      ],
      "catalog_description": "This course focuses on health and wellness with an emphasis on increasing knowledge and awareness of a wide variety of health-related topics, as well as on improving individual health.\n \nAntirequisite(s): The former Health Sciences 1000.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1001B",
      "subject": "HEALTSCI",
      "className": "PERSONAL DETERMINANT OF HEALTH",
      "course_info": [
        {
          "class_nbr": 4635,
          "start_time": "6:30 PM",
          "descrlong": "",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-35",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course focuses on health and wellness with an emphasis on increasing knowledge and awareness of a wide variety of health-related topics, as well as on improving individual health.\n \nAntirequisite(s): The former Health Sciences 1000.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1002B",
      "subject": "HEALTSCI",
      "className": "SOCIAL DETERMINANTS OF HEALTH",
      "course_info": [
        {
          "class_nbr": 5513,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "NS-145",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "395 RESERVED FOR YR 1 BHSC. 25 SPACES RESERVED FOR BRESCIA YR 1 BHSC."
        }
      ],
      "catalog_description": "This course introduces key social determinants of health, and orients students to viewing health in relation to social factors, equity, and social justice. Students will be introduced to basic terms, concepts, and measurements related to health, public health, population health, and health inequalities. \n \nAntirequisite(s): The former Health Sciences 1000.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2110B",
      "subject": "HEALTSCI",
      "className": "RESILIENCE AND WELLBEING",
      "course_info": [
        {
          "class_nbr": 11170,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Registration in second-year or higher, or permission of the School of Health Studies.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "60 SPACES RESERVED FOR BHSC STUDENTS, PRIORITY TO YR 2 BHSC STUDENTS, OPEN JULY 19 TO YRS 3 & 4 BHSC STUDENTS. 90 SPACES RESERVED FOR NON-HS STUDENTS (LIMIT 1.5)"
        }
      ],
      "catalog_description": "Personal resilience is widely recognized to be a cornerstone of wellbeing, and is considered essential to success in environments ranging from schools to workplaces. In this interdisciplinary course, we study “good vs poor” mental health, cultivation of resilience, creation and maintenance of wellbeing, and living well with compromised mental health. \n\nExtra Information: 3 contact hours.\nNotes: This course may be used as a 2000-level elective course within any of the modular offerings within the School of Health Studies."
    },
    {
      "catalog_nbr": 2244,
      "subject": "HEALTSCI",
      "className": "WOMEN AND HEALTH",
      "course_info": [
        {
          "class_nbr": 7458,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Minimum of 60% in each of Health Sciences 1001A/B and Health Sciences 1002A/B; registration in the Bachelor of Health Sciences program.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-3210",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH WOMEN'S STUDIES 2244."
        }
      ],
      "catalog_description": "This course provides an overview of historical, social, economic, political and biological influences on women's health. Using a feminist perspective, both experiential and theoretically based knowledge will be explored through the process of critical reflection.\n\nAntirequisite(s): The former Women’s Studies 2154; Women’s Studies 2244.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2250A",
      "subject": "HEALTSCI",
      "className": "HEALTH PROMOTION",
      "course_info": [
        {
          "class_nbr": 2694,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Minimum of 60% [mandatory] in each of Health Sciences 1001A/B and Health Sciences 1002A/B.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 200,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO BHSC STUDENTS. OPEN JULY 19 TO HSC MINOR. OPEN AUGUST 21 TO NON-HS STUDENTS (LIMIT 1.5). BLENDED COURSE: BOTH ONLINE AND IN PERSON INSTRUCTION."
        }
      ],
      "catalog_description": "Overview of concepts of health promotion and disease prevention in Canada: health promotion models and theories; health promotion program planning, implementation and evaluation including needs assessments, social marketing and community advocacy.\n \nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2300A",
      "subject": "HEALTSCI",
      "className": "FUNCTIONAL HUMAN GROSS ANATOMY",
      "course_info": [
        {
          "class_nbr": 2843,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Grade 12U Biology or equivalent is strongly recommended.\nRegistration information: Students not in a Health Science program are limited to a 1.5 Health Science course load.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO BHSC STUDENTS. OPEN JULY 19 TO HSC MINOR. OPEN AUGUST 21 TO NON-HS STUDENTS (LIMIT 1.5). CROSS-LISTED WITH KIN 2222A."
        }
      ],
      "catalog_description": "A gross anatomical description of systemic structure and function of the human body, with emphasis on skeletal, muscular and cardiovascular systems. Integration between systems will be discussed using clinical examples related to sport, medicine, and physical therapy. This is an introductory level lecture course.\n \nAntirequisite(s): Anatomy and Cell Biology 2200A/B, Anatomy and Cell Biology 2221, Anatomy and Cell Biology 3319, Kinesiology 2222A/B, and Health Sciences 2330A/B.\n\nExtra Information: 3 lecture hours, 1.0 laboratory hour."
    },
    {
      "catalog_nbr": "2300B",
      "subject": "HEALTSCI",
      "className": "FUNCTIONAL HUMAN GROSS ANATOMY",
      "course_info": [
        {
          "class_nbr": 2847,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Grade 12U Biology or equivalent is strongly recommended.\nRegistration information: Students not in a Health Science program are limited to a 1.5 Health Science course load.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO BHSC STUDENTS. OPEN JULY 19 TO HSC MINOR. OPEN AUGUST 21 TO NON-HS STUDENTS (LIMIT 1.5). CROSS-LISTED WITH KIN 2222B."
        }
      ],
      "catalog_description": "A gross anatomical description of systemic structure and function of the human body, with emphasis on skeletal, muscular and cardiovascular systems. Integration between systems will be discussed using clinical examples related to sport, medicine, and physical therapy. This is an introductory level lecture course.\n \nAntirequisite(s): Anatomy and Cell Biology 2200A/B, Anatomy and Cell Biology 2221, Anatomy and Cell Biology 3319, Kinesiology 2222A/B, and Health Sciences 2330A/B.\n\nExtra Information: 3 lecture hours, 1.0 laboratory hour."
    },
    {
      "catalog_nbr": "2330A",
      "subject": "HEALTSCI",
      "className": "FUNCTIONAL ANATOMY FOR NURSING",
      "course_info": [
        {
          "class_nbr": 5290,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Grade 12U Biology or equivalent.\n\nCorequisite(s): Restricted to students registered in the School of Nursing.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-240",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED IN THE SCHOOL OF NURSING."
        }
      ],
      "catalog_description": "A gross anatomical description of the systemic structure and function of the human body. Emphasis will be placed on clinical nursing applications.\n \nAntirequisite(s): Health Sciences 2300A/B, Anatomy and Cell Biology 2200A/B, Anatomy and Cell Biology 2221, Anatomy and Cell Biology 3319, Kinesiology 2222A/B.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2610G",
      "subject": "HEALTSCI",
      "className": "INTRO TO ETHICS & HEALTH",
      "course_info": [
        {
          "class_nbr": 1508,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Minimum of 60% [mandatory] in each of Health Sciences 1001A/B and Health Sciences 1002A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "An introduction to basic moral theory and development of an understanding of moral reasoning. The course will also teach students to apply basic principles of sound moral decision-making to important ethical issues in health including: concepts of health, wellness, and illness, allocation of scarce resources, the notion of \"consent\". The methods of explaining/justifying moral decisions in health will be explored by surveying major philosophical approaches to ethics. \n \nAntirequisite(s): Philosophy 2715F/G, the former Kinesiology 2293F/G, the former Philosophy 2071E. \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "2700A",
      "subject": "HEALTSCI",
      "className": "HEALTH ISS IN CHILDHOOD ADOLES",
      "course_info": [
        {
          "class_nbr": 2602,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Minimum of 60% [mandatory] in each of Health Sciences 1001A/B and Health Sciences 1002A/B.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course will explore the physical, social, psychological, and spiritual determinates of health from the prenatal period to early adulthood. The focus will be on health applications of developmental concepts, and emphasis will be placed on contemporary issues affecting health.\n \nAntirequisite(s): Kinesiology 3347A/B.\n\nExtra Information: 2 lecture hours, 1 tutorial."
    },
    {
      "catalog_nbr": 1020,
      "subject": "HEBREW",
      "className": "INTRO TO MODERN HEBREW LANG",
      "course_info": [
        {
          "class_nbr": 10517,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Permission of the faculty.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W8",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "REGISTRATION IS BY INSTRUCTOR PERMISSION. STUDENTS ARE ASKED TO COMPLETE THE FOLLOWING FORM AND SUBMIT FOR REVIEW: https://huronuc.ca/form-centre/hebrew-course-placement-form"
        }
      ],
      "catalog_description": "This course is an elementary course for students who have never studied the Hebrew language or those who have not studied it beyond grade six. The course is designed to teach students the alphabet, basic grammar, syntax, and vocabulary. Course material will build basic oral and written comprehension.\n\nAntirequisite(s): Grades 7-12 Hebrew or equivalent.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "1040A",
      "subject": "HEBREW",
      "className": "INTRODUCTN TO BIBLICAL HEBREW",
      "course_info": [
        {
          "class_nbr": 8081,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO JEWISH STUDIES AND HURON STUDENTS. CROSS-LISTED WITH HEBREW 5040A."
        }
      ],
      "catalog_description": "An introduction to the writing system and grammar of Biblical Hebrew for those with no previous knowledge of the language. Special attention will be paid to the noun, adjective, and participle. \n \nAntirequisite(s): Hebrew 1030 or Grade 4 Hebrew (or Grade 2 in Israel). \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "1041B",
      "subject": "HEBREW",
      "className": "INTRO TO BIBLICAL HEBREW II",
      "course_info": [
        {
          "class_nbr": 8082,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Hebrew 1040A/B or permission of the Instructor.",
          "end_time": "4:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W2",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH HEBREW 5041B. PRIORITY TO JEWISH STUDIES AND HURON STUDENTS."
        }
      ],
      "catalog_description": "Continuation of Hebrew 1040A/B. An introduction to the grammar of Biblical Hebrew for those with little previous knowledge of the language. Special attention will be paid to forms of the verb. \n \nAntirequisite(s): Hebrew 1030 or Grade 6 Hebrew (or Grade 3 in Israel).\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": 2200,
      "subject": "HEBREW",
      "className": "HEBREW 2",
      "course_info": [
        {
          "class_nbr": 8193,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Hebrew 1020, Hebrew 1030, or Grade 12 University-preparatory Hebrew or equivalent, or permission of the faculty.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W6",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "REGISTRATION IS BY INSTRUCTOR PERMISSION. STUDENTS ARE ASKED TO COMPLETE THE FOLLOWING FORM AND SUBMIT FOR REVIEW: https://huronuc.ca/form-centre/hebrew-course-placement-form"
        }
      ],
      "catalog_description": "This course is designed to build upon skills in reading and speaking modern Hebrew, developed in earlier courses. Students will gain increased vocabulary, and a greater understanding of more complex grammatical structures.\n \nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "2240A",
      "subject": "HEBREW",
      "className": "INTERMED BIBLICAL HEBREW:PROSE",
      "course_info": [
        {
          "class_nbr": 11669,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Hebrew 1041A/B or Grade 6 Hebrew (Grade 3 in Israel), or permission of the instructor.",
          "end_time": "3:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Reading, translating, and analyzing the grammar of selected prose passages from the Hebrew Bible with the aid of a lexicon. \n\nAntirequisite(s): Grade 7 Hebrew (or Grade 4 in Israel).\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": 3300,
      "subject": "HEBREW",
      "className": "ADV. MODERN HEBREW LANGUAGE",
      "course_info": [
        {
          "class_nbr": 10519,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Hebrew 2200 or equivalent or by permission of the faculty",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W8",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "REGISTRATION IS BY INSTRUCTOR PERMISSION. STUDENTS ARE ASKED TO COMPLETE THE FOLLOWING FORM AND SUBMIT FOR REVIEW: https://huronuc.ca/form-centre/hebrew-course-placement-form"
        }
      ],
      "catalog_description": "This course aims to build on the skills learned in Hebrew 2200 to improve students’ competency in oral and written Modern Hebrew. Exposure to a variety of materials, including literature, poetry, articles, and films, will enable students to develop oral and written fluency.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "5040A",
      "subject": "HEBREW",
      "className": "INTRO TO BIBLICAL HEBREW",
      "course_info": [
        {
          "class_nbr": 8119,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5041B",
      "subject": "HEBREW",
      "className": "INTRO TO BIBLICAL HEBREW",
      "course_info": [
        {
          "class_nbr": 8120,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Hebrew 5040A/B or the former Hebrew 003A/B",
          "end_time": "4:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W2",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5240A",
      "subject": "HEBREW",
      "className": "INTERMED BIBLICAL HEBREW:PROSE",
      "course_info": [
        {
          "class_nbr": 11656,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Hebrew 5041A/B.",
          "end_time": "3:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Reading, translating, and analyzing the grammar of selected prose passages from the Hebrew Bible with the aid of a lexicon. \n\nAntirequisite(s): Grade 7 Hebrew (or Grade 4 in Israel).\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "2200E",
      "subject": "HISTSCI",
      "className": "SCIENTIFIC THOUGHT",
      "course_info": [
        {
          "class_nbr": 8098,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V208",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "MAIN CAMPUS STUDENTS REQUIRE HOME FACULTY PERMISSION."
        }
      ],
      "catalog_description": "A general historical survey of ideas in the physical and biological sciences from antiquity to the twentieth century. This course will also examine issues in scientific methodology as well as the impact of scientific ideas on society.\n\nAntirequisite(s) at Huron campus: Philosophy 2203E.\n\nExtra Information: 3 lecture hours (Main); 2 lecture hours (Huron)."
    },
    {
      "catalog_nbr": 2220,
      "subject": "HISTSCI",
      "className": "INTRO TO HISTORY OF MEDICINE",
      "course_info": [
        {
          "class_nbr": 8482,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-W166",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO KING'S STUDENTS IN THEIR FINAL YEAR. OPEN JULY 19 TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "An overview of the development of medicine from antiquity to the present, including the growth of medical sciences, concepts of disease, therapies, and the history of medical practice and institutions.\r\n \r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "5204A",
      "subject": "HOMILET",
      "className": "THEO & PRACTICE PREACHING",
      "course_info": [
        {
          "class_nbr": 8165,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Biblical Studies 5101a/b, Biblical Studies 5110a/b, Biblical Studies 5120a/b and 5116a/b.",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W4",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": "An introduction to the theology, art, and practice of preaching God¿s word. Students will read extensively in the discipline, preach regularly, and submit their sermons for critique and comment.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "5305B",
      "subject": "HOMILET",
      "className": "CONTINUATION OF HOMILETIC",
      "course_info": [
        {
          "class_nbr": 8164,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite: Homiletics 5204A/B",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W2",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "2222A",
      "subject": "HUMANECO",
      "className": "PROFESSIONAL PERSPECTIVES",
      "course_info": [
        {
          "class_nbr": 7688,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "facility_ID": "BR-136",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED IN FOOD & NUTRITION AND FAMILY STUDIES PROGRAMS."
        }
      ],
      "catalog_description": "Introduction to the history, mission, and philosophy of the Human Ecology/Home Economics professions in North America and the evolving concepts of Human Ecology/Home Economics as a field of study in higher education. Socialization toward professionalism will include the development of knowledge, skills and values appropriate to the profession.\n\nAntirequisite(s): The former Human Ecology 2222F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2266F",
      "subject": "HUMANECO",
      "className": "COMMUNICATIONS",
      "course_info": [
        {
          "class_nbr": 7745,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Registration in the Foods and Nutrition or Nutrition and Families modules (Honours Specialization, Specialization, Major).",
          "end_time": "2:30 PM",
          "facility_ID": "BR-204",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN FOODS & NUTRITION AND BSC (HUMAN ECOLOGY) FAMILY STUDIES MODULES."
        }
      ],
      "catalog_description": "A social-psychological analysis of communication theory in the context of interpersonal small-group and large-group dynamics. Group exercises to improve communication skills and to stimulate discussion. Assignments and laboratories to provide an opportunity to prepare and present information within the scope of foods and nutrition and human ecology.\n \nAntirequisite(s): Management and Organizational Studies 2205F/G. \n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "2266G",
      "subject": "HUMANECO",
      "className": "COMMUNICATIONS",
      "course_info": [
        {
          "class_nbr": 7687,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Registration in the Foods and Nutrition or Nutrition and Families modules (Honours Specialization, Specialization, Major).",
          "end_time": "2:30 PM",
          "facility_ID": "BR-204",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN FOODS & NUTRITION AND BSC (HUMAN ECOLOGY) FAMILY STUDIES MODULES."
        }
      ],
      "catalog_description": "A social-psychological analysis of communication theory in the context of interpersonal small-group and large-group dynamics. Group exercises to improve communication skills and to stimulate discussion. Assignments and laboratories to provide an opportunity to prepare and present information within the scope of foods and nutrition and human ecology.\n \nAntirequisite(s): Management and Organizational Studies 2205F/G. \n\nExtra Information: 2 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "3033A",
      "subject": "HUMANECO",
      "className": "DESIGN FOR HUMAN NEEDS",
      "course_info": [
        {
          "class_nbr": 7966,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Human Ecology 2222A/B or the former Human Ecology 2222F/G.",
          "end_time": "9:30 PM",
          "facility_ID": "BR-302",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A survey of both visual and functional aspects of the design of shelter, furnishings, clothing and consumer products. Physical needs, social/psychological factors, as well as technology, environmental, ethical and economic concerns will be addressed.\n\nExtra Information: 3 lecture/studio hours."
    },
    {
      "catalog_nbr": "3338B",
      "subject": "HUMANECO",
      "className": "ISSUES IN HOUSING",
      "course_info": [
        {
          "class_nbr": 7713,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Human Ecology 2222A/B or the former Human Ecology 2222F/G.",
          "end_time": "9:30 PM",
          "facility_ID": "BR-204",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS IN FOODS & NUTRITION AND FAMILY STUDIES MODULES."
        }
      ],
      "catalog_description": "A study of the economic and ethical principles in housing needs of individuals and families and how those have been met at different times in history, in different societies and particularly today in Canada, including discussions of housing design, urban planning, environmental issues and alternative housing. \n \nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3343A",
      "subject": "HUMANECO",
      "className": "CONSUMER ECO & RES MGMNT",
      "course_info": [
        {
          "class_nbr": 7694,
          "start_time": "6:00 PM",
          "descrlong": "Pre-or Corequisite(s): Human Ecology 2222A/B.",
          "end_time": "9:00 PM",
          "facility_ID": "BR-302",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO STUDENTS IN FOODS & NUTRITION AND FAMILY STUDIES PROGRAMS."
        }
      ],
      "catalog_description": "An interdisciplinary approach to the study of the roles and responsibilities of consumer, marketer, and government in the market-place. Emphasis on consumer behavior and management of human, economic, and environmental resources. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3349A",
      "subject": "HUMANECO",
      "className": "PRINCIPLES OF MANAGEMENT",
      "course_info": [
        {
          "class_nbr": 7701,
          "start_time": "7:00 PM",
          "descrlong": "Prerequisite(s): Business Administration 1220E. Registration in the Foods and Nutrition modules (Honours Specialization, Specialization, Major).",
          "end_time": "10:00 PM",
          "facility_ID": "BR-304",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED IN FOOD & NUTRITION PROGRAMS."
        }
      ],
      "catalog_description": "An introductory study of management principles, evolution of theories and influence of the behavioral sciences on current management practice. Functions of management, assessment and development of managerial skills. Case studies to help develop analytical and decision-making skills. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3349B",
      "subject": "HUMANECO",
      "className": "PRINCIPLES OF MANAGEMENT",
      "course_info": [
        {
          "class_nbr": 7676,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): Business Administration 1220E. Registration in the Foods and Nutrition modules (Honours Specialization, Specialization, Major).",
          "end_time": "7:30 PM",
          "facility_ID": "BR-304",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED IN FOOD & NUTRITION PROGRAMS."
        }
      ],
      "catalog_description": "An introductory study of management principles, evolution of theories and influence of the behavioral sciences on current management practice. Functions of management, assessment and development of managerial skills. Case studies to help develop analytical and decision-making skills. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4411F",
      "subject": "HUMANECO",
      "className": "RESEARCH METHODOLOGY",
      "course_info": [
        {
          "class_nbr": 7685,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Registration in the Foods and Nutrition modules (Honours Specialization).",
          "end_time": "2:30 PM",
          "facility_ID": "BR-MRW153",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS IN FOODS & NUTRITION PROGRAMS."
        }
      ],
      "catalog_description": "Students will study the components of research and develop a research proposal.\n\nExtra Information: 3 lecture/seminar hours."
    },
    {
      "catalog_nbr": "4411G",
      "subject": "HUMANECO",
      "className": "RESEARCH METHODOLOGY",
      "course_info": [
        {
          "class_nbr": 7854,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Registration in the Foods and Nutrition modules (Honours Specialization).",
          "end_time": "11:30 AM",
          "facility_ID": "BR-2013",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN FOODS & NUTRITION PROGRAMS."
        }
      ],
      "catalog_description": "Students will study the components of research and develop a research proposal.\n\nExtra Information: 3 lecture/seminar hours."
    },
    {
      "catalog_nbr": "1020E",
      "subject": "INDIGSTU",
      "className": "INTRO TO INDIGENOUS STUDIES",
      "course_info": [
        {
          "class_nbr": 1844,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UC-2105",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An interdisciplinary survey of Indigenous issues, from academic and community perspectives including indigenous knowledge, historical background, oral history, socio-political context, arts, language and culture. Specific practical examples will be explored by researchers and community members actually engaged in their contemporary documentation and resolution. \n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": 2104,
      "subject": "INDIGSTU",
      "className": "INTRODUCTORY MOHAWK LANGUAGE",
      "course_info": [
        {
          "class_nbr": 11147,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3108",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "In this unique introductory course, students will learn the basic structural framework of the Mohawk language and, through that process -- standing (metaphorically) at the “edge of the woods” -- will transform how they view an Indigenous culture and its traditions in a collaborative, supportive learning environment.\n\nAntirequisite(s): The former Anthropology 2112, the former First Nations Studies 2112.\n\nExtra Information: 3 hour lecture."
    },
    {
      "catalog_nbr": "2212G",
      "subject": "INDIGSTU",
      "className": "CULTURES OF THE PACIFIC",
      "course_info": [
        {
          "class_nbr": 9946,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Any first year Arts and Humanities or Social Science 1.0 or 0.5 Essay course.",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-66",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH ANTHRO 2212G."
        }
      ],
      "catalog_description": "The cultures of Polynesia, Micronesia and Melanesia with an emphasis on indigenous social structures. Other topics include ecology and economy, male-female relations, ritual and cosmology, hierarchical and egalitarian political systems, Pacific history, and contemporary political and economic issues. \r\n \r\nAntirequisite(s): Anthropology 2212F/G.\r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2213F",
      "subject": "INDIGSTU",
      "className": "HISTORICAL ISSUES",
      "course_info": [
        {
          "class_nbr": 7524,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-66",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines key issues related to the history of Indigenous peoples in Canada. The time frame covers the pre-contact era to the 1969 White Paper. Topics may include: Aboriginal rights and title; treaty-making; colonial policy development; residential schools; relocation and centralization; child welfare; and the 1969 White Paper.\n\nAntirequisite(s): The former First Nations Studies 2217F/G, the former Anthropology 2217F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2216F",
      "subject": "INDIGSTU",
      "className": "CULTURES OF LATIN AMERICA",
      "course_info": [
        {
          "class_nbr": 7282,
          "start_time": "",
          "descrlong": "Prerequisite(s): Any first year Arts and Humanities or Social Science 1.0 or 0.5 Essay course.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE. CROSS-LISTED WITH ANTHRO 2216F 650."
        }
      ],
      "catalog_description": "The cultural history of Latin American societies. Topics include the historical formation of indigenous communities, and a wide variety of contemporary social problems in Latin America.\r\n \r\nAntirequisite(s): Anthropology 2216F/G. \r\n\r\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2218G",
      "subject": "INDIGSTU",
      "className": "CONTEMP FRST NATNS ISS IN CAN",
      "course_info": [
        {
          "class_nbr": 7248,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-2220",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course explores the critical challenges still faced by Indigenous peoples in Canada. The material covered will be timely and relevant, including: legal and political mobilization; jurisdictional authority and self-determination; land rights and treaty relationships; the Truth and Reconciliation Commission; and the Missing and Murdered Indigenous Women and Girls inquiry.\n \nAntirequisite(s): The former Anthropology 2218F/G. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2233F",
      "subject": "INDIGSTU",
      "className": "ARCHAEOLGY ONTARIO & GT LAKES",
      "course_info": [
        {
          "class_nbr": 9949,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Anthropology 1020 (formerly Anthropology 1020E), Anthropology 1025F/G and Anthropology 1026F/G or Anthropology 2100, or Indigenous Studies 1020E.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "SSC-3102",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH ANTHRO 2233F."
        }
      ],
      "catalog_description": "The prehistoric societies of Ontario and surrounding areas. Topics include the entry of humans into the New World and their arrival in Ontario; development of agriculture; appearance of historic period societies such as the Huron, Neutral and Ojibwa; impact of European settlement and economic systems on native societies.\r\n \r\nAntirequisite(s): Anthropology 2233F/G. \r\n\r\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2501F",
      "subject": "INDIGSTU",
      "className": "IROQUOIAN ARTS",
      "course_info": [
        {
          "class_nbr": 9967,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Any Arts and Humanities or Social Science 0.5 or 1.0 Essay course.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3108",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to the decorative expression of Iroquoian peoples, from before contact to the present, providing descriptions of manufacture and use with culturally relevant explanations for non-ritual and ritual applications. Students will have the opportunity to understand and appreciate the Iroquoian worldview through its artistic expressions in daily life.\n\nAntirequisite(s): The former First Nations Studies 2255F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2700B",
      "subject": "INDIGSTU",
      "className": "MOHAWK METAPHOR",
      "course_info": [
        {
          "class_nbr": 11148,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Completion of 3.0 courses.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3108",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course, designed for a general audience, explores the Mohawk vocabulary in everyday situations. Students will learn to deconstruct the vocabulary to discover its underlying cultural references and how this reflects the values and world view of its speakers, as well as explore how the vocabulary has changed over time.\n\nExtra Information: 3 hour lecture."
    },
    {
      "catalog_nbr": "2919G",
      "subject": "INDIGSTU",
      "className": "THE IROQUOIANS",
      "course_info": [
        {
          "class_nbr": 6928,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3108",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of the culture and history of the Iroquoian Peoples from European contact to present day as presented by historical and contemporary writings and interpretation of events. Students will use a combination of primary and secondary sources drawn from both Iroquoian and Non-Iroquoian traditions. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3001G",
      "subject": "INDIGSTU",
      "className": "SPC TOP IN INDIGENOUS STUDIES",
      "course_info": [
        {
          "class_nbr": 11441,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Registration in any third or fourth year program with approval of the Director.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3108",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "TOPIC: WARRIORS, VETERANS AND PEACEKEEPERS."
        }
      ],
      "catalog_description": "Special topics of current interest in the Indigenous Studies. List of special topics may be available in the Program office.\n\nExtra Information: 3 lecture/seminar hours."
    },
    {
      "catalog_nbr": "3142G",
      "subject": "INDIGSTU",
      "className": "DOING RESEARCH",
      "course_info": [
        {
          "class_nbr": 7523,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Indigenous Studies 2213F/G, or the former Anthropology 2217F/G, or the former FNS 2217F/G.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "WL-258",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "In this interactive course students will learn the theoretical and practical foundations for conducting research with Indigenous communities. Discussions will focus on the history of research with Indigenous peoples; ethics, especially as it relates to protocols for using Indigenous knowledge(s); Indigenous research models; research agreements; and data governance (OCAP Principle).\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3722F",
      "subject": "INDIGSTU",
      "className": "INDIGENOUS POLITCL & LEGAL ISS",
      "course_info": [
        {
          "class_nbr": 2344,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): 1.0 course from Indigenous Studies 2213F/G, Indigenous Studies 2218F/G, History 2201E, History 2205E, Law 2101, Political Science 2103A/B, Political Science 2230E, Women's Studies 2260, the former Anthropology 2218F/G.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B04",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH POLITICAL SCIENCE 3398F."
        }
      ],
      "catalog_description": "Political and legal issues are inseparable in contemporary examinations of land use, self-determination, governance, individual and community rights. This course will examine the legal institutions and practices of traditional Indigenous cultures as well as contemporary practice. \n \nAntirequisite(s): Political Science 3398F/G. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3880F",
      "subject": "INDIGSTU",
      "className": "INDIGENOUS LIT. TURTLE ISLAND",
      "course_info": [
        {
          "class_nbr": 9708,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): 1000-level English or Indigenous Studies 1020E.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "UC-2105",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH ENGLISH 3680F"
        }
      ],
      "catalog_description": "This course will introduce students to a diverse range of Indigenous storytelling practices from Turtle Island (North America), which may include oral narratives, literature, and visual and performance arts. Students will consider how these practices both shape and are shaped by specific historical and geographical contexts.\n \nAntirequisite(s): English 3680F/G, the former English 3880F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2200G",
      "subject": "ICC",
      "className": "NOT \"LOST IN TRANSLATION\"",
      "course_info": [
        {
          "class_nbr": 6186,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH CLC 2200G AND GERMAN 2260G."
        }
      ],
      "catalog_description": "How does culture mold habits of thought? What is \"lost in translation\" between one culture and another? Explore cultural values, practices, symbols, rituals, heroes, and non-verbal and verbal communication. Examples and projects will be based on language and storytelling in literature, film, music, popular culture, food, fashion, and more.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2500F",
      "subject": "ICC",
      "className": "BRIDGING CLASSROOM & COMMUNITY",
      "course_info": [
        {
          "class_nbr": 6187,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Permission of the Department.\n\nPre-or Corequisite(s): Arabic 2250 or German 2200 or Italian 2200 or Japanese 2260 or Spanish 2200.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH COMPLIT 2500F/ITAL 2500F/GERMAN 2500F/SPANISH 2500F."
        }
      ],
      "catalog_description": "Develop intercultural competence by examining individual experiences of learning and maintaining language and of integrating cultural heritage. Connect in-class learning about language, identity, memory, storytelling, and related issues with service-learning projects in London or the surrounding region.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3300F",
      "subject": "ICC",
      "className": "MAKING A DIFFERENCE",
      "course_info": [
        {
          "class_nbr": 11233,
          "start_time": "",
          "descrlong": "Prerequisite(s): ICC 2200F/G.\nPre-or Corequisite(s): ICC 2500F/G.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE. MUST EMAIL BOTH Borchert@uwo.ca AND umll@uwo.ca FOR ENROLMENT REQUEST."
        }
      ],
      "catalog_description": "What do you need to be interculturally effective? Using local experiences, gain global competencies by developing a comparative perspective on expectations, myths, roles, norms, rituals, and language. Figure out how to make a difference by applying your skills."
    },
    {
      "catalog_nbr": "3300G",
      "subject": "ICC",
      "className": "MAKING A DIFFERENCE",
      "course_info": [
        {
          "class_nbr": 11234,
          "start_time": "",
          "descrlong": "Prerequisite(s): ICC 2200F/G.\nPre-or Corequisite(s): ICC 2500F/G.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE. MUST EMAIL BOTH Borchert@uwo.ca AND umll@uwo.ca FOR ENROLMENT REQUEST."
        }
      ],
      "catalog_description": "What do you need to be interculturally effective? Using local experiences, gain global competencies by developing a comparative perspective on expectations, myths, roles, norms, rituals, and language. Figure out how to make a difference by applying your skills."
    },
    {
      "catalog_nbr": "3300Z",
      "subject": "ICC",
      "className": "MAKING A DIFFERENCE",
      "course_info": [
        {
          "class_nbr": 11235,
          "start_time": "",
          "descrlong": "Prerequisite(s): ICC 2200F/G.\nPre-or Corequisite(s): ICC 2500F/G.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "What do you need to be interculturally effective? Using local experiences, gain global competencies by developing a comparative perspective on expectations, myths, roles, norms, rituals, and language. Figure out how to make a difference by applying your skills."
    },
    {
      "catalog_nbr": "3600F",
      "subject": "ICC",
      "className": "IMMERSED IN THE EXPERIENCE",
      "course_info": [
        {
          "class_nbr": 11230,
          "start_time": "",
          "descrlong": "Prerequisite(s): ICC 2200F/G.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Practice Intercultural Communication through study abroad in a non-English speaking environment of your choice. Use your own experiences of culture and community such as good, media, family, and student life to reflect on how you transform as you adapt. Develop an awareness of how communication, verbal and non-verbal, impacts intercultural understandings."
    },
    {
      "catalog_nbr": "3600G",
      "subject": "ICC",
      "className": "IMMERSED IN THE EXPERIENCE",
      "course_info": [
        {
          "class_nbr": 11231,
          "start_time": "",
          "descrlong": "Prerequisite(s): ICC 2200F/G.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Practice Intercultural Communication through study abroad in a non-English speaking environment of your choice. Use your own experiences of culture and community such as good, media, family, and student life to reflect on how you transform as you adapt. Develop an awareness of how communication, verbal and non-verbal, impacts intercultural understandings."
    },
    {
      "catalog_nbr": "3600Z",
      "subject": "ICC",
      "className": "IMMERSED IN THE EXPERIENCE",
      "course_info": [
        {
          "class_nbr": 11232,
          "start_time": "",
          "descrlong": "Prerequisite(s): ICC 2200F/G.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Practice Intercultural Communication through study abroad in a non-English speaking environment of your choice. Use your own experiences of culture and community such as good, media, family, and student life to reflect on how you transform as you adapt. Develop an awareness of how communication, verbal and non-verbal, impacts intercultural understandings."
    },
    {
      "catalog_nbr": "3800F",
      "subject": "ICC",
      "className": "WORKING WITH A MENTOR",
      "course_info": [
        {
          "class_nbr": 11227,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department. Registration in the third or fourth year of a module in Intercultural Communication, with a minimum modular average of 75%. Approval of, and acceptance into, an internship placement.\n\nPre-or Corequisite(s): Students must have completed or are completing the required courses and at least 50% of the module.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE. MUST EMAIL BOTH Borchert@uwo.ca AND umll@uwo.ca FOR ENROLMENT REQUEST."
        }
      ],
      "catalog_description": "The Academic Internship is a 0.5 credit internship with a minimum of 60 hours. The internship will require students to make connections with academic study while undertaking supervised duties in organizations, businesses, or community groups with interests related to Intercultural Communication.\n\nExtra Information: Pass or Fail.\nStudents accepted for an internship will arrange individual programs with supervising faculty. The student is required to a) maintain a suitable level of performance in the position as verified by the employer through evaluations and b) submit a mid-term as well as a final report, demonstrating how the experience gained through the internship relates to his/her coursework and program of study."
    },
    {
      "catalog_nbr": "3800G",
      "subject": "ICC",
      "className": "WORKING WITH A MENTOR",
      "course_info": [
        {
          "class_nbr": 11228,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department. Registration in the third or fourth year of a module in Intercultural Communication, with a minimum modular average of 75%. Approval of, and acceptance into, an internship placement.\n\nPre-or Corequisite(s): Students must have completed or are completing the required courses and at least 50% of the module.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE. MUST EMAIL BOTH Borchert@uwo.ca AND umll@uwo.ca FOR ENROLMENT REQUEST."
        }
      ],
      "catalog_description": "The Academic Internship is a 0.5 credit internship with a minimum of 60 hours. The internship will require students to make connections with academic study while undertaking supervised duties in organizations, businesses, or community groups with interests related to Intercultural Communication.\n\nExtra Information: Pass or Fail.\nStudents accepted for an internship will arrange individual programs with supervising faculty. The student is required to a) maintain a suitable level of performance in the position as verified by the employer through evaluations and b) submit a mid-term as well as a final report, demonstrating how the experience gained through the internship relates to his/her coursework and program of study."
    },
    {
      "catalog_nbr": "3800Z",
      "subject": "ICC",
      "className": "WORKING WITH A MENTOR",
      "course_info": [
        {
          "class_nbr": 11229,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department. Registration in the third or fourth year of a module in Intercultural Communication, with a minimum modular average of 75%. Approval of, and acceptance into, an internship placement.\n\nPre-or Corequisite(s): Students must have completed or are completing the required courses and at least 50% of the module.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "The Academic Internship is a 0.5 credit internship with a minimum of 60 hours. The internship will require students to make connections with academic study while undertaking supervised duties in organizations, businesses, or community groups with interests related to Intercultural Communication.\n\nExtra Information: Pass or Fail.\nStudents accepted for an internship will arrange individual programs with supervising faculty. The student is required to a) maintain a suitable level of performance in the position as verified by the employer through evaluations and b) submit a mid-term as well as a final report, demonstrating how the experience gained through the internship relates to his/her coursework and program of study."
    },
    {
      "catalog_nbr": 1030,
      "subject": "ITALIAN",
      "className": "ITALIAN FOR BEGINNERS",
      "course_info": [
        {
          "class_nbr": 1492,
          "start_time": "12:30 PM",
          "descrlong": "BLENDED COURSE: BOTH ONLINE AND IN PERSON INSTRUCTION.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-58",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 201,
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "An introduction to oral and written Italian with emphasis on the development of communicative skills. No previous knowledge of Italian is required. Note that students who have successfully completed Grade 12 U Italian or equivalent cannot take this course for credit.\n\nAntirequisite(s): Grade 12 U Italian, Italian 1030W/X, Italian 1033.\n\nExtra Information: 3 lecture hours plus 1 hour online."
    },
    {
      "catalog_nbr": "1045B",
      "subject": "ITALIAN",
      "className": "ITALIAN FOR TRAVELERS 1",
      "course_info": [
        {
          "class_nbr": 6235,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "THE COURSE TAKES PLACE IN TUSCANY, ITALY. INTRODUCTORY CLASSES HELD DURING WINTER TERM, ON CAMPUS IN MAY/JUNE. FOLLOWED BY ITAL 1046 DURING INTERSESSION. APPLICATION REQUIRED. FOR DETAILS SEE “INTERNATIONAL STUDY EXPERIENCE IN RONDINE, TUSCANY”, ON THE MLL WEBPAGE."
        }
      ],
      "catalog_description": "This course is designed for students with little or no previous knowledge of Italian. An introduction to Italian in an active and practical way, the course emphasizes travel competence. Based in Tuscany, students will acquire an understanding of multifaceted contemporary Italian culture.\n\nAntirequisite(s): Students with Grade 12U Italian or OAC Italian, or with previous knowledge of Italian must consult the Department before registering for this course.\n\nExtra Information: Accelerated 40 lecture hours over 3 weeks, including pre-departure sessions. The course takes place in Italy during Intersession. See Department for information on application procedure."
    },
    {
      "catalog_nbr": "2100B",
      "subject": "ITALIAN",
      "className": "STORIES OF ITALIAN CANADIANS",
      "course_info": [
        {
          "class_nbr": 11530,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "ONLINE COURSE."
        }
      ],
      "catalog_description": "Discover the unique contribution that Italians have made to the Canadian society with a special focus on your communities. Collect stories from old and new immigrants with a view of building an archive devoted to the Italian experience in Canada. Explore issues of assimilation, integration, and identity.\n\nExtra information: 2 hours. Online course. Taught in English. Coursework in English. Some course work in Italian for Italian program students only."
    },
    {
      "catalog_nbr": 2200,
      "subject": "ITALIAN",
      "className": "INTERMEDIATE ITALIAN",
      "course_info": [
        {
          "class_nbr": 6196,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): Italian 1030, Italian 1030W/X, or Italian 1033 or Grade 12U Italian or permission of the Department.",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "UC-3325",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 200,
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course further develops students' communicative skills using authentic materials including songs, films, websites. Students will familiarize themselves with the richness of Italian contemporary culture and will expand their knowledge of grammar. \n\nAntirequisite(s): Italian 2200W/X, Italian 2202X, the former Italian 2250.\n\nExtra Information: 3 lecture hours plus 1 hour online."
    },
    {
      "catalog_nbr": "2202X",
      "subject": "ITALIAN",
      "className": "INTERMEDIATE ITALIAN IN ITALY",
      "course_info": [
        {
          "class_nbr": 6236,
          "start_time": "",
          "descrlong": "Prerequisite(s): Italian 1030 or Italian 1030W/X or Italian 1033, Italian 1045A/B and Italian 1046A/B, or Grade 12U Italian with a minimum grade of 70% or permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "THE COURSE TAKES PLACE IN TUSCANY, ITALY. INTRODUCTORY CLASSES HELD DURING FALL/WINTER TERM ON CAMPUS, REMAINING CLASSES AND EXPERIENTIAL LEARNING IN ITALY, IN MAY/JUNE. APPLICATION REQUIRED. FOR DETAILS SEE “INTERNATIONAL STUDY EXPERIENCE IN RONDINE, TUSCANY”, ON THE MLL WEBPAGE."
        }
      ],
      "catalog_description": "The course builds upon a basic knowledge of Italian and develops further effective oral and written skills in a language immersion environment. Students will be exposed to authentic Italian culture in the heart of Tuscany through daily interactions with native speakers. The course includes a community-engaged learning component.\n\nAntirequisite(s): Italian 2200, the former Italian 2250.\n\nExtra Information: 80 lecture hours over 4 weeks. The course takes place in Italy during Intersession. See Department for information on application procedure."
    },
    {
      "catalog_nbr": "2220B",
      "subject": "ITALIAN",
      "className": "ITALIAN CONVERSATION",
      "course_info": [
        {
          "class_nbr": 10546,
          "start_time": "11:30 AM",
          "descrlong": "Pre-or Corequisite(s): Italian 2200, Italian 2200W/X, Italian 2202X, the former Italian 2250 or permission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "TC-203",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH ITALIAN 3320B."
        }
      ],
      "catalog_description": "Guided conversations in Italian dealing with the hottest issues in contemporary Italy. Students will develop their communicative skills in Italian through discussion of a number of topics, ranging from social and political issues to TV and pop culture, fashion, food, sports.\n\nAntirequisite(s): Italian 3320A/B.\n\nExtra Information: 3 hours. Taken in second or third year."
    },
    {
      "catalog_nbr": "2280A",
      "subject": "ITALIAN",
      "className": "SPECIAL TOPICS IN ITALIAN",
      "course_info": [
        {
          "class_nbr": 11217,
          "start_time": "1:30 PM",
          "descrlong": "Pre-or Corequisite(s): Italian 1030 or Italian 1030W/X or Italian 1033 or permission of the Department.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-56",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH CLC 2105A AND FILM 2197A. TOPIC: SPAGHETTI WESTERNS (ORIGINS, LEGACY AND POPULAR CINEMA, FROM SERGIO LEONE TO QUENTIN TARANTINO)"
        }
      ],
      "catalog_description": "Special credit for Italian language or culture studies at authorized universities and institutions in approved programs. Not taught on campus.\r\n\r\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2284B",
      "subject": "ITALIAN",
      "className": "SPECIAL TOPICS IN ITALIAN",
      "course_info": [
        {
          "class_nbr": 11322,
          "start_time": "10:30 AM",
          "descrlong": "Pre-or Corequisite(s): Italian 1030 or Italian 1030W/X or Italian 1033 or permission of the Department.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "TC-201",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "TOPIC: INTRODUCTION TO ROMANCE LANGUAGES PHONETICS."
        }
      ],
      "catalog_description": "Special credit for Italian language or culture studies at authorized universities and institutions in approved programs. Not taught on campus.\r\n\r\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2500F",
      "subject": "ITALIAN",
      "className": "BRIDGING CLASSROOM & COMMUNITY",
      "course_info": [
        {
          "class_nbr": 5896,
          "start_time": "9:30 AM",
          "descrlong": "Pre-or Corequisite(s): Italian 2200, Italian 2200W/X, Italian 2202X, or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH COMPLIT 2500F/ICC 2500F/GERMAN 2500F/SPANISH 2500F."
        }
      ],
      "catalog_description": "Develop intercultural competence by examining individual experiences of learning and maintaining language and of integrating cultural heritage. Connect in-class learning about language acquisition, identity, memory and related issues with service-learning projects in London or the surrounding region. Taught in English and Italian.\n \nAntirequisite(s): CLC 2500F/G, German 2500F/G, Spanish 2500F/G, ICC 2500F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3040B",
      "subject": "ITALIAN",
      "className": "STUDIES CITADEL OF PEACE ITALY",
      "course_info": [
        {
          "class_nbr": 6372,
          "start_time": "",
          "descrlong": "Pre- or Corequisite(s): Italian 1045A/B (taught in conjunction with Italian 3040A/B).",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "STUDIES IN INTERCULTURAL COMPETENCE AND PEACEBUILDING AT THE CITADEL OF PEACE IN TUSCANY. THE COURSE TAKES PLACE IN TUSCANY, ITALY, IN MAY/JUNE. INTRODUCTORY CLASSES HELD DURING WINTER TERM ON CAMPUS. APPLICATION REQUIRED. FOR DETAILS SEE “INTERNATIONAL STUDY EXPERIENCE IN RONDINE, TUSCANY”, ON THE MLL WEBPAGE."
        }
      ],
      "catalog_description": "This course, held mainly in Tuscany at Rondine Citadel of Peace, builds skills for understanding cultural differences and fosters awareness for social change in a global context. Intercultural competences, migration phenomena and peacebuilding will be approached in theory and practice through field experience as well as visual and written material.\n\nExtra Information: 3 hours.\nTaught in English. The course takes place in Italy during Intersession. See Department for information on application procedure."
    },
    {
      "catalog_nbr": 3300,
      "subject": "ITALIAN",
      "className": "ADVANCED ITALIAN",
      "course_info": [
        {
          "class_nbr": 5892,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Italian 2200, Italian 2200W/X, Italian 2202X, the former Italian 2250 with a minimum standing of 60%, or permission of the Department.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "HELD JAN-APRIL IN LWH 2205."
        }
      ],
      "catalog_description": "This course expands students' communicative skills, introduces idiomatic expressions and increases control of grammatical structures. Material will be drawn from authentic articles, websites and films. Discussion will be focused on cultural aspects of Italy's past and contemporary society.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "3320B",
      "subject": "ITALIAN",
      "className": "ADV ITALIAN CONVERSATIONS",
      "course_info": [
        {
          "class_nbr": 11237,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Italian 2200, Italian 2200W/X, Italian 2202X, the former Italian 2250, or\npermission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "TC-203",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH ITALIAN 2220B."
        }
      ],
      "catalog_description": "Guided conversations in advanced Italian dealing with the hottest issues in contemporary Italy. Students will develop their communicative skills in Italian through discussion of a number of topics, ranging from social and political issues to TV and pop culture, fashion, food, sports.\n\nAntirequisite(s): Italian 2220A/B.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3338G",
      "subject": "ITALIAN",
      "className": "BOOKS ON THE BIG SCREEN",
      "course_info": [
        {
          "class_nbr": 11315,
          "start_time": "1:30 PM",
          "descrlong": "Pre-or Corequisite(s): Italian 3300 or permission of the Department.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-54A",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Explore the interplay between cinema and literature in Italian culture, focusing on the adaptation of great literary works into classic films. Students will be introduced to elements of semiotics that will allow them to appreciate and discuss the distinctive features of verbal and filmic narrative. \n\nExtra Information: 3 hours. Note: Taught in Italian."
    },
    {
      "catalog_nbr": "3600G",
      "subject": "ITALIAN",
      "className": "INTERNSHIP IN ITALIAN",
      "course_info": [
        {
          "class_nbr": 11275,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department, Italian 2200 or Italian 2202X, and Intercultural Communications 2200F/G. Registration in the third or fourth year of a module Italian, with a minimum cumulative modular average of 75%. Approval of, and acceptance into, an internship placement.\n\nPre-or Corequisite(s): Students must have completed or be completing the required courses and at least 50% of the module.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "The Academic Internship is a 0.5 credit internship with minimum of 60 hours. The internship will require students to make connections with academic study while undertaking supervised duties in organizations, businesses or community groups with interests related to Italian.\n\nExtra Information: Pass, or Fail. Students accepted for an internship will arrange individual programs with supervising faculty. The student is required to a) maintain a suitable level of performance in the position as verified by the employer through evaluations and b) submit a midterm as well as a final report, demonstrating how the experience gained through the internship relates to his/her coursework and program of study."
    },
    {
      "catalog_nbr": "4430F",
      "subject": "ITALIAN",
      "className": "SP TOP - ITALIAN LIT & CULTURE",
      "course_info": [
        {
          "class_nbr": 11426,
          "start_time": "",
          "descrlong": "Prerequisite(s): Italian 3300 or permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Please consult the Department for current offerings. \n \nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 1036,
      "subject": "JAPANESE",
      "className": "JAPANESE FOR BEGINNERS",
      "course_info": [
        {
          "class_nbr": 1875,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-11",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An intensive introduction to spoken and written Japanese with emphasis on the development of communicative skills. Intended for students with little or no previous knowledge of Japanese. Prepares students for progression to Japanese 2260. Note that students who have successfully completed Grade 12 U Japanese or equivalent cannot take this course for credit.\n \nAntirequisite(s): Grade 12 U Japanese, or Japanese 1050, Japanese 1051A/B, Japanese 1052A/B. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": 1050,
      "subject": "JAPANESE",
      "className": "JAPANESE I",
      "course_info": [
        {
          "class_nbr": 8145,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W106",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON STUDENTS. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "An introduction to spoken and written Japanese with emphasis on the development of communicative skills. Intended for students with little or no previous knowledge of Japanese. Prepares students for progression to Japanese 2250. \n\nAntirequisite(s): Japanese 1036, Japanese 1051A/B, Japanese 1052A/B.\n\nExtra Information: 4 hours. Those students with Grade 12U Japanese must consult the Department before registering for this course."
    },
    {
      "catalog_nbr": "1650F",
      "subject": "JAPANESE",
      "className": "PERSPECTIVES ON JAPAN",
      "course_info": [
        {
          "class_nbr": 9587,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W112",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A multi-disciplinary overview of Japan. Contents include territory, people, language, religion, economy, popular culture, science and technology, among others. Students investigate - and formulate questions - on Japan and East Asia within today's globalized world, identify their own cultural bias toward less familiar subjects, and critically evaluate diverse perspectives. Taught in English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 2250,
      "subject": "JAPANESE",
      "className": "JAPANESE 2",
      "course_info": [
        {
          "class_nbr": 8068,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): Japanese 1050 or Japanese 1051A/B and Japanese 1052A/B or permission of the Department.",
          "end_time": "6:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W108",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Builds on skills in reading and speaking Japanese developed in earlier courses. This course bridges between the elementary and intermediate level. Students gain increased vocabulary and familiarity with more extensive grammatical structures and will be able to communicate in Japanese regarding non-specialized topics. \n\nAntirequisite(s): Japanese 2260.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": 2260,
      "subject": "JAPANESE",
      "className": "INTRMEDIATE JAPANESE",
      "course_info": [
        {
          "class_nbr": 4514,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Japanese 1036 or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "UCC-63",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is designed to build on all four language skills (reading, writing, listening, and speaking) in Japanese developed in earlier courses. Emphasis is on the expansion of Japanese vocabulary, grammatical structures and kanji along with the communicative skills. Prepares students for progression to Japanese 3350. \n \nAntirequisite(s): Japanese 2250. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "2601A",
      "subject": "JAPANESE",
      "className": "CULTURAL FNDS OF MODERN JAPAN",
      "course_info": [
        {
          "class_nbr": 8218,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-V210",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "A survey of the artistic, philosophical, and religious factors that shape modern Japan. Taught in English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 3350,
      "subject": "JAPANESE",
      "className": "JAPANESE 3",
      "course_info": [
        {
          "class_nbr": 8070,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Japanese 2250, or Japanese 2260, or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W6",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "More advanced conversation, written composition, listening skills, and translation techniques will be emphasized. Students will master all the core elements of Japanese grammar, a larger vocabulary and kanji, and intermediate-level communicative skills. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "3360A",
      "subject": "JAPANESE",
      "className": "JAPANESE CONVERSATION I",
      "course_info": [
        {
          "class_nbr": 10615,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Japanese 2250 or Japanese 2260.",
          "end_time": "3:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W4",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Conversation-based, group-oriented experiential approach to Japanese. Conducting theme-based tasks in Japanese, students improve their conversational proficiency, as well as expanding practical vocabulary of Japanese. Taught in Japanese.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "3361B",
      "subject": "JAPANESE",
      "className": "JAPANESE CONVERSATION II",
      "course_info": [
        {
          "class_nbr": 10616,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Japanese 2250 or Japanese 2260.",
          "end_time": "3:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W4",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Conversation-based, group-oriented experiential approach to Japanese. Conducting theme-based tasks in Japanese, students improve their conversational proficiency, as well as expanding practical vocabulary of Japanese. Taught in Japanese.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "3650G",
      "subject": "JAPANESE",
      "className": "JAPAN THROUGH FILM",
      "course_info": [
        {
          "class_nbr": 8203,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 1.0 Essay course from Category A or B.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-V210",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Examination of various aspects of Japanese culture using Japanese cinema. The works by Kurosawa, and Itami, among others, will be used to prompt discussion of such topics as contemporary issues in Japanese society, aesthetics, and communication. Taught in English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3680F",
      "subject": "JAPANESE",
      "className": "JAPAN THROUGH FOOD",
      "course_info": [
        {
          "class_nbr": 10613,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Japanese 2601A/B, or 1.0 Essay course(s) from Category A or B.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W108",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Seminar on various cultural aspects of Japanese cuisine. Like any culture, Japanese has a rich food-related tradition. Examined properly, it reveals complex interactions with many distinct cultures, and Japanese attitude toward cultural integration. Through Japanese food we also investigate the Japanese attitude toward arts, craftsmanship, popularization of culture, and domesticated foreign influences.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3750F",
      "subject": "JAPANESE",
      "className": "SENIOR RESEARCH SEMINAR",
      "course_info": [
        {
          "class_nbr": 10614,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Japanese 2601A/B.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W2",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A senior level seminar to pursue students’ own research interests in the topics involving Japanese culture, Japanese language, or foreign language pedagogy. Topics of comparative natures and an interdisciplinary approach are encouraged. Prior approval by the program required. Taught in English.\n\nExtra information: 3 hour course."
    },
    {
      "catalog_nbr": "3751G",
      "subject": "JAPANESE",
      "className": "SENIOR RESEARCH SEMINAR II",
      "course_info": [
        {
          "class_nbr": 10617,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Japanese 2601A/B.",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W17",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A senior level seminar to pursue students’ own research interests in the topics involving Japanese culture, Japanese language, or foreign language pedagogy. Topics of comparative natures and an interdisciplinary approach are encouraged. Prior approval by the program required. Taught in English.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3950F",
      "subject": "JAPANESE",
      "className": "SPECIAL TOPIC IN JAPAN STUDIES",
      "course_info": [
        {
          "class_nbr": 11683,
          "start_time": "",
          "descrlong": "Prerequisite(s): 1.0 Essay course from Category A or B.",
          "end_time": "",
          "campus": "Huron",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Topics selected by the instructor. Consult the Department of French and Asian Studies.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3958F",
      "subject": "JAPANESE",
      "className": "SPECIAL TOPIC IN JAPAN STUDIES",
      "course_info": [
        {
          "class_nbr": 11749,
          "start_time": "",
          "descrlong": "Prerequisite(s): 1.0 Essay course from Category A or B.",
          "end_time": "",
          "campus": "Huron",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Topics selected by the instructor. Consult the Department of French and Asian Studies.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3959G",
      "subject": "JAPANESE",
      "className": "SPECIAL TOPIC IN JAPAN STUDIES",
      "course_info": [
        {
          "class_nbr": 11750,
          "start_time": "",
          "descrlong": "Prerequisite(s): 1.0 Essay course from Category A or B.",
          "end_time": "",
          "campus": "Huron",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Topics selected by the instructor. Consult the Department of French and Asian Studies.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 4450,
      "subject": "JAPANESE",
      "className": "JAPANESE 4",
      "course_info": [
        {
          "class_nbr": 8071,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Japanese 3350 or placement test.",
          "end_time": "10:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W2",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course builds on the skills developed in Japanese 3350. Students will read such primary materials as newspaper and journal articles, develop skills in conversation and discussion of topics related to the readings and develop practical writing skills. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "1370F",
      "subject": "JEWISH",
      "className": "THE PROBLEM OF ANTI-SEMITISM",
      "course_info": [
        {
          "class_nbr": 9448,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V207",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introductory survey of some of the forms that anti-Semitic ideas have taken from the time of the later Roman Empire until today, together with an examination of some responses to those ideas by philosophers and political theorists.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1370G",
      "subject": "JEWISH",
      "className": "THE PROBLEM OF ANTI-SEMITISM",
      "course_info": [
        {
          "class_nbr": 11439,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W101",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introductory survey of some of the forms that anti-Semitic ideas have taken from the time of the later Roman Empire until today, together with an examination of some responses to those ideas by philosophers and political theorists.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2791G",
      "subject": "JEWISH",
      "className": "SPECIAL TOPICS IN JEWISH STUD",
      "course_info": [
        {
          "class_nbr": 10521,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W112",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course explores topics in Jewish Studies related to Jewish history and/or experience. Consult the Faculty of Arts and Social Sciences for current offerings.\n\nExtra information: 3 hours."
    },
    {
      "catalog_nbr": "1070A",
      "subject": "KINESIOL",
      "className": "PSYCH OF HUMAN MOVEMENT SCI",
      "course_info": [
        {
          "class_nbr": 4611,
          "start_time": "8:30 AM",
          "descrlong": ".",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YR 1 KIN STUDENTS, 14 SPACES BRESCIA YR 1 KIN ONLY. OPEN JULY 19 TO OTHER YR 1 STUDENTS. OPEN AUG 21 TO OTHER STUDENTS; NON-KIN STUDENTS (LIMIT 1.0)."
        }
      ],
      "catalog_description": "To obtain basic knowledge in the psychology of human movement science research. The student will become familiar with the latest theory and research from the four pillars of sport psychology, exercise psychology, theoretical models of sedentary behaviour and innovative ways to reduce sedentary behaviour.\n\nAntirequisite(s): The former Kinesiology 1088A/B.\n\nExtra Information: 3 lecture hours, 3 laboratory hours biweekly, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1080B",
      "subject": "KINESIOL",
      "className": "INTRO TO PSYCHOMOTOR BEHVIOUR",
      "course_info": [
        {
          "class_nbr": 2078,
          "start_time": "8:30 AM",
          "descrlong": ".",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YR 1 KIN STUDENTS, 14 SPACES BRESCIA YR 1 KIN ONLY. OPEN JULY 19 TO OTHER YR 1 STUDENTS. OPEN AUG 21 TO OTHER STUDENTS; NON-KIN STUDENTS (LIMIT 1.0)."
        }
      ],
      "catalog_description": "Fundamental concepts and theories related to movement learning and control will be introduced. The material will address many of the factors that affect the production of motor behaviour. Students will learn about the basis for movement skill and variables that can be used to improve level of skill.\n\nExtra Information: 3 lecture hours, 3 laboratory hours biweekly, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2000A",
      "subject": "KINESIOL",
      "className": "PHYSICAL ACTIVITY & HEALTH",
      "course_info": [
        {
          "class_nbr": 5160,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SH-3345",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO NON-KINESIOLOGY STUDENTS."
        }
      ],
      "catalog_description": "The course focuses on the significant impact that physical activity has on optimal health and well-being. Students will be introduced to, and their knowledge enhanced in, concepts in the area of physical activity and health by exploring the scientific evidence base for the relationships among physical activity, well-being and disease.\n\nAntirequisite(s): Kinesiology 2271B if taken in 2013-14.\n\nExtra Information: 2 lecture hours. Note: This course may not be taken for credit by students registered in the School of Kinesiology."
    },
    {
      "catalog_nbr": "2000B",
      "subject": "KINESIOL",
      "className": "PHYSICAL ACTIVITY & HEALTH",
      "course_info": [
        {
          "class_nbr": 4405,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-1059",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO NON-KINESIOLOGY STUDENTS."
        }
      ],
      "catalog_description": "The course focuses on the significant impact that physical activity has on optimal health and well-being. Students will be introduced to, and their knowledge enhanced in, concepts in the area of physical activity and health by exploring the scientific evidence base for the relationships among physical activity, well-being and disease.\n\nAntirequisite(s): Kinesiology 2271B if taken in 2013-14.\n\nExtra Information: 2 lecture hours. Note: This course may not be taken for credit by students registered in the School of Kinesiology."
    },
    {
      "catalog_nbr": "2032B",
      "subject": "KINESIOL",
      "className": "RESRCH DSGN IN HUMN MOVMNT SCI",
      "course_info": [
        {
          "class_nbr": 2376,
          "start_time": "8:30 AM",
          "descrlong": "Pre-or Corequisite(s): Any 1.0 or 0.5 statistics course.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO ALL SENIOR KIN STUDENTS. LIMITED NUMBER OF SPACES FOR CLINICAL KIN MODULE. JULY 19 EQUAL ACCESS TO ALL KIN STUDENTS. OPEN AUG 21 TO NON-KIN STUDENTS (LIMIT 1.0)"
        }
      ],
      "catalog_description": "An introduction to the basic aspects of reading, interpreting, evaluating, and presenting research in order to better understand the research process in physical activity. Measurement and data collection techniques from physical and social science areas of kinesiology will be examined using both quantitative and qualitative research designs employed in movement science.\n\nAntirequisite(s): Health Sciences 2801A/B. \n\nExtra Information: 2 lecture hours; 2 laboratory hours every three weeks."
    },
    {
      "catalog_nbr": "2222A",
      "subject": "KINESIOL",
      "className": "SYSTEMIC APPROACH BODY",
      "course_info": [
        {
          "class_nbr": 1124,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Completion of the first year Kinesiology program and registration in the School of Kinesiology. Restricted to BA Kinesiology students. Grade 12U Biology or equivalent is strongly recommended.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ALL SENIOR KIN STUDENTS. OPEN AUG 21 TO NON-KIN STUDENTS (LIMIT 1.0). CROSS-LISTED WITH HS 2300A."
        }
      ],
      "catalog_description": "A gross anatomical description of systemic structure and function of the human body, with emphasis on skeletal, muscular and cardiovascular systems. Integration between systems will be discussed using clinical examples related to sport, medicine, and physical therapy. This is an introductory level lecture course for BA Kinesiology students.\n\nAntirequisite(s): Anatomy and Cell Biology 2200A/B, Anatomy and Cell Biology 2221, Health Sciences 2300A/B, Health Sciences 2330A/B, the former Anatomy and Cell Biology 3319.\n\nExtra Information: 3 lecture hours, 1.0 laboratory hour."
    },
    {
      "catalog_nbr": "2222B",
      "subject": "KINESIOL",
      "className": "SYSTEMIC APPROACH BODY",
      "course_info": [
        {
          "class_nbr": 2186,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Completion of the first year Kinesiology program and registration in the School of Kinesiology. Restricted to BA Kinesiology students. Grade 12U Biology or equivalent is strongly recommended.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ALL SENIOR KIN STUDENTS. OPEN AUG 21 TO NON-KIN STUDENTS (LIMIT 1.0). CROSS-LISTED WITH HS 2300B."
        }
      ],
      "catalog_description": "A gross anatomical description of systemic structure and function of the human body, with emphasis on skeletal, muscular and cardiovascular systems. Integration between systems will be discussed using clinical examples related to sport, medicine, and physical therapy. This is an introductory level lecture course for BA Kinesiology students.\n\nAntirequisite(s): Anatomy and Cell Biology 2200A/B, Anatomy and Cell Biology 2221, Health Sciences 2300A/B, Health Sciences 2330A/B, the former Anatomy and Cell Biology 3319.\n\nExtra Information: 3 lecture hours, 1.0 laboratory hour."
    },
    {
      "catalog_nbr": "2230A",
      "subject": "KINESIOL",
      "className": "INTRODUCTORY EXERCISE PHYSIOL",
      "course_info": [
        {
          "class_nbr": 1814,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Grade 12U Biology or equivalent, and Physiology 1021 or equivalent with a minimum grade of 60%.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "PAB-148",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO ALL SENIOR KIN STUDENTS. OPEN AUG 21 TO NON-KIN STUDENTS (LIMIT 1.0)."
        }
      ],
      "catalog_description": "The physiological basis of muscular exercise and training. The course will examine metabolic, cardiorespiratory and muscular adaptations to acute and chronic exercise.\n\nExtra Information: 3 lecture hours, 3 laboratory hours biweekly."
    },
    {
      "catalog_nbr": "2230B",
      "subject": "KINESIOL",
      "className": "INTRODUCTORY EXERCISE PHYSIOL",
      "course_info": [
        {
          "class_nbr": 1125,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Grade 12U Biology or equivalent, and Physiology 1021 or equivalent with a minimum grade of 60%.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ALL SENIOR KIN STUDENTS. OPEN AUG 21 TO NON-KIN STUDENTS (LIMIT 1.0)."
        }
      ],
      "catalog_description": "The physiological basis of muscular exercise and training. The course will examine metabolic, cardiorespiratory and muscular adaptations to acute and chronic exercise.\n\nExtra Information: 3 lecture hours, 3 laboratory hours biweekly."
    },
    {
      "catalog_nbr": 1000,
      "subject": "LATIN",
      "className": "INTRODUCTORY LATIN",
      "course_info": [
        {
          "class_nbr": 1937,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-2230",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction course in Latin covering major points of grammar and syntax.\n\nAntirequisite(s): Those students with Grade 12U level Latin must consult the Department before registering for this course. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": 2000,
      "subject": "LATIN",
      "className": "ADVANCED LATIN",
      "course_info": [
        {
          "class_nbr": 1939,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Latin 1000.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "LWH-3220",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A continuation of Latin grammar and an introduction to the works of Latin authors.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3100A",
      "subject": "LATIN",
      "className": "LATIN PROSE SELECTIONS",
      "course_info": [
        {
          "class_nbr": 5950,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Latin 2000 or permission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "STVH-2166",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH LATIN 4903A."
        }
      ],
      "catalog_description": "A selection of Latin prose authors.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3200B",
      "subject": "LATIN",
      "className": "LATIN POETRY SELECTIONS",
      "course_info": [
        {
          "class_nbr": 5951,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Latin 2000 or permission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "STVH-3101",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH LATION 4904B."
        }
      ],
      "catalog_description": "A selection of Latin poetry.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4903A",
      "subject": "LATIN",
      "className": "SPECIAL TOPICS IN LATIN",
      "course_info": [
        {
          "class_nbr": 6448,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Any 3000-level course in Latin or permission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "STVH-2166",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH LATIN 3100A."
        }
      ],
      "catalog_description": "Extra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4904B",
      "subject": "LATIN",
      "className": "SPECIAL TOPICS IN LATIN",
      "course_info": [
        {
          "class_nbr": 6449,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Any 3000-level course in Latin or permission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "STVH-3101",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH LATIN 3200B."
        }
      ],
      "catalog_description": "Extra Information: 3 lecture hours"
    },
    {
      "catalog_nbr": "0010A",
      "subject": "LS",
      "className": "INTRODUCTION TO LEADERSHIP",
      "course_info": [
        {
          "class_nbr": 7936,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "4:30 PM",
          "facility_ID": "BR-UH250",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS ENROLLED IN THE PRELIMINARY YEAR."
        }
      ],
      "catalog_description": "In this course students are introduced to the history and evolution of approaches to leadership, and discover what makes an effective leader in today’s world.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1000B",
      "subject": "LS",
      "className": "PRIMER ON LEADERSHIP",
      "course_info": [
        {
          "class_nbr": 7943,
          "start_time": "6:30 PM",
          "descrlong": "",
          "end_time": "9:30 PM",
          "facility_ID": "BR-303",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to various aspects of the study of leadership, with an emphasis on the theory and practice of leadership.\n\nAntirequisite(s): Leadership Studies 1031, the former Dimensions of Leadership 1000A/B, the former Dimensions of Leadership 1031\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 1031,
      "subject": "LS",
      "className": "EXPLORING LEADERSHIP",
      "course_info": [
        {
          "class_nbr": 7944,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "facility_ID": "BR-UH250",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An interdisciplinary course providing students with an introduction to the concept and history of leadership. Students will examine the philosophical, psychological and theoretical perspectives on leadership through readings, engagement with representative leaders, and experiential simulations and activities.\n\nAntirequisite(s): The former Dimensions of Leadership 1031, the former Interdisciplinary Studies 1031.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1035A",
      "subject": "LS",
      "className": "LEADERSHIP FOR FOODS & NUTR",
      "course_info": [
        {
          "class_nbr": 7947,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Registration in Foods and Nutrition programs or permission of the Division of Food and Nutritional Sciences.",
          "end_time": "5:30 PM",
          "facility_ID": "BR-136",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS ENROLLED IN THE FOODS & NUTRITION PROGRAM."
        }
      ],
      "catalog_description": "An introduction to various aspects of the study of leadership with application to foods and nutrition. Areas of concern include transformational leadership, culture and leadership, elements of effective leadership, and case studies involving leadership and foods and nutrition.\n\nAntirequisite(s): The former Dimensions of Leadership 1000A/B, the former Dimensions of Leadership 1031, the former Dimensions of Leadership 1035.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2000B",
      "subject": "LS",
      "className": "PRIMER ON LEADERSHIP",
      "course_info": [
        {
          "class_nbr": 11033,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Enrolment in the Diploma in Management Studies at Brescia University College.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-UH250",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN THE DIPLOMA IN MANAGEMENT STUDIES."
        }
      ],
      "catalog_description": "An introduction to various aspects of the study of leadership, with an emphasis on the theory and practice of leadership.\n\nAntirequisite(s): Leadership Studies 1000A/B, Leadership Studies 1031.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2210G",
      "subject": "LS",
      "className": "LEADING ETHICALLY IN DARK TIME",
      "course_info": [
        {
          "class_nbr": 7948,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Leadership Studies 1031, the former Dimensions of Leadership 1031 or permission of the department.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-304",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course engages students to think and write critically about what is typically identified as good and bad leadership, while confronting the spectre of moral tragedy that can accompany effective leadership. It emphasizes the role that both character and institutional context play in supporting or undermining ethical leadership.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2233A",
      "subject": "LS",
      "className": "WOMEN AND LEADERSHIP",
      "course_info": [
        {
          "class_nbr": 7950,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Leadership Studies 1031, the former Dimensions of Leadership 1031 or permission of the department.",
          "end_time": "5:30 PM",
          "facility_ID": "BR-2013",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course considers the traits, styles, and effectiveness of women leaders as well as significant differences which may separate male and female leaders. Obstacles women face in securing leadership positions and actions which might be taken to close this leadership gap are also examined.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2330A",
      "subject": "LS",
      "className": "LEADING CHANGE",
      "course_info": [
        {
          "class_nbr": 9775,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Leadership Studies 1031.",
          "end_time": "2:30 PM",
          "facility_ID": "BR-135",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course introduces students to the nature of change, change models, vision development, stakeholder analysis, change agent roles, resistance, and persuasion and influence techniques.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3330G",
      "subject": "LS",
      "className": "LEADING CHANGE IN ORGANIZATION",
      "course_info": [
        {
          "class_nbr": 7951,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Leadership Studies 2232A/B and Leadership Studies 2233A/B or the former Dimensions of Leadership 2232A/B and the former Dimensions of Leadership 2233A/B or permission of the department.",
          "end_time": "2:30 PM",
          "facility_ID": "BR-UH26",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course builds on change theories, positive psychology, complexity science, and social movement theories to analyze organizational issues and to develop and lead actionable change processes. Individual, organizational and societal elements required for successful change are examined through the case method of learning, experiential exercises, and lectures.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3331F",
      "subject": "LS",
      "className": "ADVANCED LEADERSHIP",
      "course_info": [
        {
          "class_nbr": 9776,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Leadership Studies 2232A/B and Leadership Studies 2233A/B or the former Dimensions of Leadership 2232A/B and the former Dimensions of Leadership 2233A/B or permission of the department.",
          "end_time": "5:30 PM",
          "facility_ID": "BR-UH26",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An in-depth and advanced examination of key elements and issues which arise in the field of leadership studies. Course topics vary from year to year.\n.\nExtra Information: 3 seminar hours."
    },
    {
      "catalog_nbr": "3333A",
      "subject": "LS",
      "className": "LEADERSHIP DEVELOPMENT",
      "course_info": [
        {
          "class_nbr": 7953,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Leadership Studies 2232A/B and Leadership Studies 2233A/B or the former Dimensions of Leadership 2232A/B and the former Dimensions of Leadership 2233A/B or permission of the department.",
          "end_time": "2:30 PM",
          "facility_ID": "BR-UH26",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course considers the conditions, techniques, and activities which facilitate the development of leaders and leadership. The course emphasizes that leadership development includes not only the nurturing of individual skills but also competencies relating to interactions with other persons in the immediate environment and the larger organization. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "4333B",
      "subject": "LS",
      "className": "DEVELOPING LEADERSHIP FOR ORGS",
      "course_info": [
        {
          "class_nbr": 9777,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Leadership Studies 3333A/B.",
          "end_time": "2:30 PM",
          "facility_ID": "BR-UH26",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course considers the conditions, techniques, and activities which facilitate the development of leaders and leadership in organizations. This course emphasizes the leadership skills and competencies related to interactions within the larger organization.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "4431F",
      "subject": "LS",
      "className": "LEADERSHIP IN THE 21ST CENTURY",
      "course_info": [
        {
          "class_nbr": 7954,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Leadership Studies 3331F/G and Leadership Studies 3333F/G or the former Dimensions of Leadership 3331F/G and the former Dimensions of Leadership 3333A/B.",
          "end_time": "2:30 PM",
          "facility_ID": "BR-UH26",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A seminar which provides students with an opportunity to undertake a close study of a selected topic or issue concerning leadership. Students will select, refine and develop a research paper on a selected leadership topic as well as provide and receive commentary on their work and that of their colleagues.\n\nExtra Information: 3 seminar hours."
    },
    {
      "catalog_nbr": "4432B",
      "subject": "LS",
      "className": "LEADERSHIP PRACTICUM",
      "course_info": [
        {
          "class_nbr": 7970,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Leadership Studies 4431F/G, the former Dimensions of Leadership 4431F/G or permission of the department.",
          "end_time": "2:30 PM",
          "facility_ID": "BR-302A",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Supervised placement with agencies and organizations in the community to complement classroom learning with experienced-based knowledge of leadership. Students will work to satisfy both specified learning objectives and placement job requirements.\n\nAntirequisite(s): The former Dimensions of Leadership 3338A/B.\n\nExtra Information: 3 seminar hours."
    },
    {
      "catalog_nbr": "1028B",
      "subject": "LINGUIST",
      "className": "LINGUISTICS: APPS & EXTENSIONS",
      "course_info": [
        {
          "class_nbr": 1716,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): One of Anthropology 1027A/B, Linguistics 2288A/B, (both French 2805A/B, French 2806A/B), Spanish 3303A/B, the former French 2800 or permission of Linguistics program.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3028",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Acquaints students with human language and how it relates to society and to the mind. Topics include applications of linguistics, such as language acquisition, language and law, language disorders, and language variation across time, space and society.\n\nExtra Information: 3 hours of lecture/tutorial."
    },
    {
      "catalog_nbr": "2242A",
      "subject": "LINGUIST",
      "className": "PHONETICS",
      "course_info": [
        {
          "class_nbr": 9991,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): One of: Anthropology 1027A/B, Linguistics 2288A/B, both French 2805A/B and\nFrench 2806A/B, or Spanish 3303A/B.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B02",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to the study of speech sounds. Topics covered include: basic anatomy of speech production, articulatory phonetics, acoustic phonetics, speech perception, phonetic transcription of sounds of the world’s languages.\n\nExtra Information: 3 hours of lecture/tutorial."
    },
    {
      "catalog_nbr": "2244B",
      "subject": "LINGUIST",
      "className": "SECOND LANGUAGE ACQUISITION",
      "course_info": [
        {
          "class_nbr": 5886,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): One of Anthropology 1027A/B, Linguistics 2288A/B, Spanish 3303A/B, or both French 2805A/B and French 2806A/B or permission of the program.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-2B02",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH SPANISH 3319B."
        }
      ],
      "catalog_description": "An overview of research on naturalistic and instructed second language acquisition (SLA). Various aspects of first language and second language learning/acquisition processes provide a framework for consideration of basic questions in SLA. Issues considered include situational factors influencing SLA, learner differences, and cognitive processes in learning a second/foreign language.\n\nAntirequisite(s): Spanish 3319A/B.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2247B",
      "subject": "LINGUIST",
      "className": "PHONOLOGICAL ANALYSIS",
      "course_info": [
        {
          "class_nbr": 5888,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): Anthropology 1027A/B or Linguistics 2288A/B.",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B08",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to the analysis of sound systems of languages. Includes discussion of the basic units of sound, their patterns of distribution and alternation. Topics to be covered are: articulatory phonetics, acoustic phonetics, distinctive feature theory, the writing of rules to describe phonological patterns. The generative framework will be emphasized.\n\nAntirequisite(s): The former Anthropology 2247A/B.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2248A",
      "subject": "LINGUIST",
      "className": "SYNTACTIC ANALYSIS",
      "course_info": [
        {
          "class_nbr": 5889,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): Anthropology 1027A/B or Linguistics 2288A/B.",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B08",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to contemporary generative syntax: lexical categories, morphology in relation to syntax, constituency, dependency, grammatical relations, argument structure. The primary language discussed will be English but examples will be drawn from other languages where appropriate.\n\nAntirequisite(s): The former Anthropology 2248A/B.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "3390A",
      "subject": "LINGUIST",
      "className": "SUPRVSD RDG/RESERCH LINGUISTCS",
      "course_info": [
        {
          "class_nbr": 2429,
          "start_time": "",
          "descrlong": "Prerequisite(s): An application (available from the Program) must be completed with the approval of the instructor and the program.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "READING COURSE. MUST HAVE INSTRUCTOR AND CHAIR APPROVAL - APPLICATION AVAILABLE IN THE DEPARTMENT OF FRENCH STUDIES."
        }
      ],
      "catalog_description": "Individual reading and research of current interest in Linguistics.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3390B",
      "subject": "LINGUIST",
      "className": "SUPRVSD RDG/RESERCH LINGUISTCS",
      "course_info": [
        {
          "class_nbr": 3304,
          "start_time": "",
          "descrlong": "Prerequisite(s): An application (available from the Program) must be completed with the approval of the instructor and the program.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "READING COURSE. MUST HAVE INSTRUCTOR AND CHAIR APPROVAL - APPLICATION AVAILABLE IN THE DEPARTMENT OF FRENCH STUDIES."
        }
      ],
      "catalog_description": "Individual reading and research of current interest in Linguistics.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4247B",
      "subject": "LINGUIST",
      "className": "ADV PHONOLOGICAL ANALYSIS",
      "course_info": [
        {
          "class_nbr": 5890,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Permission of the program.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-2120",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Explores advanced topics in different areas of phonological theory.\n\nExtra Information: 3 seminar hours."
    },
    {
      "catalog_nbr": "4248A",
      "subject": "LINGUIST",
      "className": "ADV SYNTACTIC ANALYSIS",
      "course_info": [
        {
          "class_nbr": 5891,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Permission of the program.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-2120",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Explores advanced topics in different areas of syntactic theory.\n\nExtra Information: 3 seminar hours."
    },
    {
      "catalog_nbr": "4490F",
      "subject": "LINGUIST",
      "className": "ADV SUPRVSD RDG/RSRCH LINGSTCS",
      "course_info": [
        {
          "class_nbr": 3169,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "READING COURSE. MUST HAVE INSTRUCTOR AND CHAIR APPROVAL - APPLICATION AVAILABLE IN THE DEPARTMENT OF FRENCH STUDIES."
        }
      ],
      "catalog_description": "Individual reading and research of current interest in Linguistics. An application (available from the Program) must be completed with the approval of the instructor and the program.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4490G",
      "subject": "LINGUIST",
      "className": "ADV SUPRVSD RDG/RSRCH LINGSTCS",
      "course_info": [
        {
          "class_nbr": 3117,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "READING COURSE. MUST HAVE INSTRUCTOR AND CHAIR APPROVAL - APPLICATION AVAILABLE IN THE DEPARTMENT OF FRENCH STUDIES,"
        }
      ],
      "catalog_description": "Individual reading and research of current interest in Linguistics. An application (available from the Program) must be completed with the approval of the instructor and the program.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "5204A",
      "subject": "LITURGIC",
      "className": "LITURGICAL THEOLOGY",
      "course_info": [
        {
          "class_nbr": 8207,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5305B",
      "subject": "LITURGIC",
      "className": "DAILY PRAYER",
      "course_info": [
        {
          "class_nbr": 9458,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisites: Liturgics 5204A/B",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W4",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "1021A",
      "subject": "MOS",
      "className": "INTRO TO CONSUMER BEHAV & HR",
      "course_info": [
        {
          "class_nbr": 2861,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS on Main Campus or Music Administrative Studies (MAS)",
          "end_time": "7:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO BMOS ON MAIN CAMPUS. OPEN JULY 19 TO ALL YEAR 1 STUDENTS ON MAIN CAMPUS. OPEN AUG 21 TO STUDENTS WHO HAVE COMPLETED 3.0 OR MORE COURSES. MOS 1021A/B AND 1023A/B MAY BE TAKEN IN ANY ORDER OR TOGETHER. ONE IS NOT PREREQUISITE TO THE OTHER."
        }
      ],
      "catalog_description": "This course introduces students to the study of management and organizations based on best available evidence. Topics covered may include consumer behavior, human resource management, business processes, intercultural relations, and multinational corporations in a globalized economy.These topics are fundamental to understanding managing people, consumer choice, and global commerce.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1021B",
      "subject": "MOS",
      "className": "INTRO TO CONSUMER BEHAV & HR",
      "course_info": [
        {
          "class_nbr": 2862,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS on Main Campus or Music Administrative Studies (MAS)",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO BMOS ON MAIN CAMPUS. OPEN JULY 19 TO ALL YEAR 1 STUDENTS ON MAIN CAMPUS. OPEN AUG 21 TO STUDENTS WHO HAVE COMPLETED 3.0 OR MORE COURSES. MOS 1021A/B AND 1023A/B MAY BE TAKEN IN ANY ORDER OR TOGETHER. ONE IS NOT PREREQUISITE TO THE OTHER."
        }
      ],
      "catalog_description": "This course introduces students to the study of management and organizations based on best available evidence. Topics covered may include consumer behavior, human resource management, business processes, intercultural relations, and multinational corporations in a globalized economy.These topics are fundamental to understanding managing people, consumer choice, and global commerce.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1022G",
      "subject": "MOS",
      "className": "INTRODUCTION TO AVIATION",
      "course_info": [
        {
          "class_nbr": 10022,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Enrolment in the Commercial Aviation module of BMOS.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-67",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO BMOS COMMERCIAL AVIATION MANAGEMENT, AND GEOGRAPHY AND COMMERCIAL AVIATION MANAGEMENT STUDENTS."
        }
      ],
      "catalog_description": "This course is designed as a survey of Commercial Aviation. Topics include: History of Aviation Transportation, Flight Theory and Performance, Aviation Business, Human Factors, Canadian Airspace, Air Traffic Control, and Aviation Safety. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1023A",
      "subject": "MOS",
      "className": "INTRO TO ACCOUNTING & FINANCE",
      "course_info": [
        {
          "class_nbr": 2863,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS on Main Campus or Music Administrative Studies (MAS)",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "NS-145",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO BMOS ON MAIN CAMPUS. OPEN JULY 19 TO ALL YEAR 1 STUDENTS ON MAIN CAMPUS. OPEN AUG 21 TO STUDENTS WHO HAVE COMPLETED 3.0 OR MORE COURSES. MOS 1021A/B AND 1023A/B MAY BE TAKEN IN ANY ORDER OR TOGETHER. ONE IS NOT PREREQUISITE TO THE OTHER."
        }
      ],
      "catalog_description": "This course provides students with a basic introduction to the fields of accounting and corporate finance. The accounting unit introduces students to basic accounting concepts from financial and managerial accounting. The corporate finance unit explains how financial markets work and how corporate managers use these markets to create and sustain corporate value.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1023B",
      "subject": "MOS",
      "className": "INTRO TO ACCOUNTING & FINANCE",
      "course_info": [
        {
          "class_nbr": 2864,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS on Main Campus or Music Administrative Studies (MAS)",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO BMOS ON MAIN CAMPUS. OPEN JULY 19 TO ALL YEAR 1 STUDENTS ON MAIN CAMPUS. OPEN AUG 21 TO STUDENTS WHO HAVE COMPLETED 3.0 OR MORE COURSES. MOS 1021A/B AND 1023A/B MAY BE TAKEN IN ANY ORDER OR TOGETHER. ONE IS NOT PREREQUISITE TO THE OTHER."
        }
      ],
      "catalog_description": "This course provides students with a basic introduction to the fields of accounting and corporate finance. The accounting unit introduces students to basic accounting concepts from financial and managerial accounting. The corporate finance unit explains how financial markets work and how corporate managers use these markets to create and sustain corporate value.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1025B",
      "subject": "MOS",
      "className": "NONPROFIT ORG & THEIR ENVIRON",
      "course_info": [
        {
          "class_nbr": 7790,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "facility_ID": "BR-304",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "This course will introduce students to nonprofit organizations and the nature of the political, social, economic, regulatory, and cultural context in which they operate. Topics will include governance and organizational structure, resource acquisition, public and government relations, volunteer management, partnerships and accountability. The course will prepare students for the unique strategic challenges in leading nonprofit organizations. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1033A",
      "subject": "MOS",
      "className": "INFO TECH IN COMMERCIAL ENVRMT",
      "course_info": [
        {
          "class_nbr": 8798,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-LH105A",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO YR 1 MOS STUDENTS REGISTERED AT KING’S. OPEN JULY 19 TO STUDENTS REGISTERED AT KING’S."
        }
      ],
      "catalog_description": "This course covers the skills and information used by business managers to become literate in the Information Technology environment without becoming an expert. Students will understand what current options and issues exist in I.T., the terminology, project management and will develop specific software skills useful to an efficient manager. \n\nAntirequisite(s): Computer Science 1032A/B, and all Computer Science courses numbered 2200 or higher.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1033B",
      "subject": "MOS",
      "className": "INFO TECH IN COMMERCIAL ENVRMT",
      "course_info": [
        {
          "class_nbr": 9243,
          "start_time": "6:30 PM",
          "descrlong": "",
          "end_time": "9:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-LH105A",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO YR 1 MOS STUDENTS REGISTERED AT KING’S. OPEN JULY 19 TO STUDENTS REGISTERED AT KING’S."
        }
      ],
      "catalog_description": "This course covers the skills and information used by business managers to become literate in the Information Technology environment without becoming an expert. Students will understand what current options and issues exist in I.T., the terminology, project management and will develop specific software skills useful to an efficient manager. \n\nAntirequisite(s): Computer Science 1032A/B, and all Computer Science courses numbered 2200 or higher.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2155A",
      "subject": "MOS",
      "className": "ORGANIZNAL HUMAN RLTNS",
      "course_info": [
        {
          "class_nbr": 8297,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS.",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V210",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO BMOS STUDENTS REGISTERED AT HURON. OPEN JULY 19 TO BMOS STUDENTS."
        }
      ],
      "catalog_description": "An examination of the theories and applications of managing human relations and the dynamics of interaction within organizations. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2155B",
      "subject": "MOS",
      "className": "ORGANIZNAL HUMAN RLTNS",
      "course_info": [
        {
          "class_nbr": 8125,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS.",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V214",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO BMOS STUDENTS REGISTERED AT HURON. OPEN JULY 19 TO BMOS STUDENTS."
        }
      ],
      "catalog_description": "An examination of the theories and applications of managing human relations and the dynamics of interaction within organizations. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2181A",
      "subject": "MOS",
      "className": "ORGANIZATIONAL BEHAVIOR",
      "course_info": [
        {
          "class_nbr": 3249,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS or Music Administrative Studies (MAS).",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2036",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "A multidisciplinary approach to the study of human behavior in organizations from the individual, group and organizational levels of explanation. \n\nAntirequisite(s) at Main campus: MOS 2180.\n\nAntirequisite(s) at Brescia, Huron, King's campus: MOS 2180, and King's MOS 2190A/B Special Topics, 2010-11 ONLY.\n\nExtra Information: 3 lecture hours"
    },
    {
      "catalog_nbr": "2181B",
      "subject": "MOS",
      "className": "ORGANIZATIONAL BEHAVIOR",
      "course_info": [
        {
          "class_nbr": 3251,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS or Music Administrative Studies (MAS).",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2036",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "A multidisciplinary approach to the study of human behavior in organizations from the individual, group and organizational levels of explanation. \n\nAntirequisite(s) at Main campus: MOS 2180.\n\nAntirequisite(s) at Brescia, Huron, King's campus: MOS 2180, and King's MOS 2190A/B Special Topics, 2010-11 ONLY.\n\nExtra Information: 3 lecture hours"
    },
    {
      "catalog_nbr": "2198A",
      "subject": "MOS",
      "className": "SELECTED TOPICS IN MOS",
      "course_info": [
        {
          "class_nbr": 11114,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-204",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN THE DIPLOMA IN MANAGEMENT STUDIES."
        }
      ],
      "catalog_description": "Examination of selected topics in Management and Organizational Studies. Topic and course outline available at the beginning of each term. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2198B",
      "subject": "MOS",
      "className": "SELECTED TOPICS IN MOS",
      "course_info": [
        {
          "class_nbr": 10977,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS.",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V214",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "TOPIC: INTRODUCTION TO DATA MANAGEMENT."
        }
      ],
      "catalog_description": "Examination of selected topics in Management and Organizational Studies. Topic and course outline available at the beginning of each term. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2199Y",
      "subject": "MOS",
      "className": "PROF PILOT ACADEMIC INTERN I",
      "course_info": [
        {
          "class_nbr": 2697,
          "start_time": "7:00 PM",
          "descrlong": "Prerequisite(s): Restricted to students registered in 2nd year of the Flight Training option of the Commercial Aviation Management module of BMOS or Geography and Commercial Aviation Management module.",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "PAB-117",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO BMOS COMMERCIAL AVIATION MANAGEMENT, AND GEOGRAPHY AND COMMERCIAL AVIATION MANAGEMENT STUDENTS."
        }
      ],
      "catalog_description": "In this academic internship, students explore the principles of aviation, including air law, navigation, radio aids, meteorology, and general knowledge about aeronautics. This \"ground school\" is a co-requisite to flight training toward the private pilot's license.\r\n\r\nExtra Information: 3 lecture hours"
    },
    {
      "catalog_nbr": "2205G",
      "subject": "MOS",
      "className": "BUSINESS COMMUNICATIONS",
      "course_info": [
        {
          "class_nbr": 9778,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS, the Diploma in Management Studies, Leadership Studies, or with permission of the instructor.",
          "end_time": "4:00 PM",
          "facility_ID": "BR-2013",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO BMOS STUDENTS REGISTERED AT BRESCIA. OPEN JULY 19 TO BMOS STUDENTS REGSITERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "An examination of the written, oral and visual aspects of business communication. Topics include genres of workplace writing; positive, negative and persuasive messages; oral communication; and employment seeking communications.\n\nAntirequisite(s): Business Administration 3302K (Year Three required course in HBA), Human Ecology 2266F/G, Writing 1031F/G, Writing 2111F/G.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2220F",
      "subject": "MOS",
      "className": "CROSS-CULT COMMERCL RELTNSHPS",
      "course_info": [
        {
          "class_nbr": 8567,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Business Administration 1220E plus one of Sociology 1020, Sociology 1021E, Management and Organizational Studies 2181A/B, Management and Organizational Studies 2155A/B, Management and Organizational Studies 2280F/G, Psychology 1000, Psychology 2060, Psychology 2660A/B, the former Sociology 2169 or permission of the Department.",
          "end_time": "9:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-KC006",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO MOS STUDENTS AT KING'S. OPEN JULY 19 TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "An introduction to intercultural relations for future managers and trade negotiators in a global work environment. Participants will learn the differences in thinking, communicating and behaving in different cultures, particularly as related to commercial enterprise. The course offers opportunities for students to develop their communication skills in cross-cultural situations. \n\nExtra Information: 3 seminar hours."
    },
    {
      "catalog_nbr": "2220G",
      "subject": "MOS",
      "className": "CROSS-CULT COMMERCL RELTNSHPS",
      "course_info": [
        {
          "class_nbr": 8661,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Business Administration 1220E plus one of Sociology 1020, Sociology 1021E, Management and Organizational Studies 2181A/B, Management and Organizational Studies 2155A/B, Management and Organizational Studies 2280F/G, Psychology 1000, Psychology 2060, Psychology 2660A/B, the former Sociology 2169 or permission of the Department.",
          "end_time": "9:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-BH102",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO MOS STUDENTS AT KING'S. OPEN JULY 19 TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "An introduction to intercultural relations for future managers and trade negotiators in a global work environment. Participants will learn the differences in thinking, communicating and behaving in different cultures, particularly as related to commercial enterprise. The course offers opportunities for students to develop their communication skills in cross-cultural situations. \n\nExtra Information: 3 seminar hours."
    },
    {
      "catalog_nbr": "2227A",
      "subject": "MOS",
      "className": "INTRO TO FINANCIAL ACCOUNTING",
      "course_info": [
        {
          "class_nbr": 11035,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): 5.0 courses at University level, and enrollment in second year BMOS program.",
          "end_time": "10:00 AM",
          "facility_ID": "BR-UH27",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN THE DIPLOMA IN MANAGEMENT STUDIES."
        }
      ],
      "catalog_description": "This course is an integrated introduction to accounting principles and practices. It is designed to help students begin to understand accounting information, along with its uses and limitations. This course is to provide students with an integrated framework for preparing, analyzing and interpreting the financial statements.\n\nAntirequisite(s): Business Administration 2257.\n\nExtra Information: 3 lecture hours.\nNote: Students interested in pursuing an HBA Degree at the Richard Ivey School of Business should not take this course in second year as Ivey does not recognize this course as part of the HBA degree. Instead, students should take Business Administration 2257 as required by Ivey."
    },
    {
      "catalog_nbr": "2227B",
      "subject": "MOS",
      "className": "INTRO TO FINANCIAL ACCOUNTING",
      "course_info": [
        {
          "class_nbr": 10143,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): 5.0 courses at University level, and enrollment in second year BMOS program.",
          "end_time": "9:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-LH105A",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS IN SPECIALIZATION IN FINANCIAL ECONOMICS AT KING’S. MAIN CAMPUS STUDENTS REQUIRE HOME FACULTY PERMISSION."
        }
      ],
      "catalog_description": "This course is an integrated introduction to accounting principles and practices. It is designed to help students begin to understand accounting information, along with its uses and limitations. This course is to provide students with an integrated framework for preparing, analyzing and interpreting the financial statements.\n\nAntirequisite(s): Business Administration 2257.\n\nExtra Information: 3 lecture hours.\nNote: Students interested in pursuing an HBA Degree at the Richard Ivey School of Business should not take this course in second year as Ivey does not recognize this course as part of the HBA degree. Instead, students should take Business Administration 2257 as required by Ivey."
    },
    {
      "catalog_nbr": "2228A",
      "subject": "MOS",
      "className": "INTRO TO MANAGERIAL ACCOUNTING",
      "course_info": [
        {
          "class_nbr": 11036,
          "start_time": "10:00 AM",
          "descrlong": "Prerequisite(s): 5.0 courses at University level, and enrollment in second year BMOS program.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-UH27",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN THE DIPLOMA IN MANAGEMENT STUDIES."
        }
      ],
      "catalog_description": "Students will examine how accounting information is used within organizations to plan, monitor and control. The purpose of this course is to ensure students have a basic understanding of how such management accounting systems and controls operate, the language they use and their limitations.\n\nAntirequisite(s): Business Administration 2257.\n\nExtra Information: 3 lecture hours, 0.5 course.\nNote: Students interested in pursuing an HBA Degree at the Richard Ivey School of Business should not take this course in second year as Ivey does not recognize this course as part of the HBA degree. Instead, students should take Business Administration 2257 as required by Ivey."
    },
    {
      "catalog_nbr": "2228B",
      "subject": "MOS",
      "className": "INTRO TO MANAGERIAL ACCOUNTING",
      "course_info": [
        {
          "class_nbr": 9188,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): 5.0 courses at University level, and enrollment in second year BMOS program.",
          "end_time": "9:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-LH105C",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "MAIN CAMPUS STUDENTS REQUIRE HOME FACULTY PERMISSION."
        }
      ],
      "catalog_description": "Students will examine how accounting information is used within organizations to plan, monitor and control. The purpose of this course is to ensure students have a basic understanding of how such management accounting systems and controls operate, the language they use and their limitations.\n\nAntirequisite(s): Business Administration 2257.\n\nExtra Information: 3 lecture hours, 0.5 course.\nNote: Students interested in pursuing an HBA Degree at the Richard Ivey School of Business should not take this course in second year as Ivey does not recognize this course as part of the HBA degree. Instead, students should take Business Administration 2257 as required by Ivey."
    },
    {
      "catalog_nbr": "2242A",
      "subject": "MOS",
      "className": "STATISTICS",
      "course_info": [
        {
          "class_nbr": 3258,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): 1.0 course or equivalent from Calculus 1000A/B, Calculus 1301A/B, Calculus 1501A/B, Mathematics 1225A/B, Mathematics 1228A/B, Mathematics 1229A/B, Mathematics 1600A/B, and enrolment in BMOS.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B08",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "The purpose of this course is to introduce students to quantitative decision-making skills, with an emphasis on analysis techniques used in management. Topics include: descriptive statistics, probability, hypothesis testing, analysis of variance, correlation and regression, time series forecasting, and survey techniques.\n\nAntirequisite(s) at Main campus: Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Geography 2210A/B, Health Sciences 3801A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2143A/B, Statistical Sciences 2244A/B, Statistical Sciences 2858A/B.\n\nAntirequisite(s) at Brescia, Huron, King's campus: Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Geography 2210A/B, Health Sciences 3801A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2143A/B, Statistical Sciences 2244A/B, Statistical Sciences 2858A/B, Statistical Sciences 2037A/B if taken prior to Fall 2010, former Psychology 2885 (Brescia), former Statistical Sciences 2122A/B, former Social Work 2205.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2242B",
      "subject": "MOS",
      "className": "STATISTICS",
      "course_info": [
        {
          "class_nbr": 3361,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): 1.0 course or equivalent from Calculus 1000A/B, Calculus 1301A/B, Calculus 1501A/B, Mathematics 1225A/B, Mathematics 1228A/B, Mathematics 1229A/B, Mathematics 1600A/B, and enrolment in BMOS.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-100",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "The purpose of this course is to introduce students to quantitative decision-making skills, with an emphasis on analysis techniques used in management. Topics include: descriptive statistics, probability, hypothesis testing, analysis of variance, correlation and regression, time series forecasting, and survey techniques.\n\nAntirequisite(s) at Main campus: Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Geography 2210A/B, Health Sciences 3801A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2143A/B, Statistical Sciences 2244A/B, Statistical Sciences 2858A/B.\n\nAntirequisite(s) at Brescia, Huron, King's campus: Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Geography 2210A/B, Health Sciences 3801A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2143A/B, Statistical Sciences 2244A/B, Statistical Sciences 2858A/B, Statistical Sciences 2037A/B if taken prior to Fall 2010, former Psychology 2885 (Brescia), former Statistical Sciences 2122A/B, former Social Work 2205.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2255A",
      "subject": "MOS",
      "className": "ENTREPRENEURIAL THINKING",
      "course_info": [
        {
          "class_nbr": 8993,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Completion of 5.0 1000-level courses.",
          "end_time": "2:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-DL012",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO MOS STUDENTS AT KING'S. OPEN JULY 19 TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "This course provides a broad overview of the principles, theories, and praxis of entrepreneurship, together with an understanding of the key tasks, skills, and attitudes required. It focuses on the \"Effectuation\" logic that serves entrepreneurs in the processes of opportunity identification and new venture creation based on existing resources.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2275A",
      "subject": "MOS",
      "className": "BUSINESS LAW I",
      "course_info": [
        {
          "class_nbr": 1235,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Enrolment in BMOS or Honours Specialization in Urban Development or Technical Entrepreneurship Certificate (TEC).",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2028",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "An introduction to Canadian business law, including: tort law, contracts, property, employment, partnerships, corporations, debtor and creditor, bankruptcy and insolvency, sale of goods and consumer protection. Cases and current events are used to illustrate legal issues and to solve legal problems. \n\nAntirequisite(s): Business Administration 4450A/B, Law 5510A/B, Law 5210A/B. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": 1052,
      "subject": "MTP-MKTG",
      "className": "SPECIAL TOPICS",
      "course_info": [
        {
          "class_nbr": 3172,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "0105A",
      "subject": "MATH",
      "className": "PRECALCULUS MATHEMATICS",
      "course_info": [
        {
          "class_nbr": 7729,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): One or more of Ontario Secondary School MCF3M, MCR3U, or equivalent.",
          "end_time": "2:30 PM",
          "facility_ID": "BR-203",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS IN PRELIMINIARY YEAR."
        }
      ],
      "catalog_description": "Set theory, algebra, functions and relations, trigonometry, logarithms and exponents. \n\nAntirequisite(s): Ontario Secondary School MCV4U, any university level calculus course.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "0109A",
      "subject": "MATH",
      "className": "PREPARATORY MATHEMATICS",
      "course_info": [
        {
          "class_nbr": 10265,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Ontario Secondary School MCF3M, MCR3U, or equivalent.",
          "end_time": "12:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-LH103",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED AT KING’S. OPEN JULY 19 TO STUDENTS REGISTERED AT THE AFFILIATED UNIVERSITY COLLEGES."
        }
      ],
      "catalog_description": "Review of mathematical operations and linear equations; introduction to functions; introductory finite mathematics, including combinatorics and probability; introductory financial mathematics, including compound interest and annuities.\n\nAntirequisites: Ontario Secondary School MCV4U, Mathematics 0105A/B, or any university-level calculus course.\n\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "0110A",
      "subject": "MATH",
      "className": "INTRODUCTORY CALCULUS",
      "course_info": [
        {
          "class_nbr": 1415,
          "start_time": "7:00 PM",
          "descrlong": "Prerequisite(s): One or more of Ontario Secondary School MCF3M, MCR3U, or equivalent.",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "B&GS-0165",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Introduction to differential calculus including limits, continuity, definition of derivative, rules for differentiation, implicit differentiation, velocity, acceleration, related rates, maxima and minima, exponential functions, logarithmic functions, differentiation of exponential and logarithmic functions, curve sketching.\n\nAntirequisite(s): Mathematics 1225A/B, Calculus 1000A/B, Calculus 1500A/B, Applied Mathematics 1413.\n\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "0110B",
      "subject": "MATH",
      "className": "INTRODUCTORY CALCULUS",
      "course_info": [
        {
          "class_nbr": 7719,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): One or more of Ontario Secondary School MHF4U, MCR3U, Mathematics 0105A/B, Mathematics 0109A/B, or equivalent",
          "end_time": "2:30 PM",
          "facility_ID": "BR-203",
          "days": [
            "M",
            "Tu",
            "W",
            "Th"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "Introduction to differential calculus including limits, continuity, definition of derivative, rules for differentiation, implicit differentiation, velocity, acceleration, related rates, maxima and minima, exponential functions, logarithmic functions, differentiation of exponential and logarithmic functions, curve sketching.\n\nAntirequisite(s): Mathematics 1225A/B, Calculus 1000A/B, Calculus 1500A/B, Applied Mathematics 1413.\n\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "1120B",
      "subject": "MATH",
      "className": "FUNDAMENTAL CONCEPTS IN MATH",
      "course_info": [
        {
          "class_nbr": 1884,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): One or more of Ontario Secondary School MCV4U, Mathematics 1600A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "NS-7",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "INTENDED FOR STUDENTS PLANNING TO REGISTER FOR ADVANCED MATHEMATICS COURSES."
        }
      ],
      "catalog_description": "Primarily for students interested in pursuing a degree in one of the mathematical sciences. Logic, set theory, relations, functions and operations, careful study of the integers, discussion of the real and complex numbers, polynomials, and infinite sets. \n \nAntirequisite(s): Mathematics 2155F/G, or the former Mathematics 2155A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1225B",
      "subject": "MATH",
      "className": "METHODS OF CALCULUS",
      "course_info": [
        {
          "class_nbr": 2359,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Ontario Secondary School MCV4U or Mathematics 0110A/B.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "MC-110",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Elementary techniques of integration; applications of Calculus such as area, volume, and differential equations; functions of several variables, Lagrange multipliers. This course is intended primarily for students in the Social Sciences, but may meet minimum requirements for some Science modules. It may not be used as a prerequisite for any Calculus course numbered 1300 or above.\n \nAntirequisite(s) at Main campus: Applied Mathematics 1201A/B, Applied Mathematics 1413, Calculus 1301A/B, Calculus 1501A/B, Mathematics 1230A/B. If Calculus 1000A/B or Calculus 1500A/B was completed after September 1, 2016 it is an antirequisite, but not if it was completed before that time.\n\nAntirequisite(s) at Brescia, Huron, King's campus: Applied Mathematics 1201A/B, Applied Mathematics 1413, Calculus 1301A/B, Calculus 1501A/B, Mathematics 1230A/B, Calculus 1000A/B or Calculus 1500A/B taken after September 1, 2016.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1228A",
      "subject": "MATH",
      "className": "METHODS OF FINITE MATHEMATICS",
      "course_info": [
        {
          "class_nbr": 2807,
          "start_time": "7:00 PM",
          "descrlong": "Prerequisite(s): One or more of Ontario Secondary School MCV4U, MHF4U, MDM4U, Mathematics 0110A/B, Mathematics 1225A/B, Mathematics 1229A/B.",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Permutations and combinations; probability theory. This course is intended primarily for students in the Social Sciences, but may meet minimum requirements for some Science modules.\n\nAntirequisite(s): Mathematics 2124A/B, Mathematics 2155F/G, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2857A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1228B",
      "subject": "MATH",
      "className": "METHODS OF FINITE MATHEMATICS",
      "course_info": [
        {
          "class_nbr": 1416,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): One or more of Ontario Secondary School MCV4U, MHF4U, MDM4U, Mathematics 0110A/B, Mathematics 1225A/B, Mathematics 1229A/B.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Permutations and combinations; probability theory. This course is intended primarily for students in the Social Sciences, but may meet minimum requirements for some Science modules.\n\nAntirequisite(s): Mathematics 2124A/B, Mathematics 2155F/G, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2857A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1229A",
      "subject": "MATH",
      "className": "METHODS OF MATRIX ALGEBRA",
      "course_info": [
        {
          "class_nbr": 2355,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): One or more of Ontario Secondary School MCF3M, MCR3U, or equivalent.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YR 1 STUDENTS. OPEN AUG 21 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "Matrix algebra including vectors and matrices, linear equations, determinants. This course is intended primarily for students in the Social Sciences, but may meet minimum requirements for some Science modules.\n \nAntirequisite(s): Applied Mathematics 1411A/B, Applied Mathematics 2811B, Mathematics 1600A/B, Mathematics 2120A/B, Mathematics 2155F/G, Mathematics 2211A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1229B",
      "subject": "MATH",
      "className": "METHODS OF MATRIX ALGEBRA",
      "course_info": [
        {
          "class_nbr": 7681,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): One or more of Ontario Secondary School MCF3M, MCR3U, Mathematics 0109A/B, or equivalent.",
          "end_time": "12:30 PM",
          "facility_ID": "BR-203",
          "days": [
            "M",
            "Tu",
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "Matrix algebra including vectors and matrices, linear equations, determinants. This course is intended primarily for students in the Social Sciences, but may meet minimum requirements for some Science modules.\n \nAntirequisite(s): Applied Mathematics 1411A/B, Applied Mathematics 2811B, Mathematics 1600A/B, Mathematics 2120A/B, Mathematics 2155F/G, Mathematics 2211A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2200S",
      "subject": "MME",
      "className": "ENGINEERING SHOP SAFETY TRN",
      "course_info": [
        {
          "class_nbr": 9255,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Entry into Year 2 of the Mechanical Engineering program.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2100",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO MECHANICAL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "This course will provide mechanical engineering undergraduate students with consistent and appropriate training in the safe use of Engineering student shops.\n\nAntirequisite(s): MSE 2200Q/R/S/T.\n\nExtra Information: Non-credit course."
    },
    {
      "catalog_nbr": "2202A",
      "subject": "MME",
      "className": "MECHANICS OF MATERIALS",
      "course_info": [
        {
          "class_nbr": 1721,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Engineering Science 1022A/B/Y, Applied Mathematics 1413.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SEB-2202",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO MECHANICAL ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Stress and strain, Mohr's stress circle, behaviour of structures, axial loading of columns and struts, torsion of shafts, bending of beams, buckling of columns and combined loading of components.\n \nAntirequisite(s): CEE 2202A/B, MSE 2212A/B. \n\nExtra Information: 3 lecture hours, 2 tutorial hours, 0.5 laboratory hour"
    },
    {
      "catalog_nbr": "2204A",
      "subject": "MME",
      "className": "THERMODYNAMICS I",
      "course_info": [
        {
          "class_nbr": 2447,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1413.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "HSB-35",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO MECHANICAL OR INTEGRATED ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Properties of a pure substance, first law of thermodynamics, processes in open and closed systems, second law of thermodynamics; ideal gases, compressors and energy conversion systems. \n \nAntirequisite(s): CBE 2214A/B, MSE 2214A/B. \n\nExtra Information: 3 lecture hours, 2 tutorial hours, 0.5 laboratory hour"
    },
    {
      "catalog_nbr": "2213B",
      "subject": "MME",
      "className": "ENGINEERING DYNAMICS",
      "course_info": [
        {
          "class_nbr": 1722,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Engineering Science 1022A/B/Y.\nPre-or Corequisite(s): Applied Mathematics 2270A/B.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2100",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO MECHANICAL OR YR 3 INTEGRATED OR YR 2 & 3 INTEGRATED/HBA ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Topics include: rectilinear, angular and curvilinear motion; kinetics of a particle, a translating rigid body and a rigid body in pure rotation; definitions of different energies and energy balance: power and efficiency; and linear impulse and momentum. \n\nAntirequisite(s): MSE 2213A/B.\n\nExtra Information: 3 lecture hours, 2 tutorial hours"
    },
    {
      "catalog_nbr": "2221B",
      "subject": "MME",
      "className": "COMPUTATIONAL METHODS",
      "course_info": [
        {
          "class_nbr": 10270,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): ES 1036A/B, Applied Mathematics 1411A/B, Applied Mathematics 1413.\n\nCorequisite(s): Applied Mathematics 2270A/B or Applied Mathematics 2276A/B.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1450",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "The objective of this course is to introduce data organization and processing techniques using spreadsheet tools; and numerical methods, model formulation and programming using advanced mathematical software tools. Applications in applied mathematics and mechanical engineering will be considered throughout the course.\n\nAntirequisite(s): CEE 2219A/B, CBE 2291A/B.\n\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "2200Q",
      "subject": "MSE",
      "className": "ENGINEERING SHOP SAFETY TR",
      "course_info": [
        {
          "class_nbr": 5105,
          "start_time": "3:30 PM",
          "descrlong": "Pre-or Corequisite(s): MSE 2201A/B.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1400",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO MECHATRONIC SYSTEMS ENGINEERING STUDENTS. ALSO HELD IN ACEB 2415 AND 1410.."
        }
      ],
      "catalog_description": "This course will provide mechatronic system engineering undergraduate students with uniform training in the safe use of Engineering student shops.\n\nAntirequisite(s): MME 2200Q/R/S/T.\n\nExtra Information: Non-credit course."
    },
    {
      "catalog_nbr": "2201A",
      "subject": "MSE",
      "className": "INTRO TO ELECTRICAL INSTRUMENT",
      "course_info": [
        {
          "class_nbr": 3223,
          "start_time": "2:30 PM",
          "descrlong": "Corequisite(s): ECE 2205A/B.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1415",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO MECHATRONIC SYSTEMS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Introduction to instrumentation and basic electronics; Laboratory experiments associated with ECE 2205A/B, as well as laboratory experiments in instrumentation and measurement; review of laboratory practice, health and safety issues, simulation software, data collecting methods; errors and their calculus; accuracy; averaging, signal conditioning, and data interpolation.\r\n \r\nAntirequisite(s): ECE 2240A/B.\r\n\r\nExtra Information: 2 lecture hours, 2 laboratory hours. \r\nRestricted to students enrolled in the Mechatronic Systems Engineering program."
    },
    {
      "catalog_nbr": "2202B",
      "subject": "MSE",
      "className": "INTRO TO MECHATRONIC DESIGN",
      "course_info": [
        {
          "class_nbr": 3228,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Engineering Science 1021A/B, Engineering Science 1022A/B/Y, Engineering Science 1050",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "SH-3315",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO MECHATRONIC SYSTEMS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Introduces engineering design and structured design methods from the perspective of mechatronic systems that integrate mechanical, electrical and control technologies. Topics include the mechatronic design process, simple sensors and actuators, heat management, electronic communications and microcontroller-based software design.\r\n\r\nExtra Information: 3 lecture hours, 3 laboratory/tutorial hours.\r\nRestricted to students enrolled in the Mechatronic Systems Engineering program."
    },
    {
      "catalog_nbr": "2212A",
      "subject": "MSE",
      "className": "MECHANICS OF MATERIALS",
      "course_info": [
        {
          "class_nbr": 5116,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Engineering Science 1022A/B/Y, Applied Mathematics 1413.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1410",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO MECHATRONIC SYSTEMS ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Stress and strain, Mohr's stress circle, behaviour of structures, axial loading of columns and struts, torsion of shafts, bending of beams, buckling of columns and combined loading of components.\n\nAntirequisite(s): CEE 2202A/B, MME 2202A/B.\n\nExtra Information: 3 lecture hours, 2 tutorial hours, 0.5 laboratory hour."
    },
    {
      "catalog_nbr": "2213B",
      "subject": "MSE",
      "className": "ENGINEERING DYNAMICS",
      "course_info": [
        {
          "class_nbr": 5125,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Engineering Science 1022A/B/Y.\nPre-or Corequisite(s): Applied Mathematics 2270A/B.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SEB-2100",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO MECHATRONIC SYSTEMS AND INTEGRATED ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Topics include: rectilinear, angular and curvilinear motion; kinetics of a particle, a translating rigid body and a rigid body in pure rotation; definitions of different energies and energy balance: power and efficiency; and linear impulse and momentum.\n\nAntirequisite(s): MME 2213A/B.\n\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "2214A",
      "subject": "MSE",
      "className": "THERMODYNAMICS",
      "course_info": [
        {
          "class_nbr": 5127,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1413.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "ACEB-1410",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO MECHATRONIC SYSTEMS AND INTEGRATED ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Properties of a pure substance, first law of thermodynamics, processes in open and closed systems, second law of thermodynamics; ideal gases, compressors and energy conversion systems.\n\nAntirequisite(s): CBE 2214A/B, MME 2204A/B.\n\nExtra Information: 3 lecture hours, 2 tutorial hours, 0.5 laboratory hour."
    },
    {
      "catalog_nbr": "2233B",
      "subject": "MSE",
      "className": "CIRCUITS AND SYSTEMS",
      "course_info": [
        {
          "class_nbr": 3225,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 2270A/B, ECE 2205A/B.\nPre-or Corequisite(s): Applied Mathematics 2276A/B or the former Applied Mathematics 2415.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1450",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO MECHATRONIC SYSTEMS AND COMPUTER OPTION B ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Introduction to a system level analysis of electrical circuits. The S-Plane and frequency response of circuits, frequency selective circuits, state variables, introduction to Fourier analysis, Fourier transform and Laplace transform techniques. Transfer functions and system functions.\n \nAntirequisite(s): ECE 2233A/B. \n\nExtra Information: 3 lecture hours, 2 tutorial hours, 1 laboratory hour.\n\nRestricted to students enrolled in the Mechatronic Systems Engineering program or in Computer Engineering Option B."
    },
    {
      "catalog_nbr": "1020E",
      "subject": "MIT",
      "className": "INTRO TO MIT",
      "course_info": [
        {
          "class_nbr": 4535,
          "start_time": "4:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YR 1 STUDENTS. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "This survey course introduces students to the critical study of mediated communication and explores the ways technology, information, and media interact with culture and society. Topics may include: cultural industries, political economy, identity/diversity, promotional culture, the information society, political communication, journalism studies, and social media.\n\nAntirequisite(s): MIT 1021F/G and/or MIT 1022F/G, the former MIT 1200F/G, MIT 1500F/G and/or MIT 1700F/G.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1025F",
      "subject": "MIT",
      "className": "FIRST YR FOUNDATIONS",
      "course_info": [
        {
          "class_nbr": 4562,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YR 1 FIMS. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "This writing-intensive course provides first-year FIMS students with foundational skills in scholarly research, appropriate evaluation of information sources, and textual, visual, and media analysis. In a combination of lectures and tutorials, students will produce short projects that reflect a number of modes of interpretation and analyze a variety of media.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1050A",
      "subject": "MIT",
      "className": "NAVIGATING OUR MEDIA LANDSCAPE",
      "course_info": [
        {
          "class_nbr": 4551,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-240",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YRS 1 & 2 STUDENTS. OPEN JULY 19 TO ALL YRS 3 & 4 NON-FIMS MODULE STUDENTS."
        }
      ],
      "catalog_description": "Media permeate every nook and cranny of our daily lives. This course examines how we use media to shape our world through social networking, advertising and branding, activism and politics, privacy and surveillance, celebrity and entertainment culture, sounds and music, representation and identity, and global news and media. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1050B",
      "subject": "MIT",
      "className": "NAVIGATING OUR MEDIA LANDSCAPE",
      "course_info": [
        {
          "class_nbr": 5471,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE. PRIORITY TO YRS 1 & 2 STUDENTS. OPEN JULY 19 TO ALL YRS 3 & 4 NON-FIMS MODULE STUDENTS."
        }
      ],
      "catalog_description": "Media permeate every nook and cranny of our daily lives. This course examines how we use media to shape our world through social networking, advertising and branding, activism and politics, privacy and surveillance, celebrity and entertainment culture, sounds and music, representation and identity, and global news and media. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1070A",
      "subject": "MIT",
      "className": "MEDIA PRODUCTION FOUNDATIONS",
      "course_info": [
        {
          "class_nbr": 6931,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "FNB-1240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YR 1 FIMS STUDENTS. OPEN JULY 19 TO ALL YR 1 STUDENTS."
        }
      ],
      "catalog_description": "This course introduces students to the technical and creative production of mediated communication. They will learn basic production principles and use these to analyze and create audio, visual and digital content related to and derived from mass communication through a variety of in-class exercises and creative projects.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1070B",
      "subject": "MIT",
      "className": "MEDIA PRODUCTION FOUNDATIONS",
      "course_info": [
        {
          "class_nbr": 6932,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "FNB-1240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO YR 1 FIMS STUDENTS. OPEN JULY 19 TO ALL YR 1 STUDENTS."
        }
      ],
      "catalog_description": "This course introduces students to the technical and creative production of mediated communication. They will learn basic production principles and use these to analyze and create audio, visual and digital content related to and derived from mass communication through a variety of in-class exercises and creative projects.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2000F",
      "subject": "MIT",
      "className": "THE HISTORY OF COMMUNICATION",
      "course_info": [
        {
          "class_nbr": 4552,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO YR 2 FIMS STUDENTS. NOT OPEN TO MIT MINOR MODULE."
        }
      ],
      "catalog_description": "The course examines communication throughout history. It explores the relationship of communication media and technologies to society and culture. The course covers the history of different communication media, such as the printing press, telegraph, radio and television broadcasting, film and sound recording, and the Internet. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2025B",
      "subject": "MIT",
      "className": "RESEARCH METHODS FOR DIGI AGE",
      "course_info": [
        {
          "class_nbr": 10459,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 2 FIMS STUDENTS. NOT OPEN TO MIT MINOR MODULE."
        }
      ],
      "catalog_description": "This course will introduce students to a variety of methods for collecting, analysing, and interpreting data for research in media studies. Students will explore tools and techniques that support inquiry into problems and questions of a digital era. Approaches will include content analysis, big data, interviews, ethnography, and decolonizing methods.\n\nAntirequisite(s): MIT 3000A/B.\n\nExtra Information: 2 lecture hours and 1 tutorial hour."
    },
    {
      "catalog_nbr": "1020E",
      "subject": "MIT",
      "className": "INTRO TO MIT",
      "course_info": [
        {
          "class_nbr": 4535,
          "start_time": "4:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-101",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YR 1 STUDENTS. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "This survey course introduces students to the critical study of mediated communication and explores the ways technology, information, and media interact with culture and society. Topics may include: cultural industries, political economy, identity/diversity, promotional culture, the information society, political communication, journalism studies, and social media.\n\nAntirequisite(s): MIT 1021F/G and/or MIT 1022F/G, the former MIT 1200F/G, MIT 1500F/G and/or MIT 1700F/G.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1025F",
      "subject": "MIT",
      "className": "FIRST YR FOUNDATIONS",
      "course_info": [
        {
          "class_nbr": 4562,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YR 1 FIMS. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "This writing-intensive course provides first-year FIMS students with foundational skills in scholarly research, appropriate evaluation of information sources, and textual, visual, and media analysis. In a combination of lectures and tutorials, students will produce short projects that reflect a number of modes of interpretation and analyze a variety of media.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1050A",
      "subject": "MIT",
      "className": "NAVIGATING OUR MEDIA LANDSCAPE",
      "course_info": [
        {
          "class_nbr": 4551,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-240",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YRS 1 & 2 STUDENTS. OPEN JULY 19 TO ALL YRS 3 & 4 NON-FIMS MODULE STUDENTS."
        }
      ],
      "catalog_description": "Media permeate every nook and cranny of our daily lives. This course examines how we use media to shape our world through social networking, advertising and branding, activism and politics, privacy and surveillance, celebrity and entertainment culture, sounds and music, representation and identity, and global news and media. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1050B",
      "subject": "MIT",
      "className": "NAVIGATING OUR MEDIA LANDSCAPE",
      "course_info": [
        {
          "class_nbr": 5471,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE. PRIORITY TO YRS 1 & 2 STUDENTS. OPEN JULY 19 TO ALL YRS 3 & 4 NON-FIMS MODULE STUDENTS."
        }
      ],
      "catalog_description": "Media permeate every nook and cranny of our daily lives. This course examines how we use media to shape our world through social networking, advertising and branding, activism and politics, privacy and surveillance, celebrity and entertainment culture, sounds and music, representation and identity, and global news and media. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1070A",
      "subject": "MIT",
      "className": "MEDIA PRODUCTION FOUNDATIONS",
      "course_info": [
        {
          "class_nbr": 6931,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "FNB-1240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO YR 1 FIMS STUDENTS. OPEN JULY 19 TO ALL YR 1 STUDENTS."
        }
      ],
      "catalog_description": "This course introduces students to the technical and creative production of mediated communication. They will learn basic production principles and use these to analyze and create audio, visual and digital content related to and derived from mass communication through a variety of in-class exercises and creative projects.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1070B",
      "subject": "MIT",
      "className": "MEDIA PRODUCTION FOUNDATIONS",
      "course_info": [
        {
          "class_nbr": 6932,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "FNB-1240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO YR 1 FIMS STUDENTS. OPEN JULY 19 TO ALL YR 1 STUDENTS."
        }
      ],
      "catalog_description": "This course introduces students to the technical and creative production of mediated communication. They will learn basic production principles and use these to analyze and create audio, visual and digital content related to and derived from mass communication through a variety of in-class exercises and creative projects.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2000F",
      "subject": "MIT",
      "className": "THE HISTORY OF COMMUNICATION",
      "course_info": [
        {
          "class_nbr": 4552,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "HSB-40",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO YR 2 FIMS STUDENTS. NOT OPEN TO MIT MINOR MODULE."
        }
      ],
      "catalog_description": "The course examines communication throughout history. It explores the relationship of communication media and technologies to society and culture. The course covers the history of different communication media, such as the printing press, telegraph, radio and television broadcasting, film and sound recording, and the Internet. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2025B",
      "subject": "MIT",
      "className": "RESEARCH METHODS FOR DIGI AGE",
      "course_info": [
        {
          "class_nbr": 10459,
          "start_time": "7:00 PM",
          "descrlong": "",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 2 FIMS STUDENTS. NOT OPEN TO MIT MINOR MODULE."
        }
      ],
      "catalog_description": "This course will introduce students to a variety of methods for collecting, analysing, and interpreting data for research in media studies. Students will explore tools and techniques that support inquiry into problems and questions of a digital era. Approaches will include content analysis, big data, interviews, ethnography, and decolonizing methods.\n\nAntirequisite(s): MIT 3000A/B.\n\nExtra Information: 2 lecture hours and 1 tutorial hour."
    },
    {
      "catalog_nbr": "4100F",
      "subject": "MEDHINFO",
      "className": "HEALTH INFORMATICS",
      "course_info": [
        {
          "class_nbr": 1053,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Enrolment in Year 4 of either one of the following Honours Specialization modules: Pathology, Medical Health Informatics, One Health or enrolment in Year 4 of Software Engineering (Health Informatics option) offered through the Department of Electrical and Computer Engineering, or permission of the course director.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "MSB-190",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 4 HONS SPECIALIZATIONS IN ONE HEALTH, PATHOLOGY, MEDICAL HEALTH INFORMATICS, AND YR 4 SOFTWARE ENGINEERING (HEALTH INFORMATICS OPTION)."
        }
      ],
      "catalog_description": "Fundamentals of Health Informatics including an overview of the health care system; computer systems; communications/ information theory; data types, standards, quality, uses and users; and HI applications. Uses of computers in health care with emphasis on various clinical support and clinical information systems and the electronic health record and its achievability.\n\nExtra Information: 2 lecture hours, 2 laboratory/tutorial hours."
    },
    {
      "catalog_nbr": "4110G",
      "subject": "MEDHINFO",
      "className": "HEALTH INFORMATION MANAGEMENT",
      "course_info": [
        {
          "class_nbr": 3510,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Medical Health Informatics 4100F or the former Pathology 4100F; and enrolment in Year 4 of either one of the following Honours Specialization modules: Pathology, Medical Health Informatics, One Health or enrolment in Year 4 of Software Engineering (Health Informatics option) offered through the Department of Electrical and Computer Engineering, or permission of the course director.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "HSA-H410",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 4 HONS SPECIALIZATIONS IN ONE HEALTH, PATHOLOGY, MEDICAL HEALTH INFORMATICS, AND YR 4 SOFTWARE ENGINEERING (HEALTH INFORMATICS OPTION)."
        }
      ],
      "catalog_description": "The flow, management and use of health data across integrated health facilities, clinical information systems and the care continuum will be examined. Implementation of complex health information systems will be explored, including security and privacy of health information, adoption of new technologies, team and project management.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "4980E",
      "subject": "MEDHINFO",
      "className": "SEMINAR & RESEARCH PROJECT",
      "course_info": [
        {
          "class_nbr": 4696,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Registration in Year 4 of an Honours Specialization in Medical Health Informatics.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "HSA-H410",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 4 HONS SPECIALIZATION IN MEDICAL HEALTH INFORMATICS."
        }
      ],
      "catalog_description": "Major research project and weekly seminar course for the Honours Specialization in Medical Health Informatics. Includes: i) theory and practice of research methodology and critical appraisal of research literature, ii) an independent research project supervised by faculty, and iii) preparation of a research proposal and final written research project report.\n\nExtra Information: Minimum 12 laboratory hours per week plus 3 seminar hours per week."
    },
    {
      "catalog_nbr": 1022,
      "subject": "MEDIEVAL",
      "className": "INTRO TO MEDIEVAL STUDIES",
      "course_info": [
        {
          "class_nbr": 3871,
          "start_time": "5:30 PM",
          "descrlong": "",
          "end_time": "8:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2024",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will introduce civilization and thought in Europe and the Mediterranean between 400 and 1500, with emphasis on the medieval roots of many modern institutions and attitudes, including philosophy, technology, law, governance, courtly love and attitudes to women, warfare, art and archaeology, Christianity and Islam, literature, music and coinage.\n \nAntirequisite(s): Medieval Studies 1025A/B, Medieval Studies 1026A/B, and the former Medieval Studies 1020E. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 1017,
      "subject": "MTP-MMED",
      "className": "SPECIAL TOPICS",
      "course_info": [
        {
          "class_nbr": 3173,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": 1020,
      "subject": "MTP-MMED",
      "className": "SPECIAL TOPICS",
      "course_info": [
        {
          "class_nbr": 3174,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "3610F",
      "subject": "MCS",
      "className": "CONTROVERSIES AND MUSEUMS",
      "course_info": [
        {
          "class_nbr": 9909,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): 0.5 Art History 2600-level credits or 0.5 the former Visual Art History 2200-level\ncredits, or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-247",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN MUSEUM STUDIES MODULE OR PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "What challenges do museums face in researching and displaying “difficult” material such as artefacts related to histories of violence, social and economic disparity, colonization, or environmental degradation? Students will learn how museums have both benefitted from and responded to historical and ongoing exploitation and inequality. \n\nAntirequisite(s): the former VAH 3384F/G, the former VAH 3386F/G.\n\nExtra Information: 3 hours: lecture, blended, or online format."
    },
    {
      "catalog_nbr": "3660B",
      "subject": "MCS",
      "className": "DIGITAL TOOLS FOR ARTS PROF.",
      "course_info": [
        {
          "class_nbr": 11328,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Registration in a Visual Arts module.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "VAC-249",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "The course introduces students of art history and museum and curatorial studies to some of the basic digital tools required for professionals in the field. Topics will include: image editing and optimization, documentation and digital photography, poster and catalogue design, creating didactic panels, 360 video and photo capture, etc.\n\nExtra Information: Pass/Fail."
    },
    {
      "catalog_nbr": "4605E",
      "subject": "MCS",
      "className": "MUSEUM AND CURATORIAL PRACTICU",
      "course_info": [
        {
          "class_nbr": 9910,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Registration in year 3 and 4 in Honours Specialization in Art History and Museum Studies or Major in Museum and Curatorial Studies, or permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-247",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN YRS 3&4 IN HONS SPECIALIZATION IN ART HISTORY AND MUSEUM STUDIES, MAJOR IN MUSEUM AND CURATORIAL STUDIES, OR PERMISSION OF THE DEPARTMENT"
        }
      ],
      "catalog_description": "In this capstone seminar class, students work together with the professor to plan and execute a major curatorial project. This class provides essential skills and practical experience for those hoping to move into careers in the museums and culture fields. \n\nAntirequisite(s): the former VAH 4485E, the former VAS 4485E.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "4685E",
      "subject": "MCS",
      "className": "INTERNSHIP IN THE VISUAL ARTS",
      "course_info": [
        {
          "class_nbr": 11612,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Third or fourth-year honours students with a departmental average of at least 75% have the opportunity for experiential learning in the fields of Gallery, Museum, and Heritage Studies. Students work with the Undergraduate Chair on a project at one of the many studio, museum, gallery, or heritage locations in London's region."
    },
    {
      "catalog_nbr": "4686F",
      "subject": "MCS",
      "className": "PROJECT-BASED INTERNSHIP",
      "course_info": [
        {
          "class_nbr": 11614,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Fourth-year students with a departmental average of at least 75% have the opportunity to take part in a project-based experiential learning activity at one of our many studio, museum, gallery, or heritage locations in London and surrounding areas. Students will work closely with the Project’s Supervisor."
    },
    {
      "catalog_nbr": "4686G",
      "subject": "MCS",
      "className": "PROJECT-BASED INTERNSHIP",
      "course_info": [
        {
          "class_nbr": 11615,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Fourth-year students with a departmental average of at least 75% have the opportunity to take part in a project-based experiential learning activity at one of our many studio, museum, gallery, or heritage locations in London and surrounding areas. Students will work closely with the Project’s Supervisor."
    },
    {
      "catalog_nbr": "0914",
      "subject": "MUSIC",
      "className": "PIANO REQUIREMENT",
      "course_info": [
        {
          "class_nbr": 1145,
          "start_time": "",
          "descrlong": "RESTRICTED TO STUDENTS IN THE FACULTY OF MUSIC.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Students whose principal instrument is other than piano, organ, or harpsichord must demonstrate keyboard proficiency of at least the Conservatory Grade VI level, either by presentation of a Conservatory certificate, or by passing an equivalent test offered periodically by the Faculty. Satisfaction of this requirement is strongly recommended before entrance to the BMus (Honours) programs. Students needing instruction to meet this requirement must make their own arrangements at their own expense.\n\nExtra Information: No credit."
    },
    {
      "catalog_nbr": "0918",
      "subject": "MUSIC",
      "className": "MUSIC ENSEMBLE",
      "course_info": [
        {
          "class_nbr": 2129,
          "start_time": "3:30 PM",
          "descrlong": "RESTRICTED TO STUDENTS IN THE FACULTY OF MUSIC.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "",
          "days": [
            "M",
            "Tu",
            "W",
            "Th",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "1102A",
      "subject": "MUSIC",
      "className": "LISTENING TO MUSIC",
      "course_info": [
        {
          "class_nbr": 9870,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "TC-100",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "OPEN TO NON-MUSIC STUDENTS."
        }
      ],
      "catalog_description": "A basic course to acquaint students with the materials of music and to give a broad perspective of the history of music. Through guided listening, the student will be exposed to a wide variety of musical styles. Not available for credit for music students.\n\nExtra Information: 3 hours. Open to non-music students."
    },
    {
      "catalog_nbr": "1102B",
      "subject": "MUSIC",
      "className": "LISTENING TO MUSIC",
      "course_info": [
        {
          "class_nbr": 9871,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "TC-100",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "OPEN TO NON-MUSIC STUDENTS."
        }
      ],
      "catalog_description": "A basic course to acquaint students with the materials of music and to give a broad perspective of the history of music. Through guided listening, the student will be exposed to a wide variety of musical styles. Not available for credit for music students.\n\nExtra Information: 3 hours. Open to non-music students."
    },
    {
      "catalog_nbr": "1629A",
      "subject": "MUSIC",
      "className": "INTRO TO COMPOSITION",
      "course_info": [
        {
          "class_nbr": 7332,
          "start_time": "10:30 AM",
          "descrlong": "RESTRICTED TO STUDENTS IN THE FACULTY OF MUSIC.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "TC-101",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "Introduction to musical elements and manipulation (pitch, rhythm, intensity, timbre, texture, and form), and appropriate repertoire.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1639U",
      "subject": "MUSIC",
      "className": "INTEGRATED MUSICIANSHIP I",
      "course_info": [
        {
          "class_nbr": 7360,
          "start_time": "1:30 PM",
          "descrlong": "Corequisite(s): Music 1649A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "TC-203",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "Musicianship skills for basic diatonic materials. Topics include an introduction to solfège, tonal listening, sight singing, dictation and keyboard harmony.\n\nAntirequisite(s): The former Music 1635A/B.\n\nExtra Information: 1 lecture hour, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1641U",
      "subject": "MUSIC",
      "className": "INTEGRATED MUSICIANSHIP II",
      "course_info": [
        {
          "class_nbr": 7380,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Music 1639U or the former Music 1635A/B.\nCorequisite(s): Music 1651A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "TC-202",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "A continuation of Music 1639U. Musicianship skills for advanced diatonic materials. Topics include sight singing, dictation and keyboard harmony. \n\nAntirequisite(s): The former Music 1636A/B.\n\nExtra Information: 1 lecture hour, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1649A",
      "subject": "MUSIC",
      "className": "STUDIES IN THEORY I",
      "course_info": [
        {
          "class_nbr": 1150,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Music 0601A/B or demonstrated competence in theory rudiments, melody writing and elementary harmony.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "TC-141",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Basic theory and analysis of tonal music. Topics covered include diatonic harmony and voice leading, the concept and practice of tonality, basic tonicization and modulation, and an introduction to musical form.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": 2000,
      "subject": "NEURO",
      "className": "INTRO TO NEUROSCIENCE",
      "course_info": [
        {
          "class_nbr": 3398,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Psychology 1000 with a minimum mark of 60%; either Biology 1001A or Biology 1201A with a minimum mark of 60%; and either Biology 1002B or Biology 1202B with a minimum mark of 60%.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "MSB-M384",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY INFORMATION IS LOCATED AT: https://www.schulich.uwo.ca/neuroscience/undergraduate/current_students/course_information/access_to_courses.html"
        }
      ],
      "catalog_description": "A comprehensive introduction to the neurosciences. Topics include molecular properties of neurons; neural plasticity; development of the brain and nervous system; sensory, motor and integrative systems; neural mechanisms of behaviour and cognition, including memory, language, and consciousness. Molecular and genetic techniques, electrophysiological recording, and brain imaging methods will be examined.\n\nAntirequisite(s): Psychology 2220A/B and Psychology 2221A/B, if taken in 2013/14 or onward.\n\nExtra Information: 2 lecture hours, 2 tutorial/laboratory hours."
    },
    {
      "catalog_nbr": "3000G",
      "subject": "NEURO",
      "className": "CURRENT TOPICS IN NEUROSCIENCE",
      "course_info": [
        {
          "class_nbr": 3609,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Neuroscience 2000 with a minimum mark of 75% and registration in Year 3 of an Honours Specialization in Neuroscience.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-54B",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN YR 3 HONS SPZ IN NEUROSCIENCE."
        }
      ],
      "catalog_description": "Students will read and critique current neuroscience research from the experimental and clinical literature. Topics will range from cellular properties of neurons to cognitive neuroscience. Critical thinking, evaluation of data, research design, and the conduct of scientific inquiry will be emphasized along with the ethical implications of research in neuroscience.\n\nExtra Information: 3 lecture and discussion hours."
    },
    {
      "catalog_nbr": "4000E",
      "subject": "NEURO",
      "className": "HONORS THESIS",
      "course_info": [
        {
          "class_nbr": 4031,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Neuroscience 3000F/G with a minimum mark of 75%; one of Biology 2244A/B, Statistical Sciences 2244A/B or the former Statistical Sciences 2122A/B or Psychology 2810; Pharmacology 3620; Physiology 3140A; and registration in Year 4 of an Honours Specialization in Neuroscience.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "UC-3225",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN YR 4 HONS SPZ IN NEUROSCIENCE."
        }
      ],
      "catalog_description": "An independent laboratory project in Neuroscience emphasizing experimental design, instrumentation, data collection and analysis, and communication of experimental results by oral, poster and written presentations. Topics covered in seminar time include animal and human research ethics and institutional approval of animal and human experimentation, laboratory safety, and scientific communication skills.\n\nExtra Information: Minimum 15 hours per week."
    },
    {
      "catalog_nbr": "5213B",
      "subject": "PASTTHEO",
      "className": "INTEGRATIVE SEMINAR",
      "course_info": [
        {
          "class_nbr": 8166,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W4",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "5230A",
      "subject": "PASTTHEO",
      "className": "CONGRGTNL DEVELPMNT & LEADRSHP",
      "course_info": [
        {
          "class_nbr": 8159,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5231A",
      "subject": "PASTTHEO",
      "className": "PASTORAL CARE & CONSELLING",
      "course_info": [
        {
          "class_nbr": 8158,
          "start_time": "5:30 PM",
          "descrlong": "Prerequisite: Field Educ 5110 A/B",
          "end_time": "8:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON OR ST. PETER'S SEMINARY."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5236A",
      "subject": "PASTTHEO",
      "className": "INDEPENDENT STUDY",
      "course_info": [
        {
          "class_nbr": 11733,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Huron",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "5305B",
      "subject": "PASTTHEO",
      "className": "THEOLOGICAL REFLECTION",
      "course_info": [
        {
          "class_nbr": 9562,
          "start_time": "9:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W6",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "5313B",
      "subject": "PASTTHEO",
      "className": "MDIV INTEGRATION AND FORMATION",
      "course_info": [
        {
          "class_nbr": 8242,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Huron",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Through participation in formation events and opportunities, and through the integration of learning, MDiv students will have the opportunity to reinforce and master core goals of the program."
    },
    {
      "catalog_nbr": "5330B",
      "subject": "PASTTHEO",
      "className": "COUPLE & FAMILY DYNAMICS",
      "course_info": [
        {
          "class_nbr": 9457,
          "start_time": "5:30 PM",
          "descrlong": "Prerequisite(s): Pastoral Theology 5231A/B",
          "end_time": "8:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5576A",
      "subject": "PASTTHEO",
      "className": "ETHICAL ISSUES & PASTORAL MIN",
      "course_info": [
        {
          "class_nbr": 8861,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": 1030,
      "subject": "PERSIAN",
      "className": "PERSIAN (FARSI) FOR BEGINNERS",
      "course_info": [
        {
          "class_nbr": 3890,
          "start_time": "4:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B04",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH PERSIAN 1035 001."
        }
      ],
      "catalog_description": "Introduction of oral and written Persian for students with little or no previous knowledge of the language. Develop your communicative skills while learning about the cultures of the Persian-speaking countries.\n\nAntirequisite(s): Grade 12U Persian (Farsi), Persian 1035.\n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": 1035,
      "subject": "PERSIAN",
      "className": "BEGINNER PERSIAN HRTGE SPEAKER",
      "course_info": [
        {
          "class_nbr": 4513,
          "start_time": "4:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B04",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH PERSIAN 1030 001."
        }
      ],
      "catalog_description": "For students with some background in Persian (heritage speakers), this course develops communicative skills, speaking, reading and writing in Persian. Students are enrolled on the basis of a placement test.\n\nAntirequisite(s): Grade 12U Persian and Persian 1030.\n\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "2060B",
      "subject": "PHARM",
      "className": "INTRO PHARMACOL & THERAPEUTICS",
      "course_info": [
        {
          "class_nbr": 2197,
          "start_time": "",
          "descrlong": "Pre-or Corequisite(s): One of Biology 1001A or Biology 1201A and one of Biology 1002B or Biology 1202B; or registration in the BSc in Nursing.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "ONLINE COURSE. RESTRICTED TO STUDENTS REGISTERED IN THE SCHOOL OF NURSING - NO EXCEPTIONS MADE."
        }
      ],
      "catalog_description": "A course for students in the BSc in Nursing and other Health Sciences programs as well as students in BMSc and BSc programs, to provide a basic understanding of the fundamentals of drug action and the mechanisms of action and therapeutic use of the important classes of drugs.\n\nAntirequisite(s): Pharmacology 3620. \n\n Extra Information: 1 tutorial hour (optional). Only offered online (Distance Studies)."
    },
    {
      "catalog_nbr": 3620,
      "subject": "PHARM",
      "className": "HUMAN PHARM & THERAPEUTIC PRNC",
      "course_info": [
        {
          "class_nbr": 3248,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Biochemistry 2280A, Biology 2382A/B.\n\nPre-or Corequisite(s): Physiology 3120 is strongly recommended.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "A systems-based pharmacology course surveying the range of drugs used to treat disease processes affecting various organs of the body (e.g. cardiovascular disease, neurological diseases, etc.) with emphasis on drug targets, mechanisms of drug action, and adverse effects.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "4100B",
      "subject": "PHARM",
      "className": "DIGESTION & RELATED METABOLISM",
      "course_info": [
        {
          "class_nbr": 5230,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Physiology 3120.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-2B02",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH PHYSIOL 4100B. PRIORITY INFORMATION IS ON BMSc WEBSITE: http://www.schulich.uwo.ca/bmsc/academic_resources/courses/access_to_courses.html"
        }
      ],
      "catalog_description": "This course will cover gastrointestinal secretion, motility, digestion, absorption, hepatic and pancreatic physiology. Specific areas will include: gut-brain-liver axis and nutrient metabolism, exocrine and endocrine pancreas, liver and lipid metabolism. Relevant pathologies and disease states, including obesity, diabetes, and metabolic syndrome along with current therapeutic strategies will be covered.\n\nAntirequisite(s): Physiology 4100A/B.\n\nExtra Information: 2 lecture hours. Cross-listed with Physiology 4100A/B."
    },
    {
      "catalog_nbr": "4320A",
      "subject": "PHARM",
      "className": "CARDIOVASCULAR PHARMACOL",
      "course_info": [
        {
          "class_nbr": 1026,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Pharmacology 3620 and either Physiology and Pharmacology 3000E or the former Pharmacology 3580Z; or Physiology 3120; or Pharmacology 3620 and registration in Year 4 of a module in Pathology.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "MSB-M282",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Basic principles of cardiovascular pharmacology with particular emphasis on cellular mechanisms of drug action and mechanisms of therapeutic efficacy in disease states.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "4350A",
      "subject": "PHARM",
      "className": "CLINICAL PHARMACOLOGY",
      "course_info": [
        {
          "class_nbr": 1049,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Pharmacology 3620.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "MSB-M282",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "Clinical pharmacology is a scientific and medical discipline dedicated to the bench-to-bedside study of drug action through an in-depth knowledge of human pharmacology and therapeutics. This course in clinical pharmacology focuses on fundamental concepts highlighted with examples from clinical cases, therapeutic applications and relevance to drug discovery and development. \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "4360B",
      "subject": "PHARM",
      "className": "MECHANISMS OF CANCER CHEMO",
      "course_info": [
        {
          "class_nbr": 2257,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Pharmacology 3620, or Physiology 3140A, or permission of the Department.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "DSB-2016",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course is designed to give students a basic understanding of the molecular pharmacology and therapeutic properties of anticancer agents. The focus is on molecular mechanisms of cancer chemotherapy, and will include drug resistance and the roles of receptor kinases and G protein-coupled receptors in existing and novel cancer therapies.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "4370B",
      "subject": "PHARM",
      "className": "PHARMACOLOGY OF DRUGS OF ABUSE",
      "course_info": [
        {
          "class_nbr": 3344,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Pharmacology 3620 or Physiology 3140A.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "SH-3305",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "This course will cover the pharmacological and pathophysiological effects of non-medicinal drug use including mechanisms of action, tolerance and addiction, long-term effects, side effects and toxicity, treatment of addictions and overdoses. Pharmacokinetics will also be examined including routes of administration, activation, deactivation, elimination, and drug-drug interactions. \n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "4380B",
      "subject": "PHARM",
      "className": "NEUROPHARMACOLOGY",
      "course_info": [
        {
          "class_nbr": 4525,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): Pharmacology 3620; Physiology 3140A; or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "MSB-M384",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course will focus on the cellular and molecular mechanisms underlying the actions of drugs on the central and peripheral nervous systems. The focus will be on recent developments in the field of neuroscience and their impact on our understanding of the actions, and development of, new drugs.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "4620A",
      "subject": "PHARM",
      "className": "MLCLR & STRCTRL BASIS DRUG ACT",
      "course_info": [
        {
          "class_nbr": 5229,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): One of Biochemistry 3381A, Pharmacology 3620, or Physiology 3140A",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "B&GS-0153",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "Drugs are designed to act on protein targets such as receptors, channels, exchangers and enzymes. This course explores the structures of these major targets and discusses how drugs are designed to treat dysfunction of the associated cell signaling pathways.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": "4660A",
      "subject": "PHARM",
      "className": "HUMAN TOXICOLOGY",
      "course_info": [
        {
          "class_nbr": 1019,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Pharmacology 3620 or permission of the Department.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "NCB-113",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "A course dealing with the pharmacological and toxicological principles underlying the adverse effects of xenobiotics in humans. In addition to reviewing mechanisms of toxicity in humans, the course will include overviews of the principles of management of human poisoning, the principles of chronic toxicity and of drug safety in humans.\n\nExtra Information: 2 lecture hours."
    },
    {
      "catalog_nbr": 5001,
      "subject": "PHILST",
      "className": "THOMISTIC PHIL FOR THEOLOGIANS",
      "course_info": [
        {
          "class_nbr": 8504,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": 1020,
      "subject": "PHILOSOP",
      "className": "INTRO TO PHILOSOPHY",
      "course_info": [
        {
          "class_nbr": 2677,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Through readings, film and other media this course explores debates about knowledge, truth, reality, religion,morality, politics, and the meaning of life. A weekly tutorial hour will help students to develop skills of analysis and expression.\n\nAntirequisite(s): Philosophy 1000E, Philosophy 1022E, Philosophy 1100E, Philosophy 1250F/G, Philosophy 1300E, Philosophy 1350F/G. \n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1030B",
      "subject": "PHILOSOP",
      "className": "UNDERSTANDING SCIENCE",
      "course_info": [
        {
          "class_nbr": 9491,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UC-3110",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This non-essay course introduces conceptual issues about science: What distinguishes science from non-science? Are there limits to what science can or should explain? What does science tell us about reality? What is the relationship between science and religion? What is the role and value of science in a democratic society?\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1040G",
      "subject": "PHILOSOP",
      "className": "ETHICS, LAW, & POLITICS",
      "course_info": [
        {
          "class_nbr": 6540,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "TC-141",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Many problems faced by individuals and societies lie at the intersection of ethics, law, and politics. This course will consider issues that can be analyzed along ethical, legal, and/or political lines, with a focus on understanding the differences between moral, legal, and political arguments and solutions to contemporary societal problems.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1050G",
      "subject": "PHILOSOP",
      "className": "NON-WESTERN \"PHILOSOPHIES\"",
      "course_info": [
        {
          "class_nbr": 9058,
          "start_time": "4:00 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-LH105A",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course investigates non-European ways of thinking “philosophically.” Students will study African oral traditions, Central-Asian, Chinese, Japanese, and Indigenous traditions by looking at their approach to fundamental questions: what is the human being? What is nature and what is our relation to it? What is knowledge and what is happiness?\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1120F",
      "subject": "PHILOSOP",
      "className": "POWER,SOCIAL POLITICS,CULTURE",
      "course_info": [
        {
          "class_nbr": 10628,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "10:00 AM",
          "campus": "Kings",
          "facility_ID": "KC-LH105B",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to the key social, political, and legal structures and ideas that shape our contemporary culture and worlds. Students explore complex, often-hidden social and political concepts and organizational practices that prescribe modes of behaviour, human interactions, and material modes of production.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1120G",
      "subject": "PHILOSOP",
      "className": "POWER,SOCIAL POLITICS,CULTURE",
      "course_info": [
        {
          "class_nbr": 11550,
          "start_time": "9:00 AM",
          "descrlong": "",
          "end_time": "12:00 PM",
          "campus": "Kings",
          "facility_ID": "KC-SA060",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to the key social, political, and legal structures and ideas that shape our contemporary culture and worlds. Students explore complex, often-hidden social and political concepts and organizational practices that prescribe modes of behaviour, human interactions, and material modes of production.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1130F",
      "subject": "PHILOSOP",
      "className": "BIG IDEAS",
      "course_info": [
        {
          "class_nbr": 9509,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-3110",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Apparently simple conceptions sometimes especially capture our imagination. Examples: Descartes's \"I think, therefore I am,\" McLuhan's \"the medium is the message,\" or Plato's theory of forms. The course examines a great number of these simple ideas that are also the Big Ideas that no educated person should be ignorant of. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 1200,
      "subject": "PHILOSOP",
      "className": "CRITICAL THINKING",
      "course_info": [
        {
          "class_nbr": 11255,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "TC-203",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "002",
          "ssr_component": "TUT",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to basic principles of reasoning and critical thinking designed to enhance the student's ability to evaluate various forms of reasoning as found in everyday life as well as in academic disciplines. The course will deal with such topics as inductive and deductive reasoning, the nature and function of definitions, types of fallacies, the use and misuse of statistics, and the rudiments of logic. Primarily for first-year students.\n\nAntirequisite(s) at Main campus: Philosophy 1000E, Philosophy 1230A/B.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1230A",
      "subject": "PHILOSOP",
      "className": "REASONING & CRITICAL THINKING",
      "course_info": [
        {
          "class_nbr": 8187,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-V214",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO HURON STUDENTS. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "An introduction to the basic principles of reasoning and critical thinking designed to enhance the student's ability to evaluate various forms of reasoning found in everyday life as well as in academic disciplines. The course will deal with such topics as inductive and deductive reasoning, the nature and function of definitions, types of fallacies, the use and misuse of statistics, and the rudiments of logic. Primarily for first year students. \n\nAntirequisite(s) at Main campus: Philosophy 1000E, Philosophy 1200.\nAntirequisite(s) at Brescia, Huron campus: Philosophy 1200.\n\nExtra Information: 2 lecture hours, 1 tutorial hour (Main); 3 lecture hours (Brescia, Huron)."
    },
    {
      "catalog_nbr": "1230B",
      "subject": "PHILOSOP",
      "className": "REASONING & CRITICAL THINKING",
      "course_info": [
        {
          "class_nbr": 7863,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "facility_ID": "BR-201",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS ENROLLED AT BRESCIA."
        }
      ],
      "catalog_description": "An introduction to the basic principles of reasoning and critical thinking designed to enhance the student's ability to evaluate various forms of reasoning found in everyday life as well as in academic disciplines. The course will deal with such topics as inductive and deductive reasoning, the nature and function of definitions, types of fallacies, the use and misuse of statistics, and the rudiments of logic. Primarily for first year students. \n\nAntirequisite(s) at Main campus: Philosophy 1000E, Philosophy 1200.\nAntirequisite(s) at Brescia, Huron campus: Philosophy 1200.\n\nExtra Information: 2 lecture hours, 1 tutorial hour (Main); 3 lecture hours (Brescia, Huron)."
    },
    {
      "catalog_nbr": "1250F",
      "subject": "PHILOSOP",
      "className": "RIGHT AND WRONG",
      "course_info": [
        {
          "class_nbr": 8087,
          "start_time": "6:30 PM",
          "descrlong": "",
          "end_time": "9:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W12",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON STUDENTS. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "A survey of selected philosophical problems in the areas of ethics and political/legal philosophy, with reference to works of both classical and contemporary philosophers. Specimen topics include ethical relativism, freedom and determinism, anarchy and government, and the justification of punishment. Primarily for first year students. \n\nAntirequisite(s): Philosophy 1100E, Philosophy 1300E.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1250G",
      "subject": "PHILOSOP",
      "className": "RIGHT AND WRONG",
      "course_info": [
        {
          "class_nbr": 8143,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W116",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO HURON STUDENTS. OPEN JULY 19 TO ALL STUDENTS."
        }
      ],
      "catalog_description": "A survey of selected philosophical problems in the areas of ethics and political/legal philosophy, with reference to works of both classical and contemporary philosophers. Specimen topics include ethical relativism, freedom and determinism, anarchy and government, and the justification of punishment. Primarily for first year students. \n\nAntirequisite(s): Philosophy 1100E, Philosophy 1300E.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 1030,
      "subject": "PORTUGSE",
      "className": "PORTUGUESE FOR BEGINNERS",
      "course_info": [
        {
          "class_nbr": 1824,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-54B",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to understanding, speaking, reading, and writing Portuguese, with emphasis on oral skills. Intended for students with little or no previous knowledge of Portuguese. Prepares students directly for Portuguese 2200. Note that students who have successfully completed Grade 12 U Portuguese or equivalent cannot take this course for credit.\n\nAntirequisite(s): Grade 12 U Portuguese. \n\nExtra Information: 4 hours."
    },
    {
      "catalog_nbr": "3060A",
      "subject": "REHABSCI",
      "className": "HEALTH CONDITIONS & DISEASE",
      "course_info": [
        {
          "class_nbr": 2260,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Health Sciences 2300A/B or Kinesiology 2222A/B or Anatomy and Cell Biology 2221.\nPre-or Corequisite(s): Registration in a Rehab Sci module or enrolment in the third or fourth year of the School of Health Studies or School of Kinesiology.",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-2240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "Diseases frequently encountered in rehabilitation practices will be presented in this introductory course. Definitions and concepts regarding people with disabilities will be applied within this course.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3061B",
      "subject": "REHABSCI",
      "className": "FOUNDATIONS IN REHAB SCIENCE",
      "course_info": [
        {
          "class_nbr": 2261,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Rehabilitation Sciences module or enrolment in the third or fourth year of the School of Health Studies or School of Kinesiology.",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-2240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "The primary definitions and principles of rehabilitation sciences will be covered. Practices of rehabilitation professionals will be investigated within an evidence-based context.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3125A",
      "subject": "REHABSCI",
      "className": "ENABLING HEALTH & WELL-BEING",
      "course_info": [
        {
          "class_nbr": 7337,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Rehabilitation Sciences module or enrolment in the third or fourth year of the School of Health Studies or School of Kinesiology.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-37",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course addresses the construct of 'occupation' as explored and understood within the field of occupational science and practice of occupational therapy. Students will develop and apply an occupational perspective to address contemporary issues and to consider the relationship between occupation and health and well-being.\r\n\r\nAntirequisite(s): Health Sciences 3091A section 001 if taken in 2011-12 or 2012-13. \r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3360B",
      "subject": "REHABSCI",
      "className": "MUSCULOSKELETAL DSRDS IN REHAB",
      "course_info": [
        {
          "class_nbr": 3565,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Health Sciences 2300A/B or Health Sciences 2330A/B or Kinesiology 2222A/B or Anatomy and Cell Biology 2221.\nPre-orCorequisite(s): Registration in a Rehabilitation Sciences mod or enrl in third or fourth year of the School of Health Studies or School of Kinesiology.",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1200",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "An introductory course in the area of musculoskeletal disorders as encountered in sport and in the workplace. Materials covered include the mechanisms of injury, tissue biomechanics, pathology, assessment, treatment and prevention of acute and chronic trauma. Current evidence-based practices in diagnostic testing and treatment options will be addressed.\n\nAntirequisite(s): Health Sciences 3091B section 001 if taken in 2011. \n\nExtra Information: 3 lecture/seminar hours."
    },
    {
      "catalog_nbr": "4212A",
      "subject": "REHABSCI",
      "className": "INNOVATIONS IN REHABILITATION",
      "course_info": [
        {
          "class_nbr": 5955,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Rehabilitation Sciences module or enrolment in the third or fourth year of the School of Health Studies or School of Kinesiology.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-2B02",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course examines both conceptual and practical approaches to innovations in rehabilitation practice including those that incorporate: 1) health promotion /self-management perspectives, 2) high-intensity activity-based approaches, and 3) evidence-informed ways to implement practice change. Examples will focus on neuro-rehabilitation practice associated with persons with spinal cord and acquired brain injury.\n\nAntirequisite(s): The former Rehabilitation Sciences 4210A/B or Health Sciences 4090A section 002 if taken in 2012\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4605A",
      "subject": "REHABSCI",
      "className": "REHABILITATION PSYCHOLOGY",
      "course_info": [
        {
          "class_nbr": 6262,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Rehabilitation Sciences module or enrolment in the third or fourth year of the School of Health Studies or School of Kinesiology.",
          "end_time": "9:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3006",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full"
        }
      ],
      "catalog_description": "This course will cover a range of applications of psychology in rehabilitation. Topics such as pain management, cognitive retraining and psychological adjustment to disability will be explored using examples of rehabilitation of traumatic brain injury, spinal cord injury and sport injury.\n\nAntirequisite(s): Health Sciences 4091A section 001 if taken in 2011-12 or 2012-13. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "4970E",
      "subject": "REHABSCI",
      "className": "REHAB SCI PRACTICUM",
      "course_info": [
        {
          "class_nbr": 6265,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): Permission of the School of Health Studies; Enrolment in the fourth year of an Honours Specialization module in the School of Health Studies. Application Required.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "APPLICATION REQUIRED. 1 SEMINAR HOUR, 6 PRACTICUM HOURS."
        }
      ],
      "catalog_description": "This experiential learning course offers an in-depth examination of the required background, concepts and practical considerations related to a series of rehabilitation practices selected to expose the student to a broad range of activities over several patient populations and associated with a variety of health care disciplines.\n\nAntirequisite(s): The former Health Sciences 4900E, the former Health Sciences 4910F/G.\n\nExtra Information: 2 seminar hours; Priority will be given to students enrolled in the Honours Specialization in Rehabilitation Sciences."
    },
    {
      "catalog_nbr": "5203B",
      "subject": "RELEDUC",
      "className": "INTRO TO CHRISTIAN EDUCATION",
      "course_info": [
        {
          "class_nbr": 8157,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5241A",
      "subject": "SACRTHEO",
      "className": "SACRAMENTS OF INITIATION I",
      "course_info": [
        {
          "class_nbr": 11138,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5242B",
      "subject": "SACRTHEO",
      "className": "SACRAMENTS OF INITIATION II",
      "course_info": [
        {
          "class_nbr": 11139,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5243A",
      "subject": "SACRTHEO",
      "className": "MARRIAGE AND SEXUALITY",
      "course_info": [
        {
          "class_nbr": 11140,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5249A",
      "subject": "SACRTHEO",
      "className": "SELECTED TOPICS",
      "course_info": [
        {
          "class_nbr": 8498,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5249B",
      "subject": "SACRTHEO",
      "className": "SELECTED TOPICS",
      "course_info": [
        {
          "class_nbr": 8499,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5442A",
      "subject": "SACRTHEO",
      "className": "THEOLOGY OF ORDER & MINISTRIES",
      "course_info": [
        {
          "class_nbr": 9018,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5541A",
      "subject": "SACRTHEO",
      "className": "THEOLOGY OF SACRAMENTAL HEALNG",
      "course_info": [
        {
          "class_nbr": 8697,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5542B",
      "subject": "SACRTHEO",
      "className": "THE ART OF THE CONFESSOR",
      "course_info": [
        {
          "class_nbr": 8698,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "3377B",
      "subject": "SCIENCE",
      "className": "PROJECT MGMNT FOR THE SCIENCES",
      "course_info": [
        {
          "class_nbr": 4658,
          "start_time": "7:00 PM",
          "descrlong": "Prerequisite(s): Registration in third or fourth year of any module in the Faculty of Science or Schulich School of Medicine & Dentistry.",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "MC-110",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH COMP SCI 3377B."
        }
      ],
      "catalog_description": "Fundamental techniques, theories, and tools for managing successful projects in the Sciences. Project management standards and life cycles; resourcing, scheduling and estimating techniques for project management; project management organizational concerns, including project economic analysis, human resources, proposal development, risk management, funding models, procurement, and strategic alignments.\n\nAntirequisite(s): Computer Science 3377A/B, Software Engineering 3351A/B.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "3990A",
      "subject": "SOCSCI",
      "className": "INTERNSHIP",
      "course_info": [
        {
          "class_nbr": 11600,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Faculty of Social Science. Applicants must have an average of at least 70% and be enroled in a Social Science Honours Specialization, Specialization or Major or Specialization module and be registered in third or fourth year.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "One-term placement with a government, private sector or non-governmental organization to provide a practical learning experience. Admission is competitive. Students will write a final report on work undertaken.\n\nExtra Information: Pass/Fail.\nNotes: International students should consult academic counselling about their eligibility. Students may not take any academic courses during the internship."
    },
    {
      "catalog_nbr": "3999A",
      "subject": "SOCSCI",
      "className": "EXPERIENTIAL LEARNING",
      "course_info": [
        {
          "class_nbr": 7571,
          "start_time": "",
          "descrlong": "Prerequisite(s): Registration in the Faculty of Social Science and permission of the Dean.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Experiential--or service--learning (learning through practical experience) opportunities, which result in tangible and quantifiable academic value, may be recognized for course credit. Students must seek conditional approval. \nDetailed criteria for course credit will be determined by the Dean or designate, in consultation with appropriate department(s).\n\nExtra Information: Pass/Fail.\nNote: Students must receive approval of the Dean (or designate) and reach mutual agreement on a detailed study/research/work plan, prior to the experiential or service learning opportunity. The Dean, in consultation with appropriate departmental advisors (if necessary) will provide the student with detailed criteria, including a timetable of submission deadlines, which must be fulfilled in order to gain credit for the course. No credit will be given without prior approval of the Dean and a failing grade will be assigned if students do not fulfill the pre-approved reporting arrangement."
    },
    {
      "catalog_nbr": "3999B",
      "subject": "SOCSCI",
      "className": "EXPERIENTIAL LEARNING",
      "course_info": [
        {
          "class_nbr": 7576,
          "start_time": "",
          "descrlong": "Prerequisite(s): Registration in the Faculty of Social Science and permission of the Dean.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "002",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Experiential--or service--learning (learning through practical experience) opportunities, which result in tangible and quantifiable academic value, may be recognized for course credit. Students must seek conditional approval. \nDetailed criteria for course credit will be determined by the Dean or designate, in consultation with appropriate department(s).\n\nExtra Information: Pass/Fail.\nNote: Students must receive approval of the Dean (or designate) and reach mutual agreement on a detailed study/research/work plan, prior to the experiential or service learning opportunity. The Dean, in consultation with appropriate departmental advisors (if necessary) will provide the student with detailed criteria, including a timetable of submission deadlines, which must be fulfilled in order to gain credit for the course. No credit will be given without prior approval of the Dean and a failing grade will be assigned if students do not fulfill the pre-approved reporting arrangement."
    },
    {
      "catalog_nbr": "3999Y",
      "subject": "SOCSCI",
      "className": "EXPERIENTIAL LEARNING",
      "course_info": [
        {
          "class_nbr": 11717,
          "start_time": "",
          "descrlong": "Prerequisite(s): Registration in the Faculty of Social Science and permission of the Dean.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Experiential--or service--learning (learning through practical experience) opportunities, which result in tangible and quantifiable academic value, may be recognized for course credit. Students must seek conditional approval. \nDetailed criteria for course credit will be determined by the Dean or designate, in consultation with appropriate department(s).\n\nExtra Information: Pass/Fail.\nNote: Students must receive approval of the Dean (or designate) and reach mutual agreement on a detailed study/research/work plan, prior to the experiential or service learning opportunity. The Dean, in consultation with appropriate departmental advisors (if necessary) will provide the student with detailed criteria, including a timetable of submission deadlines, which must be fulfilled in order to gain credit for the course. No credit will be given without prior approval of the Dean and a failing grade will be assigned if students do not fulfill the pre-approved reporting arrangement."
    },
    {
      "catalog_nbr": "0010A",
      "subject": "SOCIOLOG",
      "className": "SOC LIFE & SOC INEQUALITY",
      "course_info": [
        {
          "class_nbr": 7823,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "facility_ID": "BR-UH26",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN PRELIMINARY YEAR."
        }
      ],
      "catalog_description": "This course considers how social forces impact people's everyday lives. Topics include sociological theory, research methods, culture, socialization, crime and deviance, social interaction, social structure, groups, social class, race, gender, and sexual orientation.\n\nAntirequisite(s): Sociology 0012.\n\nExtra Information: For students registered in the Preliminary Year program only."
    },
    {
      "catalog_nbr": "0011B",
      "subject": "SOCIOLOG",
      "className": "SOCIAL INST & SOCIAL CHANGE",
      "course_info": [
        {
          "class_nbr": 7824,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "facility_ID": "BR-UH26",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS IN PRELIMINARY YEAR."
        }
      ],
      "catalog_description": "This course explores different social institutions and the dynamics of social change. Topics include the sociological perspective and research techniques, families, education, religion, health, mass media, aging, the economy and work, population, collective behaviour, and urbanization.\n\nAntirequisite(s): Sociology 0012.\n\nExtra Information: For students registered in the Preliminary Year program only."
    },
    {
      "catalog_nbr": 1020,
      "subject": "SOCIOLOG",
      "className": "INTRO SOCIOLOGY",
      "course_info": [
        {
          "class_nbr": 1940,
          "start_time": "4:30 PM",
          "descrlong": "",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of the major theoretical perspectives in the field of Sociology, methods of empirical investigation of social phenomena, socialization, group structure, principles of social organization, community structure, population and social change. \n\nAntirequisite(s): Sociology 1020W/X, Sociology 1021E, Sociology 1025A/B, Sociology 1026F/G, Sociology 1027A/B.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1020X",
      "subject": "SOCIOLOG",
      "className": "INTRO TO SOCIOLOGY",
      "course_info": [
        {
          "class_nbr": 8878,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-BH107",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "An examination of the major theoretical perspectives in the field of Sociology, methods of empirical investigation of social phenomena, socialization, group structure, principles of social organization, community structure, population and social change. This is a 1.0 unit condensed course, meeting for 3.0 hours, twice weekly, for a total of 6.0 hours/week. \n\nAntirequisite(s): Sociology 1021E, Sociology 1020. \n\nExtra Information: 4 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "1021E",
      "subject": "SOCIOLOG",
      "className": "INTRODUCTION TO SOCIOLOGY",
      "course_info": [
        {
          "class_nbr": 1751,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2028",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will cover the same material as Sociology 1020, but will also provide students with the opportunity to enhance their essay-writing skills while pursuing a project or projects involving sociological analysis. \n\nAntirequisite(s): Sociology 1020, Sociology 1020W/X, Sociology 1025A/B, Sociology 1026F/G, Sociology 1027A/B.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2202A",
      "subject": "SE",
      "className": "SCRIPTING PROGRAMMING LANGUAGE",
      "course_info": [
        {
          "class_nbr": 10276,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Engineering Science 1036A/B.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SEB-2200",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course is intended to explore the concepts of scripting programming using JavaScript including variable, flow control, expressions, arrays, and objects, to allow students writing functions using objects, properties and methods needed to deliver simple interactive web-based programs. The course also includes coverage of basic HTML and CSS and discusses topics such as the best-practice JavaScript programming patterns.\n\nAntirequisite(s): Computer Science 1046A/B.\n\nExtra Information: 3 lecture hours, 2 laboratory/tutorial hours."
    },
    {
      "catalog_nbr": "2203B",
      "subject": "SE",
      "className": "SOFTWARE DESIGN",
      "course_info": [
        {
          "class_nbr": 9465,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Computer Science 1026A/B or Engineering Science 1036A/B.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SEB-2200",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO SOFTWARE AND COMPUTER ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Object Oriented Design (OOD) using the Unified Modeling Language. Importance of the design process in the software life cycle. Review of traditional software design methods leading into fundamental OOD principles and practices. Reusability, use of tool sets and standards are stressed. Brief coverage of user-interface design, real-time and distributed systems, architectural design.\n\nAntirequisite(s): Computer Science 2212A/B/Y.\n\nExtra Information: 3 lecture hours, 3 laboratory hours."
    },
    {
      "catalog_nbr": "2205A",
      "subject": "SE",
      "className": "ALGORITHMS & DATA STRUCTURE",
      "course_info": [
        {
          "class_nbr": 9468,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Computer Science 1026A/B or Engineering Science 1036A/B.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-1059",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Survey of important computer algorithms and related data structures used in object-oriented software engineering. Design, performance analysis and implementation of such algorithms, stressing their practical use and performance certification of large software applications. Understand how to \"seal\" designs to guarantee performance goals and insure that all error conditions are caught. \n\nAntirequisite(s): Computer Science 2210A/B.\n\nExtra Information: 3 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "2250B",
      "subject": "SE",
      "className": "SOFTWARE CONSTRUCTION",
      "course_info": [
        {
          "class_nbr": 4389,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Computer Science 1026A/B or Engineering Science 1036A/B.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-236",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO SOFTWARE ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Provides an in depth look at the implementation and test phases of the software construction process. This project based course provides hands-on experience on various aspects of software construction including practical experience on software construction tool chain, testing and debugging tools as well as change management tools.\r\n\r\nExtra Information: 2 lecture hours, 2 laboratory hours"
    },
    {
      "catalog_nbr": "3309A",
      "subject": "SE",
      "className": "DATABASE MANAGEMENT SYSTEMS",
      "course_info": [
        {
          "class_nbr": 2391,
          "start_time": "6:30 PM",
          "descrlong": "Prerequisite(s): SE 2203A/B, SE 2205A/B.",
          "end_time": "8:30 PM",
          "campus": "Main",
          "facility_ID": "SEB-2200",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO SOFTWARE OR YR 4 COMPUTER OPTION B ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "The focus is to teach database fundamentals required in the development and evolution of most software applications by providing a basic introduction to the principles of relational database management systems such as Entity-Relationship approach to data modeling, relational model of database management systems and the use of query languages.\n\nAntirequisite(s): Computer Science 3319A/B, Computer Science 3120A/B. \n\nExtra Information: 3 lecture hours/week, 2 laboratory hours/week"
    },
    {
      "catalog_nbr": "3310B",
      "subject": "SE",
      "className": "THEORETICAL FOUNDTNS SFTWR ENG",
      "course_info": [
        {
          "class_nbr": 1832,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Registration in third year of Software Engineering program",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "ACEB-1450",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 3 SOFTWARE OR YR 4 COMPUTER OPTION B ENGINEERING STUDENTS AND YR 2 SOFTWARE/HBA STUDENTS."
        }
      ],
      "catalog_description": "An investigation into the theoretical foundations of Software Engineering including automata theory, computability, analysis of algorithms and the application of formal specification methods to software specification. \n\nAntirequisite(s): Computer Science 3331A/B, Computer Science 3340A/B.\n\nExtra Information: 3 lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "3313A",
      "subject": "SE",
      "className": "OP SYS FOR SOFTWARE ENGINEERNG",
      "course_info": [
        {
          "class_nbr": 1834,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): SE 2203A/B, SE 2205A/B, or Computer Science 2210A/B.",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-236",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 3 SOFTWARE OR YR 4 COMPUTER OPTION A OR YR 3 COMPUTER OPTION B ENGINEERING STUDENTS AND YR 2 SOFTWARE/HBA STUDENTS."
        }
      ],
      "catalog_description": "Theory and construction of operating systems, including real-time and embedded systems aspect from an engineering point of view, stressing performance measurement and metrics. Quality of Service issues leading to certification that an operating system will satisfy hard real-time constraints. \r\n\r\nAntirequisite(s): Computer Science 3305A/B.\r\n\r\nExtra Information: 3 lecture hours, 2 laboratory hours"
    },
    {
      "catalog_nbr": "3314B",
      "subject": "SE",
      "className": "COMPUTER NETWORKS APPLICATIONS",
      "course_info": [
        {
          "class_nbr": 1830,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): ECE 4436A/B",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SEB-2200",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 3 SOFTWARE OR YR 3 COMPUTER OPTION B OR YR 4 COMPUTER OPTION A OR YR 4 INTEGRATED ENGINEERING STUDENTS OR YR 2 SOFTWARE/HBA STUDENTS."
        }
      ],
      "catalog_description": "This course examines and introduces advanced concepts in computer network and data communications. Topics include mobile and wireless data communications, multimedia networking, network management, distributed computing and clusters, and peer to peer network applications. \r\n\r\nExtra Information: 3 lecture hours, 2 laboratory hours"
    },
    {
      "catalog_nbr": "3316A",
      "subject": "SE",
      "className": "WEB TECHNOLOGIES",
      "course_info": [
        {
          "class_nbr": 2648,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): SE 2202A/B, SE 2205A/B, or Computer Science 2210A/B. \nCorequisite(s): ECE 4436A/B, or Computer Science 3357A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "HSB-240",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO SOFTWARE ENGINEERING STUDENTS OR COMPUTER OPTION B ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Technologies, protocols and architectures of the Internet. From HTML, XML, JavaScript to paradigms such as ReST and AJAX and software frameworks for developing modern web applications and integrating services from 3rd parties. We will also look at semantic web, business implications of these protocols as well as legal, ethical and social issues surrounding these technologies.\n\nExtra Information: 3 lecture hours, 2 laboratory hours."
    },
    {
      "catalog_nbr": "3350B",
      "subject": "SE",
      "className": "SOFTWARE ENGINEERING DESIGN I",
      "course_info": [
        {
          "class_nbr": 4489,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): SE 2203A/B, SE 3352A/B.\nCorequisite(s): SE 3351A/B, SE 3353A/B.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "ACEB-1450",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 3 SOFTWARE ENGINEERING STUDENTS AND YR 2 SOFTWARE/HBA STUDENTS."
        }
      ],
      "catalog_description": "Design and implementation of a large group project illustrating the design concepts being taught and promoting team interaction in a professional setting. \n\nAntirequisite(s): Computer Science 3307A/B/Y.\n\nExtra Information: 1 lecture hour, 3 tutorial/laboratory hours."
    },
    {
      "catalog_nbr": "3351B",
      "subject": "SE",
      "className": "SOFTWARE PROJECT & PROC MGMT",
      "course_info": [
        {
          "class_nbr": 2444,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): SE 2203A/B, SE 2250A/B or ECE 2241A/B, Mathematics 2151A/B or Mathematics 2155A, SE 2205A/B or Computer Science 2210A/B.\nCorequisite(s): SE 3350A/B.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "ACEB-1410",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 3 SOFTWARE, AND YR 2 SOFTWARE/HBA STUDENTS."
        }
      ],
      "catalog_description": "Project Management and Software Process life cycles. Includes detailed analysis of components of each process. Metrics, tools and related standards associated with those components. Integration into a complete software project planning including software effort, scheduling and cost estimation, software quality management, and software risk management.\n\nAntirequisite(s): Computer Science 3377A/B.\n\nExtra Information: 3 lecture hours, 1 tutorial hour"
    },
    {
      "catalog_nbr": "3352A",
      "subject": "SE",
      "className": "SFTWR REQ AND ANALYSIS",
      "course_info": [
        {
          "class_nbr": 2442,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): (SE 2203A/B and SE 2205A/B) , or (Computer Science 2210A/B and Computer Science 2212A/B/Y).",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YR 3 SOFTWARE ENGINEERING OR COMPUTER OPTION B ENGINEERING STUDENTS."
        }
      ],
      "catalog_description": "Requirements includes a feasibility study of the desired systems, elicitations and analysis of user's needs, the creation of a precise description of what the system should and should not do along with any constraints on its operation and implementation, and the validation of this specification by the users. \r\n\r\nAntirequisite(s): Computer Science 4473A/B.\r\n\r\nExtra Information: 2 lecture hours, 2 laboratory hours"
    },
    {
      "catalog_nbr": "0005W",
      "subject": "SPEECH",
      "className": "INTRODUCTION TO SPEECH",
      "course_info": [
        {
          "class_nbr": 11528,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "3:30 PM",
          "facility_ID": "BR-14",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course introduces academic speaking and listening skills to international students through readings and speech manuscripts in order to develop oral communication skills. Students are expected to speak frequently and improve their skills of writing and presenting effective speeches. \n\nExtra Information: 8 class/lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "0005X",
      "subject": "SPEECH",
      "className": "INTRODUCTION TO SPEECH",
      "course_info": [
        {
          "class_nbr": 11738,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "4:30 PM",
          "facility_ID": "BR-302A",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course introduces academic speaking and listening skills to international students through readings and speech manuscripts in order to develop oral communication skills. Students are expected to speak frequently and improve their skills of writing and presenting effective speeches. \n\nExtra Information: 8 class/lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": 2001,
      "subject": "SPEECH",
      "className": "FORMS OF ORAL DISCOURSE",
      "course_info": [
        {
          "class_nbr": 1858,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "UCC-54B",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "For effective communication of ideas: Public Address, with basic purposes; Group Discussion; Debate; Voice and Diction; Interpretative Reading. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "5269A",
      "subject": "SPIRTHEO",
      "className": "SELECTED TOPICS",
      "course_info": [
        {
          "class_nbr": 8598,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5269B",
      "subject": "SPIRTHEO",
      "className": "SELECTED TOPICS",
      "course_info": [
        {
          "class_nbr": 8599,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "1023A",
      "subject": "STATS",
      "className": "STATISTICAL CONCEPTS",
      "course_info": [
        {
          "class_nbr": 3291,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "002",
          "ssr_component": "LAB",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of statistical issues aiming towards statistical literacy and appropriate interpretation of statistical information. Common misconceptions will be targeted. Assessment of the validity and treatment of results in popular and scientific media. Conceptual consideration of study design, numerical and graphical data summaries, probability, sampling variability, confidence intervals and hypothesis tests.\n\nAntirequisite(s): Statistical Sciences 2037A/B.\n\nExtra Information: Offered in two formats: 3 lecture hours, or weekly online lectures and 2 in-class lab hours."
    },
    {
      "catalog_nbr": "1023B",
      "subject": "STATS",
      "className": "STATISTICAL CONCEPTS",
      "course_info": [
        {
          "class_nbr": 3816,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH STATS 2037B."
        }
      ],
      "catalog_description": "An examination of statistical issues aiming towards statistical literacy and appropriate interpretation of statistical information. Common misconceptions will be targeted. Assessment of the validity and treatment of results in popular and scientific media. Conceptual consideration of study design, numerical and graphical data summaries, probability, sampling variability, confidence intervals and hypothesis tests.\n\nAntirequisite(s): Statistical Sciences 2037A/B.\n\nExtra Information: Offered in two formats: 3 lecture hours, or weekly online lectures and 2 in-class lab hours."
    },
    {
      "catalog_nbr": "1024A",
      "subject": "STATS",
      "className": "INTRODUCTION TO STATISTICS",
      "course_info": [
        {
          "class_nbr": 1496,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Grade 12U Mathematics or Mathematics 0110A/B or Mathematics 1229A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "TC-141",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Statistical inference, experimental design, sampling design, confidence intervals and hypothesis tests for means and proportions, regression and correlation.\n\nAntirequisite(s): All other courses or half courses in Introductory Statistics, except Statistical Sciences 1023A/B and Statistical Sciences 2037A/B.\n\nExtra Information: Offered in two formats: 3 lecture hours, or weekly online lectures and 2 in-class lab hours (Main); 3 lecture hours (Huron, King's).\n\nNote also that Statistical Sciences 1024A/B cannot be taken concurrently with any Introductory Statistics course. For a full list of Introductory Statistics courses please see: http://www.westerncalendar.uwo.ca/Departments.cfm?DepartmentID=55&SelectedCalendar=Live &ArchiveID=."
    },
    {
      "catalog_nbr": "1024B",
      "subject": "STATS",
      "className": "INTRODUCTION TO STATISTICS",
      "course_info": [
        {
          "class_nbr": 1497,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Grade 12U Mathematics or Mathematics 0110A/B or Mathematics 1229A/B.",
          "end_time": "9:30 AM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Statistical inference, experimental design, sampling design, confidence intervals and hypothesis tests for means and proportions, regression and correlation.\n\nAntirequisite(s): All other courses or half courses in Introductory Statistics, except Statistical Sciences 1023A/B and Statistical Sciences 2037A/B.\n\nExtra Information: Offered in two formats: 3 lecture hours, or weekly online lectures and 2 in-class lab hours (Main); 3 lecture hours (Huron, King's).\n\nNote also that Statistical Sciences 1024A/B cannot be taken concurrently with any Introductory Statistics course. For a full list of Introductory Statistics courses please see: http://www.westerncalendar.uwo.ca/Departments.cfm?DepartmentID=55&SelectedCalendar=Live &ArchiveID=."
    },
    {
      "catalog_nbr": 2035,
      "subject": "STATS",
      "className": "STATISTICS FOR BUS & SOC SCI",
      "course_info": [
        {
          "class_nbr": 1498,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): One full course or equivalent from: Applied Mathematics 1201A/B, Applied Mathematics 1413, Statistical Sciences 1024A/B, Calculus 1000A/B or Calculus 1500A/B, Calculus 1301A/B or Calculus 1501A/B, Mathematics 1600A/B, Mathematics 1225A/B, Mathematics 1228A/B, Mathematics 1229A/B, Mathematics 1230A/B.",
          "end_time": "10:30 AM",
          "campus": "Main",
          "facility_ID": "SEB-1059",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Descriptive statistics and graphs, probability and distributions. Sampling, hypothesis testing, and confidence intervals. Experimental design and analysis of variance. Regression and correlation, including multiple regression. Applications emphasized. This course cannot be taken for credit in any module in Data Science, Statistics, Actuarial Science, or Financial Modelling, other than the Minor in Applied Statistics.\n\nAntirequisite(s): All other courses in Introductory Statistics (except Statistical Sciences 1023A/B and Statistical Sciences 1024A/B): Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Geography 2210A/B, Health Sciences 3801A/B,MOS 2242A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2141A/B, Statistical Sciences 2143A/B, Statistical Sciences 2244A/B, Statistical Sciences 2858A/B, Statistical Sciences 2037A/B if taken prior to Fall 2010, former Psychology 2885 (Brescia), former Statistical Sciences 2122A/B, former Social Work 2205.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "2037A",
      "subject": "STATS",
      "className": "STATISTICS FOR HEALTH",
      "course_info": [
        {
          "class_nbr": 3820,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-2050",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "002",
          "ssr_component": "TUT",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of statistical issues aiming towards statistical literacy and appropriate interpretation of statistical information. Common misconceptions will be targeted. Assessment of the validity and treatment of results in popular and scientific media. Conceptual consideration of study design, numerical and graphical data summaries, probability, sampling variability, confidence intervals and hypothesis tests. Emphasis will be placed on health-related applications.\n\nAntirequisite(s) at Main campus: Statistical Sciences 1023A/B.\nAntirequisite(s) at Huron: All other courses or half courses in Introductory Statistics.\n\nExtra Information: Offered in two formats: 3 lecture hours, or weekly online lectures and 2 in-class lab hours (Main); 3 lecture hours (Huron). \nNote at Main campus: Cannot be taken for credit by students registered in the Faculty of Science and Schulich School of Medicine and Dentistry with the exception of students in Food and Nutrition."
    },
    {
      "catalog_nbr": "2037B",
      "subject": "STATS",
      "className": "STATISTICS FOR HEALTH",
      "course_info": [
        {
          "class_nbr": 6301,
          "start_time": "3:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH STATS 1023B."
        }
      ],
      "catalog_description": "An examination of statistical issues aiming towards statistical literacy and appropriate interpretation of statistical information. Common misconceptions will be targeted. Assessment of the validity and treatment of results in popular and scientific media. Conceptual consideration of study design, numerical and graphical data summaries, probability, sampling variability, confidence intervals and hypothesis tests. Emphasis will be placed on health-related applications.\n\nAntirequisite(s) at Main campus: Statistical Sciences 1023A/B.\nAntirequisite(s) at Huron: All other courses or half courses in Introductory Statistics.\n\nExtra Information: Offered in two formats: 3 lecture hours, or weekly online lectures and 2 in-class lab hours (Main); 3 lecture hours (Huron). \nNote at Main campus: Cannot be taken for credit by students registered in the Faculty of Science and Schulich School of Medicine and Dentistry with the exception of students in Food and Nutrition."
    },
    {
      "catalog_nbr": "2141A",
      "subject": "STATS",
      "className": "APPL PROB & STATS FOR ENGINEER",
      "course_info": [
        {
          "class_nbr": 2646,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1413, or 0.5 course from Calculus 1000A/B, or Calculus 1500A/B plus 0.5 course from either Calculus 1301A/B or Calculus 1501A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO ELECTRICAL, COMPUTER, SOFTWARE AND CIVIL ENGINEERING STUDENTS, SCIENCE STUDENTS, CONCURRENT BUSINESS STUDENTS, AND SCHOLARS ELECTIVES."
        }
      ],
      "catalog_description": "An introduction to statistics with emphasis on the applied probability models used in Electrical and Civil Engineering and elsewhere. Topics covered include samples, probability, probability distributions, estimation (including comparison of means), correlation and regression. This course cannot be taken for credit in any module in Data Science, Statistics, Actuarial Science, or Financial Modelling, other than the Minor in Applied Statistics or the Minor in Applied Financial Modeling.\n\nAntirequisite(s): All other courses in Introductory Statistics (except Statistical Sciences 1023A/B, Statistical Sciences 1024A/B): Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Geography 2210A/B, Health Sciences 3801A/B,MOS 2242A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2035, Statistical Sciences 2143A/B, Statistical Sciences 2244A/B, Statistical Sciences 2858A/B, Statistical Sciences 2037A/B if taken prior to Fall 2010.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2143B",
      "subject": "STATS",
      "className": "APP STATS & DATA ANLYSIS - ENG",
      "course_info": [
        {
          "class_nbr": 1793,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Applied Mathematics 1413, or 0.5 course from Calculus 1000A/B, or Calculus 1500A/B plus 0.5 course from either Calculus 1301A/B or Calculus 1501A/B.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "NSC-1",
          "days": [
            "M",
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO CHEMICAL, GREEN PROCESS, MECHANICAL, MECHATRONICS, INTEGRATED, COMPUTER AND CIVIL ENGINEERING STUDENTS, SCIENCE STUDENTS AND SCHOLARS ELECTIVES."
        }
      ],
      "catalog_description": "A data-driven introduction to statistics intended primarily for students in Chemical and Mechanical Engineering. Exploratory data analysis, probability, the Binomial, Poisson, Normal, Chi-Square and F distributions. Estimation, correlation and regression (model building and parameter estimation), analysis of variance, design of experiments. This course cannot be taken for credit in any module in Data Science, Statistics, Actuarial Science, or Financial Modelling, other than the Minor in Applied Statistics or the Minor in Applied Financial Modeling.\n\nAntirequisite(s): All other courses in Introductory Statistics (except Statistical Sciences 1023A/B, Statistical Sciences 1024A/B): Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Geography 2210A/B, Health Sciences 3801A/B,MOS 2242A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2244A/B, Statistical Sciences 2858A/B, Statistical Sciences 2037A/B if taken prior to Fall 2010.\n\nExtra Information: 3 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "2244A",
      "subject": "STATS",
      "className": "STATISTICS FOR SCIENCE",
      "course_info": [
        {
          "class_nbr": 3119,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): A full mathematics course, or equivalent, numbered 1000 or above. Statistical Sciences 1024A/B can be used to meet 0.5 of the 1.0 mathematics course requirement.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "MC-110",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "An introductory course in the application of statistical methods, intended for honours students in departments other than Statistical and Actuarial Sciences, Applied Mathematics, Mathematics, or students in the Faculty of Engineering. Topics include sampling, confidence intervals, analysis of variance, regression and correlation. Cannot be taken for credit in any module in Data Science, Statistics, Actuarial Science, or Financial Modelling other than the Minor in Applied Statistics.\n\nAntirequisite(s): All other courses in Introductory Statistics (except Statistical Sciences 1023A/B, Statistical Sciences 1024A/B): Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Geography 2210A/B, Health Sciences 3801A/B,MOS 2242A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2143A/B, Statistical Sciences 2858A/B, Statistical Sciences 2037A/B if taken prior to Fall 2010, former Psychology 2885 (Brescia), former Statistical Sciences 2122A/B, former Social Work 2205.\n\nExtra Information: 2 lecture hours, 3 lab hours."
    },
    {
      "catalog_nbr": "2244B",
      "subject": "STATS",
      "className": "STATISTICS FOR SCIENCE",
      "course_info": [
        {
          "class_nbr": 3133,
          "start_time": "12:30 PM",
          "descrlong": "Prerequisite(s): A full mathematics course, or equivalent, numbered 1000 or above. Statistical Sciences 1024A/B can be used to meet 0.5 of the 1.0 mathematics course requirement.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "WSC-55",
          "days": [
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
      "catalog_description": "An introductory course in the application of statistical methods, intended for honours students in departments other than Statistical and Actuarial Sciences, Applied Mathematics, Mathematics, or students in the Faculty of Engineering. Topics include sampling, confidence intervals, analysis of variance, regression and correlation. Cannot be taken for credit in any module in Data Science, Statistics, Actuarial Science, or Financial Modelling other than the Minor in Applied Statistics.\n\nAntirequisite(s): All other courses in Introductory Statistics (except Statistical Sciences 1023A/B, Statistical Sciences 1024A/B): Biology 2244A/B, Economics 2122A/B, Economics 2222A/B, Geography 2210A/B, Health Sciences 3801A/B,MOS 2242A/B, Psychology 2810, Psychology 2820E, Psychology 2830A/B, Psychology 2850A/B, Psychology 2851A/B, Social Work 2207A/B, Sociology 2205A/B, Statistical Sciences 2035, Statistical Sciences 2141A/B, Statistical Sciences 2143A/B, Statistical Sciences 2858A/B, Statistical Sciences 2037A/B if taken prior to Fall 2010, former Psychology 2885 (Brescia), former Statistical Sciences 2122A/B, former Social Work 2205.\n\nExtra Information: 2 lecture hours, 3 lab hours."
    },
    {
      "catalog_nbr": 1601,
      "subject": "SA",
      "className": "FOUNDATIONS OF VISUAL ARTS",
      "course_info": [
        {
          "class_nbr": 9911,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "MC-110",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A studio course designed to introduce students to techniques and processes of two-dimensional and three-dimensional media; the theoretical concepts which inform and direct studio practice will be emphasized.\n\nAntirequisite(s): Studio Art 1605, the former VAS 1020, the former VAS 1025.\n\nExtra Information: 1 lecture hour and 3 studio lab hours. \n\nNote: No Visual Arts portfolio required. Some sessions may involve drawing from the nude (female or male) as a required component of the course. For Studio Art 1601 and Studio Art 1605 only, students may request an alternate component."
    },
    {
      "catalog_nbr": 1605,
      "subject": "SA",
      "className": "ADV VIS ARTS FOUNDATN STUDIO",
      "course_info": [
        {
          "class_nbr": 9920,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Submission and acceptance of a prepared Visual Arts portfolio.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-302",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "This course is designed to develop foundational technical and conceptual skills for students with prior experience working with visual art media. Focus will be placed on the techniques and processes of two-dimensional and three-dimensional media with an emphasis on the theoretical concepts that inform and direct contemporary studio practices. \n\nAntirequisite(s): Studio Art 1601, the former VAS 1020, the former VAS 1025.\n\nExtra Information: 6 studio hours.\n\nNote: Some sessions may involve drawing from the nude (female or male) as an integral component of the course. For Studio Art 1601 and Studio Art 1605 only, students may request an alternate component."
    },
    {
      "catalog_nbr": "2504Y",
      "subject": "SA",
      "className": "ART NOW!",
      "course_info": [
        {
          "class_nbr": 9922,
          "start_time": "7:00 PM",
          "descrlong": "Prerequisite(s): 1.0 first-year course from Arts and Humanities or Social Science, or permission of the Department.",
          "end_time": "10:00 PM",
          "campus": "Main",
          "facility_ID": "NCB-117",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "THIS 0.5 HALF COURSE MEETS BI-WEEKLY THROUGH FALL AND WINTER TERMS."
        }
      ],
      "catalog_description": "An introduction to contemporary artistic production and practice, featuring dialogues with artists on their work and critics on the criticism of contemporary art. The course emphasizes recent art movements and tendencies while featuring presentations by national and international artists and scholars. The course will also focus on developing critical writing skills and vocabulary. \n\nAntirequisite(s): the former VAS 2276Y."
    },
    {
      "catalog_nbr": "2602A",
      "subject": "SA",
      "className": "STUDIO SEMINAR I",
      "course_info": [
        {
          "class_nbr": 9923,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Registration in years 2-4 of the Honours Specialization in Studio Arts module, or permission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-249",
          "days": [
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO YRS 2&3 OF THE HONS SPECIALIZATION IN STUDIO ARTS, OR PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "A studio/theory seminar required for students in the second year of the Honours Specialization in Studio Arts. As a forum for engagement with methods and practices of professional artists it will help students prepare a portfolio review for the completion of the requirements of the BFA module. \n\nAntirequisite(s): the former VAS 2282A/B\n\nExtra Information: 4 hours per week."
    },
    {
      "catalog_nbr": "2610A",
      "subject": "SA",
      "className": "INTRODUCTION TO DRAWING",
      "course_info": [
        {
          "class_nbr": 9924,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Studio Art 1601 or Studio Art 1605, or the former VAS 1020 or the former VAS 1025, or permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-206",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "Introduction to drawing as an independent practice, and as a tool for conceptual, perceptual, and technical problem solving.\n\nAntirequisite(s): Studio Art 2510A/B, Studio Art 2621, the former VAS 2104A/B, the former VAS 2200, the former VAS 2204A/B, the former VAS 2210, the former VAS 2214A/B. \n\nExtra Information: 6 studio hours.\n\nNote: Some sessions may involve drawing from the nude (female or male) as a required component of the course.\nPriority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "2610B",
      "subject": "SA",
      "className": "INTRODUCTION TO DRAWING",
      "course_info": [
        {
          "class_nbr": 11562,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Studio Art 1601 or Studio Art 1605, or the former VAS 1020 or the former VAS 1025, or permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-206",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Introduction to drawing as an independent practice, and as a tool for conceptual, perceptual, and technical problem solving.\n\nAntirequisite(s): Studio Art 2510A/B, Studio Art 2621, the former VAS 2104A/B, the former VAS 2200, the former VAS 2204A/B, the former VAS 2210, the former VAS 2214A/B. \n\nExtra Information: 6 studio hours.\n\nNote: Some sessions may involve drawing from the nude (female or male) as a required component of the course.\nPriority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "2620A",
      "subject": "SA",
      "className": "INTRODUCTION TO PAINTING",
      "course_info": [
        {
          "class_nbr": 11589,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Studio Art 1601 or Studio Art 1605, or the former VAS 1020 or the former VAS 1025, or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-230",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Introduction to painting practice, with a focus on developing critical understandings in concert with techniques. Projects address theoretical, historical, and contemporary approaches to painting, and integrate these with studio practice.\n\nAntirequisite(s): Studio Art 2621, the former VAS 2210, the former VAS 2216A/B.\n\nExtra Information: 6 studio hours.\n\nNote: Some sessions may involve drawing from the nude (female or male) as a required component of the course. Priority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "2620B",
      "subject": "SA",
      "className": "INTRODUCTION TO PAINTING",
      "course_info": [
        {
          "class_nbr": 9925,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Studio Art 1601 or Studio Art 1605, or the former VAS 1020 or the former VAS 1025, or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-230",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "Introduction to painting practice, with a focus on developing critical understandings in concert with techniques. Projects address theoretical, historical, and contemporary approaches to painting, and integrate these with studio practice.\n\nAntirequisite(s): Studio Art 2621, the former VAS 2210, the former VAS 2216A/B.\n\nExtra Information: 6 studio hours.\n\nNote: Some sessions may involve drawing from the nude (female or male) as a required component of the course. Priority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "2630A",
      "subject": "SA",
      "className": "INTRODUCTION TO PRINT MEDIA",
      "course_info": [
        {
          "class_nbr": 9926,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Studio Art 1601 or Studio Art 1605, or the former VAS 1020 or the former VAS 1025, or permission of the Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "VAC-106",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "An introduction to print media practices including relief, intaglio, and silkscreen. \n\nAntirequisite(s): the former VAS 2236A/B.\n\nExtra Information: 6 studio hours.\nPriority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "2630B",
      "subject": "SA",
      "className": "INTRODUCTION TO PRINT MEDIA",
      "course_info": [
        {
          "class_nbr": 9927,
          "start_time": "8:30 AM",
          "descrlong": "PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "VAC-106",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full"
        }
      ],
      "catalog_description": "An introduction to print media practices including relief, intaglio, and silkscreen. \n\nAntirequisite(s): the former VAS 2236A/B.\n\nExtra Information: 6 studio hours.\nPriority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "2652A",
      "subject": "SA",
      "className": "INTRO TO DIGITAL PHOTOGRAPHY",
      "course_info": [
        {
          "class_nbr": 9930,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Studio Art 1601 or Studio Art 1605, or the former VAS 1020 or the former VAS 1025, or permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-134",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT. ALSO HELD IN VAC 135."
        }
      ],
      "catalog_description": "A comprehensive examination of digital photographic techniques and production, including an overview of the digital still camera, image processing, digital output and the use of related software applications. The course also traces the evolution of digital imaging, examining its historical foundations and the theoretical debates that have informed its status. \n\nAntirequisite(s): the former VAS 2246A/B.\n\nExtra Information: 6 studio hours.\nPriority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "2652B",
      "subject": "SA",
      "className": "INTRO TO DIGITAL PHOTOGRAPHY",
      "course_info": [
        {
          "class_nbr": 9929,
          "start_time": "",
          "descrlong": "Prerequisite(s): Studio Art 1601 or Studio Art 1605, or the former VAS 1020 or the former VAS 1025, or permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 650,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "ONLINE COURSE. PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "A comprehensive examination of digital photographic techniques and production, including an overview of the digital still camera, image processing, digital output and the use of related software applications. The course also traces the evolution of digital imaging, examining its historical foundations and the theoretical debates that have informed its status. \n\nAntirequisite(s): the former VAS 2246A/B.\n\nExtra Information: 6 studio hours.\nPriority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "2660B",
      "subject": "SA",
      "className": "SOUND AND PERFORMANCE",
      "course_info": [
        {
          "class_nbr": 10442,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Studio Art 1601 or Studio Art 1605, or the former VAS 1020 or the former VAS 1025, or permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-134",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT. ALSO HELD IN VAC 135."
        }
      ],
      "catalog_description": "A studio course introducing the basic technical foundations of contemporary media art production, including digital image, video, DIY electronics, documentation, and online platforms. This lecture/studio course also locates contemporary digital practices within the broader history of cultural production, tracing developments in technology and media arts.\n\nAntirequisite(s): Studio Art 2663, the former VAS 2250, the former VAS 2254A/B.\n\nExtra Information: 3 studio hours.\nPriority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "2662A",
      "subject": "SA",
      "className": "VIDEO AND ANIMATION",
      "course_info": [
        {
          "class_nbr": 10443,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Studio Art 1601 or Studio Art 1605, or the former VAS 1020 or the former VAS 1025, or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-134",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT. ALSO HELD IN VAC 135."
        }
      ],
      "catalog_description": "A studio course introducing the basic technical foundations of contemporary media art production, including video, animation, web design and online platforms. This lecture/studio course also locates contemporary digital practices within the broader history of cultural production, tracing developments in technology and media arts. \n\nAntirequisite(s): Studio Art 2663, the former VAS 2250, the former VAS 2252A/B. \n\nExtra Information: 3 studio hours. \nPriority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "3602B",
      "subject": "SA",
      "className": "STUDIO SEMINAR II",
      "course_info": [
        {
          "class_nbr": 9932,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Studio Art 2602A/B/Y or the former VAS 2282A/B, and registration in the Honours Specialization in Studio Arts module, or permission of the Department.",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-249",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO YRS 2,3 & 4 HONS SPECIALIZATION IN STUDIO ARTS, OR PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "A studio/theory seminar required for students in the third year of the Honours Specialization in Studio Arts. As a forum for engagement with methods and practices of professional artists it will help students prepare for the portfolio review required for entry into SA 4605 Practicum. \n\nAntirequisite(s): the former VAS 3382A/B.\n\nExtra Information: 4 seminar/studio hours."
    },
    {
      "catalog_nbr": 3611,
      "subject": "SA",
      "className": "DRAWING",
      "course_info": [
        {
          "class_nbr": 11282,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Studio Art 2610A/B or the former VAS 2200, the former VAS 2210, the former VAS 2204A/B, or permission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-206",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Continuation of drawing as perceptual, technical, conceptual and critical problem solving and as a basis for exploration with other media and disciplines.\n\nAntirequisite(s): the former VAS 3300.\n\nExtra Information: 4 studio hours.\nNote: Some sessions may involve drawing from the nude (female or male) as a required component of the course. Priority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": 3623,
      "subject": "SA",
      "className": "PAINTING",
      "course_info": [
        {
          "class_nbr": 9933,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): Studio Art 2620A/B, Studio Art 2621, or the former VAS 2210, the former VAS 2216A/B, or permission of the Department.",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-230",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "A continuation of the study of painting. \n\nAntirequisite(s): the former VAS 3310.\n\nExtra Information: 4 studio hours.\nNote: Some sessions may involve drawing from the nude (female or male) as a required component of the course. Priority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": 3633,
      "subject": "SA",
      "className": "PRINT MEDIA",
      "course_info": [
        {
          "class_nbr": 9934,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Studio Art 2630A/B, or the former VAS 2236A/B, or permission of the Department.",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-106",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT."
        }
      ],
      "catalog_description": "A continuation of the study of print media. \n\nAntirequisite(s): Studio Art 3630A/B, Studio Art 3632A/B, the former VAS 3330. \n\nExtra Information: 4 studio hours.\nPriority will be given to students registered in the Visual Arts program."
    },
    {
      "catalog_nbr": 3653,
      "subject": "SA",
      "className": "PHOTOGRAPHY",
      "course_info": [
        {
          "class_nbr": 9935,
          "start_time": "11:30 AM",
          "descrlong": "Prerequisite(s): Studio Art 2650A/B, Studio Art 2652A/B, or the former VAS 2240, the former VAS 2244A/B, the former VAS 2246A/B, or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-134",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 200,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT. BLENDED COURSE: BOTH ONLINE AND IN PERSON INSTRUCTION. ALSO HELD IN VAC 135."
        }
      ],
      "catalog_description": "A continuation of the study of photography. \n\nAntirequisite(s): Studio Art 3650A/B, Studio Art 3652A/B, the former VAS 3340, the former VAS 3341A/B, the former VAS 3342A/B. \n\nExtra Information: 4 seminar/studio hours.\nPriority will be given to students registered in a Visual Arts program."
    },
    {
      "catalog_nbr": "3660A",
      "subject": "SA",
      "className": "TIME-BASED MEDIA ART: SOUND",
      "course_info": [
        {
          "class_nbr": 10444,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Studio Art 2660A/B, Studio Art 2663, or the former VAS 2250, the former VAS 2252A/B, or permission of the Department.",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-134",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT. ALSO HELD IN VAC 135."
        }
      ],
      "catalog_description": "A Studio/Theory course focusing upon digital audio production offering experience in multi- track recording, signal processing, sound synthesis and advanced studio techniques. Creative explorations may include the production of acoustic mediascapes, electronic communication as well as sound relative to video assembly. This course examines the historical evolution of sound.\n\nAntirequisite(s): Studio Art 3663, the former VAS 3350, the former VAS 3356A/B. \n \nExtra Information: 4 studio hours.\nPriority will be given to students registered in the Visual Arts program."
    },
    {
      "catalog_nbr": "3662B",
      "subject": "SA",
      "className": "TIME-BASED MEDIA ART: VIDEO",
      "course_info": [
        {
          "class_nbr": 10445,
          "start_time": "2:30 PM",
          "descrlong": "Prerequisite(s): Studio Art 2662A/B, Studio Art 2663, or the former VAS 2250, the former VAS 2254A/B, or permission of the Department.",
          "end_time": "6:30 PM",
          "campus": "Main",
          "facility_ID": "VAC-134",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PRIORITY TO STUDENTS REGISTERED IN HONS SPECIALIZATION IN STUDIO ARTS, OR MAJOR OR HONS SPECIALIZATION IN ART HISTORY AND STUDIO ART, OR SPECIALIZATION VISUAL ARTS, OR PERMISSION OF THE DEPARTMENT. ALSO HELD IN VAC 135."
        }
      ],
      "catalog_description": "A Studio/Theory course focusing upon digital video production offering experience in the areas of camerawork, lighting, sound and advanced video editing techniques. Creative explorations include single-channel work, video installation, multiscreen video as well as on-line production and interactivity. This course will also examine the historical evolution of the moving image.\n\nAntirequisite(s): Studio Art 3663, the former VAS 3350, the former VAS 3356A/B.\n\nExtra Information: 4 studio hours.\nPriority will be given to students registered in the Visual Arts program."
    },
    {
      "catalog_nbr": 4603,
      "subject": "SA",
      "className": "EXPERIENTIAL LEARNING",
      "course_info": [
        {
          "class_nbr": 11327,
          "start_time": "",
          "descrlong": "Prerequisite(s): Minimum 1.5 3000-level studio courses, plus Studio Art 2602A/B/Y, Studio Art 3602A/B/Y, or the former VAS 2282A/B and the former VAS 3382A/B. Acceptance into SA 4605, or permission of Department.\n\nCorequisite(s): Studio Art 4605.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PORTFOLIO REVIEW AND PERMISSION OF THE DEPARTMENT. HELD IN VAC 300."
        }
      ],
      "catalog_description": "The course offers BFA students the opportunity for studio visits of established artists, field trips to galleries in and outside London, the coordinating and organizing of exhibitions, artists' talks, high school presentations, etc. It is specifically intended to round out the in-studio practice taught in SA 4605."
    },
    {
      "catalog_nbr": 4605,
      "subject": "SA",
      "className": "PRACTICUM",
      "course_info": [
        {
          "class_nbr": 9937,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): Minimum 1.5 3000-level studio courses, plus Studio Art 2602A/B/Y, Studio Art 3602A/B/Y, or the former VAS 2282A/B and the former VAS 3382A/B. Submission and Acceptance of a prepared Visual Arts portfolio, and permission of Department.",
          "end_time": "11:30 AM",
          "campus": "Main",
          "facility_ID": "VAC-148",
          "days": [
            "W",
            "F"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "PORTFOLIO REVIEW AND PERMISSION OF THE DEPARTMENT. ALSO HELD IN VAC 300."
        }
      ],
      "catalog_description": "An intensive studio course encouraging the development of a mature and ongoing professional art practice. Seminars and critiques will complement the art production, writing assignments and artist’s dossier. Dedicated studio spaces, a supervised trip to an art centre, and the organization of a professional exhibition will enhance these goals.\n\nAntirequisite(s): Studio Art 4601, the former VAS 4430, the former VAS 4448.\n \nExtra Information: 6 studio hours. \nNote: Students must have a minimum 70% overall average and no Studio Art grade less than 60%."
    },
    {
      "catalog_nbr": "4630A",
      "subject": "SA",
      "className": "INDE PROJECT PRINT MEDIA I",
      "course_info": [
        {
          "class_nbr": 11747,
          "start_time": "",
          "descrlong": "Prerequisite(s): Studio Art 3630A/B, Studio Art 3632A/B, or Studio Art 3633, plus a detailed plan of study accepted by the Undergraduate Chair and the supervising course instructor.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "A studio/theory course focusing on the development of a comprehensive individual program of research and art production relating to Print Media.\n\nExtra Information: 4 studio hours. Course meets alongside third-year Print Media."
    },
    {
      "catalog_nbr": "4682A",
      "subject": "SA",
      "className": "INTERNSHIP IN STUDIO ART",
      "course_info": [
        {
          "class_nbr": 11616,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Third or fourth-year honours students with a departmental average of at least 75% have the opportunity for experiential learning in the field of Studio Arts. Students will work closely with an artist and the Undergraduate Chair of the Department of Visual Arts on a visual cultural project at a studio, gallery, or other location in London's region."
    },
    {
      "catalog_nbr": "4682B",
      "subject": "SA",
      "className": "INTERNSHIP IN STUDIO ART",
      "course_info": [
        {
          "class_nbr": 11617,
          "start_time": "",
          "descrlong": "Prerequisite(s): Permission of the Department.",
          "end_time": "",
          "campus": "Main",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Third or fourth-year honours students with a departmental average of at least 75% have the opportunity for experiential learning in the field of Studio Arts. Students will work closely with an artist and the Undergraduate Chair of the Department of Visual Arts on a visual cultural project at a studio, gallery, or other location in London's region."
    },
    {
      "catalog_nbr": "5103A",
      "subject": "SYSTHEO",
      "className": "INTRO TO SYST THEOLOGY",
      "course_info": [
        {
          "class_nbr": 8049,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-W17",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY STUDENTS AT HURON. BACHELOR'S STUDENTS TAKE THEO STUD 2207F. HELD IN HC V207."
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "5111A",
      "subject": "SYSTHEO",
      "className": "FUNDAMENTAL THEOLOGY",
      "course_info": [
        {
          "class_nbr": 8619,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5112B",
      "subject": "SYSTHEO",
      "className": "CHRISTOLOGY AND SOTERIOLOGY",
      "course_info": [
        {
          "class_nbr": 8608,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5113A",
      "subject": "SYSTHEO",
      "className": "THEOLOGICAL ANTHROPOLOGY",
      "course_info": [
        {
          "class_nbr": 8491,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5206B",
      "subject": "SYSTHEO",
      "className": "CHRIST, SALVATION, & TRINITY",
      "course_info": [
        {
          "class_nbr": 9461,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite: Systematic Theology 5103A/B",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W104",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5208A",
      "subject": "SYSTHEO",
      "className": "KEY ISSUES IN ISLAMIC THEOLOGY",
      "course_info": [
        {
          "class_nbr": 9559,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): Any university level course in Islamic Studies.",
          "end_time": "7:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W4",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A study of the major theological issues addressed by traditional and modern Muslim theologians, such as the attributes of God, revelation, human freedom and responsibility, suffering and religious pluralism. \n\nAntirequisite(s): RS 3110.\n \nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "5211A",
      "subject": "SYSTHEO",
      "className": "ECUMENISM",
      "course_info": [
        {
          "class_nbr": 9035,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An introduction to the history and theology of the ecumenical movement. Reference will be made to the teaching of the Magisterium, significant achievements in ecumenical dialogue, and prospects for future achievements. Exposure to the rich variety of Christian ecclesial communities and traditions will be included.\n\nAntirequisite(s): the former Systematic Theology 5511A/B.\n\nExtra Information: 2 hours."
    },
    {
      "catalog_nbr": "5212B",
      "subject": "SYSTHEO",
      "className": "DOCTRINE OF GOD",
      "course_info": [
        {
          "class_nbr": 11135,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5219A",
      "subject": "SYSTHEO",
      "className": "SELECTED TOPICS",
      "course_info": [
        {
          "class_nbr": 8492,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5219B",
      "subject": "SYSTHEO",
      "className": "SELECTED TOPICS",
      "course_info": [
        {
          "class_nbr": 8493,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5232A",
      "subject": "SYSTHEO",
      "className": "SPECIAL TOPICS",
      "course_info": [
        {
          "class_nbr": 9992,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5252B",
      "subject": "SYSTHEO",
      "className": "TRINITARIAN THEOLOGY",
      "course_info": [
        {
          "class_nbr": 10970,
          "start_time": "5:30 PM",
          "descrlong": "Prerequisite: Systematic Theology 5103A/B",
          "end_time": "8:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W104",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "5411B",
      "subject": "SYSTHEO",
      "className": "ECCLESIOLOGY AND MARIOLOGY",
      "course_info": [
        {
          "class_nbr": 9013,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "2201F",
      "subject": "THEATRE",
      "className": "UNDERSTANDING PERFORMANCE",
      "course_info": [
        {
          "class_nbr": 9771,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): At least 60% in 1.0 of any 1000-level or above “E” or combination of two 1000- level or above “F/G” courses from any department in the following Faculties: Arts and Humanities, School of Humanities (Brescia), Information and Media Studies (FIMS), or Music; or from any of the following additional Departments: Anthropology, English (King’s), English and Cultural Studies (Huron), History (Main and Affiliates), Philosophy (Affiliates), Political Science (Main and Affiliates), the Religious Studies (Affiliates), or permission of the Department.",
          "end_time": "12:30 PM",
          "campus": "Main",
          "facility_ID": "UC-3220",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will equip students with the primary tools necessary to conduct basic performance analysis. From costumes to lighting and sound effects to textual alterations, students will learn to analyze a production while exploring the social, political, and aesthetic meanings of the required texts. \n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2202G",
      "subject": "THEATRE",
      "className": "PERFORMANCE BEYOND THEATRES",
      "course_info": [
        {
          "class_nbr": 9772,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): At least 60% in 1.0 of any 1000-level or above “E” or combination of two 1000- level or above “F/G” courses from any department in the following Faculties: Arts and Humanities, School of Humanities (Brescia), Information and Media Studies (FIMS), or Music; or from any of the following additional Departments: Anthropology, English (King’s), English and Cultural Studies (Huron), History (Main and Affiliates), Philosophy (Affiliates), Political Science (Main and Affiliates), the Religious Studies (Affiliates), or permission of the Department.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Students will examine forms of contemporary performance that are less conventional and/or challenge conventional assumptions. This course will explore the performance of everyday life, contemporary avant-garde, site specific, and environmental theatre.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "2205G",
      "subject": "THEATRE",
      "className": "THE MODERN CONTEXT",
      "course_info": [
        {
          "class_nbr": 9774,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): At least 60% in 1.0 of any 1000-level or above “E” or combination of two 1000- level or above “F/G” courses from any department in the following Faculties: Arts and Humanities, School of Humanities (Brescia), Information and Media Studies (FIMS), or Music; or from any of the following additional Departments: Anthropology, English (King’s), English and Cultural Studies (Huron), History (Main and Affiliates), Philosophy (Affiliates), Political Science (Main and Affiliates), the Religious Studies (Affiliates), or permission of the Department.",
          "end_time": "2:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1B06",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course traces developments in playwriting, acting, and playhouse design from the Restoration to the present day. This introductory course will explore the theatrical innovations and political interventions of the work of such dramatists as Aphra Behn, George Lillo, Ibsen, Brecht, Pinter, Caryl Churchill, and Sarah Kane.\n\nAntirequisite(s): Theatre Studies 2203E.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3205F",
      "subject": "THEATRE",
      "className": "HISTORY OF PERFORMANCE THEORY",
      "course_info": [
        {
          "class_nbr": 9773,
          "start_time": "3:30 PM",
          "descrlong": "Prerequisite(s): At least 60% in 1.0 of any 1000-level or above “E” or combination of two 1000- level or above “F/G” courses from any department in the following Faculties: Arts and Humanities, School of Humanities (Brescia), Information and Media Studies (FIMS), or Music; or from any of the following additional Departments: Anthropology, English (King’s), English and Cultural Studies (Huron), History (Main and Affiliates), Philosophy (Affiliates), Political Science (Main and Affiliates), the Religious Studies (Affiliates), or permission of the Department.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course introduces students to major statements and treatises about theatre and performance from Plato and Aristotle to anti-theatrical positions of the Renaissance and late-nineteenth and twentieth-century thinkers such as Nietzsche, Stanislavski, Artaud, Brecht, and Brook. Students will also apply theories of practice to specific dramatic texts.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3581F",
      "subject": "THEATRE",
      "className": "TORONTO: CULTURE & PERFORMANCE",
      "course_info": [
        {
          "class_nbr": 6858,
          "start_time": "5:30 PM",
          "descrlong": "Prerequisite(s): At least 60% in 1.0 of English 1020E or English 1022E or English 1024E or English 1035E or English 1036E or English 1042E or both of English 1027F/G and English 1028F/G, or permission of the Department.",
          "end_time": "8:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "CROSS-LISTED WITH ENGLISH 3581F AND ARTS & HUMANITIES 3390F."
        }
      ],
      "catalog_description": "We will explore a range of recent work produced on Toronto’s stages, the contexts in which that work is made, and its reception by reviewers, bloggers, and others. Students will read six to eight plays along with contextual material, and see at least two live performances in Toronto.\n\nAntirequisite(s): English 3581F/G.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "3900G",
      "subject": "THEATRE",
      "className": "DESTINATION THEATRE",
      "course_info": [
        {
          "class_nbr": 5450,
          "start_time": "7:00 PM",
          "descrlong": "Prerequisite(s): At least 60% in 1.0 of any 1000-level or above “E” or combination of two 1000- level or above “F/G” courses from any department in the following Faculties: Arts and Humanities, School of Humanities (Brescia), Information and Media Studies (FIMS), or Music; or from any of the following additional Departments: Anthropology, English (King’s), English and Cultural Studies (Huron), History (Main and Affiliates), Philosophy (Affiliates), Political Science (Main and Affiliates), the Religious Studies (Affiliates), or permission of the Department.",
          "end_time": "9:00 PM",
          "campus": "Main",
          "facility_ID": "UC-1110",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course provides students with the opportunity to develop their drama education more deeply through the experience of theatre abroad, in cities such as New York and London, England. Students' attendance at live performance will be complemented with daily lectures, and tours of theatres, archives, and relevant historical sites.\n\nExtra Information: Experiential learning; part of the course is in a classroom setting; the other part is a trip (e.g. to London or New York) during Intersession.\nNote: Application required. See Department website for details."
    },
    {
      "catalog_nbr": "5190B",
      "subject": "THEOETH",
      "className": "ISLAMIC LAW & LEGAL THEORY",
      "course_info": [
        {
          "class_nbr": 9561,
          "start_time": "4:30 PM",
          "descrlong": "Prerequisite(s): Any university-level course in Islamic Studies.",
          "end_time": "7:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W104",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A study of the history, practice and principles of Islamic law as understood by the major schools, with a focus on their ethical and theological foundations and their adaptations to changing times. \n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "5203B",
      "subject": "THEOETH",
      "className": "THEO ETHICS",
      "course_info": [
        {
          "class_nbr": 8156,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W102",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "RESTRICTED TO THEOLOGY MASTERS STUDENTS AT HURON."
        }
      ],
      "catalog_description": " "
    },
    {
      "catalog_nbr": "5213A",
      "subject": "THEOETH",
      "className": "ISLAMIC ETHICS",
      "course_info": [
        {
          "class_nbr": 9560,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-V207",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "An examination of principled reasoning in classical Islamic jurisprudence, the theological status of reason in Islam, the principles and priorities of traditional ethical reasoning, the arguments for a goal-oriented approach to ethics, the contemporary emphasis on the context of the ethicist and the construction of religious authority, and the importance of individual moral formation.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": 5299,
      "subject": "THESIS",
      "className": "THEOLOGICAL STUDIES THESIS",
      "course_info": [
        {
          "class_nbr": 8542,
          "start_time": "",
          "descrlong": "",
          "end_time": "",
          "campus": "Kings",
          "facility_ID": "",
          "days": [],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": ""
    },
    {
      "catalog_nbr": "2001F",
      "subject": "TJ",
      "className": "PROBLEMS IN TRANSITIONAL JST",
      "course_info": [
        {
          "class_nbr": 3484,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3014",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH POLI SCI 2203F."
        }
      ],
      "catalog_description": "This course introduces students to interdisciplinary studies of transitional justice and post-conflict reconstruction, with emphasis on questions of conflict. Students will examine key concepts and explore theoretical problems in confronting and seeking solutions to the aftermath of large-scale events of social violence, including war, genocide, and authoritarian rule.\n\nAntirequisite(s): Political Science 2203F/G.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "3001G",
      "subject": "TJ",
      "className": "STUDIES IN TRANSITIONAL JST",
      "course_info": [
        {
          "class_nbr": 3485,
          "start_time": "1:30 PM",
          "descrlong": "Prerequisite(s): Transitional Justice 2001F/G or Political Science 2203F/G or permission of the Director of Studies of the Centre for Transitional Justice and Post-Conflict Reconstruction.",
          "end_time": "4:30 PM",
          "campus": "Main",
          "facility_ID": "SSC-3014",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "CROSS-LISTED WITH POLISCI 3001G."
        }
      ],
      "catalog_description": "This course explores issues inherent to regions facing the aftermath of large-scale events of social violence, including war, genocide, and authoritarian rule, with an emphasis on questions of justice and post-conflict reconstruction. Students will examine specific cases of recent attempts to establish just responses to conflict within affected communities.\n\nAntirequisite(s): Political Science 3001F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1020E",
      "subject": "WOMENST",
      "className": "INTRODUCTION TO WOMEN'S STUDIE",
      "course_info": [
        {
          "class_nbr": 1504,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "B&GS-0165",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "A survey of selected topics in the study of gender structures and the status of women in historical and cross-cultural perspective. These will include consideration of social and psychological processes by which gender identity is established in the individual, its institutional manifestations, and its articulation with class and race structures. \n\nExtra Information: 2 lecture hours, 1 tutorial hour (Main); 3 hours, limited enrolment (Brescia, King's)"
    },
    {
      "catalog_nbr": "1021F",
      "subject": "WOMENST",
      "className": "INTRO TO SEXUALITY STUDIES",
      "course_info": [
        {
          "class_nbr": 3399,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "We introduce students to current social and political issues in sexuality studies, with a focus on contemporary issues around sexuality, including formation of sexual identities, sexual practices and politics, policing of sexuality, questions of sexual diversity, and the historical and global nature of ideas and controversies around sexuality.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1022G",
      "subject": "WOMENST",
      "className": "GENDER, JUSTICE, CHANGE",
      "course_info": [
        {
          "class_nbr": 3400,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "3:30 PM",
          "campus": "Main",
          "facility_ID": "AHB-1R40",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "The 21st century is a period of accelerating change focused around issues of gender, justice and activism. This course will introduce students to the ways in which movements for justice and change are informed by and take up gender issues in matters of education, health, poverty, globalization, the environment, etc.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1023F",
      "subject": "WOMENST",
      "className": "GAY LIFE & CULTURE IN 21ST C.",
      "course_info": [
        {
          "class_nbr": 10635,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1240",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "Judging by the media, you would think the only issue in gay life today is same-sex marriage. This course will examine many of the other issues affecting gay men, such as sexual politics and practices, body image, health, consumer culture, social media, television and film, and intersections with race and class.\n\nExtra Information: 3 hours."
    },
    {
      "catalog_nbr": "1024G",
      "subject": "WOMENST",
      "className": "INTR EQUITY, DIV, & HMN RIGHTS",
      "course_info": [
        {
          "class_nbr": 6378,
          "start_time": "11:30 AM",
          "descrlong": "",
          "end_time": "1:30 PM",
          "campus": "Main",
          "facility_ID": "FNB-1240",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": ""
        }
      ],
      "catalog_description": "This course surveys theory and practice in the fields of equity, diversity, and human rights as they are taken up in institutional domains such as social work, education, and law and in schools of thought such as critical race studies, feminism and gender studies, sexuality studies, and disability studies.\n\nExtra Information: 2 lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "0005W",
      "subject": "WRITING",
      "className": "CRIT READING, EFF WRITING",
      "course_info": [
        {
          "class_nbr": 11527,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "12:30 PM",
          "facility_ID": "BR-14",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course introduces international students to academic reading skills and broadens their vocabulary base in order to provide a strong foundation for writing and responding critically to what has been read. Topics to be covered include context clues, detecting main idea(s), supporting details, dictionary use, word collocations, and academic discussions.\n\nExtra Information: 6 class/lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "0005X",
      "subject": "WRITING",
      "className": "CRIT READING, EFF WRITING",
      "course_info": [
        {
          "class_nbr": 11737,
          "start_time": "10:30 AM",
          "descrlong": "Prerequisite(s): Registration in a Preliminary Year program at Brescia University College.",
          "end_time": "12:30 PM",
          "facility_ID": "BR-UH252",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course introduces international students to academic reading skills and broadens their vocabulary base in order to provide a strong foundation for writing and responding critically to what has been read. Topics to be covered include context clues, detecting main idea(s), supporting details, dictionary use, word collocations, and academic discussions.\n\nExtra Information: 6 class/lecture hours, 2 tutorial hours."
    },
    {
      "catalog_nbr": "0010F",
      "subject": "WRITING",
      "className": "ACAD WRITING, INT'L STUDENTS",
      "course_info": [
        {
          "class_nbr": 11521,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): registration in a Preliminary Year Program at Brescia University College and\nWriting 0005W/X or permission of the Department.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-MRW152",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will introduce academic writing skills to international students. Topics covered includes grammar, sentence and paragraph structure, topic sentences and thesis statements, introductions and conclusions, revision, the appropriate use of source materials and plagiarism, and the different kinds of academic essays.\n\nAntirequisite(s): Writing 0002F/G, Writing 0011F/G.\n\nExtra Information: 3 class/lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "0010G",
      "subject": "WRITING",
      "className": "ACAD WRITING, INT'L STUDENTS",
      "course_info": [
        {
          "class_nbr": 11739,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): registration in a Preliminary Year Program at Brescia University College and\nWriting 0005W/X or permission of the Department.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-UH256",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will introduce academic writing skills to international students. Topics covered includes grammar, sentence and paragraph structure, topic sentences and thesis statements, introductions and conclusions, revision, the appropriate use of source materials and plagiarism, and the different kinds of academic essays.\n\nAntirequisite(s): Writing 0002F/G, Writing 0011F/G.\n\nExtra Information: 3 class/lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "0011F",
      "subject": "WRITING",
      "className": "INTRO TO BASIC ACAD WRITING",
      "course_info": [
        {
          "class_nbr": 8131,
          "start_time": "8:30 AM",
          "descrlong": "",
          "end_time": "10:30 AM",
          "campus": "Huron",
          "facility_ID": "HC-V207",
          "days": [
            "M",
            "W"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "GEARED TOWARDS ESL STUDENTS. RESTRICTED TO HURON UNIVERSITY COLLEGE STUDENTS."
        }
      ],
      "catalog_description": "This course for multilingual students will develop skills of planning and composing in the writing process, and pre-writing skills such as note-taking from lectures and academic readings. These will help students develop an appreciation for appropriate vocabulary, syntax, and style of the various discourse communities at the university. \n\nAntirequisite(s): Writing 0002F/G.\n\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "0011G",
      "subject": "WRITING",
      "className": "INTRO TO BASIC ACAD WRITING",
      "course_info": [
        {
          "class_nbr": 9451,
          "start_time": "12:30 PM",
          "descrlong": "",
          "end_time": "2:30 PM",
          "campus": "Huron",
          "facility_ID": "HC-W103",
          "days": [
            "Tu",
            "Th"
          ],
          "instructors": [],
          "class_section": 550,
          "ssr_component": "LEC",
          "enrl_stat": "Not full",
          "descr": "GEARED TOWARDS ESL STUDENTS. RESTRICTED TO HURON UNIVERSITY COLLEGE STUDENTS."
        }
      ],
      "catalog_description": "This course for multilingual students will develop skills of planning and composing in the writing process, and pre-writing skills such as note-taking from lectures and academic readings. These will help students develop an appreciation for appropriate vocabulary, syntax, and style of the various discourse communities at the university. \n\nAntirequisite(s): Writing 0002F/G.\n\nExtra Information: 4 lecture hours."
    },
    {
      "catalog_nbr": "0015F",
      "subject": "WRITING",
      "className": "ADV ACAD WRITING INT'L STUDENT",
      "course_info": [
        {
          "class_nbr": 11572,
          "start_time": "9:30 AM",
          "descrlong": "Prerequisite(s): registration in a Preliminary Year Program at Brescia University College, and\nWriting 0010F/G or permission of the Department.",
          "end_time": "11:30 AM",
          "facility_ID": "BR-303",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will continue to develop the academic writing skills of international students by concentrating on research skills and incorporating citations through the writing process with review of principles of strong arguments and research. Students will also focus on fundamental rules of grammar and apply these to written work.\n\nAntirequisite(s): Writing 0002F/G, Writing 0012F/G.\n\nExtra Information: 3 class/lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "0015G",
      "subject": "WRITING",
      "className": "ADV ACAD WRITING INT'L STUDENT",
      "course_info": [
        {
          "class_nbr": 11574,
          "start_time": "8:30 AM",
          "descrlong": "Prerequisite(s): registration in a Preliminary Year Program at Brescia University College, and\nWriting 0010F/G or permission of the Department.",
          "end_time": "10:30 AM",
          "facility_ID": "BR-206",
          "days": [
            "Tu"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "This course will continue to develop the academic writing skills of international students by concentrating on research skills and incorporating citations through the writing process with review of principles of strong arguments and research. Students will also focus on fundamental rules of grammar and apply these to written work.\n\nAntirequisite(s): Writing 0002F/G, Writing 0012F/G.\n\nExtra Information: 3 class/lecture hours, 1 tutorial hour."
    },
    {
      "catalog_nbr": "1000F",
      "subject": "WRITING",
      "className": "THE WRITERS' STUDIO",
      "course_info": [
        {
          "class_nbr": 3019,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1220",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Students are introduced to the creative process of writing through in-class exercises, peer workshop, analysis of creative texts, journaling, essay writing, and a review of writing mechanics. Students learn strategies for idea generation in a variety of genres, composing a first draft, approaching revision, and effective editing and proofreading.\r\n\r\nAntirequisite(s): Any Writing course or half course at the 1000, 2100 or 2200 level.\r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1000G",
      "subject": "WRITING",
      "className": "THE WRITERS' STUDIO",
      "course_info": [
        {
          "class_nbr": 2693,
          "start_time": "2:30 PM",
          "descrlong": "",
          "end_time": "5:30 PM",
          "campus": "Main",
          "facility_ID": "UC-1220",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": "001",
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": ""
        }
      ],
      "catalog_description": "Students are introduced to the creative process of writing through in-class exercises, peer workshop, analysis of creative texts, journaling, essay writing, and a review of writing mechanics. Students learn strategies for idea generation in a variety of genres, composing a first draft, approaching revision, and effective editing and proofreading.\r\n\r\nAntirequisite(s): Any Writing course or half course at the 1000, 2100 or 2200 level.\r\n\r\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1002F",
      "subject": "WRITING",
      "className": "INTRO TO WRITING IN ENGLISH",
      "course_info": [
        {
          "class_nbr": 8933,
          "start_time": "6:30 PM",
          "descrlong": "",
          "end_time": "9:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-BH107",
          "days": [
            "Th"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED AT KINGS."
        }
      ],
      "catalog_description": "This course is an introduction to academic writing for first-year English as a Second Language students in all disciplines. Topics range from grammar, sentence structure, and paragraphing to the principles of scholarly argument and research.\n\nAntirequisite(s): The former Writing 0002F/G, Writing 1020F/G, Writing 1021F/G, Writing 1022F/G, Writing 2101F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1002G",
      "subject": "WRITING",
      "className": "INTRO TO WRITING IN ENGLISH",
      "course_info": [
        {
          "class_nbr": 8938,
          "start_time": "1:30 PM",
          "descrlong": "",
          "end_time": "4:30 PM",
          "campus": "Kings",
          "facility_ID": "KC-LH220",
          "days": [
            "M"
          ],
          "instructors": [],
          "class_section": 570,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED AT KINGS."
        }
      ],
      "catalog_description": "This course is an introduction to academic writing for first-year English as a Second Language students in all disciplines. Topics range from grammar, sentence structure, and paragraphing to the principles of scholarly argument and research.\n\nAntirequisite(s): The former Writing 0002F/G, Writing 1020F/G, Writing 1021F/G, Writing 1022F/G, Writing 2101F/G.\n\nExtra Information: 3 lecture hours."
    },
    {
      "catalog_nbr": "1020F",
      "subject": "WRITING",
      "className": "INTRO TO UNIV ESSAY WRITING",
      "course_info": [
        {
          "class_nbr": 7702,
          "start_time": "10:30 AM",
          "descrlong": "",
          "end_time": "11:30 AM",
          "facility_ID": "BR-MRW152",
          "days": [
            "W"
          ],
          "instructors": [],
          "class_section": 530,
          "ssr_component": "LEC",
          "enrl_stat": "Full",
          "descr": "RESTRICTED TO STUDENTS REGISTERED AT AN AFFILIATED UNIVERSITY COLLEGE."
        }
      ],
      "catalog_description": "A practical introduction to the basics of successful academic writing, designed for first-year students in all disciplines. Topics will range from grammar, sentence structure, and paragraphing to the principles of scholarly argument and research. \n\nAntirequisite(s): Writing 0002F/G, Writing 1002F/G, Writing 1021F/G, Writing 1022F/G, Writing 2101F/G.\n\nExtra Information: 3 lecture/tutorial hours. [This course will not serve as a prerequisite for any area of concentration]"
    }
  ]
