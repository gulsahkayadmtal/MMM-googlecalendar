# Module: Google Calendar
The `googlecalendar` module was built for the MagicMirror.
This module displays events a google calendar account. 
This module is based on the default [calendar module](https://github.com/MichMich/MagicMirror/blob/develop/modules/default/calendar). 
The goal was not to reinvet the wheel, but use the existing module to get data from a different source.

At the moment, it does not support multiple accounts. Please, feel free to fork and contribute.

## Using the module

To use this module, add it to the modules array in the `config/config.js` file:
````javascript
modules: [
    {
        module: "googlecalendar",
        position: "top_left",   // This can be any of the regions.
        header: "Upcomming Events"
        config: {
            // The config property is optional.
            // If no config is set, an example calendar is shown.
            // See 'Configuration options' for more information.
        }
    }
]
````

## Configuration options

The following properties can be configured:


| Option                       | Description
| ---------------------------- | -----------
| `maximumEntries`             | The maximum number of events shown. / **Possible values:** `0` - `100` <br> **Default value:** `10`
| `maximumNumberOfDays`        | The maximum number of days in the future. <br><br> **Default value:** `365`
| `displaySymbol`              | Display a symbol in front of an entry. <br><br> **Possible values:** `true` or `false` <br> **Default value:** `true`
| `defaultSymbol`              | The default symbol. <br><br> **Possible values:** See [Font Awsome](http://fontawesome.io/icons/) website. <br> **Default value:** `calendar`
| `maxTitleLength`             | The maximum title length. <br><br> **Possible values:** `10` - `50` <br> **Default value:** `25`
| `fetchInterval`              | How often does the content needs to be fetched? (Milliseconds) <br><br> **Possible values:** `1000` - `86400000` <br> **Default value:** `300000` (5 minutes)
| `animationSpeed`             | Speed of the update animation. (Milliseconds) <br><br> **Possible values:**`0` - `5000` <br> **Default value:** `2000` (2 seconds)
| `fade`                       | Fade the future events to black. (Gradient) <br><br> **Possible values:** `true` or `false` <br> **Default value:** `true`
| `fadePoint`                  | Where to start fade? <br><br> **Possible values:** `0` (top of the list) - `1` (bottom of list) <br> **Default value:** `0.25`
| `titleReplace`               | An object of textual replacements applied to the tile of the event. This allow to remove or replace certains words in the title. <br><br> **Example:** `{'Birthday of ' : '', 'foo':'bar'}` <br> **Default value:** `{ "De verjaardag van ": "", "'s birthday": "" }`
| `displayRepeatingCountTitle` | Show count title for yearly repeating events (e.g. "X. Birthday", "X. Anniversary") <br><br> **Possible values:** `true` or `false` <br> **Default value:** `false`
| `dateFormat`                 | Format to use for the date of events (when using absolute dates) <br><br> **Possible values:** See [Moment.js formats](http://momentjs.com/docs/#/parsing/string-format/) <br> **Default value:** `MMM Do` (e.g. Jan 18th)
| `fullDayEventDateFormat`     | Format to use for the date of full day events (when using absolute dates) <br><br> **Possible values:** See [Moment.js formats](http://momentjs.com/docs/#/parsing/string-format/) <br> **Default value:** `MMM Do` (e.g. Jan 18th)
| `timeFormat`                 | Display event times as absolute dates, or relative time <br><br> **Possible values:** `absolute` or `relative` <br> **Default value:** `relative`
| `getRelative`                | How much time (in hours) should be left until calendar events start getting relative? <br><br> **Possible values:** `0` (events stay absolute) - `48` (48 hours before the event starts) <br> **Default value:** `6`
| `urgency`                    | When using a timeFormat of `absolute`, the `urgency` setting allows you to display events within a specific time frame as `relative`. This allows events within a certain time frame to be displayed as relative (in xx days) while others are displayed as absolute dates <br><br> **Possible values:** a positive integer representing the number of days for which you want a relative date, for example `7` (for 7 days) <br><br> **Default value:** `7`
| `broadcastEvents`            | If this property is set to true, the calendar will broadcast all the events to all other modules with the notification message: `CALENDAR_EVENTS`. The event objects are stored in an array and contain the following fields: `title`, `startDate`, `endDate`, `fullDayEvent`, `location` and `geo`. <br><br> **Possible values:** `true`, `false` <br><br> **Default value:** `true`
| `hidePrivate`                | Hides private calendar events. <br><br> **Possible values:** `true` or `false` <br> **Default value:** `false`
| `excludedEvents`             | An array of words / phrases from event titles that will be excluded from being shown. <br><br> **Example:** `['Birthday', 'Hide This Event']` <br> **Default value:** `[]`

### Calendar Setup

1. Go to [Google Cloud Platform Console](https://console.cloud.google.com/apis) and create a new project.
2. On the left sidebar, click on "Credentials" and then "Oauth consent screen". Here you'll have to fill the email address and the Product name. Save.
3. Go to "Credentials" tab, click on "create credentials" button and select OAuth client ID. Select "Web application".
On "Authorised redirect URIs" insert a local URL. This URL will be used by google to send your access token used to fetch calendar data. Something like "http://localhost/mmgooglecalendar" should work.
Hit create. 
4. Copy and store both generated client ID and secret.
5. now, go back to the `googlecalendar` module folder and edit `config/apiInfo.json` file.
6. Change `client_id`, `client_secret` and `redirect_uri` keys to the ones you chose in the steps above.
7. Run the Magic Mirror. Now, on you're terminal, you'll be asked to open an URL in your browser to authorise the application. Do it. Select the
account that you want to fetch google calendar events from. You should be redirected to the URL that you defined when setting up the project 
on Google Cloud Platform Console (something like `http://localhost/mmgooglecalendar?code=XXXXXXXXXXXX`). 
Now, copy the `?code` query value of the URL and paste it in terminal.
8. You're done! Now your events should be displayed in the Magic Mirror.

Note: If you want to remove the account, and connect another one, just remove the `.credentials` folder that is created after you authorise the 
module.