import https from 'https';

export function startKeepAlive() {
  const SELF_URL = process.env.SELF_URL || "https://honeypot-render-test.onrender.com";

  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      https.get(SELF_URL, (res) => {
        console.log(`[${new Date().toISOString()}] Self-ping status: ${res.statusCode}`);
        // Check for unexpected non-2xx status codes, which could indicate an issue.
        if (res.statusCode >= 400) {
          console.warn(`[${new Date().toISOString()}] Warning: Received status code ${res.statusCode} from self-ping.`);
        }
      }).on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Self-ping error:`, err.message);
      });
    }, 2 * 60 * 1000); // Every 2 minutes (optional: adjust to 5 * 60 * 1000 for the default)
  }
}
