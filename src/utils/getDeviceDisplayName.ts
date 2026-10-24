export const getDeviceDisplayName = (
  deviceName: string | undefined,
  t: (value: string) => string
): string => {
  if (!deviceName) return t('Unknown Device')

  const lowerName = deviceName.toLowerCase()

  if (lowerName.startsWith('ios')) return t('iPhone')
  if (lowerName.startsWith('android')) return t('Android')

  return deviceName
}
