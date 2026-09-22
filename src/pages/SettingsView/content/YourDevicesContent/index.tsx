import React from 'react'

import {
  Button,
  ListItem,
  PageHeader,
  Text,
  useTheme
} from 'lockwright-lib-ui-react-native-components'
import { PublicOutlined, SwapVert } from 'lockwright-lib-ui-react-native-components/icons'

import { useConnectExtension } from '../../../../hooks/useConnectExtension'
import { useTranslation } from '../../../../hooks/useTranslation'
import { createStyles } from './styles'

const TEST_IDS = {
  root: 'settings-your-devices',
  extensionSection: 'settings-card-browser-extension-connections',
  unpairBrowser: (publicKey: string) => `settings-unpair-browser-${publicKey}`
} as const

export const YourDevicesContent = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const styles = createStyles(theme.colors)
  const {
    isBrowserExtensionEnabled,
    toggleBrowserExtension,
    showPairingCode,
    pairedBrowsers,
    unpairBrowser
  } = useConnectExtension()

  const browsers = pairedBrowsers ?? []

  return (
    <div data-testid={TEST_IDS.root} style={styles.root}>
      <PageHeader
        as="h1"
        title={t('Your Devices')}
        subtitle={t(
          'Devices listed here stay in sync. Changes made on one device update across all your vaults on every synced device.'
        )}
      />

      <div style={styles.sectionHeading}>
        <Text variant="caption" color={theme.colors.colorTextSecondary}>
          {t('Browser Extension Connections')}
        </Text>
      </div>

      <div data-testid={TEST_IDS.extensionSection} style={styles.sectionCard}>
        {isBrowserExtensionEnabled && browsers.length > 0 ? (
          <>
            <div style={styles.list}>
              {browsers.map((browser) => (
                <ListItem
                  key={browser.publicKey}
                  icon={
                    <div style={styles.iconWrap}>
                      <PublicOutlined
                        width={16}
                        height={16}
                        color={theme.colors.colorTextPrimary}
                      />
                    </div>
                  }
                  title={browser.browserName || t('Browser')}
                  testID={`settings-device-item-${browser.publicKey}`}
                  rightElement={
                    <Button
                      variant="tertiary"
                      size="small"
                      onClick={() => {
                        void unpairBrowser(browser.publicKey)
                      }}
                      data-testid={TEST_IDS.unpairBrowser(browser.publicKey)}
                    >
                      {t('Unpair')}
                    </Button>
                  }
                />
              ))}
            </div>
            <div style={styles.footer}>
              <Button
                variant="tertiary"
                size="small"
                onClick={() => {
                  void showPairingCode()
                }}
                iconBefore={<SwapVert width={16} height={16} />}
              >
                {t('Pair another browser')}
              </Button>
            </div>
          </>
        ) : isBrowserExtensionEnabled ? (
          <div style={styles.emptyBrowserStateWrap}>
            <div style={styles.emptyStateCaptions}>
              <Text>{t('Browser Extension')}</Text>
              <Text color={theme.colors.colorTextSecondary}>
                {t(
                  'Waiting for a browser. Paste the pair code in Chrome or Firefox.'
                )}
              </Text>
            </div>
            <div style={styles.emptyStateFooter}>
              <Button
                variant="tertiary"
                size="small"
                onClick={() => {
                  void showPairingCode()
                }}
                iconBefore={<SwapVert width={16} height={16} />}
              >
                {t('Pair another browser')}
              </Button>
              <Button
                variant="tertiary"
                size="small"
                onClick={() => toggleBrowserExtension(false)}
              >
                {t('Turn off browser connections')}
              </Button>
            </div>
          </div>
        ) : (
          <div style={styles.emptyBrowserStateWrap}>
            <div style={styles.emptyStateCaptions}>
              <Text>{t('Browser Extension')}</Text>
              <Text color={theme.colors.colorTextSecondary}>
                {t(
                  'Create a unique pairing code to link your Lockwright extension and enable autofill.'
                )}
              </Text>
            </div>
            <div style={styles.emptyStateFooter}>
              <Button
                variant="tertiary"
                size="small"
                onClick={() => toggleBrowserExtension(true)}
                iconBefore={<SwapVert width={16} height={16} />}
              >
                {t('Generate Pair Code for Browser Extension')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

