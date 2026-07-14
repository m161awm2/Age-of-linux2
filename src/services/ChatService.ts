import { AuthService } from './AuthService';
import { supabase } from './SupabaseClient';

export interface ChatMessage {
  id: number;
  login_id: string;
  message: string;
  created_at: string;
  is_me: boolean;
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
}
