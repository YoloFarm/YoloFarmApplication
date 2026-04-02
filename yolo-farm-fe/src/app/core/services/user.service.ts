import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PageResponse } from '../models/api.models';
import { CreateUserRequest, UpdateUserRequest, UserResponse } from '../models/user.models';
import { ApiClientService } from './api-client.service';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiClientService);

  getMyInfo(): Observable<UserResponse> {
    return this.api.get<UserResponse>('/api/users/my-info');
  }

  getUsers(page = 0, size = 10): Observable<PageResponse<UserResponse>> {
    return this.api.get<PageResponse<UserResponse>>('/api/users', {
      params: { page, size }
    });
  }

  getUserById(id: string): Observable<UserResponse> {
    return this.api.get<UserResponse>(`/api/users/${id}`);
  }

  createUser(payload: CreateUserRequest): Observable<UserResponse> {
    return this.api.post<UserResponse, CreateUserRequest>('/api/users', payload);
  }

  updateUser(id: string, payload: UpdateUserRequest): Observable<UserResponse> {
    return this.api.put<UserResponse, UpdateUserRequest>(`/api/users/${id}`, payload);
  }

  deleteUser(id: string): Observable<string> {
    return this.api.delete<string>(`/api/users/${id}`);
  }
}
