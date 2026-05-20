Output

const express = require('express');
const cors = require('cors');
const app = express();

// Permissive CORS - allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(express.json());

const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

// ── STANDINGS ──
app.get('/standings', async (req, res) => {
  try {
    const url = `${MLB_BASE}/standings?leagueId=103,104&season=2026&standingsTypes=regularSeason`;
    const r = await fetch(url);
    const data = await r.json();

    const divisions = data.records.map(div => ({
      division: div.division.nameShort,
      teams: div.teamRecords.map(t => ({
        name: t.team.name,
        w: t.wins,
        l: t.losses,
        pct: t.winningPercentage,
        gb: t.gamesBack,
        streak: t.streak?.streakCode || '-',
        last10: (t.records?.splitRecords?.find(s => s.type === 'lastTen')?.wins || '-') + '-' +
                (t.records?.splitRecords?.find(s => s.type === 'lastTen')?.losses || '-')
      }))
    }));

    res.json({ success: true, divisions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── TODAY'S GAMES ──
app.get('/games/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `${MLB_BASE}/schedule?sportId=1&date=${today}&hydrate=probablePitcher(note),team,linescore`;
    const r = await fetch(url);
    const data = await r.json();

    const games = (data.dates?.[0]?.games || []).map(g => ({
      gameId: g.gamePk,
      status: g.status.detailedState,
      time: new Date(g.gameDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York' }),
      away: {
        name: g.teams.away.team.name,
        score: g.teams.away.score ?? '-',
        record: `${g.teams.away.leagueRecord?.wins}-${g.teams.away.leagueRecord?.losses}`,
        pitcher: g.teams.away.probablePitcher?.fullName || 'TBD',
      },
      home: {
        name: g.teams.home.team.name,
        score: g.teams.home.score ?? '-',
        record: `${g.teams.home.leagueRecord?.wins}-${g.teams.home.leagueRecord?.losses}`,
        pitcher: g.teams.home.probablePitcher?.fullName || 'TBD',
      }
    }));

    res.json({ success: true, date: today, games });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── TEAM STATS ──
app.get('/team/:teamId/stats', async (req, res) => {
  try {
    const { teamId } = req.params;
    const [hitting, pitching] = await Promise.all([
      fetch(`${MLB_BASE}/teams/${teamId}/stats?stats=season&group=hitting&season=2026`).then(r => r.json()),
      fetch(`${MLB_BASE}/teams/${teamId}/stats?stats=season&group=pitching&season=2026`).then(r => r.json())
    ]);
    const h = hitting.stats?.[0]?.splits?.[0]?.stat || {};
    const p = pitching.stats?.[0]?.splits?.[0]?.stat || {};
    res.json({
      success: true,
      hitting: { avg: h.avg, ops: h.ops, obp: h.obp, slg: h.slg, runs: h.runs, hr: h.homeRuns, rbi: h.rbi },
      pitching: { era: p.era, whip: p.whip, strikeOuts: p.strikeOuts }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PLAYER SEARCH ──
app.get('/player/search/:name', async (req, res) => {
  try {
    const name = encodeURIComponent(req.params.name);
    const url = `${MLB_BASE}/people/search?names=${name}&sportId=1`;
    const r = await fetch(url);
    const data = await r.json();
    const players = (data.people || []).slice(0, 5).map(p => ({
      id: p.id, name: p.fullName,
      position: p.primaryPosition?.abbreviation,
      team: p.currentTeam?.name
    }));
    res.json({ success: true, players });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── HEALTH CHECK ──
app.get('/', (req, res) => {
  res.json({ status: 'Scout AI Backend is live ⚾', version: '1.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Scout AI backend running on port ${PORT}`);
});








