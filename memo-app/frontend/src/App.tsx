import { useState, useEffect, useCallback } from 'react';
import { Inbox, MailOpen, Edit3, RefreshCw } from 'lucide-react';
import { MemoForm } from './components/MemoForm';
import { MemoList } from './components/MemoList';
import { useUser } from './hooks/useUser';
import { useMemos } from './hooks/useMemos';
import { UI_TEXT, CONFIG, TABS, TabType } from './constants';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>(TABS.RECEIVED);
  const [shouldRefreshSent, setShouldRefreshSent] = useState(false);
  
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">{UI_TEXT.LOADING}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto p-4 pb-24">
        <div className="mb-6 pt-4">
          <div className="flex">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {UI_TEXT.APP_TITLE}
          </h1>
          <p className="text-sm text-slate-500">{UI_TEXT.VERSION}</p>
          </div>
          <p className="text-slate-600 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              {userEmail}
            </span>
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 bg-white">
            <button
              onClick={() => handleTabSwitch(TABS.RECEIVED)}
              className={`flex-1 min-w-0 py-4 px-6 font-semibold text-sm transition-colors flex items-center justify-center gap-2 relative ${
                activeTab === TABS.RECEIVED
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Inbox className="h-5 w-5 flex-shrink-0" />
              <span>{UI_TEXT.TAB_RECEIVED}</span>
              {receivedMemos.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full"></span>
              )}
            </button>
            
            <button
              onClick={() => handleTabSwitch(TABS.SENT)}
              className={`flex-1 min-w-0 py-4 px-6 font-semibold text-sm transition-colors flex items-center justify-center gap-2 relative ${
                activeTab === TABS.SENT
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <MailOpen className="h-5 w-5 flex-shrink-0" />
              <span>{UI_TEXT.TAB_SENT}</span>
              {sentMemos.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </button>
            
            <button
              onClick={() => handleTabSwitch(TABS.SEND)}
              className={`flex-1 min-w-0 py-4 px-6 font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                activeTab === TABS.SEND
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Edit3 className="h-5 w-5 flex-shrink-0" />
              <span>{UI_TEXT.TAB_COMPOSE}</span>
            </button>
          </div>

          <div className="min-h-[32rem]">
            {activeTab === TABS.RECEIVED && (
              <div className="p-4 space-y-3">
                <div className="flex justify-end">
                  <button
                    onClick={() => loadReceivedMemos(false)}
                    disabled={loadingReceived}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingReceived ? 'animate-spin' : ''}`} />
                    {loadingReceived ? UI_TEXT.BTN_REFRESHING : UI_TEXT.BTN_REFRESH}
                  </button>
                </div>
                <MemoList
                  memos={receivedMemos}
                  type="received"
                  onDelete={deleteReceivedMemo}
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
            )}

            {activeTab === TABS.SENT && (
              <div className="p-4 space-y-3">
                <div className="flex justify-end">
                  <button
                    onClick={() => loadSentMemos(false)}
                    disabled={loadingSent}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingSent ? 'animate-spin' : ''}`} />
                    {loadingSent ? UI_TEXT.BTN_REFRESHING : UI_TEXT.BTN_REFRESH}
                  </button>
                </div>
                <MemoList
                  memos={sentMemos}
                  type="sent"
                  onDelete={deleteSentMemo}
                  emptyIcon={<MailOpen className="h-16 w-16 mb-4 stroke-[1.5]" />}
                  emptyTitle={UI_TEXT.EMPTY_SENT_TITLE}
                  emptySubtitle={UI_TEXT.EMPTY_SENT_SUBTITLE}
                  hasMore={hasMoreSent}
                  loading={loadingSent}
                  deletingIds={deletingMemoIds}
                  onLoadMore={() => loadSentMemos(true)}
                />
              </div>
            )}

            {activeTab === TABS.SEND && (
              <div className="p-4">
                <MemoForm onSuccess={handleSendSuccess} onSubmit={submitMemo} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
