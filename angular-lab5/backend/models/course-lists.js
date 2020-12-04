const mongoose = require('mongoose');

const dateSchema = mongoose.Schema({
  day: String,
  month: String,
  year: String
})

const courseSchema = mongoose.Schema({
  courseId: String,
  subjCode: String,
})

const courseListsSchema = mongoose.Schema({
  name: String,
  creator: String,
  descr: String,
  modifiedData: dateSchema,
  courses: [courseSchema],
  privacy: String
})

module.exports = mongoose.model('CourseList', courseListsSchema);
