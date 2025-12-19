export const onRequestGet: PagesFunction = async () => {
  return new Response('Logged out', {
    status: 401,
    headers: {
      'www-authenticate': 'Basic realm="Admin"',
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
    },
  });
};
