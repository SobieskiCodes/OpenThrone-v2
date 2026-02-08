'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';

type Race = 'ELF' | 'HUMAN' | 'UNDEAD' | 'GOBLIN';

interface RaceThemeValue {
  race: Race;
  /** Mantine color name for this race */
  colorName: string;
}

const RACE_COLOR_MAP: Record<Race, string> = {
  ELF: 'elf',
  HUMAN: 'human',
  UNDEAD: 'undead',
  GOBLIN: 'goblin',
};

const RaceThemeContext = createContext<RaceThemeValue>({
  race: 'HUMAN',
  colorName: 'human',
});

export function RaceThemeProvider({ children }: { children: React.ReactNode }) {
  const { api, isReady } = useApi();

  const { data: player } = useQuery<{ race: string }>({
    queryKey: ['player', 'me'],
    queryFn: () => api.get('/player/me'),
    enabled: isReady,
    staleTime: 5 * 60 * 1000, // 5 min — race doesn't change often
  });

  const race = ((player?.race as Race) || 'HUMAN') as Race;

  // Set data-race on <html> so CSS variables update globally
  useEffect(() => {
    document.documentElement.setAttribute('data-race', race);
    return () => {
      document.documentElement.removeAttribute('data-race');
    };
  }, [race]);

  const value = useMemo<RaceThemeValue>(
    () => ({
      race,
      colorName: RACE_COLOR_MAP[race] || 'human',
    }),
    [race],
  );

  return (
    <RaceThemeContext.Provider value={value}>
      {children}
    </RaceThemeContext.Provider>
  );
}

export function useRaceTheme() {
  return useContext(RaceThemeContext);
}
