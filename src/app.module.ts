import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { SupabaseModule } from './common/supabase/supabase.module';
import { HandwritingCheckModule } from './modules/handwriting-check/handwriting-check.module';

@Module({
  imports: [
    AppConfigModule,
    SupabaseModule,
    AuthModule,
    UserModule,
    HandwritingCheckModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
