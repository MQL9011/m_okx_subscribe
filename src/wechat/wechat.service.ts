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

      this.logger.log(`发送微信通知到: ${this.apiUrl}`);
      this.logger.log(`请求数据: ${JSON.stringify(payload, null, 2)}`);

      const response = await axios.post(this.apiUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      });

      this.logger.log(`微信通知响应: ${JSON.stringify(response.data)}`);
      const resData = response.data as { errcode?: number; success?: boolean };
      return resData?.errcode === 0 || resData?.success !== false;
    } catch (error: unknown) {
      const err = error as Error & {
        response?: { status: number; data: unknown };
      };
      this.logger.error(`发送微信通知失败: ${err.message}`);
      if (err.response) {
        this.logger.error(`响应状态: ${err.response.status}`);
        this.logger.error(`响应数据: ${JSON.stringify(err.response.data)}`);
      }
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
