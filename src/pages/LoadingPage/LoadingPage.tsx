import React from 'react'
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
  migrationProgress?: { done: number; total: number } | null
}

export const LoadingPage = ({
  migrationProgress
}: LoadingPageProps): React.ReactElement => {
  const { theme } = useTheme()
  const hasMigration = !!migrationProgress && migrationProgress.total > 0

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
          {hasMigration ? (
            <ProgressSection>
              <ProgressTrack $trackColor={theme.colors.colorSurfaceHover}>
                <ProgressFill
                  $fillColor={theme.colors.colorPrimary}
                  $progress={
                    (migrationProgress.done / migrationProgress.total) * 100
                  }
                />
              </ProgressTrack>
              <Text as="p" variant="caption">
                {`${migrationProgress.done} / ${migrationProgress.total}`}
              </Text>
            </ProgressSection>
          ) : null}
        </Footer>
      </MainContent>
    </OnboardingShell>
  )
}
