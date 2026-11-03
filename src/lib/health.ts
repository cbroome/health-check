import { fetch } from "@tauri-apps/plugin-http";
import {
	sendNotification,
	isPermissionGranted,
	requestPermission,
} from "@tauri-apps/plugin-notification";

export interface HealthEntry {
	url: string;
	status: number;
	ok: boolean;
	lastCheckedAt: number | null;
	lastError: string | null;
}

export const DEFAULT_INTERVAL_MS = 2 * 60 * 60 * 1000;

const URLS_KEY = "health-check.urls";
const HEALTH_KEY = "health-check.health";
const NOTIFIED_KEY = "health-check.notified";
const INTERVAL_KEY = "health-check.intervalMs";

export function normalizeUrl(raw: string): string {
	let url = raw.trim();
	if (!url) return "";
	const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url);
	if (hasScheme) {
		url = url.replace(/([a-zA-Z][a-zA-Z0-9+.-]*:)\/\//i, (m) => m.toLowerCase());
	} else {
		url = `https://${url}`;
	}
	while (url.endsWith("/")) url = url.slice(0, -1);
	return url;
}

function read<T>(key: string): T | null {
	try {
		const raw = window.localStorage.getItem(key);
		if (raw == null) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

function write(key: string, value: unknown): void {
	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// storage unavailable; ignore
	}
}

export function getStoredUrls(): string[] {
	const v = read<string[]>(URLS_KEY);
	return Array.isArray(v) ? v : [];
}

export function setStoredUrls(urls: string[]): void {
	write(URLS_KEY, urls);
}

export function getStoredHealth(): Record<string, HealthEntry> {
	const v = read<Record<string, HealthEntry>>(HEALTH_KEY);
	return v && typeof v === "object" ? v : {};
}

export function setStoredHealth(health: Record<string, HealthEntry>): void {
	write(HEALTH_KEY, health);
}

export function getStoredNotified(): Record<string, boolean> {
	const v = read<Record<string, boolean>>(NOTIFIED_KEY);
	return v && typeof v === "object" ? v : {};
}

export function setStoredNotified(notified: Record<string, boolean>): void {
	write(NOTIFIED_KEY, notified);
}

export function getStoredIntervalMs(): number {
	const v = read<number>(INTERVAL_KEY);
	return typeof v === "number" && Number.isFinite(v) ? v : DEFAULT_INTERVAL_MS;
}

export function setStoredIntervalMs(ms: number): void {
	write(INTERVAL_KEY, ms);
}

export async function checkUrl(rawUrl: string): Promise<HealthEntry> {
	const url = normalizeUrl(rawUrl);
	const base: HealthEntry = {
		url,
		status: 0,
		ok: false,
		lastCheckedAt: Date.now(),
		lastError: null,
	};
	try {
		const response = await fetch(url);
		const status = response.status;
		const ok = status >= 200 && status < 400;
		return { ...base, status, ok, lastError: ok ? null : `HTTP ${status}` };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ...base, ok: false, lastError: message || "Unreachable" };
	}
}

export async function checkAll(urls: string[]): Promise<Record<string, HealthEntry>> {
	const results: Record<string, HealthEntry> = {};
	await Promise.all(
		urls.map(async (u) => {
			results[u] = await checkUrl(u);
		}),
	);
	return results;
}

export async function requestNotificationPermission(): Promise<boolean> {
	const granted = await isPermissionGranted();
	if (granted) return true;
	const result = await requestPermission();
	return result === "granted";
}

export async function sendDownNotification(url: string, status: number): Promise<void> {
	const granted = await requestNotificationPermission();
	if (!granted) return;
	sendNotification({
		title: "Health check: site down",
		body: `${url} returned HTTP ${status}.`,
	});
}

export async function sendUpNotification(url: string): Promise<void> {
	const granted = await requestNotificationPermission();
	if (!granted) return;
	sendNotification({
		title: "Health check: site up",
		body: `${url} is responding again.`,
	});
}