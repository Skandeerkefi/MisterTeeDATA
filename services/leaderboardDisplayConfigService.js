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

const DEFAULT_JUICE_PRIZES = {
	1: 500,
	2: 300,
	3: 150,
	4: 100,
	5: 75,
	6: 50,
	7: 25,
	8: 0,
	9: 0,
	10: 0,
};

const CSBATTLE_FROM_FALLBACK = "2025-04-10 00:00:00";
const CSBATTLE_TO_FALLBACK = "2030-04-19 23:59:59";

function getCurrentUtcMonthRange() {
	const now = new Date();
	const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
	const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

	return {
		startDate: startDate.toISOString().slice(0, 10),
		endDate: endDate.toISOString().slice(0, 10),
	};
}

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
	const juiceDates = getCurrentUtcMonthRange();

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
		juice: {
			startDate: (doc?.juice?.startDate && String(doc.juice.startDate).trim()) || juiceDates.startDate,
			endDate: (doc?.juice?.endDate && String(doc.juice.endDate).trim()) || juiceDates.endDate,
			prizes: mapToObject(doc?.juice?.prizeByRank, DEFAULT_JUICE_PRIZES),
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
	const juicePrizes = parsePrizeBody(body?.juice?.prizes, DEFAULT_JUICE_PRIZES);

	const roobetDates = normalizeRoobetDates(
		body?.roobet?.startDate,
		body?.roobet?.endDate
	);
	const juiceDates = {
		...getCurrentUtcMonthRange(),
		startDate:
			typeof body?.juice?.startDate === "string" && body.juice.startDate.trim()
				? body.juice.startDate.trim()
				: getCurrentUtcMonthRange().startDate,
		endDate:
			typeof body?.juice?.endDate === "string" && body.juice.endDate.trim()
				? body.juice.endDate.trim()
				: getCurrentUtcMonthRange().endDate,
	};

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
				"juice.startDate": juiceDates.startDate,
				"juice.endDate": juiceDates.endDate,
				"juice.prizeByRank": new Map(Object.entries(juicePrizes)),
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
	DEFAULT_JUICE_PRIZES,
	CSBATTLE_FROM_FALLBACK,
	CSBATTLE_TO_FALLBACK,
};
