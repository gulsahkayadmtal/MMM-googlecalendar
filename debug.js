/*jshint node: true */
'use strict';

/* CalendarFetcher Tester
 * use this script with `node debug.js` to test the fetcher without the need 
 * of starting the MagicMirror core. Adjust the values below to your desire.
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

var CalendarFetcher = require('./calendarfetcher.js');

var url = 'calendarNamae';
var fetchInterval = 60 * 60 * 1000;
var maximumEntries = 10;
var maximumNumberOfDays = 365;

console.log('Create fetcher ...');

var fetcher = new CalendarFetcher(url, fetchInterval, maximumEntries, maximumNumberOfDays);

fetcher.onReceive(function(fetcher) {
	console.log(fetcher.events());	
	console.log('------------------------------------------------------------');
});

fetcher.onError(function(fetcher, error) {
	console.log('Fetcher error:');
	console.log(error);
});

fetcher.startFetch();

console.log('Create fetcher done! ');

