const LeaderboardDisplaySettings = require("../models/LeaderboardDisplaySettings");

const DEFAULT_ROOBET_PRIZES = {
	1: 675,
	2: 300,
	3: 175,
	4: 100,
	5: 80,
	6: 70,
	7: 50,
	8: 25,
	9: 25,
};

const DEFAULT_CSBATTLE_PRIZES = {
	1: 500,
	2: 300,
	3: 150,
	4: 100,
	5: 75,
	6: 50,
	7: 25,
};

const CSBATTLE_FROM_FALLBACK = "2025-04-10 00:00:00";
const CSBATTLE_TO_FALLBACK = "2030-04-19 23:59:59";

function mapToObject(mapOrObj, fallback) {
	const base = { ...fallback };
	if (!mapOrObj) return base;
	const raw =
		mapOrObj instanceof Map ? Object.fromEntries(mapOrObj) : { ...mapOrObj };
	for (const [k, v] of Object.entries(raw)) {
		const n = Number(v);
		if (Number.isFinite(n) && n >= 0) base[String(k)] = n;
	}
	return base;
}

function normalizeRoobetDates(startDate, endDate) {
	const s = typeof startDate === "string" ? startDate.trim() : "";
	const e = typeof endDate === "string" ? endDate.trim() : "";
	return {
		startDate: s || null,
		endDate: e || null,
	};
}

async function getLeaderboardDisplayConfig() {
	const doc = await LeaderboardDisplaySettings.findOne({ key: "default" }).lean();

	const roobetDates = normalizeRoobetDates(
		doc?.roobet?.startDate,
		doc?.roobet?.endDate
	);

	return {
		roobet: {
			startDate: roobetDates.startDate,
			endDate: roobetDates.endDate,
			prizes: mapToObject(doc?.roobet?.prizeByRank, DEFAULT_ROOBET_PRIZES),
		},
		csbattle: {
			from: (doc?.csbattle?.from && String(doc.csbattle.from).trim()) || CSBATTLE_FROM_FALLBACK,
			to: (doc?.csbattle?.to && String(doc.csbattle.to).trim()) || CSBATTLE_TO_FALLBACK,
			prizes: mapToObject(doc?.csbattle?.prizeByRank, DEFAULT_CSBATTLE_PRIZES),
		},
	};
}

function parsePrizeBody(input, fallback) {
	if (!input || typeof input !== "object") return { ...fallback };
	const out = { ...fallback };
	for (const key of Object.keys(fallback)) {
		const v = input[key];
		if (v === "" || v === undefined || v === null) continue;
		const n = Number(v);
		if (Number.isFinite(n) && n >= 0) out[key] = n;
	}
	return out;
}

async function upsertLeaderboardDisplayConfig(body) {
	const roobetPrizes = parsePrizeBody(body?.roobet?.prizes, DEFAULT_ROOBET_PRIZES);
	const csbattlePrizes = parsePrizeBody(body?.csbattle?.prizes, DEFAULT_CSBATTLE_PRIZES);

	const roobetDates = normalizeRoobetDates(
		body?.roobet?.startDate,
		body?.roobet?.endDate
	);

	const from =
		typeof body?.csbattle?.from === "string" && body.csbattle.from.trim()
			? body.csbattle.from.trim()
			: CSBATTLE_FROM_FALLBACK;
	const to =
		typeof body?.csbattle?.to === "string" && body.csbattle.to.trim()
			? body.csbattle.to.trim()
			: CSBATTLE_TO_FALLBACK;

	await LeaderboardDisplaySettings.findOneAndUpdate(
		{ key: "default" },
		{
			$set: {
				"roobet.startDate": roobetDates.startDate || "",
				"roobet.endDate": roobetDates.endDate || "",
				"roobet.prizeByRank": new Map(Object.entries(roobetPrizes)),
				"csbattle.from": from,
				"csbattle.to": to,
				"csbattle.prizeByRank": new Map(Object.entries(csbattlePrizes)),
			},
		},
		{ upsert: true, new: true }
	);

	return getLeaderboardDisplayConfig();
}

module.exports = {
	getLeaderboardDisplayConfig,
	upsertLeaderboardDisplayConfig,
	DEFAULT_ROOBET_PRIZES,
	DEFAULT_CSBATTLE_PRIZES,
	CSBATTLE_FROM_FALLBACK,
	CSBATTLE_TO_FALLBACK,
};
