import React from 'react'

import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (!values) return key
      return Object.entries(values).reduce(
        (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
        key
      )
    }
  })
}))

jest.mock('lockwright-lib-ui-react-native-components', () => {
  const React = require('react')
  return {
    useTheme: () => ({
      theme: {
        colors: {
          colorTextPrimary: '#fff',
          colorBorderPrimary: '#222',
          colorSurfacePrimary: '#000'
        }
      }
    }),
    rawTokens: new Proxy({}, { get: () => 0 }),
    Button: ({
      children,
      onClick,
      disabled,
      ...rest
    }: {
      children?: React.ReactNode
      onClick?: () => void
      disabled?: boolean
      [key: string]: unknown
    }) =>
      React.createElement(
        'button',
        { type: 'button', onClick, disabled, ...rest },
        children
      ),
    Snackbar: ({ text, testID }: { text: string; testID?: string }) =>
      React.createElement(
        'div',
        { 'data-testid': testID ?? 'snackbar' },
        text
      ),
    Text: ({
      children,
      ...rest
    }: {
      children?: React.ReactNode
      [key: string]: unknown
    }) => React.createElement('span', { ...rest }, children)
  }
})

jest.mock('lockwright-lib-ui-react-native-components/icons', () => {
  const React = require('react')
  const Icon = (name: string) => () =>
    React.createElement('span', { 'data-icon': name })
  return {
    DriveFileMoveOutlined: Icon('DriveFileMoveOutlined'),
    StarFilled: Icon('StarFilled'),
    StarOutlined: Icon('StarOutlined'),
    TrashOutlined: Icon('TrashOutlined')
  }
})

import { MultiSelectActionsBar } from './MultiSelectActionsBar'

describe('MultiSelectActionsBar', () => {
  const baseProps = {
    selectedCount: 3,
    allSelectedFavorited: false,
    canMove: true,
    onMove: jest.fn(),
    onToggleFavorite: jest.fn(),
    onDelete: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders count label and all three action buttons', () => {
    render(<MultiSelectActionsBar {...baseProps} />)
    expect(screen.getByTestId('multi-select-count').textContent).toBe(
      '3 Items selected'
    )
    expect(screen.getByTestId('multi-select-move')).toBeInTheDocument()
    expect(screen.getByTestId('multi-select-favorite')).toBeInTheDocument()
    expect(screen.getByTestId('multi-select-delete')).toBeInTheDocument()
  })

  it('uses singular label when exactly one item is selected', () => {
    render(<MultiSelectActionsBar {...baseProps} selectedCount={1} />)
    expect(screen.getByTestId('multi-select-count').textContent).toBe(
      '1 Item selected'
    )
  })

  it('disables all action buttons when no records are selected', () => {
    render(<MultiSelectActionsBar {...baseProps} selectedCount={0} />)
    expect(screen.getByTestId('multi-select-move')).toBeDisabled()
    expect(screen.getByTestId('multi-select-favorite')).toBeDisabled()
    expect(screen.getByTestId('multi-select-delete')).toBeDisabled()
  })

  it('disables only the move button when no folders exist', () => {
    render(<MultiSelectActionsBar {...baseProps} canMove={false} />)
    expect(screen.getByTestId('multi-select-move')).toBeDisabled()
    expect(screen.getByTestId('multi-select-favorite')).not.toBeDisabled()
    expect(screen.getByTestId('multi-select-delete')).not.toBeDisabled()
  })

  it('invokes the matching handlers when action buttons are clicked', () => {
    const onMove = jest.fn()
    const onToggleFavorite = jest.fn()
    const onDelete = jest.fn()
    render(
      <MultiSelectActionsBar
        {...baseProps}
        onMove={onMove}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
      />
    )
    fireEvent.click(screen.getByTestId('multi-select-move'))
    fireEvent.click(screen.getByTestId('multi-select-favorite'))
    fireEvent.click(screen.getByTestId('multi-select-delete'))
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onToggleFavorite).toHaveBeenCalledTimes(1)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('shows a snackbar tooltip on hover over the move button', () => {
    render(<MultiSelectActionsBar {...baseProps} />)
    expect(
      screen.queryByTestId('multi-select-move-tooltip')
    ).not.toBeInTheDocument()

    const move = screen.getByTestId('multi-select-move')
    const wrapper = move.parentElement as HTMLElement
    fireEvent.mouseEnter(wrapper)
    expect(screen.getByTestId('multi-select-move-tooltip').textContent).toBe(
      'Move to Another Folder'
    )

    fireEvent.mouseLeave(wrapper)
    expect(
      screen.queryByTestId('multi-select-move-tooltip')
    ).not.toBeInTheDocument()
  })

  it('swaps favorite tooltip wording based on allSelectedFavorited', () => {
    const { rerender } = render(<MultiSelectActionsBar {...baseProps} />)
    const wrapper = screen.getByTestId('multi-select-favorite')
      .parentElement as HTMLElement
    fireEvent.mouseEnter(wrapper)
    expect(screen.getByTestId('multi-select-favorite-tooltip').textContent).toBe(
      'Add to Favorites'
    )
    fireEvent.mouseLeave(wrapper)

    rerender(<MultiSelectActionsBar {...baseProps} allSelectedFavorited />)
    const wrapper2 = screen.getByTestId('multi-select-favorite')
      .parentElement as HTMLElement
    fireEvent.mouseEnter(wrapper2)
    expect(
      screen.getByTestId('multi-select-favorite-tooltip').textContent
    ).toBe('Remove from Favorites')
  })
})
