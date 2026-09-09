export type Role = 'admin' | 'user';

export interface AuthUserPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AccessTokenPayload extends AuthUserPayload {
  tokenType: 'access';
}

export interface RefreshTokenPayload {
  userId: string;
  tokenType: 'refresh';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterDto {
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
}
