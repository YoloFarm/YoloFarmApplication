export type UserRole = 'ADMIN' | 'USER';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenRequest {
  token: string;
}

export interface AuthenticationResponse {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  token: string;
  authenticated: boolean;
}

export interface IntrospectResponse {
  valid: boolean;
}

export type AuthSession = AuthenticationResponse;
