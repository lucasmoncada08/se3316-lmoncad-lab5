const mongoose = require('mongoose');

const courseSchema = mongoose.Schema({
  courseId: String,
  subjCode: String
})

const courseListsSchema = mongoose.Schema({
  name: String,
  creator: String,
  descr: String,
  day: Number,
  month: Number,
  year: Number,
  courses: [courseSchema],
  privacy: String
})

module.exports = mongoose.model('CourseList', courseListsSchema);
