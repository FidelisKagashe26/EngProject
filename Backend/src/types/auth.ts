export interface AuthTokenPayload {
  userId: number;
  companyId: number;
  email: string;
  fullName: string;
  role: string;
}

export interface AuthenticatedUser {
  id: number;
  companyId: number;
  email: string;
  fullName: string;
  role: string;
  status: string;
}
