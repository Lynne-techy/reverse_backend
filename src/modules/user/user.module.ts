import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository],
  // AuthModule 이 프로비저닝을 위해 UserService 를 사용한다.
  exports: [UserService],
})
export class UserModule {}
