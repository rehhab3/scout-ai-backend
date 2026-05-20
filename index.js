const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.options('*', cors());
app.use(express.json());

const MLB_BASE = process.env.MLB_BASE || 'https://statsapi.mlb.com/api/v1';
const SEASON = process.env.SEASON || '2026';

app.get('/standings', async (req, res) => {
  try {
    const r = await fetch(`${MLB_BASE}/standings?leagueId=103,104&season=${SEASON}&standingsTypes=regularSeason`);
    if (!r.ok) throw new Error(`MLB API error: ${r.status}`);
    const data = await r.json();
    const divisions = data.records.map(div => ({ 
      division: div.division.nameShort, 
      teams: div.teamRecords.map(t => ({ 
        name: t.team.name, 
        w: t.wins, 
        l: t.losses, 
        pct: t.winningPercentage, 
        gb: t.gamesBehind 
      })) 
    }));
    res.json({ success: true, divisions });
  } catch (err) { 
    res.status(500).json({ success: false, error: err.message }); 
  }
});

app.get('/games/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const r = await fetch(`${MLB_BASE}/schedule?sportId=1&date=${today}&hydrate=probablePitcher(note),team,linescore`);
    if (!r.ok) throw new Error(`MLB API error: ${r.status}`);
    const data = await r.json();
    const games = (data.dates?.[0]?.games || []).map(g => ({ 
      gameId: g.gamePk, 
      status: g.status.detailedState, 
      time: new Date(g.gameDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }));
    res.json({ success: true, date: today, games });
  } catch (err) { 
    res.status(500).json({ success: false, error: err.message }); 
  }
});

app.get('/team/:teamId/stats', async (req, res) => {
  try {
    const { teamId } = req.params;
    if (!teamId || isNaN(teamId)) return res.status(400).json({ success: false, error: 'Invalid teamId' });
    
    const [h, p] = await Promise.all([
      fetch(`${MLB_BASE}/teams/${teamId}/stats?stats=season&group=hitting&season=${SEASON}`).then(r => r.json()),
      fetch(`${MLB_BASE}/teams/${teamId}/stats?stats=season&group=pitching&season=${SEASON}`).then(r => r.json())
    ]);
    
    res.json({ 
      success: true, 
      hitting: h.stats?.[0]?.splits?.[0]?.stat || {}, 
      pitching: p.stats?.[0]?.splits?.[0]?.stat || {} 
    });
  } catch (err) { 
    res.status(500).json({ success: false, error: err.message }); 
  }
});

app.get('/', (req, res) => { 
  res.json({ status: 'Scout AI Backend is live ⚾', version: '1.0', season: SEASON }); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Scout AI backend running on port ${PORT}`));
