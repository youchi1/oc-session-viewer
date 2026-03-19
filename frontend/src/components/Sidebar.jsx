import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { formatNumber } from '../utils/formatters';

function Sidebar() {
  const navigate = useNavigate();
  const {
    agents,
    stats,
    selectedAgent,
    sidebarOpen,
    toggleSidebar,
  } = useSessionStore();

  const handleAgentClick = (agentName) => {
    if (agentName) {
      navigate(`/agent/${agentName}`);
    } else {
      navigate('/');
    }
  };

  if (!sidebarOpen) {
    return (
      <div className="fixed left-0 top-0 h-full w-12 bg-bg-secondary border-r border-white/5 flex items-start justify-center pt-4 z-50">
        <button
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-white transition-colors"
          title="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-bg-secondary border-r border-white/5 flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">OpenClaw</h1>
          <p className="text-xs text-gray-400">Session Viewer</p>
        </div>
        <button
          onClick={toggleSidebar}
          className="text-gray-400 hover:text-white transition-colors"
          title="Close sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="p-4 border-b border-white/5 glass-light">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div>
              <div className="text-2xl font-bold text-accent">{stats.agentCount}</div>
              <div className="text-xs text-gray-400">Agents</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">{formatNumber(stats.totalSessions)}</div>
              <div className="text-xs text-gray-400">Sessions</div>
            </div>
            <div className="col-span-2 mt-2 pt-2 border-t border-white/5">
              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex justify-between">
                  <span>Active:</span>
                  <span className="text-green-400">{formatNumber(stats.activeSessions)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Deleted:</span>
                  <span className="text-red-400">{formatNumber(stats.deletedSessions)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reset:</span>
                  <span className="text-yellow-400">{formatNumber(stats.resetSessions)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Agents List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <button
            onClick={() => handleAgentClick(null)}
            className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
              !selectedAgent
                ? 'bg-accent text-white'
                : 'text-gray-300 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🌐</span>
                <span className="font-medium">All Agents</span>
              </div>
              {stats && (
                <span className="text-xs opacity-70">{formatNumber(stats.totalSessions)}</span>
              )}
            </div>
          </button>

          {agents.map((agent) => (
            <button
              key={agent.name}
              onClick={() => handleAgentClick(agent.name)}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
                selectedAgent === agent.name
                  ? 'bg-accent text-white'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{agent.emoji}</span>
                  <span className="font-medium">{agent.name}</span>
                </div>
                <span className="text-xs opacity-70">
                  {formatNumber(agent.totalSessions)}
                </span>
              </div>
              <div className="text-xs opacity-60 ml-6 mt-1 flex gap-3">
                <span className="text-green-400">{agent.activeSessions}</span>
                <span className="text-red-400">{agent.deletedSessions}</span>
                <span className="text-yellow-400">{agent.resetSessions}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>OpenClaw v1.0</span>
          <a
            href="https://github.com/openclaw"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-hover"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;
