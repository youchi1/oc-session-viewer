import { useSessionStore } from '../stores/sessionStore';

function FilterBar() {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    searchLoading,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    performSearch,
    clearSearch,
  } = useSessionStore();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch();
    } else {
      clearSearch();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      clearSearch();
    }
  };

  const isSearchActive = searchResults !== null;

  return (
    <div className="bg-bg-secondary border-b border-white/5 p-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search all session content… (Enter to search)"
              className={`w-full bg-bg-tertiary border rounded-lg px-4 py-2 pl-10 ${isSearchActive ? 'pr-10' : ''} text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 ${
                isSearchActive 
                  ? 'border-accent/50 focus:border-accent focus:ring-accent' 
                  : 'border-white/10 focus:border-accent focus:ring-accent'
              }`}
            />
            <svg
              className="absolute left-3 top-2.5 w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {isSearchActive && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-white transition-colors"
                title="Clear search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {searchLoading && (
              <div className="absolute right-3 top-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
              </div>
            )}
          </div>
        </form>

        {/* Status Filter */}
        <div className="flex gap-1 bg-bg-tertiary rounded-lg p-1">
          {['all', 'active', 'deleted', 'reset'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-accent text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-bg-tertiary border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="date_desc">Latest First</option>
          <option value="date_asc">Oldest First</option>
          <option value="name_desc">Name (Z-A)</option>
          <option value="name_asc">Name (A-Z)</option>
        </select>
      </div>
    </div>
  );
}

export default FilterBar;
