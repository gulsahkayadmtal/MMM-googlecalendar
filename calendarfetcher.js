/*jshint node: true */
'use strict';

/* Magic Mirror
 * Node Helper: GoogleCalendar - CalendarFetcher
 *
 * By Luís Gomes
 * MIT Licensed.
 */

var moment = require('moment'),
    fs = require('fs'),
    readline = require('readline'),
    google = require('googleapis'),
    googleAuth = require('google-auth-library');

var GOOGLE_API_CONFIG_PATH = __dirname + '/config/apiInfo.json',
    SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'],
    TOKEN_DIR = __dirname + '/.credentials/',
    TOKEN_PATH = TOKEN_DIR + 'calendar-credentials.json';

var CalendarFetcher = function(calendarName, reloadInterval, maximumEntries, maximumNumberOfDays) {
    var self = this;

    var reloadTimer = null;
    var events = [];

    var fetchFailedCallback = function() {};
    var eventsReceivedCallback = function() {};


    /* fetchCalendar()
     * Initiates calendar fetch.
     */
    var fetchCalendar = function(){
        
        fs.readFile(GOOGLE_API_CONFIG_PATH, function processClientSecrets(err, content) {
            if (err) {
                console.log('Error loading client secret file: ' + err);
                return;
            }
            // Authorize a client with the loaded credentials, then call the
            // Google Calendar API.
            authorize(JSON.parse(content), listEvents);
        });
    };
    

    /* scheduleTimer()
     * Schedule the timer for the next update.
     */
    var scheduleTimer = function() {
        console.log('Schedule update timer.');
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(function() {
            fetchCalendar();
        }, reloadInterval);
    };

    /* isFullDayEvent(event)
     * Checks if an event is a fullday event.
     *
     * argument event obejct - The event object to check.
     *
     * return bool - The event is a fullday event.
     */
    var isFullDayEvent = function(event) {
        if (event.start.date)
            return true;

        var start = event.start.dateTime || 0;
        var startDate = new Date(start);
        var end = event.end.dateTime || 0;

        if (end - start === 24 * 60 * 60 * 1000 && startDate.getHours() === 0 && startDate.getMinutes() === 0) {
            // Is 24 hours, and starts on the middle of the night.
            return true;            
        }

        return false;
    };

    /**
     * Create an OAuth2 client with the given credentials, and then execute the
     * given callback function.
     *
     * @param {Object} credentials The authorization client credentials.
     * @param {function} callback The callback to call with the authorized client.
     */
    var authorize = function(credentials, callback) {

        var clientID = credentials.client_id,
            clientSecret = credentials.client_secret,
            redirectUrl = credentials.redirect_uri;

        var auth = new googleAuth();

        var oauth2Client = new auth.OAuth2(clientID, clientSecret, redirectUrl);

        // Check if already have calendar credentials
        fs.readFile(TOKEN_PATH, (err, tokens) => {

            if(err)
                getNewToken(oauth2Client, callback);
            else{
                oauth2Client.credentials = JSON.parse(tokens);
                callback(oauth2Client);
            } 
        });
    };

    /**
     * Lists the next 10 events on the user's primary calendar.
     *
     * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
     */
    var listEvents = function(auth) {

        var calendar = google.calendar('v3');

        calendar.events.list({
            auth: auth,
            calendarId: 'primary',
            timeMin: (new Date()).toISOString(),
            maxResults: maximumEntries,
            singleEvents: true,
            orderBy: 'startTime'
        }, function(err, response) {
            if (err) {
                fetchFailedCallback(self, err);
                scheduleTimer();
                console.log('The API returned an error: ' + err);
                return;
            }

            var newEvents = [];

            var receivedEvents = response.items;
            if (receivedEvents.length == 0) {
                console.log('No upcoming events found.');
            } else {
                for (var i = 0; i < receivedEvents.length; i++) {

                    var event = receivedEvents[i];
                    var today = moment().startOf('day').toDate();
                    var future = moment().startOf('day').add(maximumNumberOfDays, 'days').subtract(1,'seconds').toDate(); // Subtract 1 second so that events that start on the middle of the night will not repeat.

                    if(event.kind === 'calendar#event'){

                        var startDate = moment(new Date(event.start.dateTime || event.start.date));
                        var endDate = moment(new Date(event.end.dateTime || event.end.date));

                        if (event.start.length === 8)
                            startDate = startDate.startOf('day');

                        var title = event.summary || event.description || 'Event';

                        var fullDayEvent = isFullDayEvent(event);

                        if (!fullDayEvent && endDate < new Date()) {
                            //console.log("It's not a fullday event, and it is in the past. So skip: " + title);
                            continue;
                        }

                        if (fullDayEvent && endDate <= today) {
                            //console.log("It's a fullday event, and it is before today. So skip: " + title);
                            continue;
                        }

                        if (startDate > future) {
                            //console.log("It exceeds the maximumNumberOfDays limit. So skip: " + title);
                            continue;
                        }

                        // Every thing is good. Add it to the list.                 
                        newEvents.push({
                            title: title,
                            startDate: startDate.format('x'),
                            endDate: endDate.format('x'),
                            fullDayEvent: fullDayEvent
                        });
                    }
                }
                newEvents.sort(function(a, b) {
                    return a.startDate - b.startDate;
                });

                events = newEvents.slice(0, maximumEntries);

                self.broadcastEvents();
                scheduleTimer();
            }
        });
    };


    /**
     * Store token to disk be used in later program executions.
     *
     * @param {Object} token The token to store to disk.
     */
    var storeToken = function(token) {
        try {
            fs.mkdirSync(TOKEN_DIR);
        } catch (err) {
            if (err.code != 'EEXIST')
                throw err;
        }

        fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    };

    /**
     * Get and store new token after prompting for user authorization, and then
     * execute the given callback with the authorized OAuth2 client.
     *
     * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
     * @param {getEventsCallback} callback The callback to call with the authorized
     *     client.
     */
    var getNewToken = function(oauth2Client, callback) {
        var authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        });

        console.log('Authorize this app by visiting this url:', authUrl);
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Enter the code from that page here: ', function(code) {
            rl.close();
            oauth2Client.getToken(code, function(err, token) {
                if (err) {
                    console.log('Error while trying to retrieve access token', err);
                    return;
                }
                oauth2Client.setCredentials(token);
                storeToken(token);
                callback(oauth2Client);
            });
        });
    };
    
    /* public methods */

    /* startFetch()
     * Initiate fetchCalendar();
     */
    this.startFetch = function() {
        fetchCalendar();
    };

    /* broadcastItems()
     * Broadcast the existing events.
     */
    this.broadcastEvents = function() {
        //console.log('Broadcasting ' + events.length + ' events.');
        eventsReceivedCallback(self);
    };

    /* onReceive(callback)
     * Sets the on success callback
     *
     * argument callback function - The on success callback.
     */
    this.onReceive = function(callback) {
        eventsReceivedCallback = callback;
    };

    /* onError(callback)
     * Sets the on error callback
     *
     * argument callback function - The on error callback.
     */
    this.onError = function(callback) {
        fetchFailedCallback = callback;
    };

    /* url()
     * Returns the calendar name of this fetcher.
     *
     * return string - The calendar name of this fetcher.
     */
    this.name = function() {
        return calendarName;
    };

    /* events()
     * Returns current available events for this fetcher.
     *
     * return array - The current available events for this fetcher.
     */
    this.events = function() {
        return events;
    };

};

module.exports = CalendarFetcher;