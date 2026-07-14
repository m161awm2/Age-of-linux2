import type { User } from '@supabase/supabase-js';
import { supabase } from './SupabaseClient';

export interface SignUpResult {
  signedIn: boolean;
  requiresEmailConfirmation: boolean;
}

export class AuthService {
  static async getUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    if (data.user.is_anonymous) {
      await supabase.auth.signOut();
      return null;
    }
    return data.user;
  }

  static async signIn(loginId: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithPassword({ email: this.toInternalEmail(loginId), password });
    if (error) throw error;
    if (!data.user || data.user.is_anonymous) throw new Error('로그인 세션을 만들지 못했습니다.');
  }

  static async signUp(loginId: string, password: string): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email: this.toInternalEmail(loginId),
      password,
      options: { data: { login_id: loginId.trim().toLowerCase() } },
    });
    if (error) throw error;
    return {
      signedIn: Boolean(data.session && data.user && !data.user.is_anonymous),
      requiresEmailConfirmation: Boolean(data.user && !data.session),
    };
  }

  static async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  static isValidLoginId(loginId: string): boolean {
    return /^[a-zA-Z0-9_]{4,16}$/.test(loginId.trim());
  }

  private static toInternalEmail(loginId: string): string {
    const cleaned = loginId.trim().toLowerCase();
    if (!this.isValidLoginId(cleaned)) throw new Error('아이디는 영문, 숫자, _를 사용해 4~16자로 입력하세요.');
    return `${cleaned}@users.ageoflinux2.com`;
  }
}
