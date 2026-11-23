import { Role } from '@prisma/client';

export interface CurrentUserPayload {
  id: number;
  login: string;
  role: Role;
  fullName?: string | null;
}
