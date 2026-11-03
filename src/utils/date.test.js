import { formatDate, isBefore, subtractMonths } from './date'

describe('formatDate', () => {
  test('renders the formats the app uses', () => {
    const date = new Date('2023-05-15T14:30:45')
    expect(formatDate(date, 'dd-mmm-yyyy', ' ')).toBe('15 May 2023')
    expect(formatDate(date, 'yyyy-mm-dd', '.')).toBe('2023.05.15')
    expect(formatDate(date, 'hh-mi-ss', ':')).toBe('14:30:45')
    expect(formatDate(date, 'dd-mm-yy', '/')).toBe('15/05/23')
    expect(formatDate(date, 'hh-mi', ':')).toBe('14:30')
  })

  test('throws on an invalid date', () => {
    expect(() => formatDate('invalid-date')).toThrow('Invalid date input')
  })

  test('passes unknown format components through unchanged', () => {
    expect(formatDate(new Date(2024, 0, 2), 'yyyy-unknown')).toBe(
      '2024-unknown'
    )
  })
})

describe('subtractMonths', () => {
  test('clamps to the last day of a shorter month', () => {
    expect(subtractMonths(1, new Date(2024, 2, 31)).getTime()).toBe(
      new Date(2024, 1, 29).getTime()
    )
  })

  test('subtracts six months', () => {
    expect(subtractMonths(6, new Date(2024, 6, 15)).getTime()).toBe(
      new Date(2024, 0, 15).getTime()
    )
  })

  test('uses the current date when no starting date is supplied', () => {
    jest.useFakeTimers().setSystemTime(new Date(2024, 6, 15))

    expect(subtractMonths(1)).toEqual(new Date(2024, 5, 15))

    jest.useRealTimers()
  })

  test('rejects an invalid starting date', () => {
    expect(() => subtractMonths(1, 'invalid-date')).toThrow(
      'Invalid date input'
    )
  })
})

describe('isBefore', () => {
  test('compares timestamps and rejects invalid input', () => {
    expect(isBefore('2024-01-01', '2024-06-01')).toBe(true)
    expect(isBefore('2024-06-01', '2024-01-01')).toBe(false)
    expect(() => isBefore('nope', '2024-01-01')).toThrow('Invalid date input')
  })
})
