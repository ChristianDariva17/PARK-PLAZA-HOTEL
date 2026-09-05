import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CompromisedPasswordService } from './compromised-password.service.js';
import { CryptoService } from './crypto.service.js';
import { GoogleTokenVerifier } from './google-token-verifier.js';
import { LoginDefenseService } from './login-defense.service.js';
import { PasswordPolicyService } from './password-policy.service.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { SessionGuard } from './guards/session.guard.js';
import { SessionService } from './session.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService, CryptoService, GoogleTokenVerifier, LoginDefenseService, SessionService, CompromisedPasswordService, PasswordPolicyService,
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [CryptoService, PasswordPolicyService, SessionService],
})
export class AuthModule {}
