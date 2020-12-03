const express = require('express');

const app = express();

app.use((req, res, next) => {
  console.log('Middleware');
  res.send('Using express');
})

module.exports = app
