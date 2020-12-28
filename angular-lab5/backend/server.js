/* JS file to assist with providing an api */

const debug = require('debug')('node-angular');
const http = require('http');
const app = require('./app')

const verifyPort = val => {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false
}

const onError = error => {
  if (error.syscall !== "listen") {
    throw error;
  }
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + port;
  switch (error.code) {
    case "EACCES":
      console.error(bind + " requires greater privileges");
      process.exit(1);
      break;
    case "EADDRINUSE":
      console.error(bind + "is already being used");
      process.exit(1);
      break;
    default:
      throw error;
    }
};

const onListening = () => {
  const addr = server.address();
  const bind = typeof addr === "string" ? "pipe " + addr : "port " + port;
  debug("Listening on " + bind);
}

// If port is set use it, otherwise use 3000
const port = verifyPort(process.env.PORT || "3000");
app.set('port', port)

const server = http.createServer(app);

server.on("error", onError);
server.on("listening", onListening);

server.listen(port);
