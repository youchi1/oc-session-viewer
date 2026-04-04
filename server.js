import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';

const app = express();
const PORT = process.env.PORT || 18095;
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/root/.openclaw';
const AGENTS_DIR = join(OPENCLAW_DIR, 'agents');

app.use(cors());
app.use(express.json());
app.use(express.static(join(import.meta.dirname, 'frontend', 'dist')));

// ─── Cache ─────────────────────────────────────────────────────
const parseCache = new Map(); // filename → { summary, mtime }
const MAX_CACHE_SIZE = 1000;
const spawnMapCache = new Map(); // agent → { map, mtime }

// Agent emoji map
const AGENT_EMOJIS = {
  main: '🤖', 'jon-snow': '🐺', tyrion: '🍷', varys: '🕷️',
  arya: '🗡️', bran: '👁️', daenerys: '🐉', sansa: '👑',
  littlefinger: '🪙', davos: '📦', hound: '🐕', brienne: '⚔️',
  'grey-worm': '🪖', sam: '📚',
};

function parseSessionFilename(filename) {
  const isDeleted = filename.includes('.deleted.');
  const isReset = filename.includes('.reset.');
  let status = 'active';
  if (isDeleted) status = 'deleted';
  else if (isReset) status = 'reset';
  
  const topicMatch = filename.match(/-topic-(\d+)/);
  const topic = topicMatch ? parseInt(topicMatch[1]) : null;
  
  const uuidMatch = filename.match(/^([0-9a-f-]{36})/);
  const sessionId = uuidMatch ? uuidMatch[1] : filename.replace(/\.jsonl$/, '');
  
  return { filename, sessionId, topic, status };
}

// Get just filenames (no stat) - super fast
async function getAgentFilenames(agent) {
  const sessDir = join(AGENTS_DIR, agent, 'sessions');
  try {
    const files = await readdir(sessDir);
    return files.filter(f => 
      f.endsWith('.jsonl') || f.includes('.deleted.') || f.includes('.reset.')
    );
  } catch {
    return [];
  }
}

// Extract searchable segments from a message's content blocks
function extractContentSegments(message) {
  const content = message.content;
  const segments = [];
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === 'text' && c.text) {
        segments.push({ type: 'text', text: c.text });
      } else if (c.type === 'thinking' && c.thinking) {
        segments.push({ type: 'thinking', text: c.thinking });
      } else if (c.type === 'tool_use' || c.type === 'toolCall') {
        const name = c.name || '';
        const args = typeof c.input === 'string' ? c.input
          : typeof c.arguments === 'string' ? c.arguments
          : (c.input || c.arguments) ? JSON.stringify(c.input || c.arguments) : '';
        if (name || args) {
          segments.push({ type: 'tool_call', text: name + (args ? ' ' + args : '') });
        }
      } else if (c.type === 'tool_result' || c.type === 'toolResult') {
        const resultText = typeof c.content === 'string' ? c.content
          : Array.isArray(c.content) ? c.content.filter(r => r.type === 'text').map(r => r.text || '').join(' ')
          : '';
        if (resultText) {
          segments.push({ type: 'tool_result', text: resultText });
        }
      }
    }
  } else if (typeof content === 'string') {
    segments.push({ type: 'text', text: content });
  }
  if (message.errorMessage) {
    segments.push({ type: 'error', text: message.errorMessage });
  }
  return segments;
}

// Get filenames WITH stat (for date sorting)
async function getAgentFilesWithStat(agent) {
  const sessDir = join(AGENTS_DIR, agent, 'sessions');
  try {
    const files = await readdir(sessDir);
    const sessionFiles = files.filter(f => 
      f.endsWith('.jsonl') || f.includes('.deleted.') || f.includes('.reset.')
    );
    
    // Stat all files in parallel (fast, low memory)
    const entries = await Promise.all(sessionFiles.map(async (filename) => {
      try {
        const filepath = join(sessDir, filename);
        const fileStat = await stat(filepath);
        const meta = parseSessionFilename(filename);
        return {
          ...meta,
          agent,
          size: fileStat.size,
          mtime: fileStat.mtime.getTime(),
          modifiedAt: fileStat.mtime.toISOString(),
        };
      } catch {
        return null;
      }
    }));
    
    return entries.filter(Boolean);
  } catch {
    return [];
  }
}

