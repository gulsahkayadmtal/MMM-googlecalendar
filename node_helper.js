/*jshint node: true */
'use strict';

/* Magic Mirror
 * Node Helper: Google Calendar
 *
 * By Luís Gomes
 * MIT Licensed.
 */

var NodeHelper = require('node_helper');
var CalendarFetcher = require('./calendarfetcher.js');

module.exports = NodeHelper.create({
    
    // Override start method.
    start: function() {

        this.fetchers = [];

        console.log('Starting node helper for: ' + this.name);
    },

    // Override socketNotificationReceived method.
    socketNotificationReceived: function(event, payload) {
        if (event === 'ADD_CALENDAR')
            this.createFetcher(payload.calendarName, payload.fetchInterval, payload.maximumEntries, payload.maximumNumberOfDays);
    },

    /* createFetcher(calendarName, reloadInterval)
     * Creates a fetcher for the calendarName doesn't exist yet.
     * Otherwise it reuses the existing one.
     *
     * attribute calendarName string - Calendar Name.
     * attribute reloadInterval number - Reload interval in milliseconds.
     */

    createFetcher: function(calendarName, fetchInterval, maximumEntries, maximumNumberOfDays) {
        var self = this;

        var fetcher = new CalendarFetcher(calendarName, fetchInterval, maximumEntries, maximumNumberOfDays);
        console.log('Create new calendar fetcher for: ' + calendarName + ' - Interval: ' + fetchInterval);
        
        fetcher.onReceive(function(fetcher) {
            self.sendSocketNotification('CALENDAR_EVENTS', {
                calendarName: fetcher.name(),
                events: fetcher.events()
            });
        });

        fetcher.onError(function(fetcher, error) {
            self.sendSocketNotification('FETCH_ERROR', {
                calendarName: fetcher.name(),
                error: error
            });
        });

        self.fetchers[calendarName] = fetcher;

        fetcher.startFetch();
    }
});
