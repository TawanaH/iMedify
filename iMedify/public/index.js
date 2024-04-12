var sqlite3 = require('sqlite3').verbose(); //verbose provides more detailed stack trace
const http = require('http');
var db = new sqlite3.Database('data/db_songs');
var recentResponse = [];

exports.index = function (request, response) {
    response.render('authenticate');
}

exports.home = function(request, response) {
	if(request.user_role === 'admin'){
		db.all(`SELECT trackName, artistName, artworkURL FROM songs WHERE userid = '${request.userid}';`, function(err, rows) {
			response.render('adminHome', {playlistSongs: rows});
		})
	}
	else{
		db.all(`SELECT trackName, artistName, artworkURL FROM songs WHERE userid = '${request.userid}';`, function(err, rows) {
			response.render('home', {playlistSongs: rows});
		})
	}	
}

exports.signupPage = function(request, response) {
    response.render('signup');
}

exports.signup = function (request, response) {
	const { userid, password } = request.body;
	let sqlString = `INSERT OR REPLACE INTO users VALUES ('${userid}', '${password}', 'guest')`;
	db.run(sqlString);
	return;
}

exports.users = function(request, response) {
	// /send_users
	if(request.user_role === 'admin'){
	  db.all("SELECT userid, password FROM users", function(err, rows) {
		response.render('users', {users: rows})
	  })
	}
	else{
	  handleError(response,'ERROR: Admin Privileges Required To See Users');
	  return;
	}
}

exports.updatePlaylist = function(request, response) {
	let songId = request.query.id
	//Adding to database
	recentResponse.forEach(element => {
		if (element.trackId === parseInt(songId)) {
			console.log("Adding song to database!")
			let sqlString = `INSERT INTO songs (trackid, trackName, artistName, artworkURL, userid) VALUES ('${element.trackId}', '${element.trackName}', '${element.artistName}', '${element.artworkUrl60}', '${request.userid}');`
			db.run(sqlString)
		}
	});

	//Return updated user playlist!
	db.all(`SELECT trackName, artistName, artworkURL FROM songs WHERE userid = '${request.userid}';`, function(err, rows) {
		response.render('playlist', {playlistSongs: rows}, (err, html) => {
			if (err) {
				console.error(err);
				response.status(500).send('Server error');
				return;
			}
			response.send(html); // Send the rendered HTML back to the client
		});
	})
}

exports.local = function(request, response) {
	response.render('local')
}

exports.addLocal = function(request, response) {
	let trackName = decodeURIComponent(request.query.trackName);
	let artistName = decodeURIComponent(request.query.artistName);
	let artworkURL = decodeURIComponent(request.query.artworkURL);

	let sqlString = `INSERT INTO songs (trackid, trackName, artistName, artworkURL, userid) VALUES ('0', '${trackName}', '${artistName}', '${artworkURL}', '${request.userid}');`
	db.run(sqlString)

	//Return updated user playlist!
	db.all(`SELECT trackName, artistName, artworkURL FROM songs WHERE userid = '${request.userid}';`, function(err, rows) {
		response.render('playlist', {playlistSongs: rows}, (err, html) => {
			if (err) {
				console.error(err);
				response.status(500).send('Server error');
				return;
			}
			response.send(html); // Send the rendered HTML back to the client
		});
	})
}

function addLocalMedia() {
	let trackName = encodeURIComponent(document.getElementById("trackName").value);
	let artistName = encodeURIComponent(document.getElementById("artistName").value);
	let artworkURL = encodeURIComponent(document.getElementById("artworkURL").value);

	if(trackName === '' || artistName === '') {
        return alert('You must enter a track name and artist name. Artwork URL is optional.')
    }

	if(artworkURL === ''){
		artworkURL = encodeURIComponent('https://icons.iconarchive.com/icons/icons8/ios7/48/Logos-Chrome-Copyrighted-icon.png')
	}

	fetch(`/private/addLocal?trackName=${trackName}&artistName=${artistName}&artworkURL=${artworkURL}`)
	.then(response => response.text())
	.then(html => {
		document.getElementById('playlistArea').innerHTML = html;
	})
	.catch(error => console.error('Error fetching data:', error));
}

