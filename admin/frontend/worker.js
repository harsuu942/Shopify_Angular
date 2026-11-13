export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Forward API and actuator requests to Render Admin Backend (with automatic fallback to unified backend)
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/actuator/')) {
      const primaryOrigin = 'https://hearth-admin-backend.onrender.com';
      const fallbackOrigin = 'https://hearth-backend-0bbo.onrender.com';

      const forwardRequest = async (origin) => {
        const targetUrl = new URL(url.pathname + url.search, origin);
        const headers = new Headers(request.headers);
        headers.set('host', targetUrl.host);
        headers.set('x-forwarded-host', url.host);
        headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
        headers.set('x-portal', 'admin');

        return fetch(targetUrl.toString(), {
          method: request.method,
          headers: headers,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
          redirect: 'follow',
          duplex: 'half'
        });
      };

      try {
        let resp = await forwardRequest(primaryOrigin);
        // If primary backend reports suspended or error, try the fallback backend
        if (resp.status === 502 || resp.status === 503 || resp.status === 504 || (resp.status === 200 && resp.headers.get('content-type')?.includes('text/html') && !url.pathname.includes('/actuator/'))) {
          const text = await resp.clone().text();
          if (text.includes('Service Suspended') || text.includes('no-deploy')) {
            resp = await forwardRequest(fallbackOrigin);
          }
        }
        return resp;
      } catch (err) {
        return forwardRequest(fallbackOrigin);
      }
    }

    // Fallback to static assets
    return env.ASSETS.fetch(request);
  }
};
