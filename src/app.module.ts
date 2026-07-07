import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { VerseModule } from './modules/verse/verse.module';
import { WritingModule } from './modules/writing/writing.module';
import { SupabaseModule } from './common/supabase/supabase.module';

@Module({
  imports: [
    AppConfigModule,
    SupabaseModule,
    AuthModule,
    UserModule,
    VerseModule,
    WritingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
