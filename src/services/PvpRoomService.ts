import { AuthService } from './AuthService';
import { supabase } from './SupabaseClient';

export type PvpRoomStatus = 'waiting' | 'full' | 'cancelled';

export interface PvpRoom {
  id: string;
  code: string;
  status: PvpRoomStatus;
  host_user_id: string;
  host_login_id: string;
  guest_user_id: string | null;
  guest_login_id: string | null;
  is_host: boolean;
  expires_at: string;
}

export class PvpRoomService {
  static async createRoom(): Promise<PvpRoom> {
    await this.ensureAuthenticated();
    const { data, error } = await supabase.rpc('create_pvp_room');
    if (error) throw error;
    return this.parseRoom(data);
  }

  static async joinRoom(code: string): Promise<PvpRoom> {
    const cleaned = code.trim().toUpperCase();
    if (!/^[A-F0-9]{6}$/.test(cleaned)) throw new Error('방 코드 6자리를 입력하세요.');
    await this.ensureAuthenticated();
    const { data, error } = await supabase.rpc('join_pvp_room', { p_code: cleaned });
    if (error) throw error;
    return this.parseRoom(data);
  }

  static async getRoom(roomId: string): Promise<PvpRoom> {
    await this.ensureAuthenticated();
    const { data, error } = await supabase.rpc('get_pvp_room', { p_room_id: roomId });
    if (error) throw error;
    return this.parseRoom(data);
  }

  static async leaveRoom(roomId: string): Promise<void> {
    await this.ensureAuthenticated();
    const { error } = await supabase.rpc('leave_pvp_room', { p_room_id: roomId });
    if (error) throw error;
  }

  private static async ensureAuthenticated(): Promise<void> {
    if (!await AuthService.getSessionUser()) throw new Error('로그인이 필요합니다.');
  }

  private static parseRoom(value: unknown): PvpRoom {
    if (!value || typeof value !== 'object') throw new Error('방 정보를 불러오지 못했습니다.');
    const room = value as Partial<PvpRoom>;
    if (typeof room.id !== 'string' || typeof room.code !== 'string') throw new Error('방 정보가 올바르지 않습니다.');
    return room as PvpRoom;
  }
}
