/**
 * @param {string} name
 * @returns {string}
 */
export const generateAvatarInitials = (name) => {
  if (typeof name !== 'string') return ''

  const parts = name.split(' ')
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}
