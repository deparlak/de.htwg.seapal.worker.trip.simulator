var PouchDB = require('pouchdb');
var nconf = require('nconf');
var geohash = require('ngeohash');
var TripSimulator = require("./single.js");

//
// Setup nconf to use (in-order):
//   1. Command-line arguments
//   2. Environment variables
//   3. A file located at 'path/to/config.json'
//
nconf.argv()
   .env()
   .file({ file: 'config.json' });

// get connection setup
var simulation = nconf.get("simulation"); 
var server = nconf.get("server");
var avtive = 0;
var maxTimeout = 3;
// all worker timers, to clear them on SIGINT.
var workerTimer = [];

// handle the exit event
process.on('exit', function(code) {
    console.log('About to exit with code:', code);

});

// handle termination of program
process.on('SIGINT', function() {
    for (var i = 0; i < workerTimer.length; i++) {
        clearTimeout(workerTimer[i]);
    }
    console.log('Got SIGINT. Going to exit now.');
});

// we have to set max listeners to unlimited, because the TripSimulator also listen on SIGINT to close it's connection to the server.
// anyway if we create a lot of TripSimulator, we reach the limit for listeners very fast.
process.setMaxListeners(0);

// valid character of a geohash.
var validGeohashChar = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
// check if max geohash length is not reached.
if (simulation.areaGeohash.length < 0 || simulation.areaGeohash.length > 8) {
    throw new Error("areaGeohash in configuration should have a length between 0 and 8");
}
// check if are geohash is valid.
for (var i = 0; i < simulation.areaGeohash.length; i++) {
    if (-1 == validGeohashChar.indexOf(simulation.areaGeohash[i])) {
        throw new Error("Invalid character in areaGeohash");
    }
}
// get a random hash, based on the areaGeohash.
function getRandomHash() {
    var hash = simulation.areaGeohash;
    for (var i = simulation.areaGeohash.length; i < 9; i++) {
        index = Math.floor(Math.random() * validGeohashChar.length);
        hash += validGeohashChar[index];
    }
    return hash;
}

// print some information about the setup
console.log("Number of Bots to start                       : "+simulation.botsToStart);
console.log("First bot to start                            : "+simulation.botPrefix +"1");
console.log("Last bot to start                             : "+simulation.botPrefix + simulation.botsToStart);
console.log("Number of position updates one bot will do    : "+simulation.botUpdates);
console.log("Position update sending frequency in seconds  : "+simulation.botUpdateTimeout + " seconds");

console.log("WARNING : Bots have to be valid users on the syncGateway.");


// run through all useres and createWorker for them.
for (var i = 1; i <= simulation.botsToStart; i++) {
    var user = {email : simulation.botPrefix + i, password : simulation.botPassword};
    // create a worker
    createWorker(i, user);
}

// creates a bot after a timeout
function createWorker(i, user) {
    // the worker will be created after a time out, so that the simulated positions are evenly spread
    workerTimer[i] = setTimeout(function() {
        var startHash = getRandomHash();
        console.log("Start worker on position : "+startHash);
        new TripSimulator (server, user, simulation.botUpdates, simulation.botUpdateTimeout, startHash);
    }, (i % maxTimeout) * 1000);
}

