import React, { useState } from 'react'
import { Button, Text, Title } from 'lockwright-lib-ui-react-native-components'
import { KeyboardArrowRightRound } from 'lockwright-lib-ui-react-native-components/icons'
import { OnboardingShell } from '../../components/OnboardingShell'
import { NAVIGATION_ROUTES } from '../../constants/navigation'
import { useRouter } from '../../context/RouterContext'
import { VaultUnlockAnimation } from './VaultUnlockAnimation'
import { PeerLinkAnimation } from './PeerLinkAnimation'
import {
  ButtonIconWrapper,
  ContinueButtonWrapper,
  MainContent,
  Footer,
  TextBlock,
  ArtWrapper,
} from './IntroStyles'

export const Intro: React.FC = () => {
  const { navigate } = useRouter()
  const [pageIndex, setPageIndex] = useState(0)

  const pages = [
    {
      title: 'Your data stays on your devices',
      body: (
        <Text as="p" variant="label">
          Your items are stored locally, not on our servers.
          <br />
          Only you have access to them.
        </Text>
      ),
      art: (
        <ArtWrapper>
          <VaultUnlockAnimation />
        </ArtWrapper>
      )
    },
    {
      title: 'Sync without the cloud',
      body: (
        <>
          <Text as="p" variant="label">
            Your devices connect directly to each other using
            <br />
            peer-to-peer technology.
          </Text>
          <Text as="p" variant="label">
            No cloud. No copies. No middlemen.
          </Text>
        </>
      ),
      art: (
        <ArtWrapper>
          <PeerLinkAnimation />
        </ArtWrapper>
      )
    }
  ]

  const currentPage = pages[pageIndex]
  const isFirstPage = pageIndex === 0

  const handleContinue = () => {
    if (pageIndex >= pages.length - 1) {
      navigate('welcome', {
        state: NAVIGATION_ROUTES.CREATE_MASTER_PASSWORD
      })
      return
    }

    setPageIndex((current) => current + 1)
  }

  const content = (
    <MainContent>
      {currentPage.art}

      <TextBlock>
        <Title>{currentPage.title}</Title>
        {currentPage.body}
      </TextBlock>

      <Footer>
        <ContinueButtonWrapper>
          <Button
            variant="primary"
            size="small"
            onClick={handleContinue}
            iconAfter={
              <ButtonIconWrapper>
                <KeyboardArrowRightRound />
              </ButtonIconWrapper>
            }
          >
            Continue
          </Button>
        </ContinueButtonWrapper>
      </Footer>
    </MainContent>
  )

  return <OnboardingShell background={isFirstPage ? 'gradient' : 'solid'}>{content}</OnboardingShell>
}
