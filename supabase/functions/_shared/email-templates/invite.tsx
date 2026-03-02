/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You've been invited to Voyance — your travel crew awaits</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <Text style={wordmark}>
            <span style={wordmarkV}>V</span>
            <span style={wordmarkRest}>OYANCE</span>
          </Text>
        </Section>
        <Heading style={h1}>You're invited ✨</Heading>
        <Text style={text}>
          Someone thinks you'd love{' '}
          <Link href={siteUrl} style={link}>
            <strong>Voyance</strong>
          </Link>
          — a personalized travel companion. Click below to accept and create your account.
        </Text>
        <Section style={buttonSection}>
          <Button style={button} href={confirmationUrl}>
            Accept Invitation
          </Button>
        </Section>
        <Text style={footer}>
          If you weren't expecting this invitation, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '32px' }
const wordmark = { fontSize: '28px', margin: '0', lineHeight: '1' }
const wordmarkV = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontWeight: 'bold' as const,
  fontSize: '32px',
  color: 'hsl(185, 45%, 28%)',
}
const wordmarkRest = {
  fontFamily: "'DM Sans', Arial, sans-serif",
  fontWeight: 500 as const,
  fontSize: '18px',
  letterSpacing: '0.2em',
  color: 'hsl(220, 15%, 12%)',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  fontFamily: "'Playfair Display', Georgia, serif",
  color: 'hsl(220, 15%, 12%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(220, 10%, 38%)',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: 'hsl(185, 45%, 28%)', textDecoration: 'underline' }
const buttonSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: 'hsl(185, 45%, 28%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  fontFamily: "'DM Sans', Arial, sans-serif",
  borderRadius: '8px',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '13px', color: '#999999', margin: '32px 0 0', lineHeight: '1.5' }
