import {
  Title,
  Text,
  Container,
  Stack,
  Button,
  SimpleGrid,
  Box,
  Badge,
} from '@mantine/core';
import Link from 'next/link';

const RACES = [
  {
    name: 'Human',
    key: 'HUMAN',
    color: '#1a8cff',
    icon: '\u2694\uFE0F',
    desc: 'Balanced rulers of commerce and war. Strong economies and versatile armies.',
    bonus: '+5 Offense',
    bonusColor: '#ff6b6b',
  },
  {
    name: 'Elf',
    key: 'ELF',
    color: '#1aff80',
    icon: '\uD83C\uDF3F',
    desc: 'Swift and cunning. Masters of espionage with powerful intelligence networks.',
    bonus: '+5 Defense',
    bonusColor: '#4dabf7',
  },
  {
    name: 'Goblin',
    key: 'GOBLIN',
    color: '#ff4444',
    icon: '\uD83D\uDD25',
    desc: 'Fierce and relentless. Overwhelming numbers and savage battle tactics.',
    bonus: '+5 Defense',
    bonusColor: '#4dabf7',
  },
  {
    name: 'Undead',
    key: 'UNDEAD',
    color: '#a0a0a0',
    icon: '\uD83D\uDC80',
    desc: 'Tireless legions. Unmatched fortifications and armies that never rest.',
    bonus: '+5 Offense',
    bonusColor: '#ff6b6b',
  },
];

const CLASSES = [
  {
    name: 'Fighter',
    key: 'FIGHTER',
    color: '#ff6b6b',
    icon: '\uD83D\uDDE1\uFE0F',
    desc: 'Masters of the blade. Brute force and tactical superiority on the battlefield.',
    bonus: '+5 Offense',
    bonusColor: '#ff6b6b',
  },
  {
    name: 'Cleric',
    key: 'CLERIC',
    color: '#4dabf7',
    icon: '\uD83D\uDEE1\uFE0F',
    desc: 'Holy guardians. Fortified walls and divine protection for your realm.',
    bonus: '+5 Defense',
    bonusColor: '#4dabf7',
  },
  {
    name: 'Thief',
    key: 'THIEF',
    color: '#ffd43b',
    icon: '\uD83D\uDCB0',
    desc: 'Shadow merchants. Plunder riches and grow wealthy beyond measure.',
    bonus: '+5 Income',
    bonusColor: '#ffd43b',
  },
  {
    name: 'Assassin',
    key: 'ASSASSIN',
    color: '#da77f2',
    icon: '\uD83D\uDC41\uFE0F',
    desc: 'Silent operatives. Unseen eyes and ears in every corner of the realm.',
    bonus: '+5 Intel',
    bonusColor: '#da77f2',
  },
];

