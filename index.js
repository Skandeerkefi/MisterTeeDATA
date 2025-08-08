const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cron = require("node-cron");
const { drawWinnerAuto } = require("./controllers/gwsController"); // You create this
dotenv.config();
const GWS = require("./models/GWS");
const fetch = (...args) =>
	import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = 3000;

// Schedule job to run every minute
cron.schedule("* * * * *", async () => {
	console.log("Running giveaway auto-draw job...");
	const now = new Date();

	try {
		const giveawaysToDraw = await GWS.find({
			state: "active",
			endTime: { $lte: now },
		}).populate("participants");

		for (const gws of giveawaysToDraw) {
			await drawWinnerAuto(gws); // call the helper above
			console.log(`Giveaway ${gws._id} winner drawn automatically.`);
		}
	} catch (err) {
		console.error("Error during auto draw:", err);
	}
});

// Logging Middleware
app.use((req, res, next) => {
	console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
	const originalSend = res.send;
	res.send = function (body) {
		console.log(
			`[${new Date().toISOString()}] Response Headers:`,
			res.getHeaders()
		);
		return originalSend.call(this, body);
	};
	next();
});

// CORS Middleware
const allowedOrigins = [
	"http://localhost:5173",
	"https://moneylife1k.vercel.app",
];

app.use(
	cors({
		origin: function (origin, callback) {
			// allow requests with no origin like curl or Postman
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			} else {
				return callback(new Error("CORS policy: This origin is not allowed"));
			}
		},
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

app.use(express.json());

// MongoDB Connection
mongoose
	.connect(process.env.MONGO_URI)
	.then(() => console.log("✅ MongoDB connected"))
	.catch((err) => console.error("❌ MongoDB connection error:", err));

// Models
const { User } = require("./models/User");
const { SlotCall } = require("./models/SlotCall");

// Middleware
const { verifyToken, isAdmin } = require("./middleware/auth");

// Routes
const slotCallRoutes = require("./routes/slotCallRoutes");

// Auth Routes
app.post("/api/auth/register", async (req, res) => {
	const { kickUsername, rainbetUsername, password, confirmPassword } = req.body;

	if (password !== confirmPassword) {
		return res.status(400).json({ message: "Passwords do not match." });
	}

	const existing = await User.findOne({ kickUsername });
	const existingRainbet = await User.findOne({ rainbetUsername });
	if (existing || existingRainbet)
		return res.status(400).json({ message: "Username already exists." });

	const hashed = await bcrypt.hash(password, 10);
	const newUser = new User({ kickUsername, rainbetUsername, password: hashed });
	await newUser.save();

	res.status(201).json({ message: "User registered." });
});

app.post("/api/auth/login", async (req, res) => {
	const { kickUsername, password } = req.body;

	const user = await User.findOne({ kickUsername });
	if (!user) return res.status(404).json({ message: "User not found." });

	const match = await bcrypt.compare(password, user.password);
	if (!match) return res.status(401).json({ message: "Invalid credentials." });

	const token = jwt.sign(
		{ id: user._id, role: user.role, kickUsername: user.kickUsername },
		process.env.JWT_SECRET,
		{ expiresIn: "7d" }
	);

	res.json({
		token,
		user: { id: user._id, kickUsername: user.kickUsername, role: user.role },
	});
});

// Slot Call Routes
app.use("/api/slot-calls", slotCallRoutes);

// Affiliates Route
app.get("/api/affiliates", async (req, res) => {
	const { start_at, end_at } = req.query;

	if (!start_at || !end_at) {
		return res
			.status(400)
			.json({ error: "Missing start_at or end_at parameter" });
	}

	const url = `https://services.rainbet.com/v1/external/affiliates?start_at=${start_at}&end_at=${end_at}&key=${process.env.RAINBET_API_KEY}`;

	try {
		const response = await fetch(url);
		const content = await response.text();
		if (!response.ok) throw new Error(content);
		res.json(JSON.parse(content));
	} catch (error) {
		res.status(500).json({ error: "Failed to fetch affiliates data" });
	}
});

const gwsRoutes = require("./routes/gwsRoutes");
app.use("/api/gws", gwsRoutes);

// Start Server
app.listen(PORT, () =>
	console.log(`✅ Server is running at http://localhost:${PORT}`)
);
