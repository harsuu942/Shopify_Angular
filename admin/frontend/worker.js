export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Forward API and actuator requests to Render Admin Backend
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/actuator/')) {
      const targetUrl = new URL(url.pathname + url.search, 'https://hearth-admin-backend.onrender.com');
      const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'manual'
      });
      return fetch(proxyRequest);
    }

    // Fallback to static assets
    return env.ASSETS.fetch(request);
  }
};
