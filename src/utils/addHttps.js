/**
 * Prefix https:// when no scheme is present. Only the scheme and host are
 * case-insensitive, so only those are lowercased; paths, queries, fragments
 * and userinfo stay as typed.
 *
 * @param {string} url
 * @returns {string}
 */
export const addHttps = (url) => {
  const unwrapped = url.replace(
    /^(https?:\/\/)((?:android|ios)app:\/\/)/i,
    '$2'
  )
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(unwrapped)
    ? unwrapped
    : `https://${unwrapped}`

  return withScheme.replace(
    /^([a-z][a-z0-9+.-]*:\/\/)([^/?#]*@)?([^/?#]*)/i,
    (_m, scheme, userinfo = '', host) =>
      `${scheme.toLowerCase()}${userinfo}${host.toLowerCase()}`
  )
}
