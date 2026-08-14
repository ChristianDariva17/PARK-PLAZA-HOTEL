import { BadRequestException, Injectable } from '@nestjs/common';
import { CompromisedPasswordService } from './compromised-password.service.js';

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly compromisedPasswords: CompromisedPasswordService) {}
  async assertAcceptable(password: string): Promise<void> {
    if (password.length < 12) throw new BadRequestException('Password must be at least 12 characters');
    await this.compromisedPasswords.assertAcceptable(password);
  }
}
