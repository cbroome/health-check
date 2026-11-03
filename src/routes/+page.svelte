<script lang="ts">
	import {
		checkUrl,
		checkAll,
		getStoredUrls,
		setStoredUrls,
		getStoredHealth,
		setStoredHealth,
		getStoredIntervalMs,
		setStoredIntervalMs,
		sendDownNotification,
		sendUpNotification,
		type HealthEntry,
	} from "$lib/health";

	let urls = $state<string[]>(getStoredUrls());
	let health = $state<Record<string, HealthEntry>>(getStoredHealth());
	let intervalMs = $state<number>(getStoredIntervalMs());
	let newUrl = $state("");
	let adding = $state(false);
	let statusError = $state("");
	let lastRun = $state<number | null>(null);

	async function runCheckNow(): Promise<void> {
		const results = await checkAll(urls);
		const prev = { ...health };
	 health = { ...results };
		lastRun = Date.now();
		setStoredHealth(health);

		for (const [u, entry] of Object.entries(results)) {
			const old = prev[u];
			if (old && old.ok && !entry.ok) {
				void sendDownNotification(entry.url, entry.status).catch(() => {});
			} else if (old && !old.ok && entry.ok) {
				void sendUpNotification(entry.url).catch(() => {});
			}
		}
	}

	$effect(() => {
		const id = setInterval(() => {
			void runCheckNow();
		}, intervalMs);
		return () => clearInterval(id);
	});

	// Run an immediate check on startup.
	void runCheckNow();

	function addUrl(): void {
		const url = newUrl.trim();
		if (!url) return;
		if (urls.includes(url)) {
			statusError = "URL already in list";
			return;
		}
		adding = true;
		statusError = "";
		urls = [...urls, url];
		setStoredUrls(urls);
		void runCheckNow();
		newUrl = "";
		adding = false;
	}

	function removeUrl(url: string): void {
		urls = urls.filter((u) => u !== url);
		const next = { ...health };
		delete next[url];
		health = next;
		setStoredUrls(urls);
		setStoredHealth(health);
	}

	function onIntervalChange(value: number): void {
		const ms = Number.isFinite(value) ? Math.max(1000, value) : intervalMs;
		intervalMs = ms;
		setStoredIntervalMs(ms);
	}
</script>

<main class="container">
	<h1>Health Check</h1>
	<p class="subtitle">Monitor your sites and get notified when they go down.</p>

	<form
		class="add-row"
		onsubmit={(e) => {
			e.preventDefault();
			addUrl();
		}}
	>
		<input
			type="text"
			placeholder="https://example.com"
			value={newUrl}
			oninput={(e) => (newUrl = (e.target as HTMLInputElement).value)}
		/>
		<button type="submit" disabled={adding || !newUrl.trim()}>Add</button>
	</form>
	{#if statusError}
		<p class="error">{statusError}</p>
	{/if}

	<div class="url-list">
		{#each urls as url (url)}
			<div class="url-row">
				<span class="url-label">{url}</span>
				<span class="status">
					{#if health[url]}
						{#if health[url].ok}
							<span class="badge ok">OK</span>
						{:else}
							<span class="badge down">DOWN</span>
						{/if}
						<span class="status-text">
							{health[url].ok ? "up" : `down (HTTP ${health[url].status})`}
						</span>
					{:else}
						<span class="badge pending">PENDING</span>
					{/if}
				</span>
				<button class="remove" onclick={() => removeUrl(url)}>Remove</button>
			</div>
		{:else}
			<p class="empty">No URLs added yet.</p>
		{/each}
	</div>

	<div class="interval-row">
		<label for="interval">Check every</label>
		<input
			id="interval"
			type="number"
			min="60"
			step="60"
			value={Math.round(intervalMs / 60000)}
			oninput={(e) => onIntervalChange(Number((e.target as HTMLInputElement).value))}
		/>
		<label for="interval">minutes</label>
		<div class="actions">
			<button onclick={() => void runCheckNow()}>Check now</button>
		</div>
	</div>

	{#if lastRun}
		<p class="last-run">Last check: {new Date(lastRun).toLocaleTimeString()}</p>
	{/if}
</main>

<style>
	.container {
		margin: 0;
		padding: 2rem 1rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	h1 {
		text-align: center;
	}
	.subtitle {
		text-align: center;
		color: #666;
	}
	.add-row {
		display: flex;
		gap: 0.5rem;
		width: 100%;
		max-width: 480px;
		margin-bottom: 1rem;
	}
	input {
		flex: 1;
		border-radius: 8px;
		border: 1px solid #ccc;
		padding: 0.6em 1.2em;
		font-size: 1em;
	}
	button {
		border-radius: 8px;
		border: none;
		padding: 0.6em 1.2em;
		font-size: 1em;
		background: #646cff;
		color: white;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.error {
		color: #d33;
	}
	.url-list {
		width: 100%;
		max-width: 480px;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
	}
	.url-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 0.5rem 0.75rem;
	}
	.url-label {
		flex: 1;
		font-weight: 500;
		word-break: break-all;
	}
	.status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.status-text {
		font-size: 0.85rem;
		color: #666;
	}
	.badge {
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 700;
	}
	.badge.ok {
		background: #4caf50;
		color: white;
	}
	.badge.down {
		background: #f44336;
		color: white;
	}
	.badge.pending {
		background: #999;
		color: white;
	}
	.remove {
		background: #d33;
		padding: 0.3em 0.6em;
		font-size: 0.8rem;
	}
	.interval-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.interval-row input {
		width: 80px;
	}
	.actions {
		margin-left: 0.5rem;
	}
	.last-run {
		color: #666;
		font-size: 0.85rem;
	}
	.empty {
		color: #888;
		text-align: center;
	}
</style>