import { Module } from '@nestjs/common';
import { WritingModule } from '../writing/writing.module';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  // 진척률 계산은 필사 도메인 소관이라 WritingService 에 위임한다.
  imports: [WritingModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  // AuthModule 이 프로비저닝을 위해 UserService 를 사용한다.
  exports: [UserService],
})
export class UserModule {}
