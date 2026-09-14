const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { Affiliate } = require("./models/Affiliate");

dotenv.config();

const rewardsData = {
  Roobet: [
    { icon: "🏅", label: "Monthly Leaderboard" },
    { icon: "💵", label: "Weekly Deposit bonus" },
    { icon: "🎁", label: "Monthly wager promotion" },
    { icon: "🎰", label: "Weekly free spins giveaway" },
  ],
  CSGOWIN: [
    { icon: "🏅", label: "Monthly Leaderboard" },
    { icon: "💵", label: "Weekly Deposit bonus" },
    { icon: "🎁", label: "Monthly wager promotion" },
    { icon: "🔪", label: "Weekly free battle giveaway" },
  ],
  JuiceGG: [
    { icon: "🏅", label: "Monthly Leaderboard" },
    { icon: "💵", label: "Weekly Deposit bonus" },
    { icon: "🎁", label: "Monthly wager promotion" },
    { icon: "🔪", label: "Weekly free battle giveaway" },
  ],
};

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  for (const [name, rewards] of Object.entries(rewardsData)) {
    const result = await Affiliate.updateOne(
      { name: { $regex: new RegExp(name, "i") } },
      { $set: { rewards } }
    );
    console.log(`${name}: matched=${result.matchedCount}, modified=${result.modifiedCount}`);
  }

  await mongoose.disconnect();
  console.log("Done");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});