require("dotenv").config()
const { fetchMessage, postToSlack } = require("./lib.js")

// The main function that runs the job
async function updateAndPostStats() {
  const message = await fetchMessage()
  await postToSlack(message)
}

// Execute the job and then exit the process
updateAndPostStats()
  .then(() => {
    console.log("Cron job finished successfully.")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Cron job failed:", error)
    process.exit(1)
  })
