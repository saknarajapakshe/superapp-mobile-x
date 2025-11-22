export interface MemoFilter {
  search: string;
  startDate: string; // ISO string YYYY-MM-DD
  endDate: string;   // ISO string YYYY-MM-DD
  isBroadcast: boolean;
}

export interface Memo {
  id: string;
  from: string;
  to: string;
  subject: string;
  message: string;
  status: 'sent' | 'delivered';
  isBroadcast: boolean;
  ttlDays?: number;
  createdAt: string;
  deliveredAt?: string;
}

export interface ReceivedMemo extends Omit<Memo, 'status'> {
  savedAt: string;
}

/**
 * Native Bridge interface provided by the SuperApp
 * All bridge methods return Promises
 * 
 * Reference: superapp-mobile/frontend/docs/BRIDGE_GUIDE.md
 */
export interface NativeBridge {
  requestToken: () => Promise<string | null>;
  requestSaveLocalData: (params: { key: string; value: string }) => Promise<void>;
  requestGetLocalData: (params: { key: string }) => Promise<{ value: string | null }>;
  requestAlert: (params: { title: string; message: string; buttonText: string }) => Promise<void>;
  requestConfirmAlert: (params: {
    title: string;
    message: string;
    cancelButtonText: string;
    confirmButtonText: string;
  }) => Promise<'confirm' | 'cancel'>;
}

declare global {
  interface Window {
    nativebridge?: NativeBridge;
  }
}


export interface Group {
  id: string;
  name: string;
  recipients: string[];
  createdAt: number;
}
