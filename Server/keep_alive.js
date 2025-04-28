import https from 'https';

export function startKeepAlive() {
  const SELF_URL = process.env.SELF_URL || "https://honeypot-render-test.onrender.com";

  if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
      https.get(SELF_URL, (res) => {
        console.log(`[${new Date().toISOString()}] Self-ping status: ${res.statusCode}`);
      }).on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Self-ping error:`, err.message);
      });
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}
