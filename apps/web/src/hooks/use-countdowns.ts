'use client';

import { useState, useEffect } from 'react';

export function useCountdowns() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Next turn tick: every 30 minutes on the clock (XX:00 and XX:30)
  const msIn30Min = 30 * 60 * 1000;
  const nextTurnMs = Math.ceil(now.getTime() / msIn30Min) * msIn30Min - now.getTime();
  const nextTurnMin = Math.floor(nextTurnMs / 60000);
  const nextTurnSec = Math.floor((nextTurnMs % 60000) / 1000);

  // Daily reset: midnight UTC
  const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const dailyResetMs = tomorrowUTC.getTime() - now.getTime();
  const dailyResetH = Math.floor(dailyResetMs / 3600000);
  const dailyResetM = Math.floor((dailyResetMs % 3600000) / 60000);
  const dailyResetS = Math.floor((dailyResetMs % 60000) / 1000);

  return {
    nextTurn: `${nextTurnMin}:${String(nextTurnSec).padStart(2, '0')}`,
    dailyReset: `${dailyResetH}h ${String(dailyResetM).padStart(2, '0')}m ${String(dailyResetS).padStart(2, '0')}s`,
  };
}
