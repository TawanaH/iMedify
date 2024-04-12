var http = require('http');
var express = require('express');
var path = require('path');
var logger = require('morgan');

var  app = express(); //create express middleware dispatcher

const PORT = process.env.PORT || 3000

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs'); //use hbs handlebars wrapper
app.locals.pretty = true; //to generate pretty view-source code in browser

//read routes modules
var routes = require('./public/index');

//Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()) //JSON for getting userid and password
app.use((request, response, next) => {
    console.log("METHOD LOGGER");
    console.log("================================");
    console.log("METHOD: " + request.method);
    console.log("URL:" + request.url);
    console.log("================================");
    next(); // Pass control to the next middleware function
});

//Routing
app.get('/', routes.index); 
app.get('/signupPage', routes.signupPage); 
app.post('/signup', routes.signup) 

//Require Authentication
app.use('/private', routes.authenticate) 
app.get('/private/login', routes.home); 
app.get('/private/home', routes.home); 
app.get('/private/songs', routes.songs); 
app.get('/private/users', routes.users); 
app.get('/private/updatePlaylist', routes.updatePlaylist); 
app.get('/private/addLocal', routes.addLocal);
app.get('/private/local', routes.local);

//start server
app.listen(PORT, err => {
    if(err) console.log(err)
    else {
          console.log(`Server listening on port: ${PORT} CNTL:-C to stop`)
          console.log(`To Test:`)
          console.log('http://localhost:3000/')
      }
  })