// Parse a single session file - streaming, memory-efficient
async function parseSessionFile(agent, filename, existingStat = null) {
  const cacheKey = `${agent}/${filename}`;
  const filepath = join(AGENTS_DIR, agent, 'sessions', filename);
  
  // Get real stat object if not provided
  let fileStat;
  let mtime;
  let size;
  
  if (existingStat && existingStat.size && existingStat.mtime) {
    // Use existing stat data (from sorting)
    size = existingStat.size;
    mtime = existingStat.mtime;
  } else {
    // Stat the file
    try {
      fileStat = await stat(filepath);
      size = fileStat.size;
      mtime = fileStat.mtime.getTime();
    } catch {
      return null;
    }
  }
  
  // Check cache
  const cached = parseCache.get(cacheKey);
  if (cached && cached.mtime === mtime) {
    return cached.summary;
  }
  
  const meta = parseSessionFilename(filename);
  const rl = createInterface({
    input: createReadStream(filepath),
    crlfDelay: Infinity
  });
  
  let firstUserMsg = null;
  let firstTimestamp = null;
  let lastTimestamp = null;
  const models = new Set();
  let totalCost = 0;
  let messageCount = 0;
  let toolCallCount = 0;
  let compactionCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let lineCount = 0;
  
  try {
    for await (const line of rl) {
      if (!line.trim()) continue;
      lineCount++;
      
      try {
        const obj = JSON.parse(line);
        
        if (obj.timestamp) {
          if (!firstTimestamp) firstTimestamp = obj.timestamp;
          lastTimestamp = obj.timestamp;
        }
        
        if (obj.type === 'message' && obj.message) {
          messageCount++;
          
          if (obj.message.role === 'user' && !firstUserMsg) {
            const content = obj.message.content;
            let text = '';
            if (Array.isArray(content) && content[0]?.text) {
              text = content[0].text;
            } else if (typeof content === 'string') {
              text = content;
            }
            if (text) firstUserMsg = text.slice(0, 200);
          }
          
          if (obj.message.role === 'assistant') {
            if (obj.message.model) models.add(obj.message.model);
            if (obj.message.usage?.cost?.total) {
              totalCost += obj.message.usage.cost.total;
            }
            if (obj.message.usage?.input) totalInputTokens += obj.message.usage.input;
            if (obj.message.usage?.output) totalOutputTokens += obj.message.usage.output;
            
            if (Array.isArray(obj.message.content)) {
              for (const c of obj.message.content) {
                if (c.type === 'toolCall') toolCallCount++;
              }
            }
          }
        }
        
        if (obj.type === 'compaction') compactionCount++;
      } catch (e) {
        // Skip malformed lines
      }
    }
  } catch (e) {
    console.error(`Error parsing ${filename}:`, e.message);
  }
  
  const summary = {
    ...meta,
    agent,
    size,
    mtime,
    modifiedAt: new Date(mtime).toISOString(),
    firstTimestamp,
    lastTimestamp,
    firstUserMsg: firstUserMsg || '(no message)',
    models: [...models],
    totalCost: Math.round(totalCost * 1000000) / 1000000,
    messageCount,
    toolCallCount,
    compactionCount,
    lineCount,
    totalInputTokens,
    totalOutputTokens,
  };
  
  // Cache management - evict oldest if too large
  if (parseCache.size >= MAX_CACHE_SIZE) {
    const firstKey = parseCache.keys().next().value;
    parseCache.delete(firstKey);
  }
  parseCache.set(cacheKey, { summary, mtime });
  
  return summary;
}

// Build parent↔child session map by scanning ALL JSONL files for sessions_spawn results.
// The sessions_spawn tool result contains { childSessionKey } which is the exact key
// in sessions.json for the child session — deterministic ID-based linking.
//
// Any file containing a sessions_spawn result IS the parent. The file's UUID is used
// as the parent sessionId (it appears in the session list as that UUID).
//
// Returns { childToParent: Map<sessionId, parentSessionId>, parentToChildren: Map<sessionId, sessionId[]> }
const EMPTY_SPAWN_MAP = { childToParent: new Map(), parentToChildren: new Map() };

