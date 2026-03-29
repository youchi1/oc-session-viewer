import { useEffect } from 'react';
import { Routes, Route, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionStore } from './stores/sessionStore';
import Sidebar from './components/Sidebar';
import FilterBar from './components/FilterBar';
import SessionList from './components/SessionList';
import TranscriptViewer from './components/TranscriptViewer';

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainView />} />
      <Route path="/agent/:agent" element={<MainView />} />
      <Route path="/session/:agent/:filename" element={<MainView />} />
    </Routes>
  );
}

function MainView() {
  const { agent: routeAgent, filename: routeFilename } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const {
    fetchAgents,
    fetchStats,
    fetchSessions,
    fetchTranscript,
    selectedAgent,
    selectedSession,
    setSelectedAgent,
    sidebarOpen,
    error,
  } = useSessionStore();

  // Initialize data + poll every 2s
  useEffect(() => {
    fetchAgents();
    fetchStats();
    const id = setInterval(() => {
      fetchAgents();
      fetchStats();
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Handle route agent change
  useEffect(() => {
    if (routeAgent && routeAgent !== selectedAgent) {
      setSelectedAgent(routeAgent);
    }
  }, [routeAgent]);

  // Fetch sessions when filters change + poll every 2s
  useEffect(() => {
    fetchSessions();
    const id = setInterval(fetchSessions, 2000);
    return () => clearInterval(id);
  }, [selectedAgent, searchParams]);

  // Handle route-based session selection + poll transcript every 2s
  useEffect(() => {
    if (routeAgent && routeFilename) {
      const currentSelection = `${selectedSession?.agent}/${selectedSession?.filename}`;
      const routeSelection = `${routeAgent}/${routeFilename}`;

      if (currentSelection !== routeSelection) {
        fetchTranscript(routeAgent, routeFilename);
      }

      const id = setInterval(() => {
        fetchTranscript(routeAgent, routeFilename);
      }, 2000);
      return () => clearInterval(id);
    }
  }, [routeAgent, routeFilename]);

  // Redirect to main view if session not found
  useEffect(() => {
    if (routeAgent && routeFilename && error && !selectedSession) {
      navigate('/');
    }
  }, [error, selectedSession, routeAgent, routeFilename]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg-primary flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Filter Bar */}
        <FilterBar />

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Session List */}
          <div className={`transition-all duration-300 flex-shrink-0 ${selectedSession ? 'w-1/3' : 'w-full'}`}>
            <SessionList />
          </div>

          {/* Transcript Viewer */}
          {selectedSession && (
            <div className="flex-1 min-w-0 border-l border-white/5">
              <TranscriptViewer />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
