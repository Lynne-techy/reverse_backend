import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { VerseModule } from './modules/verse/verse.module';
import { WritingModule } from './modules/writing/writing.module';
import { StatsModule } from './modules/stats/stats.module';
import { DevModule } from './modules/dev/dev.module';
import { SupabaseModule } from './common/supabase/supabase.module';
import { HandwritingCheckModule } from './modules/handwriting-check/handwriting-check.module';
import { BooksModule } from './modules/books/books.module';

@Module({
  imports: [
    AppConfigModule,
    SupabaseModule,
    AuthModule,
    UserModule,
    VerseModule,
    WritingModule,
    StatsModule,
    DevModule,
    HandwritingCheckModule,
    BooksModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
