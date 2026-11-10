/* SHAD admin service worker — app-shell offline support.
 *
 * - Hashed `_app/immutable/*` assets: cache-first (safe forever).
 * - Navigations + static root files: network-first, cache fallback.
 * - Anything dynamic (`api.php`, `wm.php`, query `action=`) is NEVER cached:
 *   the ledger is live state and auth rides cookies.
 * - Scope is /admin/app/ so project frontends and victim flows are untouched.
 */
const CACHE = 'shad-app-v1';
const IMMUTABLE = /\/_app\/immutable\//;
const NEVER = /api\.php|wm\.php|[?&]action=/;

self.addEventListener('install', (e) => {
	self.skipWaiting();
	e.waitUntil(caches.open(CACHE).then((c) => c.add('./').catch(() => {})));
});

self.addEventListener('activate', (e) => {
	e.waitUntil(
		caches
			.keys()
			.then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (e) => {
	const url = new URL(e.request.url);
	if (e.request.method !== 'GET') return;
	if (url.pathname.indexOf('/admin/app/') !== 0) return;
	if (NEVER.test(url.pathname + url.search)) return; // live data: always network
	if (IMMUTABLE.test(url.pathname)) {
		e.respondWith(
			caches.match(e.request).then(
				(hit) =>
					hit ||
					fetch(e.request).then((res) => {
						const copy = res.clone();
						caches.open(CACHE).then((c) => c.put(e.request, copy));
						return res;
					})
			)
		);
		return;
	}
	e.respondWith(
		fetch(e.request)
			.then((res) => {
				const copy = res.clone();
				caches.open(CACHE).then((c) => c.put(e.request, copy));
				return res;
			})
			.catch(() => caches.match(e.request).then((hit) => hit || caches.match('./')))
	);
});
