import { AuthService } from './AuthService';
import { supabase } from './SupabaseClient';
import type { UnitKind } from '../data/types';

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

export interface PvpSpawnEvent {
  id: number;
  user_id: string;
  unit_kind: UnitKind;
  created_at: string;
}

export interface PvpBattleSnapshot {
  sequence: number;
  player_base_hp: number;
  enemy_base_hp: number;
  units: Array<{ event_id: number; x: number; hp: number; burn_stacks: number }>;
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

  static async sendSpawn(roomId: string, unitKind: UnitKind): Promise<PvpSpawnEvent> {
    await this.ensureAuthenticated();
    const { data, error } = await supabase.rpc('send_pvp_spawn', { p_room_id: roomId, p_unit_kind: unitKind });
    if (error) throw error;
    return this.parseSpawnEvent(data);
  }

  static async getSpawnEvents(roomId: string, afterId: number): Promise<PvpSpawnEvent[]> {
    await this.ensureAuthenticated();
    const { data, error } = await supabase.rpc('get_pvp_events', { p_room_id: roomId, p_after_id: afterId });
    if (error) throw error;
    return (data ?? []).map((value: unknown) => this.parseSpawnEvent(value));
  }

  static async setBattleState(roomId: string, snapshot: PvpBattleSnapshot): Promise<void> {
    await this.ensureAuthenticated();
    const { error } = await supabase.rpc('set_pvp_battle_state', { p_room_id: roomId, p_snapshot: snapshot });
    if (error) throw error;
  }

  static async getBattleState(roomId: string): Promise<PvpBattleSnapshot | null> {
    await this.ensureAuthenticated();
    const { data, error } = await supabase.rpc('get_pvp_battle_state', { p_room_id: roomId });
    if (error) throw error;
    if (!data || typeof data !== 'object') return null;
    const value = data as Partial<PvpBattleSnapshot>;
    if (typeof value.sequence !== 'number' || typeof value.player_base_hp !== 'number' ||
        typeof value.enemy_base_hp !== 'number' || !Array.isArray(value.units)) {
      throw new Error('전투 상태 정보가 올바르지 않습니다.');
    }
    return value as PvpBattleSnapshot;
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

  private static parseSpawnEvent(value: unknown): PvpSpawnEvent {
    if (!value || typeof value !== 'object') throw new Error('전투 동기화 정보를 불러오지 못했습니다.');
    const event = value as Partial<PvpSpawnEvent>;
    if ((typeof event.id !== 'number' && typeof event.id !== 'string') ||
        typeof event.user_id !== 'string' || typeof event.unit_kind !== 'string') {
      throw new Error('전투 동기화 정보가 올바르지 않습니다.');
    }
    return { ...event, id: Number(event.id) } as PvpSpawnEvent;
  }
}
