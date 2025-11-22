import { useState, useEffect, useCallback } from 'react';
import { Inbox, MailOpen, Edit3, RefreshCw, Loader2, Archive, MoreHorizontal, Star, ChevronLeft, Users } from 'lucide-react';
import { MemoForm } from './components/MemoForm';
import { MemoList } from './components/MemoList';
import { GroupManager } from './components/GroupManager';
import { useUser } from './hooks/useUser';
import { useMemos } from './hooks/useMemos';
import { UI_TEXT, CONFIG, TABS, TabType } from './constants';
import { cn } from './lib/utils';
import { ReceivedMemo, Memo } from './types';
import { bridge } from './bridge';

import { MemoFilters } from './components/MemoFilters';
import { MemoFilter } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>(TABS.RECEIVED);
  const [shouldRefreshSent, setShouldRefreshSent] = useState(false);
  const [archivedMemos, setArchivedMemos] = useState<(ReceivedMemo | Memo)[]>([]);
  const [favoriteMemoIds, setFavoriteMemoIds] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [archiveLoaded, setArchiveLoaded] = useState(false);

  // Filter State
  const [filter, setFilter] = useState<MemoFilter>({
    search: '',
    startDate: '',
    endDate: '',
    isBroadcast: false,
  });

  const { userEmail, loading } = useUser();

  const {
    sentMemos,
    receivedMemos,
    loadSentMemos,
    loadReceivedMemos,
    deleteSentMemo,
    deleteReceivedMemo,
    submitMemo,
    hasMoreSent,
    hasMoreReceived,
    loadingSent,
    loadingReceived,
    initialLoadingReceived,
    deletingMemoIds,
  } = useMemos(userEmail);

  // Load favorites from bridge on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const savedFavorites = await bridge.getFavorites();
        setFavoriteMemoIds(new Set(savedFavorites));
        setFavoritesLoaded(true);
      } catch (error) {
        console.error('Failed to load favorites:', error);
        setFavoritesLoaded(true);
      }
    };
    loadFavorites();
  }, []);

  // Save favorites to bridge whenever they change (but only after initial load)
  useEffect(() => {
    if (!favoritesLoaded) return; // Don't save until we've loaded initial favorites

    const saveFavorites = async () => {
      try {
        await bridge.saveFavorites(Array.from(favoriteMemoIds));
      } catch (error) {
        console.error('Failed to save favorites:', error);
      }
    };
    saveFavorites();
  }, [favoriteMemoIds, favoritesLoaded]);

  // Load archive from bridge on mount
  useEffect(() => {
    const loadArchive = async () => {
      try {
        const savedArchive = await bridge.getArchive();
        setArchivedMemos(savedArchive);
        setArchiveLoaded(true);
      } catch (error) {
        console.error('Failed to load archive:', error);
        setArchiveLoaded(true);
      }
    };
    loadArchive();
  }, []);

  // Load known users on mount
  const [knownUsers, setKnownUsers] = useState<string[]>([]);
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await bridge.getUsers();
        setKnownUsers(users);
      } catch (error) {
        console.error('[App] Failed to load users:', error);
      }
    };
    loadUsers();
  }, []);

  // Save archive to bridge whenever it changes (but only after initial load)
  useEffect(() => {
    if (!archiveLoaded) return; // Don't save until we've loaded initial archive

    const saveArchive = async () => {
      try {
        await bridge.saveArchive(archivedMemos);
      } catch (error) {
        console.error('Failed to save archive:', error);
      }
    };
    saveArchive();
  }, [archivedMemos, archiveLoaded]);

  // Load received memos on mount
  useEffect(() => {
    if (userEmail) {
      loadReceivedMemos(false);
    }
  }, [userEmail, loadReceivedMemos]);

  // Poll for new received memos
  useEffect(() => {
    if (!userEmail) return;

    const pollInterval = setInterval(() => {
      loadReceivedMemos(false);
    }, CONFIG.POLL_INTERVAL_MS);

    return () => clearInterval(pollInterval);
  }, [userEmail, loadReceivedMemos]);

  // Load sent memos when switching to sent tab OR when refresh is triggered
  useEffect(() => {
    if (activeTab === TABS.SENT && userEmail) {
      if (sentMemos.length === 0 || shouldRefreshSent) {
        loadSentMemos(false);
        setShouldRefreshSent(false);
      }
    }
  }, [activeTab, userEmail, sentMemos.length, shouldRefreshSent, loadSentMemos]);

  // Simple tab switch - let useEffect handle loading
  const handleTabSwitch = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  // After sending, switch to sent tab and trigger refresh with slight delay
  const handleSendSuccess = useCallback(() => {
    setActiveTab(TABS.SENT);
    // Small delay to let the tab switch animation complete, then refresh
    setTimeout(() => {
      setShouldRefreshSent(true);
    }, 1000);
  }, []);

  // Archive memo (soft delete)
  const handleArchiveMemo = useCallback((id: string, type: 'received' | 'sent') => {
    if (type === 'received') {
      const memo = receivedMemos.find(m => m.id === id);
      if (memo) {
        setArchivedMemos(prev => [...prev, memo]);
        deleteReceivedMemo(id);
      }
    } else {
      const memo = sentMemos.find(m => m.id === id);
      if (memo) {
        setArchivedMemos(prev => [...prev, memo]);
        deleteSentMemo(id);
      }
    }
    // Remove from favorites if it was favorited
    setFavoriteMemoIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, [receivedMemos, sentMemos, deleteReceivedMemo, deleteSentMemo]);

  // Permanent delete from archive
  const handlePermanentDelete = useCallback((id: string) => {
    setArchivedMemos(prev => prev.filter(m => m.id !== id));
    setFavoriteMemoIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  // Toggle favorite
  const handleToggleFavorite = useCallback((id: string) => {
    setFavoriteMemoIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Filter Logic
  const filterMemos = useCallback((memos: (ReceivedMemo | Memo)[]) => {
    return memos.filter(memo => {
      // 1. Search (Title or Sender/Receiver)
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        const matchesSubject = memo.subject.toLowerCase().includes(searchLower);
        const matchesFrom = 'from' in memo ? memo.from.toLowerCase().includes(searchLower) : false;
        const matchesTo = 'to' in memo ? memo.to.toLowerCase().includes(searchLower) : false;

        if (!matchesSubject && !matchesFrom && !matchesTo) return false;
      }

      // 2. Date Range
      if (filter.startDate) {
        const memoDate = new Date(memo.createdAt).setHours(0, 0, 0, 0);
        const startDate = new Date(filter.startDate).setHours(0, 0, 0, 0);
        if (memoDate < startDate) return false;
      }
      if (filter.endDate) {
        const memoDate = new Date(memo.createdAt).setHours(0, 0, 0, 0);
        const endDate = new Date(filter.endDate).setHours(23, 59, 59, 999);
        if (memoDate > endDate) return false;
      }

      // 3. Broadcast
      if (filter.isBroadcast && !memo.isBroadcast) return false;

      return true;
    });
  }, [filter]);

  const handleClearFilters = () => {
    setFilter({
      search: '',
      startDate: '',
      endDate: '',
      isBroadcast: false,
    });
  };

  // Filtered Lists
  const filteredReceivedMemos = filterMemos(receivedMemos);
  const filteredSentMemos = filterMemos(sentMemos);
  const filteredArchivedMemos = filterMemos(archivedMemos);
  const filteredFavoriteMemos = filterMemos(
    Array.from(new Map([...receivedMemos, ...sentMemos].map(m => [m.id, m])).values())
      .filter(memo => favoriteMemoIds.has(memo.id))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-primary-600 w-8 h-8" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case TABS.RECEIVED:
        return (
          <div className="space-y-3">
            <MemoFilters
              filter={filter}
              onChange={setFilter}
              onClear={handleClearFilters}
              knownUsers={knownUsers}
            />
            <MemoList
              memos={filteredReceivedMemos}
              type="received"
              onDelete={(id) => handleArchiveMemo(id, 'received')}
              onToggleFavorite={handleToggleFavorite}
              favoriteMemoIds={favoriteMemoIds}
              emptyIcon={<Inbox className="h-16 w-16 mb-4 stroke-[1.5]" />}
              emptyTitle={UI_TEXT.EMPTY_RECEIVED_TITLE}
              emptySubtitle={UI_TEXT.EMPTY_RECEIVED_SUBTITLE}
              hasMore={hasMoreReceived}
              loading={loadingReceived}
              initialLoading={initialLoadingReceived}
              deletingIds={deletingMemoIds}
              onLoadMore={() => loadReceivedMemos(true)}
            />
          </div>
        );

      case TABS.SENT:
        return (
          <div className="space-y-3">
            <MemoFilters
              filter={filter}
              onChange={setFilter}
              onClear={handleClearFilters}
              knownUsers={knownUsers}
            />
            <MemoList
              memos={filteredSentMemos}
              type="sent"
              onDelete={(id) => handleArchiveMemo(id, 'sent')}
              onToggleFavorite={handleToggleFavorite}
              favoriteMemoIds={favoriteMemoIds}
              emptyIcon={<MailOpen className="h-16 w-16 mb-4 stroke-[1.5]" />}
              emptyTitle={UI_TEXT.EMPTY_SENT_TITLE}
              emptySubtitle={UI_TEXT.EMPTY_SENT_SUBTITLE}
              hasMore={hasMoreSent}
              loading={loadingSent}
              deletingIds={deletingMemoIds}
              onLoadMore={() => loadSentMemos(true)}
            />
          </div>
        );

      case TABS.FAVORITES:
        return (
          <div className="space-y-3">
            <MemoFilters
              filter={filter}
              onChange={setFilter}
              onClear={handleClearFilters}
              knownUsers={knownUsers}
            />
            <MemoList
              memos={filteredFavoriteMemos}
              type="received"
              onDelete={(id) => {
                const memo = filteredFavoriteMemos.find(m => m.id === id);
                if (memo && 'from' in memo) {
                  handleArchiveMemo(id, 'received');
                } else {
                  handleArchiveMemo(id, 'sent');
                }
              }}
              onToggleFavorite={handleToggleFavorite}
              favoriteMemoIds={favoriteMemoIds}
              emptyIcon={<Star className="h-16 w-16 mb-4 stroke-[1.5]" />}
              emptyTitle={UI_TEXT.EMPTY_FAVORITES_TITLE}
              emptySubtitle={UI_TEXT.EMPTY_FAVORITES_SUBTITLE}
              hasMore={false}
              loading={false}
              deletingIds={deletingMemoIds}
              onLoadMore={() => { }}
            />
          </div>
        );

      case TABS.ARCHIVE:
        return (
          <div className="space-y-3">
            <MemoFilters
              filter={filter}
              onChange={setFilter}
              onClear={handleClearFilters}
              knownUsers={knownUsers}
            />
            <MemoList
              memos={filteredArchivedMemos}
              type="received"
              onDelete={handlePermanentDelete}
              emptyIcon={<Archive className="h-16 w-16 mb-4 stroke-[1.5]" />}
              emptyTitle={UI_TEXT.EMPTY_ARCHIVE_TITLE}
              emptySubtitle={UI_TEXT.EMPTY_ARCHIVE_SUBTITLE}
              hasMore={false}
              loading={false}
              deletingIds={new Set()}
              onLoadMore={() => { }}
            />
          </div>
        );

      case TABS.MORE:
        return (
          <div className="space-y-4 pb-24">
            {/* Menu Options */}
            <div className="space-y-2">
              <button
                onClick={() => handleTabSwitch(TABS.SENT)}
                className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <MailOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-slate-900">Sent</h3>
                  <p className="text-sm text-slate-500">View sent messages</p>
                </div>
              </button>

              <button
                onClick={() => handleTabSwitch(TABS.SEND)}
                className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Edit3 className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-slate-900">Send Memo</h3>
                  <p className="text-sm text-slate-500">Compose a new message</p>
                </div>
              </button>

              <button
                onClick={() => handleTabSwitch(TABS.ARCHIVE)}
                className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                  <Archive className="w-6 h-6 text-slate-600" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-slate-900">Archive</h3>
                  <p className="text-sm text-slate-500">View archived messages</p>
                </div>
              </button>

              <button
                onClick={() => handleTabSwitch(TABS.GROUPS)}
                className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors active:scale-[0.98]"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center">
                  <Users className="w-6 h-6 text-slate-600" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-slate-900">Manage Groups</h3>
                  <p className="text-sm text-slate-500">Create and edit recipient groups</p>
                </div>
              </button>
            </div>
          </div>
        );

      case TABS.GROUPS:
        return <GroupManager knownUsers={knownUsers} />;

      case TABS.SEND:
        return <MemoForm onSuccess={handleSendSuccess} onSubmit={submitMemo} knownUsers={knownUsers} />;

      default:
        return null;
    }
  };

  const handleRefresh = () => {
    if (activeTab === TABS.RECEIVED) {
      loadReceivedMemos(false);
    } else if (activeTab === TABS.SENT) {
      loadSentMemos(false);
    }
  };

  const isRefreshing = (activeTab === TABS.RECEIVED && loadingReceived) || (activeTab === TABS.SENT && loadingSent);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-primary-100 selection:text-primary-900">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {(activeTab === TABS.SENT || activeTab === TABS.ARCHIVE || activeTab === TABS.SEND || activeTab === TABS.GROUPS) && (
            <button
              onClick={() => setActiveTab(TABS.MORE)}
              className="-ml-2 p-2 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            {activeTab === TABS.SEND ? 'New Message' : activeTab === TABS.SENT ? 'Sent' : activeTab === TABS.ARCHIVE ? 'Archive' : activeTab === TABS.MORE ? 'More' : activeTab === TABS.FAVORITES ? 'Favorites' : activeTab === TABS.GROUPS ? 'Groups' : 'Feed'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {(activeTab === TABS.RECEIVED || activeTab === TABS.SENT) && (
            <button
              aria-label="Refresh"
              onClick={handleRefresh}
              className="p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
            >
              {isRefreshing ? <Loader2 className="animate-spin w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-md mx-auto min-h-[calc(100vh-140px)]">
        {renderContent()}
      </main>

      {/* Bottom Navigation - Always Visible: Feed, Favorites, More */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-2 px-6 flex justify-around items-end h-[80px] z-40">
        <button
          onClick={() => handleTabSwitch(TABS.RECEIVED)}
          className={cn(
            "flex flex-col items-center pb-4 w-16 transition-colors relative",
            activeTab === TABS.RECEIVED ? "text-primary-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Inbox size={24} className="mb-1" />
          <span className="text-[10px] font-medium">{UI_TEXT.TAB_RECEIVED}</span>
          {receivedMemos.length > 0 && (
            <span className="absolute top-0 right-3 w-2.5 h-2.5 bg-primary-600 rounded-full border-2 border-white"></span>
          )}
        </button>

        <button
          onClick={() => handleTabSwitch(TABS.FAVORITES)}
          className={cn(
            "flex flex-col items-center pb-4 w-16 transition-colors relative",
            activeTab === TABS.FAVORITES ? "text-primary-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Star size={24} className="mb-1" />
          <span className="text-[10px] font-medium">{UI_TEXT.TAB_FAVORITES}</span>
          {favoriteMemoIds.size > 0 && (
            <span className="absolute top-0 right-3 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white"></span>
          )}
        </button>

        <button
          onClick={() => handleTabSwitch(TABS.MORE)}
          className={cn(
            "flex flex-col items-center pb-4 w-16 transition-colors",
            activeTab === TABS.MORE ? "text-primary-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <MoreHorizontal size={24} className="mb-1" />
          <span className="text-[10px] font-medium">{UI_TEXT.TAB_MORE}</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
