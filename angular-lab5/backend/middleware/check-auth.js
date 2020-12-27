/* Middleware code for passing to the api the userId and email as well as verifying the jwt token */

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1]; // Split to account for bearer convention used
    const decodedToken = jwt.verify(token, 'secret_this_should_be_longer');
    req.userData = {email: decodedToken.email, userId: decodedToken.userId};
    next();
  } catch (error) {
    res.status(401).json({message: "Auth failed"});
  }
}
