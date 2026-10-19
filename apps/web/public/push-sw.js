/* Web push handlers (FEAT-020, ADR-0032), imported into the generated service worker
 * through `workbox.importScripts` (vite.config.ts), so the PWA's caching (ADR-0015)
 * stays exactly as it was.
 *
 * Plain JS on purpose: this file is served as-is and runs in the worker scope.
 * `self.__bulkPush` exposes the two handlers so a unit test can drive them.
 */
(function (scope) {
  var ACCENTS = ['mono', 'ocean', 'aurora', 'bloom', 'sunset', 'forest', 'lagoon'];

  /** Only same-app paths are opened on tap — a payload can never send someone off-site.
   *  One query is allowed: `?join=<id>` (FEAT-022 — a notification that opens a round). */
  function safePath(url) {
    return typeof url === 'string' && /^\/[A-Za-z0-9/_-]*(\?join=[A-Za-z0-9_-]+)?$/.test(url) ? url : '/';
  }

  function show(data) {
    var accent = ACCENTS.indexOf(data && data.accent) >= 0 ? data.accent : 'mono';
    var title = (data && typeof data.title === 'string' && data.title) || 'Bulk Saving';
    return scope.registration.showNotification(title, {
      body: (data && typeof data.body === 'string' && data.body) || '',
      icon: '/push/icon-' + accent + '.png',
      badge: '/push/badge.png',
      // One notification per round: a newer event replaces the older one, and says so.
      tag: (data && typeof data.tag === 'string' && data.tag) || 'bulk-saving',
      renotify: true,
      data: { url: safePath(data && data.url) },
    });
  }

  function onPush(event) {
    var data = {};
    try {
      data = event.data ? event.data.json() : {};
    } catch (e) {
      data = { body: event.data ? event.data.text() : '' };
    }
    event.waitUntil(show(data));
  }

  /** Focus an open app window and take it to the path; otherwise open one. */
  function onClick(event) {
    event.notification.close();
    var path = safePath(event.notification.data && event.notification.data.url);
    event.waitUntil(
      scope.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
        for (var i = 0; i < windows.length; i += 1) {
          var client = windows[i];
          if (new URL(client.url).origin === scope.location.origin && 'focus' in client) {
            return client
              .focus()
              .then(function (focused) {
                return focused && 'navigate' in focused ? focused.navigate(path) : focused;
              })
              .catch(function () {
                // `navigate` rejects for a window this worker does not control (V2 P3).
                return scope.clients.openWindow(path);
              });
          }
        }
        return scope.clients.openWindow(path);
      }),
    );
  }

  scope.addEventListener('push', onPush);
  scope.addEventListener('notificationclick', onClick);
  scope.__bulkPush = { onPush: onPush, onClick: onClick, safePath: safePath };
})(self);
