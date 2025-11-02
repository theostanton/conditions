const METEOFRANCE_TOKEN = process.env.METEOFRANCE_TOKEN;

if (!METEOFRANCE_TOKEN) {
  throw new Error('METEOFRANCE_TOKEN environment variable is not set');
}

export const headers: HeadersInit = new Headers();
headers.set('Content-Type', 'application/json');
headers.set('apikey', METEOFRANCE_TOKEN);