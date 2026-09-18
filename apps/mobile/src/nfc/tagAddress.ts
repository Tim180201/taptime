import hosts from './tagHosts.json';

// Dispatch only: tag identity always comes from the captured UID.
// Add a future host first; retain old hosts while their tags are still in use.
export const TAG_HOSTS: readonly string[] = Object.freeze(hosts);
export const TAG_URI = `https://${TAG_HOSTS[0]}/tag`;
