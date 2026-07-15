# TapTim.e Admin Web

C3D browser surface for Administrator sign-in, safe setup projection, and Customer creation.
The browser uses same-origin `/v1` requests and memory-only Supabase sessions. It cannot capture
NFC data, receive canonical tag payloads, or select arbitrary tenants and roles.

Required build variables: `VITE_TAPTIME_SUPABASE_URL` and
`VITE_TAPTIME_SUPABASE_PUBLISHABLE_KEY`. Local development may set the server-only
`TAPTIME_API_PROXY_TARGET` to a loopback origin. The Auth URL accepts HTTPS generally and, only
for the controlled local harness, exact origin `http://127.0.0.1:54321`; alternate loopback
spellings, `localhost`, LAN, credentials, paths, queries and fragments remain invalid.
