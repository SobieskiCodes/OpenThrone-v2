/**
 * Kill stale node dev processes (Windows).
 * Skips the current process tree so it doesn't kill itself.
 * Usage: node scripts/kill-dev.js
 */
const { execSync } = require('child_process');

const myPid = process.pid;
const parentPid = process.ppid;

try {
  const result = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', {
    encoding: 'utf8',
  });

  const pids = [];
  for (const line of result.trim().split('\n')) {
    const match = line.match(/"node\.exe","(\d+)"/);
    if (match) {
      const pid = parseInt(match[1], 10);
      // Skip our own process and direct parent
      if (pid !== myPid && pid !== parentPid) {
        pids.push(pid);
      }
    }
  }

  if (pids.length === 0) {
    console.log('[kill-dev] No stale node processes found.');
    process.exit(0);
  }

  console.log(`[kill-dev] Killing ${pids.length} stale node process(es): ${pids.join(', ')}`);
  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
    } catch {
      // Process may have already exited
    }
  }
  console.log('[kill-dev] Done.');
} catch {
  console.log('[kill-dev] No node processes to kill.');
}
