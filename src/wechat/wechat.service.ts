import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface WechatTemplateData {
  keyword1: { value: string; color?: string }; // 交易时间
  keyword2: { value: string; color?: string }; // 交易品种
  keyword3: { value: string; color?: string }; // 交易方向
  keyword4: { value: string; color?: string }; // 成交数量
  keyword5: { value: string; color?: string }; // 订单状态
}

@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name);
  private readonly apiUrl: string;
  private readonly openid: string;
  private readonly templateId: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('WECHAT_API_URL')!;
    this.openid = this.configService.get<string>('WECHAT_OPENID')!;
    this.templateId = this.configService.get<string>('WECHAT_TEMPLATE_ID')!;
  }

  /**
   * 发送微信模板消息
   */
  async sendTemplateMessage(
    data: WechatTemplateData,
    url?: string,
  ): Promise<boolean> {
    try {
      const payload = {
        openid: this.openid,
        templateId: this.templateId,
        data,
        url: url || '',
      };

      this.logger.log(`发送微信通知: ${JSON.stringify(payload)}`);

      const response = await axios.post(this.apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      this.logger.log(`微信通知响应: ${JSON.stringify(response.data)}`);
      return true;
    } catch (error) {
      this.logger.error(`发送微信通知失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 发送订单通知
   * @param time 交易时间
   * @param instId 交易品种
   * @param side 交易方向
   * @param size 成交数量
   * @param state 订单状态
   */
  async sendOrderNotification(
    time: string,
    instId: string,
    side: string,
    size: string,
    state: string,
  ): Promise<boolean> {
    return this.sendTemplateMessage({
      keyword1: { value: time },
      keyword2: { value: instId },
      keyword3: { value: side },
      keyword4: { value: size },
      keyword5: { value: state },
    });
  }
}
