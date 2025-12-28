import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { WechatService } from './wechat/wechat.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly wechatService: WechatService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }

  /**
   * 测试发送微信通知（用于调试）
   */
  @Post('test-notify')
  async testNotify(): Promise<{ success: boolean; message: string }> {
    const time = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const success = await this.wechatService.sendOrderNotification(
      time,
      'BTC-USDT-SWAP', // 交易品种
      '买入', // 交易方向
      '0.1 @ 95000', // 成交数量
      '完全成交', // 订单状态
    );

    return {
      success,
      message: success ? '测试通知发送成功' : '测试通知发送失败',
    };
  }
}
