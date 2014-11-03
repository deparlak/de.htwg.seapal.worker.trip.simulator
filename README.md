#Preconditions.
- node.js v0.10.26 http://nodejs.org/download/
- npm 1.4.3
- Sync Gateway 1.0.2-9.
- [Seapal Webserver](https://github.com/deparlak/de.htwg.seapal.play)

#Description
This project is a node.js application, which simulate seapal user. Therefore the application
can start a defined number of processes. Each process is a logged in user, which simulate
his boat position on the map. The boat position will be send to the sync Gateway by creating 
a document with the position of the boat. The position will be saved as lat/lng coordinates, as
well as a [geohash](http://www.bigdatamodeling.org/2013/01/intuitive-geohash.html).
The simulation of users should be used to test the seapal application. On production mode, the
position documents should be created by real users.

#Configuration
The complete configuration is stored in the config.json file.
The *simulation* Attribute contain all information about the users we like to simulate.
areaGeohash      : The geohash position in which the boats should be simulated. E.g. if we use "0ee", all users will move in this area.
botUpdateTimeout : The position update frequency of each user in seconds.
botUpdates       : The number of position updates of each user. After this amount, the user will stop sending his position and logout.
botPrefix        : The username of each bot. If we start 3 bots and our botPrefix is set to "trackSimulationBot"
                   we need 3 Sync Gateway users with the names "trackSimulationBot1", "trackSimulationBot2" and "trackSimulationBot3".  Make sure 
                   that the bots exist in the Sync Gateway as valid users. An easy way is to store the users in the Sync Gateway configuration.
botPassword      : The password of each bot. Each bot server has the same password. Because this application should
                   only be used on testing and not in production mode, this should not be a security threat.
botsToStart      : The number of bots to start. As mentioned above, the username will be built with the botPrefix and a sequential number.

The *server* Attribute contain all information about the running server.
loginUrl        : The URL, to which the bots can sent the login data. This is the URL of the play server.
logoutUrl       : The same as the loginUrl, except that the bot gets logged out.
syncGatewayUrl  : The URL to the sync Gateway.
 
``` 
{
    "simulation" : {
        "areaGeohash"       :   "e",
        "botUpdateTimeout"  :   5,
        "botUpdates"        :   20000,
        "botPrefix"         :   "trackSimulationBot",
        "botPassword"       :   "TBD_A_PASSWORD",
        "botsToStart"       :   50
        },

    "server" : {     
        "loginUrl"      :   "http://localhost:9000/login",
        "logoutUrl"     :   "http://localhost:9000/logout",
        "syncGatewayUrl":   "http://localhost:4984/sync_gateway/"
    }
}
```

#Execute
To run the application you should start a command line
``` 
# install all packages.
npm install
# This command will start the defined number of bot servers
node multiple
```