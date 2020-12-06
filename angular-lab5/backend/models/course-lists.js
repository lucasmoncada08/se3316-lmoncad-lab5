const mongoose = require('mongoose');

const dateSchema = mongoose.Schema({
  day: Number,
  month: Number,
  year: Number
})

const courseSchema = mongoose.Schema({
  courseId: String,
  subjCode: String
})

const courseListsSchema = mongoose.Schema({
  name: String,
  creator: String,
  descr: String,
  modifiedDate: dateSchema,
  courses: [courseSchema],
  privacy: String
})

module.exports = mongoose.model('CourseList', courseListsSchema);
