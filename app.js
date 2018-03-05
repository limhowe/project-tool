// analytics
var newrelic = require('newrelic');

// bootstrap
require('./bootstrap.js');

// express
var express = require('express');

// require middlewares
var http = require('http');
var favicon  = require('serve-favicon');
var parser   = require('body-parser');
var cookie   = require('cookie-parser');
var session  = require('express-session');
var morgan   = require('morgan');
var override = require('method-override');
var passportSocketIo = require('passport.socketio');

var MongoStore = require('connect-mongo')(session);

global.app = express();

// set app settings
app.set('views', APP_PATH + 'views');
app.set('view engine', 'jade');
console.log(APP_PATH)
// set app middlewares
app.use(favicon(__dirname + '/public/img/planhammer.ico'));
app.use(express.static(APP_PATH + 'public'));
app.use(override());
app.use(cookie());
app.use(parser.json({ extended: true }));
app.use(parser.urlencoded({ extended: true }));
app.use(Middlewares.general.locals);

var sessionStore = new MongoStore({
    mongooseConnection: require('mongoose').connection
});

app.use(session({
  secret: config.get('cookie_secret'),
  store: sessionStore,
  resave: true,
  saveUninitialized: true,
  auto_reconnect: true
}));

if (app.get('env') === 'development') {
  app.use(morgan('dev'));
  app.locals.pretty = true;
}

// setup helpers
Helpers.analytics();
Helpers.stripe.sync_plans();

// load controllers
require(APP_PATH + '/controllers');

// Redirect all frontend routes to the main AngularJS bootstrap file to support HTML5 mode.
// This should be put after loading controllers, because we don't want to intercept '/api' routes.
app.use('/*', function(req, res) {
  res.render('index.jade');
});

var server = http.createServer(app);

// start server
server.listen(config.get('port'), function() {
  console.log('rolling on port ' + config.get('port'));
});

// socket.io
global.io = require('socket.io')(server, {
  transports: ['websocket', 'polling', 'xhr-polling']
});

io.use(passportSocketIo.authorize({
  secret: config.get('cookie_secret'),
  store: sessionStore,
}));

io.on('connection', Helpers.socket.onConnection);
