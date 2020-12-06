const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const userSchema = mongoose.Schema({
  username: { type:String, unique:true },
  email: { type:String, unique:true },
  password: String,
  admin: Boolean
});

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model("User", userSchema);
