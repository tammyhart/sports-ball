require("dotenv").config();
const axios = require("axios");
const { WebClient } = require("@slack/web-api");
const cron = require("node-cron");

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

async function fetchNcaaStats() {
  try {
    const response = await axios.get(
      "https://api.collegefootballdata.com/games",
      {
        params: {
          year: new Date().getFullYear(),
          week: getCurrentWeek(),
          seasonType: "regular",
        },
        headers: {
          Authorization: `Bearer ${process.env.CFBD_API_KEY}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching NCAA stats:", error);
    return null;
  }
}

function getCurrentWeek() {
  // This is a simplified way to get the current week. You may need to adjust this logic.
  const now = new Date();
  const startOfSeason = new Date(now.getFullYear(), 7, 1); // August 1st
  const weeksSinceStart = Math.floor(
    (now - startOfSeason) / (7 * 24 * 60 * 60 * 1000)
  );
  return Math.max(1, weeksSinceStart);
}

function formatStatsMessage(stats) {
  if (!stats || stats.length === 0) {
    return "No games data available for this week.";
  }

  let message = "NCAA Football Stats for Week " + getCurrentWeek() + ":\n\n";
  stats.forEach((game) => {
    message += `${game.home_team} ${game.home_points} - ${game.away_team} ${game.away_points}\n`;
  });

  return message;
}

async function postToSlack(message) {
  try {
    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: message,
    });
    console.log("Message posted to Slack successfully");
  } catch (error) {
    console.error("Error posting message to Slack:", error);
  }
}

async function updateStats() {
  const stats = await fetchNcaaStats();
  const message = formatStatsMessage(stats);
  await postToSlack(message);
}

// Schedule the job to run every Sunday at 9:00 AM
cron.schedule("0 9 * * 0", updateStats);

console.log(
  "NCAA Stats Bot is running. Stats will be posted every Sunday at 9:00 AM."
);