export default function LandingPage() {
  return (
    <div className="ot-landing-bg">
      <Container size="md" py={80}>
        <Stack align="center" gap="xl">
          {/* Hero */}
          <Stack align="center" gap="md" style={{ animation: 'ot-fadeInUp 0.6s ease both' }}>
            <Title
              order={1}
              className="ot-landing-title"
              ta="center"
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)' }}
            >
              OpenThrone
            </Title>
            <Text
              size="lg"
              ta="center"
              maw={500}
              style={{ color: 'var(--ot-text-dim)', lineHeight: 1.6 }}
            >
              A slow, text-driven strategy game where power grows quietly,
              reputation spreads loudly, and every decision leaves a public scar.
            </Text>
          </Stack>

          {/* CTA */}
          <Stack
            gap="sm"
            align="center"
            className="ot-landing-cta"
            style={{ animation: 'ot-fadeInUp 0.6s ease 0.15s both', width: '100%', maxWidth: 360 }}
          >
            <Button
              component={Link}
              href="/register"
              size="lg"
              variant="filled"
              fullWidth
              style={{
                background: 'linear-gradient(135deg, #dd953f, #fde265)',
                color: '#0a0a0a',
                fontWeight: 700,
                border: 'none',
              }}
            >
              Begin Your Reign
            </Button>
            <Button
              component={Link}
              href="/login"
              size="lg"
              variant="outline"
              fullWidth
              style={{
                borderColor: 'var(--ot-border-highlight)',
                color: 'var(--ot-gold)',
              }}
            >
              Return to Throne
            </Button>
          </Stack>

          {/* Tagline pillars */}
          <SimpleGrid
            cols={{ base: 1, sm: 3 }}
            spacing="lg"
            mt="xl"
            style={{ animation: 'ot-fadeInUp 0.6s ease 0.3s both' }}
          >
            {[
              { title: 'Asynchronous', desc: 'Play on your schedule. No grinding, no twitch skill. All intent.' },
              { title: 'Persistent', desc: 'Your kingdom endures. Reputation and history carry forward.' },
              { title: 'Player-Driven', desc: 'Feuds form naturally. Every action creates a narrative artifact.' },
            ].map((pillar) => (
              <Stack key={pillar.title} align="center" gap="xs">
                <Text fw={700} size="sm" style={{ color: 'var(--ot-gold-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {pillar.title}
                </Text>
                <Text size="sm" ta="center" style={{ color: 'var(--ot-text-dim)', maxWidth: 200 }}>
                  {pillar.desc}
                </Text>
              </Stack>
            ))}
          </SimpleGrid>

          {/* Race previews */}
          <Stack align="center" gap="md" mt="xl" w="100%">
            <Text
              fw={600}
              size="sm"
              style={{
                color: 'var(--ot-gold-dim)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Choose Your Race
            </Text>
            <SimpleGrid
              cols={{ base: 2, sm: 4 }}
              spacing="md"
              w="100%"
              className="ot-stagger"
            >
              {RACES.map((race) => (
                <Box
                  key={race.key}
                  className="ot-race-card"
                  data-race={race.key}
                  p="md"
                  ta="center"
                  style={{ borderRadius: '4px' }}
                >
                  <Text style={{ fontSize: '1.75rem', lineHeight: 1 }} mb={6}>
                    {race.icon}
                  </Text>
                  <Text
                    fw={700}
                    size="lg"
                    mb={4}
                    style={{
                      color: race.color,
                      fontFamily: "var(--font-medieval), 'MedievalSharp', cursive",
                    }}
                  >
                    {race.name}
                  </Text>
                  <Text size="xs" mb={8} style={{ color: 'var(--ot-text-dim)', lineHeight: 1.5 }}>
                    {race.desc}
                  </Text>
                  <Badge
                    size="sm"
                    variant="light"
                    style={{ backgroundColor: `${race.bonusColor}18`, color: race.bonusColor }}
                  >
                    {race.bonus}
                  </Badge>
                </Box>
              ))}
            </SimpleGrid>
          </Stack>

          {/* Class previews */}
          <Stack align="center" gap="md" mt="lg" w="100%">
            <Text
              fw={600}
              size="sm"
              style={{
                color: 'var(--ot-gold-dim)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Choose Your Class
            </Text>
            <SimpleGrid
              cols={{ base: 2, sm: 4 }}
              spacing="md"
              w="100%"
              className="ot-stagger"
            >
              {CLASSES.map((cls) => (
                <Box
                  key={cls.key}
                  className="ot-race-card"
                  p="md"
                  ta="center"
                  style={{ borderRadius: '4px' }}
                >
                  <Text style={{ fontSize: '1.75rem', lineHeight: 1 }} mb={6}>
                    {cls.icon}
                  </Text>
                  <Text
                    fw={700}
                    size="lg"
                    mb={4}
                    style={{
                      color: cls.color,
                      fontFamily: "var(--font-medieval), 'MedievalSharp', cursive",
                    }}
                  >
                    {cls.name}
                  </Text>
                  <Text size="xs" mb={8} style={{ color: 'var(--ot-text-dim)', lineHeight: 1.5 }}>
                    {cls.desc}
                  </Text>
                  <Badge
                    size="sm"
                    variant="light"
                    style={{ backgroundColor: `${cls.bonusColor}18`, color: cls.bonusColor }}
                  >
                    {cls.bonus}
                  </Badge>
                </Box>
              ))}
            </SimpleGrid>
          </Stack>

          {/* Footer */}
          <Text
            size="xs"
            mt="xl"
            style={{ color: 'var(--ot-text-dim)', opacity: 0.6 }}
          >
            Open source. Community driven. No pay-to-win.
          </Text>
        </Stack>
      </Container>
    </div>
  );
}
