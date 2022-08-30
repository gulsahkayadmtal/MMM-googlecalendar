/*jshint node: true */
"use strict";

/* Magic Mirror
 * Node Helper: GoogleCalendar - CalendarFetcher
 *
 * By Luís Gomes
 * MIT Licensed.
 *
 * Updated by @asbjorn
 * - rewrote to follow the nodejs samples from Google Calendar API
 */

var moment = require("moment"),
    fs = require("fs"),
    readline = require("readline"),
    { google } = require("googleapis");
const { OAuth2Client } = require("google-auth-library");
const http = require("http");
const destroyer = require("server-destroy");
const opn = require("opn");
const url = require("url");
const open = require("open");

var SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"],
    TOKEN_DIR = __dirname + "/.credentials/",
    GOOGLE_API_CONFIG_PATH = TOKEN_DIR + "client_secret.json",
    TOKEN_PATH = TOKEN_DIR + "calendar-credentials.json";

var CalendarFetcher = function (
    calendarName,
    calendarIds,
    reloadInterval,
    maximumEntries,
    maximumNumberOfDays
) {
    var self = this;

    var reloadTimer = null;
    var events = [];

    var fetchFailedCallback = function () { };
    var eventsReceivedCallback = function () { };

    /* fetchCalendar()
     * Initiates calendar fetch.
     */
    var fetchCalendar = async function () {
        // Load client secrets from a local file.
        try {
            //const content = fs.readFileSync(TOKEN_PATH);
            const content = fs.readFileSync(GOOGLE_API_CONFIG_PATH);
            await authorize(JSON.parse(content), listEvents);
        } catch (err) {
            console.log(
                "Error loading client secret file! \nDid you download the '" +
                GOOGLE_API_CONFIG_PATH +
                "' file to access your Google Calendar? \nPath: " +
                GOOGLE_API_CONFIG_PATH
            );
            console.error(err);
            throw new Error("Error loading client secret file!");
        }
    };

    /* scheduleTimer()
     * Schedule the timer for the next update.
     */
    var scheduleTimer = function () {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(function () {
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
    var isFullDayEvent = function (event) {
        if (event.start.date) return true;

        var start = event.start.dateTime || 0;
        var startDate = new Date(start);
        var end = event.end.dateTime || 0;

        if (
            end - start === 24 * 60 * 60 * 1000 &&
            startDate.getHours() === 0 &&
            startDate.getMinutes() === 0
        ) {
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
    var authorize = async function (credentials, callback) {
        var redirect_uri = credentials.web.redirect_uris[0];
        if (!redirect_uri.includes(":3000")) {
            redirect_uri = redirect_uri + ":3000";
        }

        // Check if we have previously stored a token.
        let oAuth2Client = new OAuth2Client(
            credentials.web.client_id,
            credentials.web.client_secret,
            redirect_uri
        );
        try {
            const token = fs.readFileSync(TOKEN_PATH);
            oAuth2Client.setCredentials(JSON.parse(token));
            callback(oAuth2Client);
        } catch (err) {
            oAuth2Client = await getAuthenticatedClient(credentials);
            try {
                storeToken(oAuth2Client.credentials);
            } catch (writeErr) {
                console.error("Unable to write token to file: " + TOKEN_PATH);
                console.error("ERror: ", writeErr);
            }
            callback(oAuth2Client);
        }
    };

    /**
     * Create a new OAuth2Client, and go through the OAuth2 content
     * workflow.  Return the full client to the callback.
     */
    function getAuthenticatedClient(credentials) {
        return new Promise((resolve, reject) => {
            const redirect_uri =
                credentials.web.redirect_uris[0] + ":3000";

            const oAuth2Client = new OAuth2Client(
                credentials.web.client_id,
                credentials.web.client_secret,
                redirect_uri
            );

            const authorizeUrl = oAuth2Client.generateAuthUrl({
                scope: SCOPES,
            });

            const server = http.createServer(async (req, res) => {
                try {
                    console.log("req url: ", req.url);
                    if (req.url.indexOf("/") > -1) {
                        // acquire the code from the querystring, and close the web server.
                        const qs = new url.URL(req.url, "http://localhost:3000")
                            .searchParams;
                        const code = qs.get("code");
                        console.log(`Code is ${code}`);
                        res.end(
                            "Authentication successful! Please return to the console."
                        );
                        server.destroy();

                        // Now that we have the code, use that to acquire tokens.
                        const r = await oAuth2Client.getToken(code);
                        // Make sure to set the credentials on the OAuth2 client.
                        oAuth2Client.setCredentials(r.tokens);
                        resolve(oAuth2Client);
                    }
                } catch (e) {
                    reject(e);
                }
            });

            server.listen(3000, () => {
                // open the browser to the authorize url to start the workflow
                open(authorizeUrl, { wait: false }).then((cp) => cp.unref());
            });
            destroyer(server);
        });
    }

    /**
     * Create and returns a Promise object that retrieves, filters and properly
     * packs the Google Calendar events.
     *
     * @param {integer} calendar_id ID of the google calendar to retrieve
     * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
     */
    var createCalendarPromise = function (calendar_id, auth) {
        const calendar = google.calendar({ version: "v3", auth });
        console.log("Calendar ID: " + calendar_id);

        return new Promise(async function cb(resolve, reject) {
            try {
                var res = await calendar.events.list(
                    {
                        calendarId: calendar_id,
                        timeMin: new Date().toISOString(),
                        maxResults: maximumEntries,
                        singleEvents: true,
                        orderBy: "startTime",
                    }
                );
                let calendar_events = res.data.items;
                console.log('We have ' + calendar_events.length + ' events');

                if (calendar_events.length) {
                    calendar_events.map((event, i) => {
                        let start =
                            event.start.dateTime || event.start.date;
                        let today = moment().startOf("day").toDate();
                        let future = moment()
                            .startOf("day")
                            .add(maximumNumberOfDays, "days")
                            .subtract(1, "seconds")
                            .toDate(); // Subtract 1 second so that events that start on the middle of the night will not repeat.
                        let skip_me = false;

                        let title = "";
                        let fullDayEvent = false;
                        let startDate = undefined;
                        let endDate = undefined;

                        // console.log("event.kind: " + event.kind);
                        if (event.kind === "calendar#event") {
                            startDate = moment(
                                new Date(
                                    event.start.dateTime || event.start.date
                                )
                            );
                            endDate = moment(
                                new Date(
                                    event.end.dateTime || event.end.date
                                )
                            );

                            if (event.start.length === 8) {
                                startDate = startDate.startOf("day");
                            }

                            title =
                                event.summary ||
                                event.description ||
                                "Event";
                            fullDayEvent = isFullDayEvent(event);
                            if (!fullDayEvent && endDate < new Date()) {
                                console.log(
                                    "It's not a fullday event, and it is in the past. So skip: " +
                                    title
                                );
                                skip_me = true;
                            }
                            if (fullDayEvent && endDate <= today) {
                                console.log(
                                    "It's a fullday event, and it is before today. So skip: " +
                                    title
                                );
                                skip_me = true;
                            }

                            if (startDate > future) {
                                console.log(
                                    "It exceeds the maximumNumberOfDays limit. So skip: " +
                                    title
                                );
                                skip_me = true;
                            }
                        } else {
                            console.log("Other kind of event: ", event);
                        }

                        if (!skip_me) {
                            // Every thing is good. Add it to the list.
                            console.log("Adding: " + title);
                            events.push({
                                title: title,
                                startDate: startDate.format("x"),
                                endDate: endDate.format("x"),
                                fullDayEvent: fullDayEvent,
                            });
                        }
                    });
                } else {
                    console.log("No upcoming events found.");
                }
                resolve();
            } catch (err) {
                fetchFailedCallback(self, err);
                scheduleTimer();
                console.log("The API returned an error: " + err);
                return;
            }
        });
    };

    /**
     * Loops over a set of configurable calendarId's and fetch the events.
     *
     * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
     */
    var listEvents = function (auth) {
        let calendar_ids = calendarIds;
        //[
        // "webstep.no_i8smtpm3bbodi61t6ht5qvbthk@group.calendar.google.com",
        // "webstep.no_kh3h3l3uhv7pd0slgealv8pgj8@group.calendar.google.com",
        //];

        let promises = [];
        for (let i = 0; i < calendar_ids.length; i++) {
            promises.push(createCalendarPromise(calendar_ids[i], auth));
        }

        // Will only run after all Promises are complete
        Promise.all(promises).then(
            function (results) {
                let newEvents = events;
                // Just for console debugging
                newEvents.map((event, i) => {
                    let start = event.startDate;
                    console.log(`#${i}: ${start} - ${event.summary}`);
                });

                // Sort the combination of events from all calendars
                newEvents.sort(function (a, b) {
                    return a.startDate - b.startDate;
                });

                // Update 'global' events array
                events = newEvents.slice(0, maximumEntries);

                // Broadcast event and setup re-occurring scheduler
                self.broadcastEvents();
            },
            function (err) {
                // Error handling goes here
                console.log("Fucks sake mate - error from Promise!");
                scheduleTimer();
            }
        );
    };

    /**
     * Store token to disk be used in later program executions.
     *
     * @param {Object} token The token to store to disk.
     */
    var storeToken = function (token) {
        try {
            fs.mkdirSync(TOKEN_DIR);
        } catch (err) {
            if (err.code != "EEXIST") throw err;
        }

        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) {
                console.log(err);
            } else {
                console.log("Successfully wrote token to " + TOKEN_PATH);
            }
        });
    };

    /* public methods */

    /* startFetch()
     * Initiate fetchCalendar();
     */
    this.startFetch = async function () {
        await fetchCalendar();
    };

    /* broadcastItems()
     * Broadcast the existing events.
     */
    this.broadcastEvents = function () {
        //console.log('Broadcasting ' + events.length + ' events.');
        eventsReceivedCallback(self);
    };

    /* onReceive(callback)
     * Sets the on success callback
     *
     * argument callback function - The on success callback.
     */
    this.onReceive = function (callback) {
        eventsReceivedCallback = callback;
    };

    /* onError(callback)
     * Sets the on error callback
     *
     * argument callback function - The on error callback.
     */
    this.onError = function (callback) {
        fetchFailedCallback = callback;
    };

    /* url()
     * Returns the calendar name of this fetcher.
     *
     * return string - The calendar name of this fetcher.
     */
    this.name = function () {
        return calendarName;
    };

    /* events()
     * Returns current available events for this fetcher.
     *
     * return array - The current available events for this fetcher.
     */
    this.events = function () {
        return events;
    };
};

module.exports = CalendarFetcher;
