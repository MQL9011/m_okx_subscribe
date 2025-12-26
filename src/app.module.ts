import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OkxModule } from './okx/okx.module';
import { WechatModule } from './wechat/wechat.module';
import { LoggingModule } from './common/logging';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggingModule,
    OkxModule,
    WechatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
