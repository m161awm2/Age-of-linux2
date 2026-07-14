import { createClient } from '@supabase/supabase-js';
import type { Difficulty } from '../data/types';

const SUPABASE_URL = 'https://ksszogzpavdwhyvptfea.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_M7GevbrpxxPJYHKGk5ek0A_2eLII7HY';
const NICKNAME_KEY = 'age-of-linux2-rank-nickname';

export const RANKING_VERSION = '2026-07-15';

export interface LeaderboardEntry {
  position: number;
  nickname: string;
  best_time_ms: number;
  is_me: boolean;
  unit_composition: Record<string, number>;
}

export interface FinishRankResult {
  accepted: boolean;
  duration_ms: number;
  personal_best: boolean;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export class RankService {
  private static authPromise: Promise<string> | null = null;

  static getNickname(): string | null {
    try {
      const nickname = window.localStorage.getItem(NICKNAME_KEY)?.trim();
      return nickname && this.isValidNickname(nickname) ? nickname : null;
    } catch {
      return null;
    }
  }

  static saveNickname(nickname: string): boolean {
    const cleaned = nickname.trim();
    if (!this.isValidNickname(cleaned)) return false;
    try { window.localStorage.setItem(NICKNAME_KEY, cleaned); }
    catch { /* 저장이 막혀도 이번 기록에는 입력값을 사용할 수 있다. */ }
    return true;
  }

  static promptForNickname(): string | null {
    const current = this.getNickname() ?? '';
    const entered = window.prompt('랭킹에 표시할 닉네임을 입력하세요. (2~12자)', current)?.trim();
    if (!entered) return null;
    if (!this.saveNickname(entered)) {
      window.alert('닉네임은 한글, 영문, 숫자, 공백, _, -만 사용해 2~12자로 입력하세요.');
      return null;
    }
    return entered;
  }

  static async startRun(difficulty: Difficulty): Promise<string | null> {
    try {
      await this.ensureAuthenticated();
      const { data, error } = await supabase.rpc('start_ranked_run', {
        p_difficulty: difficulty,
        p_game_version: RANKING_VERSION,
      });
      if (error) throw error;
      return typeof data === 'string' ? data : null;
    } catch (error) {
      console.warn('랭킹 전투 시작 기록을 만들지 못했습니다.', error);
      return null;
    }
  }

  static async finishRun(runId: string, nickname: string, unitComposition: Record<string, number>): Promise<FinishRankResult> {
    await this.ensureAuthenticated();
    const { data, error } = await supabase.rpc('finish_ranked_run', {
      p_run_id: runId,
      p_nickname: nickname.trim(),
      p_unit_composition: unitComposition,
    });
    if (error) throw error;
    return data as FinishRankResult;
  }

  static async getLeaderboard(difficulty: Difficulty): Promise<LeaderboardEntry[]> {
    await this.ensureAuthenticated();
    const { data, error } = await supabase.rpc('get_leaderboard', {
      p_difficulty: difficulty,
      p_game_version: RANKING_VERSION,
      p_limit: 100,
    });
    if (error) throw error;
    return (data ?? []).map((entry: LeaderboardEntry) => ({
      ...entry,
      position: Number(entry.position),
      unit_composition: entry.unit_composition ?? {},
    }));
  }

  static async updateNickname(nickname: string): Promise<void> {
    await this.ensureAuthenticated();
    const { error } = await supabase.rpc('set_rank_nickname', {
      p_nickname: nickname.trim(),
      p_game_version: RANKING_VERSION,
    });
    if (error) throw error;
  }

  private static isValidNickname(nickname: string): boolean {
    return /^[가-힣a-zA-Z0-9 _-]{2,12}$/.test(nickname);
  }

  private static async ensureAuthenticated(): Promise<string> {
    if (!this.authPromise) {
      this.authPromise = (async () => {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (sessionData.session?.user.id) return sessionData.session.user.id;
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        if (!data.user?.id) throw new Error('익명 사용자 ID를 만들지 못했습니다.');
        return data.user.id;
      })().catch((error) => {
        this.authPromise = null;
        throw error;
      });
    }
    return this.authPromise;
  }
}
