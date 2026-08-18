/*
 * Setup file for Jest test environment
 */
const { Response, Request, Headers, fetch } = globalThis;

if (typeof global.Response === 'undefined' && Response) {
  global.Response = Response;
}
if (typeof window !== 'undefined') {
  if (typeof window.Response === 'undefined' && Response) {
    window.Response = Response;
  }
  if (typeof window.Request === 'undefined' && Request) {
    window.Request = Request;
  }
  if (typeof window.Headers === 'undefined' && Headers) {
    window.Headers = Headers;
  }
}
