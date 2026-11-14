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

      let body = undefined;
      if (!['GET', 'HEAD'].includes(request.method)) {
        try {
          body = await request.arrayBuffer();
        } catch (_) {
          body = undefined;
        }
      }

      const proxyRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: headers,
        body: body,
        redirect: 'follow',
        duplex: 'half'
      });

      try {
        return await fetch(proxyRequest);
      } catch (err) {
        return new Response(JSON.stringify({ 
          message: 'The storefront backend is waking up from cold start on Render. Please refresh in a moment.',
          error: 'Backend temporarily unreachable',
          details: err.message 
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Fallback to static assets
    return env.ASSETS.fetch(request);
  }
};
