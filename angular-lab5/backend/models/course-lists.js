/* Data model for course lists */

const mongoose = require('mongoose');

const courseSchema = mongoose.Schema({
  courseId: String,
  subjCode: String
})

const courseListsSchema = mongoose.Schema({
  name: {type: String, unique:true},
  creator: {type: String, ref: 'User'},
  descr: String,
  day: Number,
  month: Number,
  year: Number,
  courses: [courseSchema],
  numOfCourses: Number,
  privacy: String
})

module.exports = mongoose.model('CourseList', courseListsSchema);
