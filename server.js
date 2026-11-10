// Local development server. The game itself no longer needs a server:
// players connect to each other directly with PeerJS, so this just serves
// the static files (the same files you could put on GitHub Pages).
var Express = require('express');

// Create the express app
var app = Express();

// Set the client root directory
app.use(Express.static(__dirname));

// Start the server
var server = app.listen(process.env.PORT || 8081, function () {
    //This will just output what port we're listening on.
    console.log(`Listening on http://localhost:${server.address().port}`);
});
