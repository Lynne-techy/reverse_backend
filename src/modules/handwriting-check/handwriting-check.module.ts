import { Module } from '@nestjs/common';
import { HandwritingCheckController } from './handwriting-check.controller';
import { HandwritingCheckService } from './handwriting-check.service';

@Module({
  controllers: [HandwritingCheckController],
  providers: [HandwritingCheckService],
})
export class HandwritingCheckModule {}
