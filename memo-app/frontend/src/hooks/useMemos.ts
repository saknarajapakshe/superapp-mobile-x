import { useState, useCallback, useEffect, useRef } from 'react';
import { bridge } from '../bridge';
import { getSentMemos, getReceivedMemos, deleteMemo as deleteServerMemo, updateMemoStatus, sendMemo } from '../api';
import { Memo, ReceivedMemo } from '../types';
import { UI_TEXT, CONFIG } from '../constants';

/**
 * Custom hook for managing memos - simplified and straightforward
 */
export const useMemos = (userEmail: string) => {
  // Core state - simple and clear
  const [sentMemos, setSentMemos] = useState<Memo[]>([]);
  const [receivedMemos, setReceivedMemos] = useState<ReceivedMemo[]>([]);
  const [hasMoreSent, setHasMoreSent] = useState(true);
  const [hasMoreReceived, setHasMoreReceived] = useState(true);
  const [loadingSent, setLoadingSent] = useState(false);
  const [loadingReceived, setLoadingReceived] = useState(false);
  const [initialLoadingReceived, setInitialLoadingReceived] = useState(true);
  const [deletingMemoIds, setDeletingMemoIds] = useState<Set<string>>(new Set());
  
  // Simple refs for pagination and preventing duplicate operations
  const sentOffsetRef = useRef(0);
  const receivedOffsetRef = useRef(0);
  const loadingSentRef = useRef(false);
  const loadingReceivedRef = useRef(false);
  const deletingRef = useRef<Set<string>>(new Set());

  // Reset all state when user changes
  useEffect(() => {
    if (!userEmail) {
      setSentMemos([]);
      setReceivedMemos([]);
      sentOffsetRef.current = 0;
      receivedOffsetRef.current = 0;
      setHasMoreSent(true);
      setHasMoreReceived(true);
      setDeletingMemoIds(new Set());
      deletingRef.current = new Set();
    }
  }, [userEmail]);

  // Load initial received memos from async storage on mount
  useEffect(() => {
    const loadInitialMemos = async () => {
      try {
        setInitialLoadingReceived(true);
        const savedMemos = await bridge.getSavedMemos();
        setReceivedMemos(savedMemos);
      } catch (error) {
        console.error('Failed to load initial memos from storage:', error);
      } finally {
        setInitialLoadingReceived(false);
      }
    };

    loadInitialMemos();
  }, []);


  const loadSentMemos = useCallback(async (append: boolean = false) => {
    // Prevent concurrent requests
    if (!userEmail || loadingSentRef.current) return;
    
    loadingSentRef.current = true;
    setLoadingSent(true);
    
    // Clear existing memos when refreshing (not appending)
    if (!append) {
      setSentMemos([]);
      sentOffsetRef.current = 0;
    }
    
    try {
      const offset = append ? sentOffsetRef.current : 0;
      const memos = await getSentMemos(CONFIG.PAGE_SIZE, offset);
      
      // Calculate new offset
      const newOffset = append ? (offset + memos.length) : memos.length;
      sentOffsetRef.current = newOffset;
      
      // Simple: append or replace
      setSentMemos(prev => append ? [...prev, ...memos] : memos);
      setHasMoreSent(memos.length === CONFIG.PAGE_SIZE);
    } catch (error) {
      console.error('Failed to load sent memos:', error);
      // On error, show empty if not appending
      if (!append) {
        setSentMemos([]);
      }
    } finally {
      setLoadingSent(false);
      loadingSentRef.current = false;
    }
  }, [userEmail]);

  const loadReceivedMemos = useCallback(async (append: boolean = false) => {
    // Prevent concurrent requests
    if (loadingReceivedRef.current) return;
    
    loadingReceivedRef.current = true;
    setLoadingReceived(true);
    
    try {
      const offset = append ? receivedOffsetRef.current : 0;
      
      // Reset offset when not appending
      if (!append) {
        receivedOffsetRef.current = 0;
      }
      
      // Fetch from server
      const serverMemos = await getReceivedMemos(CONFIG.PAGE_SIZE, offset);
      
      // Get currently saved memos
      const savedMemos = await bridge.getSavedMemos();
      const savedMemoIds = new Set(savedMemos.map(m => m.id));
      
      // Find new memos that aren't saved yet
      const newMemos = serverMemos.filter(memo => !savedMemoIds.has(memo.id));
      
      // Save new memos to local storage and update their status
      for (const memo of newMemos) {
        const receivedMemo: ReceivedMemo = {
          id: memo.id,
          from: memo.from,
          to: memo.to,
          subject: memo.subject,
          message: memo.message,
          isBroadcast: memo.isBroadcast,
          ttlDays: memo.ttlDays,
          createdAt: memo.createdAt,
          savedAt: new Date().toISOString(),
        };
        await bridge.saveMemo(receivedMemo);
        
        // Update status to delivered for direct messages (not broadcasts)
        if (!memo.isBroadcast) {
          await updateMemoStatus(memo.id, 'delivered');
        }
      }
      
      // Load all saved memos and display
      const allMemos = await bridge.getSavedMemos();
      setReceivedMemos(allMemos);
      
      // Update offset properly
      const newOffset = append ? (offset + serverMemos.length) : serverMemos.length;
      receivedOffsetRef.current = newOffset;
      setHasMoreReceived(serverMemos.length === CONFIG.PAGE_SIZE);
    } catch (error) {
      console.error('Failed to load received memos:', error);
      await bridge.showAlert(UI_TEXT.ALERT_ERROR, UI_TEXT.ALERT_LOAD_FAILED);
    } finally {
      setLoadingReceived(false);
      loadingReceivedRef.current = false;
    }
  }, []);

  const deleteSentMemo = useCallback(async (id: string) => {
    // Prevent duplicate deletes
    if (deletingRef.current.has(id)) return;
    
    try {
      deletingRef.current.add(id);
      setDeletingMemoIds(prev => new Set(prev).add(id));
      
      // Delete from server FIRST
      await deleteServerMemo(id);
      
      // Remove from UI after successful server delete
      setSentMemos(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('Failed to delete memo:', error);
      await bridge.showAlert(UI_TEXT.ALERT_ERROR, UI_TEXT.ALERT_DELETE_FAILED);
    } finally {
      deletingRef.current.delete(id);
      setDeletingMemoIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, []);

  const deleteReceivedMemo = useCallback(async (id: string) => {
    // Prevent duplicate deletes
    if (deletingRef.current.has(id)) return;
    
    try {
      deletingRef.current.add(id);
      setDeletingMemoIds(prev => new Set(prev).add(id));
      
      // Delete from storage FIRST
      await bridge.deleteMemo(id);
      
      // Remove from UI after successful delete
      setReceivedMemos(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('Failed to delete memo:', error);
      await bridge.showAlert(UI_TEXT.ALERT_ERROR, UI_TEXT.ALERT_DELETE_FAILED);
    } finally {
      deletingRef.current.delete(id);
      setDeletingMemoIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, []);

  const submitMemo = useCallback(async (
    to: string,
    subject: string,
    message: string,
    isBroadcast: boolean,
    ttlDays?: number
  ) => {
    try {
      await sendMemo(to, subject, message, isBroadcast, ttlDays);
      await bridge.showAlert(UI_TEXT.ALERT_SUCCESS, UI_TEXT.ALERT_MEMO_SENT);
      return true;
    } catch (error) {
      await bridge.showAlert(UI_TEXT.ALERT_ERROR, UI_TEXT.ALERT_SEND_FAILED);
      return false;
    }
  }, []);

  return {
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
  };
};
