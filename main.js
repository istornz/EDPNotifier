// Libraries
const axios        = require('axios');
const cheerio      = require('cheerio');
const dotenv       = require('dotenv');
const cron         = require('node-cron');
const Push         = require( 'pushover-notifications' );
const OneSignal    = require( 'onesignal-node' );
const LocalStorage = require( 'node-localstorage' ).LocalStorage;

// Configure DotEnv
dotenv.config();

// Constants
const edpUrlCheck = 'https://www.dealabs.com/discussions/le-topic-des-erreurs-de-prix-1056379?page=9999999#thread-comments';
const localStorage = new LocalStorage('./data');
const pusher = new Push( {
  user: process.env.USER_KEY,
  token: process.env.API_TOKEN,
});
const oneSignalClient = new OneSignal.Client({      
  userAuthKey: process.env.AUTH_KEY,
  app: {
    appAuthKey: process.env.APP_AUTH_KEY,
    appId: process.env.APP_ID
  }      
});

// Run the fetcher once it started
fetcher();

// Setup crontab every 5min
cron.schedule('*/5 * * * *', () => {
  console.log('Running fetcher !');
  fetcher();
});

function fetcher() {
  const latestSavedCommentId = localStorage.getItem('latestSavedCommentId');

  axios(edpUrlCheck)
  .then(response => {
    const html = response.data;
    const $ = cheerio.load(html);
    const statsTable = $('.comments-list--paginated > article');
    var currentLatestCommentHtml = statsTable[statsTable.length - 1];

    // Get last comment data
    const currentLatestComment = {
      id: $(currentLatestCommentHtml).attr('id'),
      posterName: $(currentLatestCommentHtml).find('.user > span').text(),
      time: $(currentLatestCommentHtml).find('.lbox--v-3 > time').text(),
      comment: $(currentLatestCommentHtml).find('.userHtml').text()
    }

    // Check if it's a new deal or not :)
    if (latestSavedCommentId != currentLatestComment.id) {
      // It's a new deal !, let's create a push notification
      
      /* PushOver config
      var msg = {
        message: currentLatestComment.comment,
        title: 'New EDP Deal !',
        sound: 'magic',
        priority: 1
      }

      // Send the push !
      pusher.send(msg);
      */

      // OneSignal config
      var msg = new OneSignal.Notification({
        headings: {
          en: 'New EDP Deal !'     
        },
        contents: {
          en: currentLatestComment.comment      
        },
        included_segments: [ 'Active Users' ],
        excluded_segments: [ 'Banned Users' ],
      });
      oneSignalClient.sendNotification(msg)
        .finally(()=> {
          // Then save it for later use...
          localStorage.setItem('latestSavedCommentId', currentLatestComment.id);
        });
    }
  })
}