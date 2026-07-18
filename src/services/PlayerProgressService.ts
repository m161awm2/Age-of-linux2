import type { Difficulty } from '../data/types';
import { supabase } from './SupabaseClient';

export type SpecialPath = 'ronin' | 'fenrir' | 'hatchling';

export interface PlayerProgress {
  gold: number;
  tutorialCompleted: boolean;
  unlockedSpecialPaths: SpecialPath[];
}

export interface CampaignRewardResult {
  awarded: number;
  gold: number;
}

const EMPTY_PROGRESS: PlayerProgress = {
  gold: 200,
  tutorialCompleted: false,
  unlockedSpecialPaths: [],
};

export class PlayerProgressService {
  private static progress: PlayerProgress | null = null;
  private static loading: Promise<PlayerProgress> | null = null;

  static get isLoaded(): boolean {
    return this.progress !== null;
  }

  static get current(): PlayerProgress {
    return this.progress ?? EMPTY_PROGRESS;
  }

  static async load(force = false): Promise<PlayerProgress> {
    if (!force && this.progress) return this.progress;
    if (!force && this.loading) return this.loading;
    this.loading = (async () => {
      const { data, error } = await supabase.rpc('get_player_progress');
      if (error) throw error;
      this.progress = this.parse(data);
      return this.progress;
    })().finally(() => { this.loading = null; });
    return this.loading;
  }

  static clear(): void {
    this.progress = null;
    this.loading = null;
  }

  static async completeTutorial(): Promise<void> {
    if (this.progress) this.progress.tutorialCompleted = true;
    const { error } = await supabase.rpc('complete_player_tutorial');
    if (error) throw error;
  }

  static async purchaseSpecial(path: SpecialPath): Promise<PlayerProgress> {
    const { data, error } = await supabase.rpc('purchase_special_path', { p_path: path });
    if (error) throw error;
    this.progress = this.parse(data);
    return this.progress;
  }

  static async claimCampaignReward(runId: string, difficulty: Difficulty): Promise<CampaignRewardResult> {
    const { data, error } = await supabase.rpc('claim_campaign_reward', {
      p_run_id: runId,
      p_difficulty: difficulty,
    });
    if (error) throw error;
    const result = data as { awarded?: unknown; gold?: unknown } | null;
    const awarded = Number(result?.awarded ?? 0);
    const gold = Number(result?.gold ?? this.current.gold);
    if (this.progress) this.progress.gold = gold;
    return { awarded, gold };
  }

  private static parse(value: unknown): PlayerProgress {
    const raw = (value ?? {}) as Record<string, unknown>;
    const paths = Array.isArray(raw.unlocked_special_paths)
      ? raw.unlocked_special_paths.filter((path): path is SpecialPath => path === 'ronin' || path === 'fenrir' || path === 'hatchling')
      : [];
    return {
      gold: Math.max(0, Number(raw.gold ?? 0)),
      tutorialCompleted: raw.tutorial_completed === true,
      unlockedSpecialPaths: paths,
    };
  }
}
