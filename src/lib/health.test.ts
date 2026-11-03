import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Tauri HTTP plugin before importing the module under test.
vi.mock("@tauri-apps/plugin-http", () => ({
	fetch: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
	sendNotification: vi.fn(),
	isPermissionGranted: vi.fn(),
	requestPermission: vi.fn(),
}));

import { fetch } from "@tauri-apps/plugin-http";
import {
	sendNotification,
	isPermissionGranted,
	requestPermission,
} from "@tauri-apps/plugin-notification";
import {
	normalizeUrl,
	getStoredUrls,
	setStoredUrls,
	getStoredHealth,
	setStoredHealth,
	getStoredIntervalMs,
	setStoredIntervalMs,
	checkUrl,
	checkAll,
	sendDownNotification,
	sendUpNotification,
	type HealthEntry,
} from "$lib/health";

describe("normalizeUrl", () => {
	it("adds https:// scheme when missing", () => {
		expect(normalizeUrl("www.christopherbroome.com")).toBe("https://www.christopherbroome.com");
	});

	it("lowercases the scheme and strips trailing slashes", () => {
		expect(normalizeUrl("Https://www.christopherbroome.com/")).toBe("https://www.christopherbroome.com");
	});

	it("trims whitespace", () => {
		expect(normalizeUrl("   https://example.com/path/  ")).toBe("https://example.com/path");
	});

	it("returns empty string for empty input", () => {
		expect(normalizeUrl("   ")).toBe("");
	});
});

describe("stored urls", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("returns empty array when nothing stored", () => {
		expect(getStoredUrls()).toEqual([]);
	});

	it("round-trips stored urls", () => {
		setStoredUrls(["https://example.com", "https://other.com"]);
		expect(getStoredUrls()).toEqual(["https://example.com", "https://other.com"]);
	});

	it("returns empty array when stored value is invalid", () => {
		window.localStorage.setItem("health-check.urls", "not-json");
		expect(getStoredUrls()).toEqual([]);
	});
});

describe("stored health", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("returns empty object when nothing stored", () => {
		expect(getStoredHealth()).toEqual({});
	});

	it("round-trips health entries", () => {
		const entry: HealthEntry = {
			url: "https://example.com",
			status: 200,
			ok: true,
			lastCheckedAt: 1234,
			lastError: null,
		};
		setStoredHealth({ "https://example.com": entry });
		expect(getStoredHealth()["https://example.com"]).toEqual(entry);
	});

	it("returns empty object when stored value is invalid", () => {
		window.localStorage.setItem("health-check.health", "not-json");
		expect(getStoredHealth()).toEqual({});
	});
});

describe("stored interval", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("defaults to 2 hours when nothing stored", () => {
		expect(getStoredIntervalMs()).toBe(2 * 60 * 60 * 1000);
	});

	it("round-trips the interval", () => {
		setStoredIntervalMs(60_000);
		expect(getStoredIntervalMs()).toBe(60_000);
	});
});

describe("checkUrl", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("marks a 2xx response as ok", async () => {
		vi.mocked(fetch).mockResolvedValue({
			status: 200,
			ok: true,
		} as unknown as Response);

		const entry = await checkUrl("https://example.com");
		expect(entry.ok).toBe(true);
		expect(entry.status).toBe(200);
	});

	it("marks a 500 response as down", async () => {
		vi.mocked(fetch).mockResolvedValue({
			status: 500,
			ok: false,
		} as unknown as Response);

		const entry = await checkUrl("https://example.com");
		expect(entry.ok).toBe(false);
		expect(entry.status).toBe(500);
	});

	it("marks an unreachable request as down", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

		const entry = await checkUrl("https://example.com");
		expect(entry.ok).toBe(false);
		expect(entry.lastError).toBeTruthy();
	});

	it("normalizes the url before fetching", async () => {
		vi.mocked(fetch).mockResolvedValue({
			status: 200,
			ok: true,
		} as unknown as Response);

		const entry = await checkUrl("https://example.com/");
		expect(entry.url).toBe("https://example.com");
		expect(fetch).toHaveBeenCalledWith("https://example.com");
	});
});

describe("checkAll", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("checks every url and returns results keyed by url", async () => {
		vi.mocked(fetch).mockImplementation(async (input: string | URL | Request) => {
			const url = typeof input === "string" ? input : String(input);
			if (url.includes("bad")) {
				return { status: 500, ok: false } as unknown as Response;
			}
			return { status: 200, ok: true } as unknown as Response;
		});

		const results = await checkAll(["https://good.com", "https://bad.com"]);
		expect(Object.keys(results).sort()).toEqual(["https://bad.com", "https://good.com"]);
		expect(results["https://good.com"].ok).toBe(true);
		expect(results["https://bad.com"].ok).toBe(false);
	});
});

describe("notifications", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sends a down notification when permission granted", async () => {
		vi.mocked(isPermissionGranted).mockResolvedValue(true);
		const sendSpy = vi.mocked(sendNotification);

		await sendDownNotification("https://example.com", 503);
		expect(sendSpy).toHaveBeenCalledTimes(1);
		expect(sendSpy).toHaveBeenCalledWith(
			expect.objectContaining({ title: expect.stringContaining("down") }),
		);
	});

	it("does nothing when permission denied", async () => {
		vi.mocked(isPermissionGranted).mockResolvedValue(false);
		vi.mocked(requestPermission).mockResolvedValue("denied");

		await sendDownNotification("https://example.com", 503);
		expect(sendNotification).not.toHaveBeenCalled();
	});

	it("sends an up notification when permission granted", async () => {
		vi.mocked(isPermissionGranted).mockResolvedValue(true);
		const sendSpy = vi.mocked(sendNotification);

		await sendUpNotification("https://example.com");
		expect(sendSpy).toHaveBeenCalledTimes(1);
		expect(sendSpy).toHaveBeenCalledWith(
			expect.objectContaining({ title: expect.stringContaining("up") }),
		);
	});

	it("does nothing when permission not granted", async () => {
		vi.mocked(isPermissionGranted).mockResolvedValue(false);
		vi.mocked(requestPermission).mockResolvedValue("denied");

		await sendUpNotification("https://example.com");
		expect(sendNotification).not.toHaveBeenCalled();
	});
});