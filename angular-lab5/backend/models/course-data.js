const mongoose = require('mongoose');

const courseDataInfoSchema = mongoose.Schema({
  "class_nbr": { type: Number },
  "start_time": { type: String },
  "descrlong": { type: String },
  "end_time": { type: String },
  "campus": { type: String },
  "facility_ID": { type: String },
  "days": [String],
  "instructors": [String],
  "class_section": { type: String },
  "ssr_component": { type: String },
  "enrl_stat": { type: String },
  "descr": { type: String }
});

const courseDataSchema = mongoose.Schema({
  "catalog_nbr": { type: String },
  "subject": { type: String },
  "className": { type: String },
  "course_info": [courseDataInfoSchema],
  "catalog_description": { type: String }
});

module.exports = mongoose.model('Post', courseDataSchema);
