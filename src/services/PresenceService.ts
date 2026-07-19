import { supabase } from './SupabaseClient';

export interface OnlineUserPresence {
  login_id: string;
  last_seen_at: string;
  is_me: boolean;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

export class PresenceService {
  private static timer: number | null = null;
  private static readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') void this.heartbeat();
  };

  static start(): void {
    if (this.timer !== null) return;
    void this.heartbeat();
    this.timer = window.setInterval(() => void this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  static async stop(removePresence = false): Promise<void> {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (removePresence) {
      const { error } = await supabase.rpc('leave_user_presence');
      if (error) console.warn('온라인 상태 종료 처리 실패', error);
    }
  }

  static async getOnlineUsers(): Promise<OnlineUserPresence[]> {
    await this.heartbeat();
    const { data, error } = await supabase.rpc('get_online_users');
    if (error) throw error;
    return (data ?? []).filter((item: OnlineUserPresence) => (
      typeof item.login_id === 'string' && typeof item.last_seen_at === 'string'
    ));
  }

  private static async heartbeat(): Promise<void> {
    const { error } = await supabase.rpc('touch_user_presence');
    if (error) console.warn('온라인 상태 갱신 실패', error);
  }
}
