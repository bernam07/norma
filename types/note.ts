export interface Note {
  id: string;
  content: string;
  created_at: string;
  processed: boolean;
  user_id?: string;
}
