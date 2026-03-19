import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { formatBytes, formatCost, formatDate, formatRelativeTime, truncate, getModelColor, getModelShortName } from '../utils/formatters';

function SessionList() {
  const navigate = useNavigate();
  const {
    sessions,
    loading,
    error,
    currentPage,
    totalPages,
    setPage,
    selectedSession,
    searchResults,
    searchLoading,
    searchQuery,
  } = useSessionStore();

  const handleSessionClick = (agent, filename) => {
    navigate(`/session/${agent}/${filename}`);
  };

  // ─── Search Results Mode ───
  if (searchResults !== null) {
    if (searchLoading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-400">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
            <p>Searching session content…</p>
          </div>
        </div>
      );
    }

    if (searchResults.length === 0) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-gray-500 text-center">
            <p className="text-lg mb-2">No results found</p>
            <p className="text-sm">No sessions contain "<span className="text-gray-300">{searchQuery}</span>"</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col">
        <div className="px-4 pt-3 pb-2 text-xs text-gray-500 border-b border-white/5">
          {searchResults.length} session{searchResults.length !== 1 ? 's' : ''} matching "<span className="text-gray-300">{searchQuery}</span>"
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {searchResults.map((result) => (
              <button
                key={`${result.agent}-${result.filename}`}
                onClick={() => handleSessionClick(result.agent || result.agentName, result.filename)}
                className={`w-full text-left p-4 rounded-lg transition-all glass hover:glass-light ${
                  selectedSession?.filename === result.filename
                    ? 'ring-2 ring-accent bg-bg-tertiary'
                    : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-300">
                      {result.agent || result.agentName}
                    </span>
                    {result.topic && (
                      <span className="text-xs bg-bg-quaternary px-2 py-0.5 rounded text-gray-400">
                        Topic {result.topic}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {result.messageCount || 0} msgs
                  </span>
                </div>

                {/* Snippets */}
                <div className="space-y-1.5 mb-2">
                  {result.snippets.map((snippet, idx) => (
                    <div key={idx} className="text-xs rounded bg-black/20 border border-white/5 p-2">
                      <span className={`inline-block mb-1 text-[10px] font-medium uppercase tracking-wider ${
                        snippet.role === 'user' ? 'text-blue-400' : 'text-emerald-400'
                      }`}>
                        {snippet.role}
                      </span>
                      <p className="text-gray-400 line-clamp-2 break-words">
                        <HighlightMatch text={snippet.text} query={searchQuery} />
                      </p>
                    </div>
                  ))}
                </div>

                {/* Models */}
                {result.models && result.models.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {result.models.map((model, idx) => (
                      <span
                        key={idx}
                        className={`text-xs px-2 py-0.5 rounded bg-${getModelColor(model)}-500/20 text-${getModelColor(model)}-400 border border-${getModelColor(model)}-500/30`}
                      >
                        {getModelShortName(model)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer with timestamps */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500" title="Created">
                      {formatDate(result.firstTimestamp)}
                    </span>
                  </div>
                  <span className="font-mono text-xs">{result.sessionId.slice(0, 8)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Normal Session List ───
  if (loading && sessions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-400">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p>Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-red-400">
          <p className="text-lg mb-2">⚠️ Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500">
          <p className="text-lg">No sessions found</p>
          <p className="text-sm mt-2">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {sessions.map((session) => (
            <button
              key={`${session.agent}-${session.filename}`}
              onClick={() => handleSessionClick(session.agent, session.filename)}
              className={`w-full text-left p-4 rounded-lg transition-all glass hover:glass-light ${
                selectedSession?.filename === session.filename
                  ? 'ring-2 ring-accent bg-bg-tertiary'
                  : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-300">
                    {session.agent}
                  </span>
                  {session.topic && (
                    <span className="text-xs bg-bg-quaternary px-2 py-0.5 rounded text-gray-400">
                      Topic {session.topic}
                    </span>
                  )}
                </div>
                <StatusBadge status={session.status} />
              </div>

              {/* Message Preview */}
              <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                {truncate(session.firstUserMsg, 120)}
              </p>

              {/* Models */}
              {session.models && session.models.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {session.models.map((model, idx) => (
                    <span
                      key={idx}
                      className={`text-xs px-2 py-0.5 rounded bg-${getModelColor(model)}-500/20 text-${getModelColor(model)}-400 border border-${getModelColor(model)}-500/30`}
                    >
                      {getModelShortName(model)}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span title="Messages">💬 {session.messageCount || 0}</span>
                {session.toolCallCount > 0 && (
                  <span title="Tool Calls">🔧 {session.toolCallCount}</span>
                )}
                {session.totalCost > 0 && (
                  <span title="Cost" className="text-green-400">
                    {formatCost(session.totalCost)}
                  </span>
                )}
                <span title="Size">{formatBytes(session.size)}</span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500" title={session.firstTimestamp ? `Created: ${new Date(session.firstTimestamp).toLocaleString()}` : 'Created'}>
                    {formatDate(session.firstTimestamp || session.modifiedAt)}
                  </span>
                  <span className="text-gray-600" title="Last modified">
                    · {formatRelativeTime(session.modifiedAt)}
                  </span>
                </div>
                <span className="font-mono text-xs">{session.sessionId.slice(0, 8)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-white/5 p-4 bg-bg-secondary">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-bg-tertiary rounded text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-quaternary transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 bg-bg-tertiary rounded text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-bg-quaternary transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-bg-primary/50 backdrop-blur-sm flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      )}
    </div>
  );
}

function HighlightMatch({ text, query }) {
  if (!text || !query) return <>{text}</>;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts = [];
  let lastIndex = 0;
  let idx = lowerText.indexOf(lowerQuery);
  
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, idx)}</span>);
    }
    parts.push(
      <mark key={`m-${idx}`} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    lastIndex = idx + query.length;
    idx = lowerText.indexOf(lowerQuery, lastIndex);
  }
  
  if (lastIndex < text.length) {
    parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }
  
  return <>{parts}</>;
}

function StatusBadge({ status }) {
  const colors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    deleted: 'bg-red-500/20 text-red-400 border-red-500/30',
    reset: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  const icons = {
    active: '✓',
    deleted: '🗑️',
    reset: '🔄',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${colors[status] || colors.active}`}>
      {icons[status]} {status}
    </span>
  );
}

export default SessionList;
