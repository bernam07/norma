export interface User {
  id: string;
  username: string;
  email: string | null;
  resend_api_key: string | null;
  from_email: string | null;
  api_key: string;
  onboarding_completed: boolean;
  created_at: string;
}

export interface UserSession {
  userId: string;
  username: string;
}