async function getSpawnMap(agent) {
  const sessionsJsonPath = join(AGENTS_DIR, agent, 'sessions', 'sessions.json');

  let fileStat;
  try { fileStat = await stat(sessionsJsonPath); } catch { return EMPTY_SPAWN_MAP; }
  const mtime = fileStat.mtime.getTime();

  const cached = spawnMapCache.get(agent);
  if (cached && cached.mtime === mtime) return cached.map;

  const data = JSON.parse(await readFile(sessionsJsonPath, 'utf8'));

  // Build childSessionKey → childSessionId lookup from sessions.json
  const keyToSessionId = new Map();
  for (const [key, val] of Object.entries(data)) {
    if (val.sessionId) keyToSessionId.set(key, val.sessionId);
  }

  const childToParent = new Map();
  const parentToChildren = new Map();
  const sessDir = join(AGENTS_DIR, agent, 'sessions');

  // Scan every JSONL file on disk for childSessionKey using streaming
  const filenames = await getAgentFilenames(agent);

  await Promise.all(filenames.map(async (filename) => {
    const parentSid = parseSessionFilename(filename).sessionId;
    if (!parentSid) return;

    const filepath = join(sessDir, filename);
    const rl = createInterface({ input: createReadStream(filepath), crlfDelay: Infinity });

    try {
      for await (const line of rl) {
        if (!line.includes('childSessionKey')) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type !== 'message') continue;
          const content = obj.message?.content;
          if (!Array.isArray(content)) continue;
          for (const block of content) {
            const text = block.text || (typeof block.content === 'string' ? block.content : '');
            if (!text || !text.includes('childSessionKey')) continue;
            try {
              const result = JSON.parse(text);
              const childKey = result.childSessionKey;
              if (childKey && keyToSessionId.has(childKey)) {
                const childSid = keyToSessionId.get(childKey);
                childToParent.set(childSid, parentSid);
                if (!parentToChildren.has(parentSid)) parentToChildren.set(parentSid, []);
                parentToChildren.get(parentSid).push(childSid);
              }
            } catch {}
          }
        } catch {}
      }
    } catch { /* stream error */ }
  }));

  const map = { childToParent, parentToChildren };
  spawnMapCache.set(agent, { map, mtime });
  return map;
}

// ─── Routes ────────────────────────────────────────────────────

