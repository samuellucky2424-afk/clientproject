// Read API responses without exposing HTML error pages or raw parser errors.
export async function responseJson(response, service = 'Account service') {
 const raw = await response.text();
 let data;
 try { data = JSON.parse(raw); } catch {
  if (response.status === 404) throw Error(`${service} could not be found (HTTP 404). Please check the site address or contact support.`);
  if (response.status >= 500) throw Error(`${service} is temporarily unavailable (HTTP ${response.status}). Please try again shortly.`);
  throw Error(`${service} returned an unexpected response (HTTP ${response.status}). Please reload the page and try again.`);
 }
 if (!data || Array.isArray(data) || typeof data !== 'object') throw Error(`${service} returned an invalid response. Please try again.`);
 if (!response.ok) throw Error(typeof data.error === 'string' ? data.error : `${service} request failed (HTTP ${response.status}).`);
 return data;
}
