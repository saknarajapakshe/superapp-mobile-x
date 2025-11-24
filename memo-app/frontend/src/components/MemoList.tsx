import { useState } from 'react';
import { Trash2, Loader2, Star } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from './ui/dialog';
import { ReceivedMemo, Memo } from '../types';
import { UI_TEXT } from '../constants';
import { cn } from '../lib/utils';

interface MemoListProps {
  memos: (ReceivedMemo | Memo)[];
  type: 'received' | 'sent';
  onDelete: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  favoriteMemoIds?: Set<string>;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptySubtitle: string;
  hasMore?: boolean;
  loading?: boolean;
  initialLoading?: boolean;
  deletingIds?: Set<string>;
  onLoadMore?: () => void;
}

export const MemoList = ({
  memos,
  type,
  onDelete,
  onToggleFavorite,
  favoriteMemoIds = new Set(),
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  hasMore = false,
  loading = false,
  initialLoading = false,
  deletingIds = new Set(),
  onLoadMore,
}: MemoListProps) => {
  const [selectedMemo, setSelectedMemo] = useState<ReceivedMemo | Memo | null>(null);
  const CHARACTER_LIMIT = 150; // Adjust this value as needed

  const truncateMessage = (message: string) => {
    if (message.length <= CHARACTER_LIMIT) {
      return { text: message, isTruncated: false };
    }
    return { text: message.slice(0, CHARACTER_LIMIT) + '...', isTruncated: true };
  };

  // // Show loading skeleton when initially loading from async storage
  // if (initialLoading) {
  //   return (
  //     <div className="space-y-3">
  //       {[1, 2, 3].map((i) => (
  //         <div
  //           key={i}
  //           className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse"
  //         >
  //           <div className="flex items-start justify-between mb-3">
  //             <div className="flex-1 space-y-2">
  //               <div className="h-5 bg-slate-200 rounded w-2/3"></div>
  //               <div className="h-4 bg-slate-200 rounded w-1/2"></div>
  //             </div>
  //             <div className="h-8 w-8 bg-slate-200 rounded"></div>
  //           </div>
  //           <div className="space-y-2 mb-3">
  //             <div className="h-4 bg-slate-200 rounded w-full"></div>
  //             <div className="h-4 bg-slate-200 rounded w-5/6"></div>
  //           </div>
  //           <div className="h-3 bg-slate-200 rounded w-1/4"></div>
  //         </div>
  //       ))}
  //     </div>
  //   );
  // }

  if (memos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
        {emptyIcon}
        <p className="text-sm font-medium text-slate-600">{emptyTitle}</p>
        <p className="text-xs mt-1 text-slate-400">{emptySubtitle}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {memos.map((memo, index) => {
          const { text: truncatedMessage, isTruncated } = truncateMessage(memo.message);
          const isDeleting = deletingIds.has(memo.id);

          return (
            <div
              key={memo.id}
              className={cn(
                "tap-highlight bg-white rounded-xl border border-slate-200/60 p-4",
                "hover:shadow-lg hover:border-primary-200 hover:-translate-y-0.5",
                "transition-all duration-300 active:scale-[0.98]",
                "animate-slide-in-from-bottom",
                isDeleting && 'opacity-50 pointer-events-none'
              )}
              style={{
                animationDelay: `${index * 50}ms`,
                animationFillMode: 'backwards'
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-slate-900 truncate">
                      {memo.subject}
                    </h3>
                    {memo.isBroadcast && (
                      <Badge variant="default" className="shrink-0 bg-purple-100 text-purple-700 border-purple-200 animate-scale-in">
                        Broadcast
                      </Badge>
                    )}
                  </div>

                  {type === 'received' ? (
                    <p className="text-sm text-slate-500">From: {memo.from}</p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      To: {memo.isBroadcast ? 'Everyone' : memo.to}
                    </p>
                  )}

                  {memo.ttlDays && (
                    <p className="text-xs text-slate-400 mt-1">
                      {type === 'received' ? `Expires in ${memo.ttlDays} days` : `TTL: ${memo.ttlDays} days`}
                    </p>
                  )}
                  {type === 'sent' && !memo.ttlDays && (
                    <p className="text-xs text-slate-400 mt-1">TTL: Forever</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {type === 'sent' && 'status' in memo && (
                    <Badge
                      variant={memo.status === 'delivered' ? 'success' : 'warning'}
                      className="font-medium text-xs animate-scale-in"
                    >
                      {memo.status}
                    </Badge>
                  )}
                  {onToggleFavorite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onToggleFavorite(memo.id)}
                      className={cn(
                        "tap-highlight -mr-1 -mt-1 hover:bg-amber-50 transition-all duration-200 active:scale-90",
                        favoriteMemoIds.has(memo.id) ? "text-amber-500 hover:text-amber-600" : "text-slate-300 hover:text-amber-500"
                      )}
                    >
                      <Star className={cn("h-4 w-4 transition-transform", favoriteMemoIds.has(memo.id) && "fill-current scale-110")} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(memo.id)}
                    disabled={isDeleting}
                    className="tap-highlight -mr-2 -mt-1 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-all duration-200 active:scale-90"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {truncatedMessage}
                </p>
                {isTruncated && (
                  <button
                    onClick={() => setSelectedMemo(memo)}
                    className="text-primary-600 font-medium hover:text-primary-700 active:text-primary-800 text-sm mt-1 inline-flex items-center tap-highlight transition-colors duration-200"
                  >
                    Read more →
                  </button>
                )}
              </div>

              <p className="text-xs text-slate-400">
                {new Date(
                  type === 'received' && 'savedAt' in memo ? memo.savedAt : memo.createdAt
                ).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={onLoadMore}
            disabled={loading}
            className="tap-highlight px-8"
          >
            {loading ? UI_TEXT.BTN_LOADING : UI_TEXT.BTN_LOAD_MORE}
          </Button>
        </div>
      )}

      {/* Memo Detail Dialog */}
      <Dialog open={!!selectedMemo} onOpenChange={(open) => !open && setSelectedMemo(null)}>
        <DialogContent onClose={() => setSelectedMemo(null)}>
          {selectedMemo && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedMemo.subject}</DialogTitle>
                <div className="mt-2 space-y-1.5">
                  {type === 'received' ? (
                    <p className="text-xs sm:text-sm text-slate-600">
                      <span className="font-medium">From:</span> {selectedMemo.from}
                    </p>
                  ) : (
                    <p className="text-xs sm:text-sm text-slate-600">
                      <span className="font-medium">To:</span> {selectedMemo.isBroadcast ? 'Everyone' : selectedMemo.to}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedMemo.isBroadcast && (
                      <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                        Broadcast
                      </Badge>
                    )}
                    {type === 'sent' && 'status' in selectedMemo && (
                      <Badge
                        variant={selectedMemo.status === 'delivered' ? 'success' : 'warning'}
                        className="font-medium text-xs"
                      >
                        {selectedMemo.status}
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>
              <DialogBody>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <h4 className="text-xs sm:text-sm font-semibold text-slate-700 mb-2">Message</h4>
                    <p className="text-sm sm:text-base text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {selectedMemo.message}
                    </p>
                  </div>
                  <div className="pt-3 sm:pt-4 border-t border-slate-200 space-y-1.5">
                    {selectedMemo.ttlDays && (
                      <p className="text-xs text-slate-500">
                        <span className="font-medium">
                          {type === 'received' ? 'Expires in:' : 'TTL:'}
                        </span>{' '}
                        {selectedMemo.ttlDays} days
                      </p>
                    )}
                    {type === 'sent' && !selectedMemo.ttlDays && (
                      <p className="text-xs text-slate-500">
                        <span className="font-medium">TTL:</span> Forever
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      <span className="font-medium">
                        {type === 'received' && 'savedAt' in selectedMemo ? 'Saved:' : 'Created:'}
                      </span>{' '}
                      {new Date(
                        type === 'received' && 'savedAt' in selectedMemo ? selectedMemo.savedAt : selectedMemo.createdAt
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              </DialogBody>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
