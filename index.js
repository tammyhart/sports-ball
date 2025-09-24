require("dotenv").config()
const express = require("express")

const { getPreviousWeek, fetchMessage, postToSlack } = require("./lib.js")

const app = express()
const port = process.env.PORT || 3000

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
app.get("/test", async (req, res) => {
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
