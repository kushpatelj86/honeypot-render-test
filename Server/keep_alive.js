setInterval(() => {
  https.get(SELF_URL, (res) => {
    console.log(`[${new Date().toISOString()}] Self-ping status: ${res.statusCode}`);
    if (res.statusCode >= 400) {
      console.warn(`[${new Date().toISOString()}] Warning: Received status code ${res.statusCode} from self-ping.`);
    }
  }).on('error', (err) => {
    console.error(`[${new Date().toISOString()}] Self-ping error:`, err.message);
  });
}, 5 * 60 * 1000); // Every 5 minutes (optional)
