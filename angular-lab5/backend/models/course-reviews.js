const mongoose = require('mongoose');

const reviewSchema = mongoose.Schema({
  courseCode: String,
  subjCode: String,
  rating: Number,
  reviewText: String,
  username: String,
  day: Number,
  month: Number,
  year: Number
})

module.exports = mongoose.model('CourseReview', reviewSchema);
