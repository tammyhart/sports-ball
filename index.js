require("dotenv").config()
const axios = require("axios")
const { WebClient } = require("@slack/web-api")
const cron = require("node-cron")
const express = require("express")

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)
const app = express()
const port = process.env.PORT || 3000

const dateOptions = {
  weekday: "long",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  timeZone: "America/Chicago",
}

function getPreviousWeek() {
  const now = new Date()
  const currentYear = now.getFullYear()

  // Define the start date of the college football season
  // Week 1 started on August 23, 2025
  const seasonStart = new Date(currentYear, 7, 23) // August 24th

  // Calculate the number of days since the start of the season
  const daysSinceStart = Math.floor((now - seasonStart) / (24 * 60 * 60 * 1000))

  // Calculate the week number
  const weekNumber = Math.floor(daysSinceStart / 7)

  return Math.max(1, weekNumber)
}

function formatTeams(teams) {
  const emoji = {
    Alabama: "🐘",
    "Oklahoma State": "🤠",
    Tennessee: "🍊",
  }
  return teams.map((team) => `${emoji[team]} ${team}`).join(", ")
}

function fetchOptions(thisWeek = false, params = {}) {
  const previousWeek = getPreviousWeek()
  return {
    params: {
      year: new Date().getFullYear(),
      week: thisWeek ? previousWeek + 1 : previousWeek,
      seasonType: "regular",
      classification: "fbs",
      ...params,
    },
    headers: {
      Authorization: `Bearer ${process.env.CFBD_API_KEY}`,
    },
  }
}

async function fetchTop25Teams() {
  try {
    const response = await axios.get(
      "https://api.collegefootballdata.com/rankings",
      fetchOptions()
    )

    const apPoll = response.data[0].polls.find(
      (poll) => poll.poll === "AP Top 25"
    )
    if (!apPoll) {
      throw new Error("AP Top 25 poll not found in the response")
    }

    // Return an object with team names as keys and ranks as values
    return apPoll.ranks.reduce((acc, team) => {
      acc[team.school] = team.rank
      return acc
    }, {})
  } catch (error) {
    console.error("Error fetching top 25 teams:", error)
    return null
  }
}

async function fetchTop25Games(rankings) {
  try {
    const response = await axios.get(
      "https://api.collegefootballdata.com/games",
      fetchOptions()
    )

    const top25Games = response.data.filter(
      (game) =>
        rankings.hasOwnProperty(game.homeTeam) ||
        rankings.hasOwnProperty(game.awayTeam)
    )

    // Sort games by the highest rank of participating teams
    return top25Games.sort((a, b) => {
      const aRank = Math.min(
        rankings[a.homeTeam] || Infinity,
        rankings[a.awayTeam] || Infinity
      )
      const bRank = Math.min(
        rankings[b.homeTeam] || Infinity,
        rankings[b.awayTeam] || Infinity
      )
      return aRank - bRank
    })
  } catch (error) {
    console.error("Error fetching top 25 games:", error)
    return null
  }
}

async function fetchUpcomingGamesData(teams) {
  try {
    // Fetch all games data and media data
    const [gamesResponse, mediaResponse] = await Promise.all([
      axios.get(
        "https://api.collegefootballdata.com/games",
        fetchOptions(true)
      ),
      axios.get(
        "https://api.collegefootballdata.com/games/media",
        fetchOptions(true, { mediaType: "tv" })
      ),
    ])

    // Filter and combine the data
    const upcomingGames = gamesResponse.data
      .filter(
        (game) => teams.includes(game.homeTeam) || teams.includes(game.awayTeam)
      )
      .map((game) => {
        const mediaInfo = mediaResponse.data.find(
          (mediaGame) =>
            mediaGame.id === game.id ||
            (mediaGame.homeTeam === game.homeTeam &&
              mediaGame.awayTeam === game.awayTeam)
        )

        return {
          ...game,
          tv: mediaInfo ? mediaInfo.outlet : "",
        }
      })

    return upcomingGames
  } catch (error) {
    console.error("Error fetching upcoming games data:", error)
    return null
  }
}

