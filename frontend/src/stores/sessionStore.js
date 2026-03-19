import { create } from 'zustand';

const API_URL = window.location.origin;

export const useSessionStore = create((set, get) => ({
  // State
  agents: [],
  sessions: [],
  selectedSession: null,
  transcript: [],
  sessionMeta: null,
  stats: null,
  loading: false,
  error: null,
  
  // Filters
  selectedAgent: null,
  searchQuery: '',
  statusFilter: 'all',
  modelFilter: '',
  sortBy: 'date_desc',
  currentPage: 1,
  totalPages: 1,
  limit: 50,
  
  // Search state
  searchResults: null,     // null = not searching; [] = no results
  searchLoading: false,
  
  // UI state
  sidebarOpen: true,
  
  // Transcript controls
  activeTypeFilters: [],   // empty = all visible; non-empty = only listed types visible
  expandedTypes: ['thinking'],       // collapsible types whose blocks are expanded: 'thinking', 'tools'
  
  // Actions
  fetchAgents: async () => {
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      const data = await res.json();
      set({ agents: data, error: null });
    } catch (err) {
      set({ error: err.message });
    }
  },
  
  fetchStats: async () => {
    try {
      const res = await fetch(`${API_URL}/api/stats`);
      const data = await res.json();
      set({ stats: data, error: null });
    } catch (err) {
      set({ error: err.message });
    }
  },
  
  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const {
        selectedAgent,
        searchQuery,
        statusFilter,
        modelFilter,
        sortBy,
        currentPage,
        limit,
      } = get();
      
      const params = new URLSearchParams({
        page: currentPage,
        limit,
        status: statusFilter,
        sort: sortBy,
      });
      
      if (selectedAgent) params.set('agent', selectedAgent);
      if (searchQuery) params.set('search', searchQuery);
      if (modelFilter) params.set('model', modelFilter);
      
      const res = await fetch(`${API_URL}/api/sessions?${params}`);
      const data = await res.json();
      
      set({
        sessions: data.sessions,
        totalPages: data.totalPages,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },
  
  fetchTranscript: async (agent, filename) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/api/sessions/${agent}/${filename}`);
      const data = await res.json();
      
      set({
        transcript: data.entries,
        sessionMeta: data.sessionMeta || null,
        selectedSession: { agent, filename },
        loading: false,
        error: null,
        // Reset transcript controls on new session
        activeTypeFilters: [],
        expandedTypes: ['thinking'],
      });
    } catch (err) {
      set({ error: err.message, loading: false, transcript: [], sessionMeta: null, selectedSession: null });
    }
  },
  
  setSelectedAgent: (agent) => {
    set({ selectedAgent: agent, currentPage: 1 });
  },
  
  setSearchQuery: (query) => {
    set({ searchQuery: query, currentPage: 1 });
    // Clear search results when query is emptied
    if (!query.trim()) {
      set({ searchResults: null });
    }
  },
  
  performSearch: async () => {
    const { searchQuery, selectedAgent } = get();
    if (!searchQuery || searchQuery.trim().length < 2) {
      set({ searchResults: null });
      get().fetchSessions();
      return;
    }
    
    set({ searchLoading: true, searchResults: [] });
    try {
      const params = new URLSearchParams({ query: searchQuery.trim() });
      if (selectedAgent) params.set('agent', selectedAgent);
      
      const res = await fetch(`${API_URL}/api/search?${params}`);
      const data = await res.json();
      set({ searchResults: data.results || [], searchLoading: false, error: null });
    } catch (err) {
      set({ searchResults: [], searchLoading: false, error: err.message });
    }
  },
  
  clearSearch: () => {
    set({ searchQuery: '', searchResults: null, currentPage: 1 });
    get().fetchSessions();
  },
  
  setStatusFilter: (status) => {
    set({ statusFilter: status, currentPage: 1 });
    get().fetchSessions();
  },
  
  setModelFilter: (model) => {
    set({ modelFilter: model, currentPage: 1 });
    get().fetchSessions();
  },
  
  setSortBy: (sort) => {
    set({ sortBy: sort, currentPage: 1 });
    get().fetchSessions();
  },
  
  setPage: (page) => {
    set({ currentPage: page });
    get().fetchSessions();
  },
  
  toggleSidebar: () => {
    set({ sidebarOpen: !get().sidebarOpen });
  },
  
  // Transcript filter actions
  toggleTypeFilter: (type) => {
    const current = get().activeTypeFilters;
    const idx = current.indexOf(type);
    if (idx >= 0) {
      set({ activeTypeFilters: current.filter(t => t !== type) });
    } else {
      set({ activeTypeFilters: [...current, type] });
    }
  },
  
  clearTypeFilters: () => set({ activeTypeFilters: [] }),
  
  toggleTypeExpand: (type) => {
    const current = get().expandedTypes;
    if (current.includes(type)) {
      set({ expandedTypes: current.filter(t => t !== type) });
    } else {
      set({ expandedTypes: [...current, type] });
    }
  },
  
  expandAllBlocks: () => set({ expandedTypes: ['thinking', 'tools'] }),
  
  collapseAllBlocks: () => set({ expandedTypes: [] }),
  
  selectSession: (agent, filename) => {
    set({ selectedSession: { agent, filename } });
  },
  
  clearSelectedSession: () => {
    set({ selectedSession: null, transcript: [], sessionMeta: null });
  },
}));
