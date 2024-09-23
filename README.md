# SportsBall Slack Bot

Automatically post NCAAF scores to Slack every Monday at 9am Central time. Instructions include deploying and running with Heroku.

**Notes:**

- I've also included the upcoming game schedules for my family's favorite teams: 🐘 Alabama, 🍊 Tennessee, 🤠 Oklahoma State
- You'll want to customize your Heroku timezone and the timezone specified in `index.js#dateOptions.timezone` to match your preferred timezone

## Install

To run locally, you can `npm install` or `yarn`. Then after you complete the Setup instructions below, you can `npm start` or `yarn start` and use the routes outlined in the Usage instructions below.

## Setup

1. Get an API key from [College Football Data API](https://collegefootballdata.com/)
2. Create a [Slack app](https://api.slack.com/apps)
3. Go to the Slack app's "OAuth & Permissions" settings page
4. Add the following scopes: `channels:read` and `chat:write`
5. At the top of that same page, click the button to install the app on your workspace
6. Save the Bot User OAuth Token that generates
7. In your Slack workspace, create the channel you want to post in
8. Open the channel details by clicking the name at the top
9. At the bottom of that modal, copy the channel ID
10. Invite your Slack app/bot to the channel
11. Create a .env file with the following variables:

```
CFBD_API_KEY=your_unique_api_key
SLACK_BOT_TOKEN=your_oauth_bot_token
SLACK_CHANNEL_ID=your_slack_channel
```

11. Create a project on Heroku
12. Connect the project to your fork of this repo and enable auto deploy
13. Add the variables from step 10 in the project's settings under "Config Vars"
14. On the Resources tab, toggle the worker dyno on
15. Still on the Resources tab, search for and add the "Heroku Scheduler"
16. Open the scheduler and add a job to run hourly with the command `curl https://your-app-id.herokuapp.com/` (replace `your-app-id` so that the Heroku app url is correct)

## Usage

This will begin running the script and the message will be posted in your Slack channel every Monday at 9am.

To view the output without posting a message to Slack, you can visit your app url in a browser.

- Local app url if running the node server on your machine: `http://localhost:3000`
- Hosted app url is your Heroku project's url, e.g. `https://your-app-id.herokuapp.com`

There is also an endpoint to test posting the message. By visiting this URL, a message will post immediately to your Slack channel

- Local: `http://localhost:3000/test-message`
- Hosted: `https://your-app-id.herokuapp.com/test-message`
