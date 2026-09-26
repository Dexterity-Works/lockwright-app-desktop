const timestampOf = (date) => {
  const timestamp = new Date(date).getTime()
  if (isNaN(timestamp)) throw new Error('Invalid date input')
  return timestamp
}

/**
 * Format components joined by `separator`: yyyy, yy, mm, mmm, dd, ddd, hh
 * (24h), mi, ss. Unknown components pass through.
 * @param {string|number|Date} dateInput
 * @param {string} [format]
 * @param {string} [separator]
 * @returns {string}
 */
export const formatDate = (
  dateInput,
  format = 'yyyy-mm-dd',
  separator = '-'
) => {
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) throw new Error('Invalid date input')

  const pad = (n) => String(n).padStart(2, '0')
  const year = date.getFullYear()
  const components = {
    yyyy: year,
    yy: String(year).slice(-2),
    mm: pad(date.getMonth() + 1),
    dd: pad(date.getDate()),
    ddd: date.toLocaleString('en-US', { weekday: 'short' }),
    mmm: date.toLocaleString('en-US', { month: 'short' }),
    hh: pad(date.getHours()),
    mi: pad(date.getMinutes()),
    ss: pad(date.getSeconds())
  }

  return format
    .toLowerCase()
    .split('-')
    .map((component) => components[component] || component)
    .join(separator)
}

/**
 * @param {string|number|Date} date1
 * @param {string|number|Date} date2
 * @returns {boolean}
 */
export const isBefore = (date1, date2) =>
  timestampOf(date1) < timestampOf(date2)

/**
 * Subtract whole months, clamping the day to the target month's length.
 * @param {number} amount
 * @param {string|number|Date} [fromDate]
 * @returns {Date}
 */
export const subtractMonths = (amount, fromDate = new Date()) => {
  const date = new Date(fromDate)
  if (isNaN(date.getTime())) throw new Error('Invalid date input')

  const originalDay = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() - amount)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(originalDay, lastDay))
  return date
}
