const mongoose = require('mongoose');

const reviewSchema = mongoose.Schema({
  courseCode: String,
  subjCode: String,
  rating: Number,
  reviewText: String,
  username: {type: String, ref: 'User'},
  day: Number,
  month: Number,
  year: Number,
  hidden: Boolean
})

module.exports = mongoose.model('CourseReview', reviewSchema);
