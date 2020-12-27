/* Data model for application users */

const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');

const userSchema = mongoose.Schema({
  username: { type:String, unique:true },
  email: { type:String, unique:true },
  password: String,
  admin: Boolean,
  deactivated: Boolean
});

userSchema.plugin(uniqueValidator);

module.exports = mongoose.model("User", userSchema);