function formatScore(rank, team, points) {
  if (rank) return `\`#${rank} ${team} - ${points}\``
  return `${team} - ${points}`
}

function formatTop25GamesMessage(games, rankings) {
  if (!games || games.length === 0) {
    return [
      {
        text: "⛔️ No games involving top 25 teams available for this week.",
      },
    ]
  }

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🏈 NCAAF Game Scores for Week ${getPreviousWeek()} from the Top 25 Teams: 🏈`,
        emoji: true,
      },
    },
    {
      type: "divider",
    },
  ]

  games.forEach((game) => {
    const text = `> ${formatScore(
      rankings[game.awayTeam],
      game.awayTeam,
      game.awayPoints
    )} ＠ ${formatScore(
      rankings[game.homeTeam],
      game.homeTeam,
      game.homePoints
    )}\n`

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text,
      },
    })
  })

  return blocks
}

function formatUpcomingGamesMessage(games, teams) {
  if (!games || games.length === 0) {
    return [
      {
        text: `⛔️ No upcoming games found for ${formatTeams(
          teams
        )} this week.`,
      },
    ]
  }

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Upcoming Games in Week ${
          getPreviousWeek() + 1
        } for ${formatTeams(teams)}:`,
        emoji: true,
      },
    },
    {
      type: "divider",
    },
  ]

  games.forEach((game) => {
    let text = `${game.awayTeam} @ ${game.homeTeam}\n`
    text += `📍 Venue: ${game.venue}\n`
    text += `⏰ Kickoff: ${new Date(game.startDate).toLocaleString(
      "en-US",
      dateOptions
    )} CT\n`
    text += `📺 Watch on: ${game.tv || "None"}\n`
    text += "\n"

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text,
      },
    })
  })

  return blocks
}

async function fetchTop25GamesMessage() {
  const rankings = await fetchTop25Teams()
  const games = await fetchTop25Games(rankings)
  return formatTop25GamesMessage(games, rankings)
}

async function fetchUpcomingGamesMessage() {
  const specificTeams = ["Alabama", "Tennessee", "Oklahoma State"]
  const upcomingGames = await fetchUpcomingGamesData(specificTeams)
  return formatUpcomingGamesMessage(upcomingGames, specificTeams)
}

async function fetchMessage() {
  const [top25GamesMessage, upcomingGamesMessage] = await Promise.all([
    fetchTop25GamesMessage(),
    fetchUpcomingGamesMessage(),
  ])
  return { blocks: [...top25GamesMessage, ...upcomingGamesMessage] }
}

async function updateAndPostStats() {
  const message = await fetchMessage()
  await postToSlack(message)
}

async function postToSlack(message) {
  try {
    if (typeof message === "string") {
      await slack.chat.postMessage({
        channel: process.env.SLACK_CHANNEL_ID,
        text: message,
      })
    } else {
      // If the message is a Block Kit object, use the 'blocks' property
      await slack.chat.postMessage({
        channel: process.env.SLACK_CHANNEL_ID,
        blocks: message.blocks,
        text: "NCAAF Game Scores", // Fallback text for notifications
      })
    }
    console.log("Message posted to Slack successfully")
  } catch (error) {
    console.error("Error posting message to Slack:", error)
  }
}

// Main route
app.get("/", async (req, res) => {
  try {
    const message = await fetchMessage()
    res.send(message)
  } catch (error) {
    res.status(500).send("Error fetching top 25 games")
  }
})

// Add a test endpoint
app.get("/test-message", async (req, res) => {
  try {
    const message = await fetchMessage()
    await postToSlack(message)
    res.send("Test message sent successfully!")
  } catch (error) {
    console.error("Error sending test message:", error)
    res.status(500).send("Error sending test message")
  }
})

// Start the Express server
app.listen(port, () => {
  console.log(
    `SportsBall is running on port ${port}. Stats will be posted every Monday at 9:00 AM.`
  )
  console.log(`Current week calculation: ${getPreviousWeek()}`)
})

// Schedule the job to run every Monday at 9:00 AM
cron.schedule("0 9 * * 1", () => {
  console.log("Running scheduled update...")
  updateAndPostStats()
})
