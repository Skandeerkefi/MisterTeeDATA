const GWS = require("../models/GWS");
const { User } = require("../models/User");
const fetch = (...args) =>
	import("node-fetch").then(({ default: fetch }) => fetch(...args));
exports.createGWS = async (req, res) => {
	const { title, endTime } = req.body;

	try {
		const gws = new GWS({ title, endTime, state: "active" }); // <-- set active here
		await gws.save();
		res.status(201).json({ message: "GWS created", gws });
	} catch (error) {
		res.status(500).json({ error: "Create GWS failed" });
	}
};

exports.joinGWS = async (req, res) => {
	const user = await User.findById(req.user.id);
	if (!user || !user.rainbetUsername) {
		return res
			.status(400)
			.json({ message: "Rainbet username is required to join GWs." });
	}

	// ✅ Calculate current biweekly range (starting from 2025-07-20)
	const now = new Date();
	const firstStart = new Date("2025-07-20T00:00:00Z");
	const daysSinceStart = Math.floor((now - firstStart) / (1000 * 60 * 60 * 24));
	const cycle = Math.floor(daysSinceStart / 14);
	const startDate = new Date(firstStart);
	startDate.setDate(startDate.getDate() + cycle * 14);
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + 13);

	const start_at = startDate.toISOString().split("T")[0];
	const end_at = endDate.toISOString().split("T")[0];

	// ✅ Fetch leaderboard from Rainbet API
	const url = `https://services.rainbet.com/v1/external/affiliates?start_at=${start_at}&end_at=${end_at}&key=${process.env.RAINBET_API_KEY}`;

	try {
		const response = await fetch(url);
		const data = await response.json();

		if (!data?.affiliates || !Array.isArray(data.affiliates)) {
			throw new Error("Invalid leaderboard response");
		}

		const isEligible = data.affiliates.some((entry) => {
			return (
				entry.username?.toLowerCase() === user.rainbetUsername.toLowerCase() &&
				parseFloat(entry.wagered_amount || "0") > 0
			);
		});

		if (!isEligible) {
			return res.status(403).json({
				message:
					"You must appear in the current biweekly leaderboard (by wagering on Rainbet) to enter this giveaway.",
			});
		}
	} catch (error) {
		console.error("Leaderboard check failed:", error);
		return res.status(500).json({ message: "Failed to validate eligibility." });
	}

	// ✅ Normal join logic
	try {
		const gws = await GWS.findById(req.params.id);
		if (!gws) return res.status(404).json({ message: "GWS not found" });

		if (gws.participants.includes(req.user.id)) {
			return res.status(400).json({ message: "Already joined" });
		}

		gws.participants.push(req.user.id);
		gws.totalParticipants += 1;
		gws.totalEntries += 1;
		await gws.save();

		res.json({ message: "Joined GWS", gws });
	} catch (error) {
		console.error("GWS join failed:", error);
		res.status(500).json({ message: "Join failed" });
	}
};

exports.updateGWS = async (req, res) => {
	const { winnerId, state } = req.body;

	try {
		const gws = await GWS.findById(req.params.id);
		if (!gws) return res.status(404).json({ message: "GWS not found" });

		if (winnerId) gws.winner = winnerId;
		if (state && ["active", "complete"].includes(state)) gws.state = state;

		await gws.save();
		res.json({ message: "GWS updated", gws });
	} catch {
		res.status(500).json({ error: "Failed to update GWS" });
	}
};
exports.drawWinner = async (req, res) => {
	try {
		const gws = await GWS.findById(req.params.id).populate("participants");
		if (!gws || gws.participants.length === 0) {
			return res.status(400).json({ message: "No participants to draw from." });
		}

		const randomIndex = Math.floor(Math.random() * gws.participants.length);
		const winner = gws.participants[randomIndex];

		gws.winner = winner._id;
		gws.state = "complete";
		await gws.save();

		res.json({
			message: "Winner selected",
			winner: { id: winner._id, kickUsername: winner.kickUsername },
			gws,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Failed to draw winner." });
	}
};
exports.getAllGWS = async (req, res) => {
	try {
		const giveaways = await GWS.find()
			.populate("winner", "kickUsername") // only include username
			.populate("participants", "kickUsername");
		res.json(giveaways);
	} catch (err) {
		console.error("❌ getAllGWS error:", err);
		res.status(500).json({ message: "Failed to fetch giveaways." });
	}
};
// Helper to auto-draw winner and update state
exports.drawWinnerAuto = async (gws) => {
	if (!gws.participants || gws.participants.length === 0) {
		gws.state = "complete";
		await gws.save();
		return;
	}

	const randomIndex = Math.floor(Math.random() * gws.participants.length);
	const winner = gws.participants[randomIndex];

	gws.winner = winner;
	gws.state = "complete"; // IMPORTANT: set state to complete here
	await gws.save();
};
