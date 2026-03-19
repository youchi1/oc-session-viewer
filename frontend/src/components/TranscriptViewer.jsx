import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import MessageBubble from './MessageBubble';
import { formatCost, formatDate, formatDuration, formatTime } from '../utils/formatters';

const FILTER_TYPES = [
  { key: 'user', label: 'User', icon: '👤', collapsible: false },
  { key: 'assistant', label: 'Assistant', icon: '💬', collapsible: false },
  { key: 'thinking', label: 'Thinking', icon: '💭', collapsible: true },
  { key: 'tools', label: 'Tools', icon: '🔧', collapsible: true },
  { key: 'system', label: 'System', icon: '⚙️', collapsible: false },
];

function TranscriptViewer() {
  const navigate = useNavigate();
  const {
    transcript,
    sessionMeta,
    selectedSession,
    selectedAgent,
    activeTypeFilters,
    expandedTypes,
    toggleTypeFilter,
    clearTypeFilters,
    toggleTypeExpand,
    expandAllBlocks,
    collapseAllBlocks,
  } = useSessionStore();

  if (!selectedSession) return null;

  const handleClose = () => {
    if (selectedAgent) {
      navigate(`/agent/${selectedAgent}`);
    } else {
      navigate('/');
    }
  };

  const isTypeVisible = (type) => {
    if (activeTypeFilters.length === 0) return true;
    return activeTypeFilters.includes(type);
  };

  // Classify ALL entries first, then group into turns, then filter within groups
  const classifiedEntries = [];
  transcript.forEach((entry, globalIdx) => {
    if (entry.type === 'message') {
      const role = entry.message?.role;
      if (role === 'user') {
        classifiedEntries.push({ entry, globalIdx, kind: 'user' });
      } else if (role === 'assistant') {
        classifiedEntries.push({ entry, globalIdx, kind: 'assistant' });
      } else if (role === 'toolResult') {
        classifiedEntries.push({ entry, globalIdx, kind: 'toolResult' });
      }
    } else if (['session', 'model_change', 'thinking_level_change', 'compaction', 'custom'].includes(entry.type)) {
      classifiedEntries.push({ entry, globalIdx, kind: 'system' });
    }
  });

  // Group into turns using ALL entries (user messages always form boundaries)
  const rawGroups = groupIntoTurns(classifiedEntries);

  // Now filter within groups based on active type filters
  const isEntryVisible = (item) => {
    const { kind, entry } = item;
    if (kind === 'user') return isTypeVisible('user');
    if (kind === 'toolResult') return isTypeVisible('tools');
    if (kind === 'system') return isTypeVisible('system');
    if (kind === 'assistant') {
      const content = Array.isArray(entry.message?.content) ? entry.message.content : [];
      const hasThinking = content.some(c => c.type === 'thinking');
      const hasText = content.some(c => c.type === 'text');
      const hasTools = content.some(c => c.type === 'toolCall');
      const showThinking = hasThinking && isTypeVisible('thinking');
      const showText = hasText && isTypeVisible('assistant');
      const showTools = hasTools && isTypeVisible('tools');
      return showThinking || showText || showTools || 
             (activeTypeFilters.length === 0) ||
             (!hasThinking && !hasText && !hasTools);
    }
    return true;
  };

  const groups = rawGroups.map(group => {
    if (group.type === 'turn') {
      const filteredSteps = group.steps
        .map(step => step.filter(isEntryVisible))
        .filter(step => step.length > 0);
      if (filteredSteps.length === 0) return null;
      return { ...group, steps: filteredSteps };
    }
    return isEntryVisible(group) ? group : null;
  }).filter(Boolean);

  const sessionInfo = transcript.find(e => e.type === 'session');
  const firstMessage = transcript.find(e => e.type === 'message');
  const lastMessage = [...transcript].reverse().find(e => e.type === 'message');

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <div className="bg-bg-secondary border-b border-white/5 p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              {selectedSession.agent}
              <span className="text-sm text-gray-400 font-normal truncate">
                / {selectedSession.filename}
              </span>
            </h2>
            {sessionInfo && (
              <p className="text-xs text-gray-500 mt-1">
                Session ID: {sessionInfo.id || 'unknown'}
              </p>
            )}
            {firstMessage && lastMessage && (
              <p className="text-xs text-gray-500">
                Duration: {formatDuration(firstMessage.timestamp, lastMessage.timestamp)}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-2"
            title="Close transcript"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Type Filter Chips */}
          <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
            {FILTER_TYPES.map((ft) => {
              const isActive = activeTypeFilters.includes(ft.key);
              const isExpanded = expandedTypes.includes(ft.key);
              const noFilters = activeTypeFilters.length === 0;
              
              return (
                <div key={ft.key} className="flex items-center">
                  <button
                    onClick={() => toggleTypeFilter(ft.key)}
                    className={`px-2 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
                      ft.collapsible ? 'rounded-l' : 'rounded'
                    } ${
                      isActive
                        ? 'bg-accent text-white'
                        : noFilters
                          ? 'text-gray-300 hover:text-white hover:bg-white/5'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                    title={`${isActive ? 'Hide' : 'Show'} ${ft.label}`}
                  >
                    <span>{ft.icon}</span>
                    <span>{ft.label}</span>
                  </button>
                  {ft.collapsible && (
                    <button
                      onClick={() => toggleTypeExpand(ft.key)}
                      className={`px-1 py-1 text-xs transition-colors rounded-r border-l border-white/10 ${
                        isExpanded
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                      }`}
                      title={`${isExpanded ? 'Collapse' : 'Expand'} all ${ft.label.toLowerCase()}`}
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/10" />

          {/* Action buttons */}
          <button
            onClick={expandAllBlocks}
            className="text-xs px-2 py-1.5 bg-bg-tertiary hover:bg-bg-quaternary rounded text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
            title="Expand all blocks"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            Expand
          </button>
          <button
            onClick={collapseAllBlocks}
            className="text-xs px-2 py-1.5 bg-bg-tertiary hover:bg-bg-quaternary rounded text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
            title="Collapse all blocks"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 9h4.5M15 9V4.5M15 9l5.5-5.5M15 15h4.5M15 15v4.5m0-4.5l5.5 5.5" />
            </svg>
            Collapse
          </button>

          {activeTypeFilters.length > 0 && (
            <button
              onClick={clearTypeFilters}
              className="text-xs px-2 py-1.5 bg-bg-tertiary hover:bg-bg-quaternary rounded text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
              title="Clear all filters"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {groups.map((group, gIdx) => {
          if (group.type === 'turn') {
            const totalSteps = group.steps.length;
            const allEntries = group.steps.flat();
            const toolResultCount = allEntries.filter(e => e.kind === 'toolResult').length;

            return (
              <div key={gIdx} className="space-y-1">
                {group.steps.map((step, sIdx) => {
                  const stepAssistant = step.find(e => e.kind === 'assistant');
                  const stepToolResults = step.filter(e => e.kind === 'toolResult');
                  const model = stepAssistant?.entry?.message?.model;
                  const usage = stepAssistant?.entry?.message?.usage;
                  const timestamp = stepAssistant?.entry?.timestamp || stepAssistant?.entry?.message?.timestamp;
                  const stepLabel = totalSteps > 1 ? `Step ${sIdx + 1}/${totalSteps}` : null;

                  return (
                    <div key={sIdx} className="relative rounded-lg bg-white/[0.015] border border-white/[0.04]">
                      {/* Step accent bar */}
                      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-indigo-500/40" />

                      {/* Step header */}
                      <div className="px-4 pt-2 pb-1 flex items-center gap-2 flex-wrap">
                        {timestamp && (
                          <span className="text-[10px] text-gray-500 font-mono tabular-nums">
                            {formatTime(timestamp)}
                          </span>
                        )}
                        {stepLabel && (
                          <span className="text-[10px] font-medium text-indigo-400/60 uppercase tracking-wider">
                            {stepLabel}
                          </span>
                        )}
                        {model && (
                          <span className="text-[10px] text-gray-600 font-mono">
                            {model.split('/').pop()}
                          </span>
                        )}
                        {usage?.cost?.total != null && (
                          <span className="text-[10px] text-green-400/70">
                            {formatCost(usage.cost.total)}
                          </span>
                        )}
                        {stepToolResults.length > 0 && (
                          <span className="text-[10px] text-gray-600">
                            · {stepToolResults.length} tool call{stepToolResults.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Step content — tool results are merged into the assistant bubble */}
                      <div className="px-4 pb-3 space-y-2">
                        {step.filter(e => e.kind !== 'toolResult').map(({ entry, globalIdx, kind }) => (
                          <EntryRenderer
                            key={globalIdx}
                            entry={entry}
                            index={globalIdx}
                            kind={kind}
                            expandedTypes={expandedTypes}
                            activeTypeFilters={activeTypeFilters}
                            hideMetadata={true}
                            toolResults={stepToolResults.map(e => e.entry.message)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }
          
          const { entry, globalIdx, kind } = group;
          return (
            <div key={gIdx}>
              <EntryRenderer
                entry={entry}
                index={globalIdx}
                kind={kind}
                expandedTypes={expandedTypes}
                activeTypeFilters={activeTypeFilters}
                sessionMeta={sessionMeta}
              />
            </div>
          );
        })}

        {groups.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            No entries match the current filters
          </div>
        )}
      </div>
    </div>
  );
}

function SessionMetaBlock({ meta }) {
  const [expanded, setExpanded] = useState(false);

  const fileCount = meta.workspaceFiles?.length || 0;
  const skillCount = meta.skills?.length || 0;
  const toolCount = meta.tools?.length || 0;
  const hasMeta = fileCount > 0 || skillCount > 0 || toolCount > 0;

  if (!hasMeta) return null;

  const SOURCE_BADGES = {
    'openclaw-bundled': { label: 'bundled', color: 'bg-blue-500/20 text-blue-400' },
    'openclaw-managed': { label: 'managed', color: 'bg-emerald-500/20 text-emerald-400' },
    'openclaw-workspace': { label: 'workspace', color: 'bg-amber-500/20 text-amber-400' },
  };

  return (
    <div className="mx-auto max-w-xl">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-bg-tertiary/50 border border-white/[0.06] hover:bg-bg-tertiary hover:border-white/10 transition-all group"
      >
        <span className="text-[11px] text-gray-500 group-hover:text-gray-400 transition-colors">
          {fileCount} file{fileCount !== 1 ? 's' : ''} · {skillCount} skill{skillCount !== 1 ? 's' : ''} · {toolCount} tool{toolCount !== 1 ? 's' : ''}
          {meta.model && (
            <span className="ml-1.5 text-gray-600">
              · {meta.model}
            </span>
          )}
        </span>
        <svg
          className={`w-3 h-3 text-gray-600 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg bg-bg-tertiary/40 border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
          {/* Workspace Files */}
          {fileCount > 0 && (
            <MetaSection icon="📁" title="Workspace Files" count={fileCount}>
              <div className="space-y-0.5">
                {meta.workspaceFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] py-0.5">
                    <span className={`font-medium ${f.missing ? 'text-gray-600 line-through' : 'text-gray-300'}`}>
                      {f.name}
                    </span>
                    <span className="text-gray-600 font-mono tabular-nums">
                      {f.rawChars > 0 ? `${(f.rawChars / 1024).toFixed(1)}k` : '—'}
                    </span>
                    {f.missing && (
                      <span className="px-1 py-0.5 rounded text-[9px] bg-yellow-500/15 text-yellow-500 font-medium">
                        missing
                      </span>
                    )}
                    {f.truncated && (
                      <span className="px-1 py-0.5 rounded text-[9px] bg-orange-500/15 text-orange-400 font-medium">
                        truncated
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </MetaSection>
          )}

          {/* Skills */}
          {skillCount > 0 && (
            <MetaSection icon="🧩" title="Skills" count={skillCount}>
              <div className="space-y-0.5">
                {meta.skills.map((s, i) => {
                  const badge = SOURCE_BADGES[s.source];
                  return (
                    <div key={i} className="flex items-center gap-2 text-[11px] py-0.5">
                      <span className="text-gray-300 font-medium">{s.name}</span>
                      {badge && (
                        <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </MetaSection>
          )}

          {/* Tools */}
          {toolCount > 0 && (
            <MetaSection icon="🔧" title="Tools" count={toolCount}>
              <div className="flex flex-wrap gap-1">
                {meta.tools.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-white/[0.04] text-gray-400 font-mono"
                    title={`${t.propertiesCount} params`}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </MetaSection>
          )}

          {/* System prompt stats */}
          {(meta.systemPromptChars || meta.contextTokens) && (
            <div className="px-3 py-2 flex items-center gap-3 text-[10px] text-gray-600">
              {meta.systemPromptChars && (
                <span>System prompt: {(meta.systemPromptChars / 1024).toFixed(1)}k chars</span>
              )}
              {meta.projectContextChars && (
                <span>Project context: {(meta.projectContextChars / 1024).toFixed(1)}k chars</span>
              )}
              {meta.contextTokens && (
                <span>Context window: {(meta.contextTokens / 1000).toFixed(0)}k tokens</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetaSection({ icon, title, count, children }) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs">{icon}</span>
        <span className="text-[11px] font-medium text-gray-400">{title}</span>
        <span className="text-[10px] text-gray-600">({count})</span>
      </div>
      {children}
    </div>
  );
}

function EntryRenderer({ entry, index, kind, expandedTypes, activeTypeFilters, hideMetadata, toolResults, sessionMeta }) {
  // Session header
  if (entry.type === 'session') {
    return (
      <div className="py-4 space-y-2">
        <div className="text-center">
          <div className="inline-block bg-bg-tertiary px-4 py-2 rounded-lg border border-white/10">
            <div className="text-sm text-gray-400">Session Started</div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDate(entry.timestamp)}
            </div>
            {entry.cwd && (
              <div className="text-xs text-gray-600 mt-1 font-mono">
                {entry.cwd}
              </div>
            )}
          </div>
        </div>
        {sessionMeta && <SessionMetaBlock meta={sessionMeta} />}
      </div>
    );
  }

  // Model change
  if (entry.type === 'model_change') {
    return (
      <div className="text-center py-2">
        <div className="inline-block bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded text-xs text-purple-400">
          Model: {entry.modelId} ({entry.provider})
        </div>
      </div>
    );
  }

  // Thinking level change
  if (entry.type === 'thinking_level_change') {
    return (
      <div className="text-center py-2">
        <div className="inline-block bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded text-xs text-indigo-400">
          Thinking Level: {entry.thinkingLevel}
        </div>
      </div>
    );
  }

  // Compaction
  if (entry.type === 'compaction') {
    return (
      <div className="text-center py-2">
        <div className="inline-block bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded text-xs text-amber-400">
          📦 Compaction: {entry.tokensBefore} → {entry.tokensAfter || '?'} tokens
        </div>
      </div>
    );
  }

  // Messages
  if (entry.type === 'message') {
    return (
      <MessageBubble
        message={entry.message}
        index={index}
        expandedTypes={expandedTypes}
        activeTypeFilters={activeTypeFilters}
        hideMetadata={hideMetadata}
        toolResults={toolResults}
      />
    );
  }

  return null;
}

// Group entries into turns, with steps inside each turn.
// A "turn" = everything between user/system boundaries.
// A "step" = one assistant message + its following toolResult messages.
function groupIntoTurns(filteredEntries) {
  const groups = [];
  let currentTurnEntries = [];

  const flushTurn = () => {
    if (currentTurnEntries.length === 0) return;
    // Break turn entries into steps: each assistant msg starts a new step
    const steps = [];
    let currentStep = [];
    currentTurnEntries.forEach((item) => {
      if (item.kind === 'assistant') {
        if (currentStep.length > 0) steps.push(currentStep);
        currentStep = [item];
      } else {
        // toolResult — belongs to current step
        currentStep.push(item);
      }
    });
    if (currentStep.length > 0) steps.push(currentStep);
    groups.push({ type: 'turn', steps });
    currentTurnEntries = [];
  };

  filteredEntries.forEach((item) => {
    const { kind } = item;
    if (kind === 'user' || kind === 'system') {
      flushTurn();
      groups.push(item);
    } else {
      currentTurnEntries.push(item);
    }
  });

  flushTurn();
  return groups;
}

export default TranscriptViewer;
