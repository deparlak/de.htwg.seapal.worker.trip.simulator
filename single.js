var PouchDB = require('pouchdb');
var Worker = require('de.htwg.seapal.worker');
var nconf = require('nconf');
var geohash = require('ngeohash');

//
// Setup nconf to use (in-order):
//   1. Command-line arguments
//   2. Environment variables
//   3. A file located at 'path/to/config.json'
//
nconf.argv()
   .env()
   .file({ file: 'config.json' });


// trip simulator    
var TripSimulator = function (server, user, maxCalls, timeout, startHashString) {
    // get server connection setup
    var server = server;
    // set user object
    var user = user;
    // save number of calls
    var maxCalls = maxCalls;
    // save number of calls
    var startHashString = startHashString;
    // the time after which to call the position update in milliseconds
    var timeout = timeout * 1000;
    // timer for cyclic call
    var timer = null;
    // get the bbox, where the position updates should be made
    var tmp = geohash.decode_bbox (startHashString);
    // extract min, max values
    var bbox = {minlat : tmp[0], minlng : tmp[1], maxlat : tmp[2], maxlng : tmp[3]};
    // called counter
    var called = 0;
    // last position send
    var geoPosition = {_id : user.email+ '/geoPosition', type : 'geoPosition', lat : bbox.minlat, lng : bbox.minlng, hash : geohash.encode(bbox.minlat, bbox.minlng)};
    // set direction to forward
    var forward = true;
    // reference to db
    var db;

    // handle the exit event
    process.on('exit', function(code) {
        if (worker) {
            worker.close();
        }
    });

    // handle termination of program
    process.on('SIGINT', function() {
        console.log('TripSimulator got SIGINT.');
        called = maxCalls;
        clearTimeout(timer);
    });

    // start new worker
    var worker = new Worker(server, user, function(err, response) {
        if (err) {
            throw new Error(err);
        }
        
        // save db handle
        db = response;
        
        // get the actual geoPosition
        db.get(geoPosition._id, function (err, response) {
            // check if the document could not be get. If we have a 404, no initial document existed yet
            if (err && err.status != 404) {
                throw new Error(err);
            }

            // check if there was a _rev returned
            if (response && response._rev) {
                geoPosition._rev = response._rev;
            }
            
            // call simulate boat position first time.
            sumulatePosition();         
        });
            

    });

    // send position updates to the server.
    var sumulatePosition = function () {
        clearTimeout(timer);
        
        // finish execution
        if (called >= maxCalls) {
            // logout and exit
            worker.close();
            return;
        }
        
        // increment counter
        called++;
        
        // post a new position
        db.put(geoPosition, function(err, response) {
            if (err) {
                throw new Error(err);
            }
            
            // check if there was a _rev returned
            if (!response || !response.rev) {
                throw new Error("Got no rev after put");
            }
            
            // set the new rev
            geoPosition._rev = response.rev;        
            // set the new position
            if (forward && geoPosition.lat < bbox.maxlat) {
                geoPosition.lat = (geoPosition.lat + 0.02 > bbox.maxlat) ? bbox.maxlat : geoPosition.lat + 0.02;
            } else if (forward && geoPosition.lng < bbox.maxlng) {
                geoPosition.lng = (geoPosition.lng + 0.02 > bbox.maxlng) ? bbox.maxlng : geoPosition.lng + 0.02;
                forward = (geoPosition.lng == bbox.maxlng) ? false : true;
            } else if (!forward && geoPosition.lat > bbox.minlat) {
                geoPosition.lat = (geoPosition.lat - 0.02 < bbox.minlat) ? bbox.minlat : geoPosition.lat - 0.02;
            } else if (!forward && geoPosition.lng > bbox.minlng) {
                geoPosition.lng = (geoPosition.lng - 0.02 < bbox.minlng) ? bbox.minlng : geoPosition.lng - 0.02;
                forward = (geoPosition.lng == bbox.minlng) ? true : false;
            }
            
            // get geohash
            geoPosition.hash = geohash.encode(geoPosition.lat, geoPosition.lng);
            
            // so all new values are calculated, now call the sumulatePosition after the timeout
            timer = setTimeout(sumulatePosition, timeout);
        });
    };
};

// started from command line
if(require.main === module) {
    // check for parameters
    if (6 != process.argv.length) {
        console.log("Invalid number of parameters. should be 'node single.js usermail password maxCalls timeout startGeohashPosition'");
        return;
    }
    // get server connection setup
    var server = nconf.get("server");
    // set user object
    var user = {email : process.argv[2], password : process.argv[3]};
    // save number of calls
    var maxCalls = process.argv[4];
    // save number of calls
    var timeout = process.argv[5];
    // save number of calls
    var startHashString = process.argv[6];
    // call simulator
    TripSimulator(server, user, maxCalls, startHashString);
}

// export module
module.exports = TripSimulator;