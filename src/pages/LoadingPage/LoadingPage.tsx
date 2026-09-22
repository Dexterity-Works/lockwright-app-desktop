import React, { useEffect, useState } from 'react'
import { Text, Title, useTheme } from 'lockwright-lib-ui-react-native-components'
import { OnboardingShell } from '../../components/OnboardingShell'
import {
  ArtFrame,
  Footer,
  MainContent,
  ProgressFill,
  ProgressSection,
  ProgressTrack,
  TextBlock,
} from './LoadingPageStyles'
import { VaultUnlockAnimation } from '../Intro/VaultUnlockAnimation'

interface LoadingPageProps {
  onLoadingComplete?: () => void
  duration?: number
  migrationProgress?: { done: number; total: number } | null
}

export const LoadingPage = ({
  onLoadingComplete,
  duration = 3000,
  migrationProgress
}: LoadingPageProps): React.ReactElement => {
  const { theme } = useTheme()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min((elapsed / duration) * 100, 100)

      setProgress(newProgress)

      if (newProgress >= 100) {
        clearInterval(interval)
        onLoadingComplete?.()
      }
    }, 50)

    return () => clearInterval(interval)
  }, [duration, onLoadingComplete])

  return (
    <OnboardingShell background="gradient">
      <MainContent>
        <ArtFrame>
          <VaultUnlockAnimation />
        </ArtFrame>

        <TextBlock>
          <Title>Welcome to Lockwright</Title>
          <Text as="p" variant="label">
            Your items are stored locally, not on our servers.
            <br />
            Only you have access to them.
          </Text>
        </TextBlock>

        <Footer>
          <ProgressSection>
            <ProgressTrack $trackColor={theme.colors.colorSurfaceHover}>
              <ProgressFill
                $fillColor={theme.colors.colorPrimary}
                $progress={
                  migrationProgress && migrationProgress.total > 0
                    ? (migrationProgress.done / migrationProgress.total) * 100
                    : progress
                }
              />
            </ProgressTrack>
            {migrationProgress && migrationProgress.total > 0 ? (
              <Text as="p" variant="caption">
                {`${migrationProgress.done} / ${migrationProgress.total}`}
              </Text>
            ) : null}
          </ProgressSection>
        </Footer>
      </MainContent>
    </OnboardingShell>
  )
}
