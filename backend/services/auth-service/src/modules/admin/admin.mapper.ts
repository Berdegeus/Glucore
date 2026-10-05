export interface AdminUserSource {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
}

/** One row of the administrators' account list: no phone, no credentials. */
export interface AdminUserDto {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface AdminUsersPageDto {
  items: AdminUserDto[];
  page: number;
  limit: number;
  total: number;
}

export function toAdminUserDto(user: AdminUserSource): AdminUserDto {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
