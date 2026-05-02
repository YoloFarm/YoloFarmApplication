import { UserRole } from './auth.models';

export interface UserResponse {
  id: string;
  email: string;
  password?: string;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRole;
  active: boolean;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  password?: string;
  role?: UserRole;
}

export interface UsersPageQuery {
  page: number;
  size: number;
}
