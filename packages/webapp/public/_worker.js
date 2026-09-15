export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy all /api/* requests to the Cloudflare Worker API
    if (url.pathname.startsWith('/api/')) {
      const targetUrl = new URL(url.pathname + url.search, 'https://wise-api-bun.tuanquynet.workers.dev');
      return fetch(new Request(targetUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