function addToPlaylist(button) {
	console.log("Add to playlist was called!");
	fetch(`/private/updatePlaylist?id=${button.id}`)
	.then(response => response.text())
	.then(html => {
		document.getElementById('playlistArea').innerHTML = html;
	})
	.catch(error => console.error('Error fetching data:', error));
}

function sendDetails(){
	let userid = document.getElementById("userid").value;
	let password = document.getElementById("password").value;

	if(userid === '' || password === '') {
        return alert('Please enter a userid and a password.')
    }

	fetch('/signup', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			userid: userid,
			password: password
		}),
	})
	
	document.getElementById("userid").value = ''
	document.getElementById("password").value = ''
	return alert('Sign up successful, click to login.')
}

function getSongs() {
	let title = document.getElementById("title").value

	if(title === '') {
        return alert('Please enter a title')
    }

	fetch(`/private/songs?title=${title}`)
	.then(response => response.text())
	.then(html => {
		document.documentElement.innerHTML = html;
	})
	.catch(error => console.error('Error fetching data:', error));
}

exports.songs = function(request, response) {
    let title = request.query.title

	title = title.replace(/\s/g, "+")

	if(!title) {
		//send json response to client using response.json() feature
		//of express
		response.json({message: 'Please enter a song title'})
		return
	}
	
	const options = {
		"method": "GET",
		"hostname": "itunes.apple.com",
		"port": null,
		"path": `/search?term=${title}&entity=musicTrack&limit=20`,
		"headers": {
			"useQueryString": true
		}
	}

	//create the actual http request and set up
	//its handlers
	http.request(options, function(apiResponse) {
	let songData = ''
	apiResponse.on('data', function(chunk) {
		songData += chunk
	})
	apiResponse.on('end', function() {
		let temp = JSON.parse(songData)
		recentResponse = temp.results;

		response.render('songs', {title: request.query.title, songEntries: temp.results}, (err, html) => {
			if (err) {
				console.error(err);
				response.status(500).send('Server error');
				return;
			}
			response.send(html); // Send the rendered HTML back to the client
		});
	})
	}).end() //important to end the request
			//to actually send the message
}

exports.authenticate = function(request, response, next) {
	/*
	  Middleware to do BASIC http 401 authentication
	  */
	let auth = request.headers.authorization
	// auth is a base64 representation of (username:password)
	//so we will need to decode the base64
	if (!auth) {
	  //note here the setHeader must be before the writeHead
	  response.setHeader('WWW-Authenticate', 'Basic realm="need to login"')
	  response.writeHead(401, {
		'Content-Type': 'text/html'
	  })
	  console.log('No authorization found, send 401.')
	  response.end();
	} else {
	  console.log("Authorization Header: " + auth)
	  //decode authorization header
	  // Split on a space, the original auth
	  //looks like  "Basic Y2hhcmxlczoxMjM0NQ==" and we need the 2nd part
	  var tmp = auth.split(' ')
  
	  // create a buffer and tell it the data coming in is base64
	  var buf = Buffer.from(tmp[1], 'base64');
  
	  // read it back out as a string
	  //should look like 'ldnel:secret'
	  var plain_auth = buf.toString()
	  console.log("Decoded Authorization ", plain_auth)
  
	  //extract the userid and password as separate strings
	  var credentials = plain_auth.split(':') // split on a ':'
	  var username = credentials[0]
	  var password = credentials[1]
	  console.log("User: ", username)
	  console.log("Password: ", password)
  
	  var authorized = false
  
	  //check database users table for user
	  db.all("SELECT userid, password, role FROM users", function(err, rows) {
		for (var i = 0; i < rows.length; i++) {
		  if (rows[i].userid == username & rows[i].password == password){
			authorized = true;
			request.userid = rows[i].userid;
			request.user_role = rows[i].role;
		  } 
		}
		if (authorized == false) {
		  //we had an authorization header by the user:password is not valid
		  response.setHeader('WWW-Authenticate', 'Basic realm="need to login"')
		  response.writeHead(401, {
			'Content-Type': 'text/html'
		  })
		  console.log('No authorization found, send 401.')
		  response.end()
		} else
		  next()
	  })
	}
  
	//notice no call to next()
}
