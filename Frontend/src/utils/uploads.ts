/**
 * Uploaded files are stored as origin-relative paths ("/uploads/documents/x.pdf")
 * because that is what the upload endpoint returns. The API lives on a
 * different origin from the app in development, and behind a different nginx
 * location in production, so those paths must be resolved against the API
 * origin before they can be linked to.
 *
 * Using the raw path is not merely wrong, it is silently wrong: the browser
 * resolves it against the *app* origin, nginx's SPA fallback answers with
 * index.html, React Router fails to match the path, and the catch-all route
 * redirects to the dashboard. The user clicks "View File" and lands on the
 * dashboard with no error anywhere.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString().trim() || "http://localhost:5050/api";

/**
 * The API origin with the trailing "/api" removed, since static uploads are
 * served from the root rather than from under the API prefix.
 *
 * Only a trailing "/api" is stripped — a plain `.replace("/api", "")` would
 * also mangle a host like "https://api.example.com/api".
 */
const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/**
 * Turns a stored file reference into a URL the browser can actually open.
 * Absolute URLs (and data: URIs) are passed through untouched, so this is safe
 * to apply to any stored reference without knowing which form it takes.
 */
export const resolveUploadUrl = (fileReference: string): string => {
  const reference = fileReference?.trim() ?? "";
  if (reference.length === 0) {
    return "";
  }

  if (/^(https?:|data:|blob:)/i.test(reference)) {
    return reference;
  }

  return `${API_ORIGIN}${reference.startsWith("/") ? "" : "/"}${reference}`;
};
