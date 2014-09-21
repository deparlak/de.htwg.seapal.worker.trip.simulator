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
    // extract latlng coordinates
    tmp = geohash.decode_bbox (startHashString);
    // bbox for range of movement.
    var bbox = {minlat : tmp[0], minlng : tmp[1], maxlat : tmp[2], maxlng : tmp[3]};
    // called counter
    var called = 0;
    // max repeations after a timeout
    var maxTimeoutErrorRetries = 4;
    // counter for error, because of timeout
    var timeoutErrorCounter = 0;
    // steps to move. This value will be added or removed to LatLng coordinates.
    var latStep = (bbox.maxlat - bbox.minlat) / 20.0;
    var lngStep = (bbox.maxlng - bbox.minlng) / 20.0;

    // last position send
    var geoPosition = 
    {   _id     : user.email+ '/geoPosition', 
        _rev    : null,
        type    : 'geoPosition', 
        lat     : bbox.minlat, 
        lng     : bbox.minlng, 
        geohash : geohash.encode(bbox.minlat, bbox.minlng),
        owner   : user.email
    };
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
        
        // first get the last set position, to get the _rev
        db.get(geoPosition._id, function(err, response) {
            // if we get an error, which is not because of a missing doc 
            // (missing doc is ok if it's the first created document by this user)
            if (err && err.status !== 404) {
                throw new Error(err);
            } else if (err && err.status === 404){
                geoPosition._rev = null;
            } else {
                geoPosition._rev = response._rev;
            }
        
            // call simulate boat position first time. (will be called cyclic)
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
        // get the actual date
        now = new Date().toISOString();
        // set the date, on which the geoPosition was set
        geoPosition.date = now
        
        // post a new position
        db.put(geoPosition, function(err, response) {
            if (err) {
                timeoutErrorCounter++;
                // repeat after a timeout, if not max repeats are reached.
                if (maxTimeoutErrorRetries > timeoutErrorCounter) {
                    console.log(err);
                    console.log("Retry after " + timeoutErrorCounter + " calls. "+err);
                    timer = setTimeout(sumulatePosition, timeout);
                    return;
                }
                // max retries reached.
                throw new Error(err);
            }
            if (0 !== timeoutErrorCounter) {
                console.log("Process is running ok again after " + timeoutErrorCounter + " retries. ");
                // no error occurred, so set counter back
                timeoutErrorCounter = 0;
            }
            
            // set the _rev
            geoPosition._rev = response.rev;
            
            // set the new position
            if (forward && geoPosition.lat < bbox.maxlat) {
                geoPosition.lat = (geoPosition.lat + latStep > bbox.maxlat) ? bbox.maxlat : geoPosition.lat + latStep;
            } else if (forward && geoPosition.lng < bbox.maxlng) {
                geoPosition.lng = (geoPosition.lng + lngStep > bbox.maxlng) ? bbox.maxlng : geoPosition.lng + lngStep;
                forward = (geoPosition.lng == bbox.maxlng) ? false : true;
            } else if (!forward && geoPosition.lat > bbox.minlat) {
                geoPosition.lat = (geoPosition.lat - latStep < bbox.minlat) ? bbox.minlat : geoPosition.lat - latStep;
            } else if (!forward && geoPosition.lng > bbox.minlng) {
                geoPosition.lng = (geoPosition.lng - lngStep < bbox.minlng) ? bbox.minlng : geoPosition.lng - lngStep;
                forward = (geoPosition.lng == bbox.minlng) ? true : false;
            }
            
            // get geohash
            geoPosition.geohash = geohash.encode(geoPosition.lat, geoPosition.lng);
            
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