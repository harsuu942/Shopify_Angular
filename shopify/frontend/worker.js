export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Forward API and actuator requests to Render Storefront Backend
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/actuator/')) {
      const targetUrl = new URL(url.pathname + url.search, 'https://hearth-backend-0bbo.onrender.com');
      const headers = new Headers(request.headers);
      headers.set('host', targetUrl.host);
      headers.set('x-forwarded-host', url.host);
      headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

      const proxyRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'follow',
        duplex: 'half'
      });
      return fetch(proxyRequest);
    }

    // Fallback to static assets
    return env.ASSETS.fetch(request);
  }
};
