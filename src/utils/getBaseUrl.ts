export const getBaseUrl = () => {
  // In the browser, always use the actual origin the user is on. `VERCEL_URL`
  // is not exposed to the client, so relying on it here would fall back to
  // localhost in production (e.g. QR codes encoding a localhost URL).
  if (typeof window !== "undefined") return window.location.origin;

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url

  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};
