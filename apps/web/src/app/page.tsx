import {
  Title,
  Text,
  Container,
  Stack,
  Button,
  Group,
  SimpleGrid,
  Box,
} from '@mantine/core';
import Link from 'next/link';

const RACES = [
  {
    name: 'Human',
    key: 'HUMAN',
    color: '#1a8cff',
    desc: 'Balanced rulers of commerce and war. Strong economies and versatile armies.',
  },
  {
    name: 'Elf',
    key: 'ELF',
    color: '#1aff80',
    desc: 'Swift and cunning. Masters of espionage with powerful intelligence networks.',
  },
  {
    name: 'Goblin',
    key: 'GOBLIN',
    color: '#ff4444',
    desc: 'Fierce and relentless. Overwhelming numbers and savage battle tactics.',
  },
  {
    name: 'Undead',
    key: 'UNDEAD',
    color: '#a0a0a0',
    desc: 'Tireless legions. Unmatched fortifications and armies that never rest.',
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
          <Group
            gap="md"
            style={{ animation: 'ot-fadeInUp 0.6s ease 0.15s both' }}
          >
            <Button
              component={Link}
              href="/register"
              size="lg"
              variant="filled"
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
              style={{
                borderColor: 'var(--ot-border-highlight)',
                color: 'var(--ot-gold)',
              }}
            >
              Return to Throne
            </Button>
          </Group>

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
              Choose Your Destiny
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
                  <Text size="xs" style={{ color: 'var(--ot-text-dim)', lineHeight: 1.5 }}>
                    {race.desc}
                  </Text>
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
