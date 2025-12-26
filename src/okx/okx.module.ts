import { Module } from '@nestjs/common';
import { OkxService } from './okx.service';
import { WechatModule } from '../wechat/wechat.module';

@Module({
  imports: [WechatModule],
  providers: [OkxService],
  exports: [OkxService],
})
export class OkxModule {}
