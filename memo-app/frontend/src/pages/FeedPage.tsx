import { MailOpen } from 'lucide-react';
import { useMemoContext } from '../context/MemoContext';
import { MemoList } from '../components/MemoList';
import { MemoFilters } from '../components/MemoFilters';
import { UI_TEXT } from '../constants';

export const FeedPage = () => {
    const {
        receivedMemos,
        loadingReceived,
        archiveMemo,
        toggleFavorite,
        favoriteMemoIds,
        filter,
        setFilter,
        clearFilters,
        knownUsers
    } = useMemoContext();

    // Filter logic could be moved to context or kept here if specific to view
    // For now, simple filtering here to match previous App.tsx logic
    const filteredMemos = receivedMemos.filter(memo => {
        // Search
        if (filter.search) {
            const searchLower = filter.search.toLowerCase();
            const matchesSubject = memo.subject.toLowerCase().includes(searchLower);
            const matchesMessage = memo.message.toLowerCase().includes(searchLower);
            const matchesFrom = memo.from.toLowerCase().includes(searchLower);
            if (!matchesSubject && !matchesMessage && !matchesFrom) return false;
        }

        // Date Range
        if (filter.startDate) {
            const memoDate = new Date(memo.savedAt).setHours(0, 0, 0, 0);
            const startDate = new Date(filter.startDate).setHours(0, 0, 0, 0);
            if (memoDate < startDate) return false;
        }
        if (filter.endDate) {
            const memoDate = new Date(memo.savedAt).setHours(0, 0, 0, 0);
            const endDate = new Date(filter.endDate).setHours(0, 0, 0, 0);
            if (memoDate > endDate) return false;
        }

        // Broadcast
        if (filter.isBroadcast && !memo.isBroadcast) return false;

        return true;
    });

    return (
        <div className="space-y-3">
            <MemoFilters
                filter={filter}
                onChange={setFilter}
                onClear={clearFilters}
                knownUsers={knownUsers}
            />
            <MemoList
                memos={filteredMemos}
                type="received"
                onDelete={(id) => archiveMemo(id, 'received')}
                onToggleFavorite={toggleFavorite}
                favoriteMemoIds={favoriteMemoIds}
                emptyIcon={<MailOpen className="h-16 w-16 mb-4 stroke-[1.5] text-primary-400" />}
                emptyTitle={UI_TEXT.EMPTY_RECEIVED_TITLE}
                emptySubtitle={UI_TEXT.EMPTY_RECEIVED_SUBTITLE}
                hasMore={false} // Pagination not implemented for received yet in context
                loading={loadingReceived}
                onLoadMore={() => { }}
            />
        </div>
    );
};
