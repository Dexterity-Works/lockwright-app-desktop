/// <reference types="@testing-library/jest-dom" />

import React from 'react'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

import { YourDevicesContent } from './index'
;(globalThis as { React?: typeof React }).React = React

jest.mock('../../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (str: string) => str
  })
}))

const mockToggleBrowserExtension = jest.fn()
const mockShowPairingCode = jest.fn()
const mockUnpairBrowser = jest.fn()
type PairedBrowser = { publicKey: string; browserName?: string }
let mockExtensionState = {
  isBrowserExtensionEnabled: false,
  toggleBrowserExtension: mockToggleBrowserExtension,
  showPairingCode: mockShowPairingCode,
  pairedBrowsers: [] as PairedBrowser[],
  unpairBrowser: mockUnpairBrowser
}

jest.mock('../../../../hooks/useConnectExtension', () => ({
  useConnectExtension: () => mockExtensionState
}))

jest.mock('./styles', () => ({
  createStyles: () => ({
    root: {},
    sectionHeading: {},
    sectionCard: {},
    list: {},
    iconWrap: {},
    emptyBrowserStateWrap: {},
    emptyStateCaptions: {},
    emptyStateFooter: {},
    footer: {}
  })
}))

jest.mock('lockwright-lib-ui-react-native-components', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        colorTextSecondary: '#888',
        colorTextPrimary: '#fff',
        colorAccentActive: '#22a'
      }
    }
  }),
  PageHeader: ({
    title
  }: {
    title: React.ReactNode
    subtitle?: React.ReactNode
    as?: string
  }) => <h1>{title}</h1>,
  Text: ({
    children
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) => <div>{children}</div>,
  Button: (props: {
    children?: React.ReactNode
    onClick?: () => void
    'data-testid'?: string
    'aria-label'?: string
    [key: string]: unknown
  }) => (
    <button
      type="button"
      data-testid={props['data-testid']}
      aria-label={props['aria-label']}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  ),
  ListItem: (props: {
    testID?: string
    title?: React.ReactNode
    rightElement?: React.ReactNode
    [key: string]: unknown
  }) => (
    <div data-testid={props.testID}>
      <div>{props.title}</div>
      {props.rightElement}
    </div>
  ),
  ContextMenu: ({
    children,
    trigger
  }: {
    children: React.ReactNode
    trigger: React.ReactNode
    [key: string]: unknown
  }) => (
    <div>
      {trigger}
      {children}
    </div>
  ),
  NavbarListItem: (props: {
    label: string
    onClick?: () => void
    [key: string]: unknown
  }) => (
    <button type="button" onClick={props.onClick}>
      {props.label}
    </button>
  )
}))

jest.mock('lockwright-lib-ui-react-native-components/icons', () => ({
  MoreVert: () => null,
  PhoneIphone: () => null,
  PublicOutlined: () => null,
  SwapVert: () => null
}))

describe('YourDevicesContent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockExtensionState = {
      isBrowserExtensionEnabled: false,
      toggleBrowserExtension: mockToggleBrowserExtension,
      showPairingCode: mockShowPairingCode,
      pairedBrowsers: [],
      unpairBrowser: mockUnpairBrowser
    }
  })

  it('renders the page heading', () => {
    render(<YourDevicesContent />)

    expect(
      screen.getByRole('heading', { name: 'Your Devices' })
    ).toBeInTheDocument()
  })

  it('shows empty state when the browser extension is disabled', () => {
    render(<YourDevicesContent />)

    expect(screen.getByText('Browser Extension')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Create a unique pairing code to link your Lockwright extension and enable autofill.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Generate Pair Code for Browser Extension')
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('settings-device-item-browser')
    ).not.toBeInTheDocument()
  })

  it('calls toggleBrowserExtension(true) when generate-pair-code button is clicked', () => {
    render(<YourDevicesContent />)

    fireEvent.click(
      screen.getByText('Generate Pair Code for Browser Extension')
    )

    expect(mockToggleBrowserExtension).toHaveBeenCalledTimes(1)
    expect(mockToggleBrowserExtension).toHaveBeenCalledWith(true)
  })

  it('lists each paired browser so one can be dropped without the other', () => {
    mockExtensionState = {
      isBrowserExtensionEnabled: true,
      toggleBrowserExtension: mockToggleBrowserExtension,
      showPairingCode: mockShowPairingCode,
      pairedBrowsers: [
        { publicKey: 'chromePub', browserName: 'Chrome' },
        { publicKey: 'firefoxPub', browserName: 'Firefox' }
      ],
      unpairBrowser: mockUnpairBrowser
    }

    render(<YourDevicesContent />)

    expect(screen.getByText('Chrome')).toBeInTheDocument()
    expect(screen.getByText('Firefox')).toBeInTheDocument()
    expect(
      screen.queryByTestId('settings-device-item-browser')
    ).not.toBeInTheDocument()
    expect(screen.getByText('Pair another browser')).toBeInTheDocument()
  })

  it('unpairs only the chosen browser', () => {
    mockExtensionState = {
      isBrowserExtensionEnabled: true,
      toggleBrowserExtension: mockToggleBrowserExtension,
      showPairingCode: mockShowPairingCode,
      pairedBrowsers: [
        { publicKey: 'chromePub', browserName: 'Chrome' },
        { publicKey: 'firefoxPub', browserName: 'Firefox' }
      ],
      unpairBrowser: mockUnpairBrowser
    }

    render(<YourDevicesContent />)

    fireEvent.click(screen.getByTestId('settings-unpair-browser-firefoxPub'))

    expect(mockUnpairBrowser).toHaveBeenCalledTimes(1)
    expect(mockUnpairBrowser).toHaveBeenCalledWith('firefoxPub')
    expect(mockToggleBrowserExtension).not.toHaveBeenCalled()
  })

  it('does not ask the user for Chromium extension IDs', () => {
    render(<YourDevicesContent />)

    expect(
      screen.queryByTestId('settings-chromium-extension-allowlist')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        'If Vivaldi/Chrome shows “Access to the specified native messaging host is forbidden”, paste your extension ID from vivaldi://extensions (Developer mode). One ID per line.'
      )
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Approved Chromium extension IDs')).toBeNull()
    expect(screen.queryByText('Apply approved IDs')).toBeNull()
  })

  it('lets you show the pair code while waiting for the first browser', () => {
    mockExtensionState = {
      isBrowserExtensionEnabled: true,
      toggleBrowserExtension: mockToggleBrowserExtension,
      showPairingCode: mockShowPairingCode,
      pairedBrowsers: [],
      unpairBrowser: mockUnpairBrowser
    }

    render(<YourDevicesContent />)

    fireEvent.click(screen.getByText('Pair another browser'))

    expect(mockShowPairingCode).toHaveBeenCalledTimes(1)
    expect(mockToggleBrowserExtension).not.toHaveBeenCalled()
  })

  it('turns native messaging off when no browsers are paired yet', () => {
    mockExtensionState = {
      isBrowserExtensionEnabled: true,
      toggleBrowserExtension: mockToggleBrowserExtension,
      showPairingCode: mockShowPairingCode,
      pairedBrowsers: [],
      unpairBrowser: mockUnpairBrowser
    }

    render(<YourDevicesContent />)

    fireEvent.click(screen.getByText('Turn off browser connections'))

    expect(mockToggleBrowserExtension).toHaveBeenCalledTimes(1)
    expect(mockToggleBrowserExtension).toHaveBeenCalledWith(false)
  })
})
