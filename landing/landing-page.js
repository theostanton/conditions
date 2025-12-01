/**
 * Cloudflare Worker to serve landing page from Google Cloud Storage
 * Proxies requests to the GCS bucket and provides edge caching
 */

const GCS_BUCKET_URL = 'https://storage.googleapis.com/conditions-450312-bras/landing/index.html';

async function handleRequest(request) {
  const url = new URL(request.url);

  // Redirect conditionsreports.com (plural) to conditionsreport.com (singular)
  if (url.hostname === 'conditionsreports.com' || url.hostname === 'www.conditionsreports.com') {
    return Response.redirect('https://conditionsreport.com/', 301);
  }

  // Redirect www to root domain
  if (url.hostname === 'www.conditionsreport.com') {
    return Response.redirect('https://conditionsreport.com/', 301);
  }

  // Redirect any non-root path to root (e.g., /about → /)
  if (url.pathname !== '/' && url.pathname !== '') {
    return Response.redirect('https://conditionsreport.com/', 301);
  }

  // Handle root path - serve landing page
  try {
    // Fetch from GCS with caching
    const response = await fetch(GCS_BUCKET_URL, {
      cf: {
        cacheTtl: 3600,        // Cache for 1 hour
        cacheEverything: true  // Cache HTML content
      }
    });

    if (!response.ok) {
      return new Response('Error loading page', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Clone response to modify headers
    const newResponse = new Response(response.body, response);

    // Set custom headers
    newResponse.headers.set('Cache-Control', 'public, max-age=3600');
    newResponse.headers.set('Content-Type', 'text/html; charset=utf-8');
    newResponse.headers.set('X-Content-Type-Options', 'nosniff');

    return newResponse;
  } catch (error) {
    return new Response('Error loading page: ' + error.message, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
