import { AuthService } from './AuthService';
import { supabase } from './SupabaseClient';

export interface ChatMessage {
  id: number;
  login_id: string;
  message: string;
  created_at: string;
  is_me: boolean;
}

export interface ChatAnnouncement {
  login_id: string;
  message: string;
  updated_at: string;
}

export class ChatService {
  static async getMessages(): Promise<ChatMessage[]> {
    const user = await AuthService.getSessionUser();
    if (!user) throw new Error('로그인이 필요합니다.');
    const { data, error } = await supabase.rpc('get_chat_messages', { p_limit: 60 });
    if (error) throw error;
    return (data ?? []).map((message: ChatMessage) => ({ ...message, id: Number(message.id) }));
  }

  static async sendMessage(message: string): Promise<void> {
    const cleaned = message.trim();
    if (!cleaned || cleaned.length > 200) throw new Error('메시지는 1~200자로 입력하세요.');
    const user = await AuthService.getSessionUser();
    if (!user) throw new Error('로그인이 필요합니다.');
    const { error } = await supabase.rpc('send_chat_message', { p_message: cleaned });
    if (error) throw error;
  }

  static async getAnnouncement(): Promise<ChatAnnouncement | null> {
    const user = await AuthService.getSessionUser();
    if (!user) throw new Error('로그인이 필요합니다.');
    const { data, error } = await supabase.rpc('get_chat_announcement');
    if (error) throw error;
    if (!data || typeof data !== 'object') return null;
    const announcement = data as Partial<ChatAnnouncement>;
    if (typeof announcement.login_id !== 'string' || typeof announcement.message !== 'string' ||
        typeof announcement.updated_at !== 'string') return null;
    return announcement as ChatAnnouncement;
  }

  static async setAnnouncement(message: string): Promise<void> {
    const cleaned = message.trim();
    if (cleaned.length > 200) throw new Error('공지는 200자까지 입력할 수 있습니다.');
    const user = await AuthService.getSessionUser();
    if (!user) throw new Error('로그인이 필요합니다.');
    const { error } = await supabase.rpc('set_chat_announcement', { p_message: cleaned });
    if (error) throw error;
  }
}