app.get('/api/agents', async (req, res) => {
  try {
    const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
    const agents = [];
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const filenames = await getAgentFilenames(entry.name);
      const active = filenames.filter(f => !f.includes('.deleted.') && !f.includes('.reset.')).length;
      const deleted = filenames.filter(f => f.includes('.deleted.')).length;
      const reset = filenames.filter(f => f.includes('.reset.')).length;
      
      agents.push({
        name: entry.name,
        emoji: AGENT_EMOJIS[entry.name] || '🤖',
        activeSessions: active,
        deletedSessions: deleted,
        resetSessions: reset,
        totalSessions: filenames.length,
      });
    }
    
    agents.sort((a, b) => a.name.localeCompare(b.name));
    res.json(agents);
  } catch (err) {
    console.error('Agents error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Build spawn maps for the given agents (parallel)
async function getSpawnMaps(agentNames) {
  const results = await Promise.all(agentNames.map(async (ag) => [ag, await getSpawnMap(ag)]));
  return new Map(results);
}

// Filter out child sessions from a file list (pre-pagination) so they don't take up page slots.
// Returns the filtered list; children will be fetched on-demand when their parent is on the page.
function removeChildFiles(allFiles, maps) {
  return allFiles.filter(f => {
    const map = maps.get(f.agent);
    return !map || !map.childToParent.has(f.sessionId);
  });
}

// After parsing a page of sessions, attach their children as nested objects
async function attachChildren(sessions, maps) {
  // Cache directory listings per agent to avoid repeated readdir calls
  const dirCache = new Map();
  async function getDirFiles(agentName) {
    if (dirCache.has(agentName)) return dirCache.get(agentName);
    const files = await getAgentFilenames(agentName);
    dirCache.set(agentName, files);
    return files;
  }

  await Promise.all(sessions.map(async (s) => {
    const map = maps.get(s.agent);
    if (!map) return;
    const childIds = map.parentToChildren.get(s.sessionId);
    if (!childIds || childIds.length === 0) return;

    const dirFiles = await getDirFiles(s.agent);
    const children = (await Promise.all(childIds.map(async (childSid) => {
      const childFilename = dirFiles.find(f => f.startsWith(childSid));
      if (!childFilename) return null;
      try {
        const child = await parseSessionFile(s.agent, childFilename);
        if (child) child.parentSessionId = s.sessionId;
        return child;
      } catch { return null; }
    }))).filter(Boolean);

    if (children.length > 0) s.children = children;
  }));
}

// List sessions - memory-efficient pagination with proper sorting
app.get('/api/sessions', async (req, res) => {
  try {
    const {
      agent,
      search,
      status = 'all',
      model,
      sort = 'date_desc',
      page = '1',
      limit = '50',
    } = req.query;

    // Get agent list
    let agentNames = [];
    if (agent) {
      agentNames = [agent];
    } else {
      const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
      agentNames = entries.filter(e => e.isDirectory()).map(e => e.name);
    }
    
    // For date sorting, we need to stat files
    // For name sorting, we can use filenames only
    const needsStat = sort.startsWith('date_') || sort.startsWith('size_');
    
    let allFiles = [];
    
    if (needsStat) {
      // Stat files (fast, low memory - just metadata)
      for (const ag of agentNames) {
        const files = await getAgentFilesWithStat(ag);
        allFiles.push(...files);
      }
    } else {
      // Just filenames (fastest)
      for (const ag of agentNames) {
        const filenames = await getAgentFilenames(ag);
        for (const filename of filenames) {
          const meta = parseSessionFilename(filename);
          allFiles.push({ ...meta, agent: ag });
        }
      }
    }
    
    // Build spawn maps for child filtering
    const spawnMaps = await getSpawnMaps(agentNames);

    // Status filter (cheap, filename-based)
    if (status !== 'all') {
      allFiles = allFiles.filter(f => f.status === status);
    }

    // Remove child sessions so they don't occupy page slots
    allFiles = removeChildFiles(allFiles, spawnMaps);

    // Sort
    switch (sort) {
      case 'date_asc':
        allFiles.sort((a, b) => (a.mtime || 0) - (b.mtime || 0));
        break;
      case 'date_desc':
      default:
        allFiles.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
        break;
      case 'size_desc':
        allFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
        break;
      case 'size_asc':
        allFiles.sort((a, b) => (a.size || 0) - (b.size || 0));
        break;
      case 'name_asc':
        allFiles.sort((a, b) => a.filename.localeCompare(b.filename));
        break;
      case 'name_desc':
        allFiles.sort((a, b) => b.filename.localeCompare(a.filename));
        break;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // When search or model filter is active, we must parse ALL files first
    if (search || model) {
      const allSessions = [];
      for (const f of allFiles) {
        try {
          const summary = await parseSessionFile(f.agent, f.filename, f.size ? { size: f.size, mtime: f.mtime } : null);
          if (summary) allSessions.push(summary);
        } catch (e) {
          console.error(`Failed to parse ${f.filename}:`, e.message);
        }
      }

      let filtered = allSessions;

      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter(s =>
          (s.firstUserMsg && s.firstUserMsg.toLowerCase().includes(q)) ||
          s.sessionId.toLowerCase().includes(q) ||
          s.filename.toLowerCase().includes(q)
        );
      }

      if (model) {
        filtered = filtered.filter(s =>
          s.models && s.models.some(m => m.toLowerCase().includes(model.toLowerCase()))
        );
      }

      const total = filtered.length;
      const offset = (pageNum - 1) * limitNum;
      const paged = filtered.slice(offset, offset + limitNum);
      await attachChildren(paged, spawnMaps);

      res.json({
        sessions: paged,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } else {
      // Fast path: paginate first then parse only the page
      const total = allFiles.length;
      const offset = (pageNum - 1) * limitNum;
      const pageFiles = allFiles.slice(offset, offset + limitNum);
      const sessions = [];

      for (const f of pageFiles) {
        try {
          const summary = await parseSessionFile(f.agent, f.filename, f.size ? { size: f.size, mtime: f.mtime } : null);
          if (summary) sessions.push(summary);
        } catch (e) {
          console.error(`Failed to parse ${f.filename}:`, e.message);
        }
      }
      await attachChildren(sessions, spawnMaps);

      res.json({
        sessions,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }
  } catch (err) {
    console.error('Sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Full transcript - streaming parse
app.get('/api/sessions/:agent/:filename', async (req, res) => {
  try {
    const { agent, filename } = req.params;
    
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = join(AGENTS_DIR, agent, 'sessions', filename);
    
    if (!existsSync(filepath)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const entries = [];
    const rl = createInterface({
      input: createReadStream(filepath),
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        entries.push(JSON.parse(line));
      } catch (e) {
        // Skip malformed lines
      }
    }
    
    // Look up session metadata from sessions.json
    let sessionMeta = null;
    const sessionsJsonPath = join(AGENTS_DIR, agent, 'sessions', 'sessions.json');
    if (existsSync(sessionsJsonPath)) {
      try {
        const sessionsData = JSON.parse(await readFile(sessionsJsonPath, 'utf8'));
        const targetUuid = filename.match(/^([0-9a-f-]{36})/)?.[1];

        for (const [key, value] of Object.entries(sessionsData)) {
          // Match by sessionFile path or by sessionId UUID
          const sessFilename = value.sessionFile ? value.sessionFile.split('/').pop() : '';
          const match = sessFilename === filename
            || (targetUuid && sessFilename.startsWith(targetUuid))
            || (targetUuid && value.sessionId === targetUuid);

          if (match) {
            const resolvedSkills = value.skillsSnapshot?.resolvedSkills || [];
            const basicSkills = value.skillsSnapshot?.skills || [];
            const skills = resolvedSkills.length > 0
              ? resolvedSkills.map(s => ({
                  name: s.name,
                  description: s.description || null,
                  source: s.source || null,
                }))
              : basicSkills.map(s => ({ name: s.name, description: null, source: null }));

            sessionMeta = {
              sessionKey: key,
              model: value.model || null,
              modelProvider: value.modelProvider || null,
              contextTokens: value.contextTokens || null,
              workspaceFiles: (value.systemPromptReport?.injectedWorkspaceFiles || []).map(f => ({
                name: f.name,
                path: f.path,
                missing: f.missing || false,
                rawChars: f.rawChars || 0,
                injectedChars: f.injectedChars || 0,
                truncated: f.truncated || false,
              })),
              skills,
              tools: (value.systemPromptReport?.tools?.entries || []).map(t => ({
                name: t.name,
                propertiesCount: t.propertiesCount || 0,
              })),
              systemPromptChars: value.systemPromptReport?.systemPrompt?.chars || null,
              projectContextChars: value.systemPromptReport?.systemPrompt?.projectContextChars || null,
            };
            break;
          }
        }
      } catch (e) {
        console.error('Failed to read sessions.json:', e.message);
      }
    }

    res.json({
      agent,
      filename,
      entries,
      sessionMeta,
    });
  } catch (err) {
    console.error('Transcript error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Global stats (cached)
let statsCache = null;
let statsCacheTime = 0;
const STATS_CACHE_TTL = 60000; // 1 minute

app.get('/api/stats', async (req, res) => {
  try {
    const now = Date.now();
    if (statsCache && (now - statsCacheTime) < STATS_CACHE_TTL) {
      return res.json(statsCache);
    }
    
    const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
    let totalSessions = 0;
    let activeSessions = 0;
    let deletedSessions = 0;
    let resetSessions = 0;
    const agentCount = entries.filter(e => e.isDirectory()).length;
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const filenames = await getAgentFilenames(entry.name);
      totalSessions += filenames.length;
      activeSessions += filenames.filter(f => !f.includes('.deleted.') && !f.includes('.reset.')).length;
      deletedSessions += filenames.filter(f => f.includes('.deleted.')).length;
      resetSessions += filenames.filter(f => f.includes('.reset.')).length;
    }
    
    statsCache = {
      agentCount,
      totalSessions,
      activeSessions,
      deletedSessions,
      resetSessions,
    };
    statsCacheTime = now;
    
    res.json(statsCache);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Deep content search — searches through full session transcripts
app.get('/api/search', async (req, res) => {
  try {
    const { query, agent, limit: limitStr = '50' } = req.query;
    const limitNum = Math.min(parseInt(limitStr) || 50, 200);
    
    if (!query || query.trim().length < 2) {
      return res.json({ results: [], total: 0, query: '' });
    }
    
    const q = query.toLowerCase().trim();
    
    let agentNames;
    if (agent) {
      agentNames = [agent];
    } else {
      const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
      agentNames = entries.filter(e => e.isDirectory()).map(e => e.name);
    }
    
    const results = [];
    
    for (const ag of agentNames) {
      if (results.length >= limitNum) break;
      
      const sessDir = join(AGENTS_DIR, ag, 'sessions');
      let files;
      try {
        files = await readdir(sessDir);
      } catch {
        continue;
      }
      
      const sessionFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.deleted.'));
      
      for (const filename of sessionFiles) {
        if (results.length >= limitNum) break;
        
        const filepath = join(sessDir, filename);
        const rl = createInterface({
          input: createReadStream(filepath),
          crlfDelay: Infinity,
        });
        
        let firstTimestamp = null;
        let lastTimestamp = null;
        let firstUserMsg = null;
        const snippets = [];
        let messageCount = 0;
        const models = new Set();
        
        try {
          for await (const line of rl) {
            if (!line.trim()) continue;
            
            let obj;
            try { obj = JSON.parse(line); } catch { continue; }
            
            if (obj.timestamp) {
              if (!firstTimestamp) firstTimestamp = obj.timestamp;
              lastTimestamp = obj.timestamp;
            }
            
            if (obj.type !== 'message' || !obj.message) continue;
            messageCount++;
            
            const role = obj.message.role;
            if (role === 'assistant' && obj.message.model) {
              models.add(obj.message.model);
            }
            
            // Extract firstUserMsg from text content only
            if (role === 'user' && !firstUserMsg) {
              const content = obj.message.content;
              const text = Array.isArray(content) && content[0]?.type === 'text' ? content[0].text
                : typeof content === 'string' ? content : '';
              if (text) firstUserMsg = text.slice(0, 200);
            }

            // Skip heavy segment extraction once we have enough snippets
            // or when the raw line doesn't contain the query at all
            if (snippets.length >= 3) continue;
            if (!line.toLowerCase().includes(q)) continue;

            const segments = extractContentSegments(obj.message);
            for (const seg of segments) {
              if (snippets.length >= 3) break;
              const idx = seg.text.toLowerCase().indexOf(q);
              if (idx !== -1) {
                const start = Math.max(0, idx - 100);
                const end = Math.min(seg.text.length, idx + q.length + 100);
                snippets.push({
                  role,
                  sourceType: seg.type,
                  text: (start > 0 ? '…' : '') + seg.text.slice(start, end) + (end < seg.text.length ? '…' : ''),
                  matchStart: idx - start + (start > 0 ? 1 : 0),
                  matchLength: q.length,
                  timestamp: obj.timestamp,
                });
              }
            }
          }
        } catch {
          // Async iterator may throw when stream ends
        }
        
        if (snippets.length > 0) {
          const meta = parseSessionFilename(filename);
          let fileStat;
          try { fileStat = await stat(filepath); } catch {}
          
          results.push({
            ...meta,
            agent: ag,
            firstTimestamp,
            lastTimestamp,
            firstUserMsg: firstUserMsg || '(no message)',
            models: [...models],
            messageCount,
            snippets,
            size: fileStat?.size || 0,
            modifiedAt: fileStat?.mtime?.toISOString() || null,
          });
        }
      }
    }
    
    // Sort by lastTimestamp desc (most recent first)
    results.sort((a, b) => {
      const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
      const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
      return tb - ta;
    });
    
    res.json({ results, total: results.length, query });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(import.meta.dirname, 'frontend', 'dist', 'index.html'));
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST);
