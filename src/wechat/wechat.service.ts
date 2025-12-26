import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface WechatTemplateData {
  first: { value: string; color?: string };
  keyword1: { value: string; color?: string };
  keyword2: { value: string; color?: string };
  remark?: { value: string; color?: string };
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
   */
  async sendOrderNotification(
    title: string,
    date: string,
    content: string,
    remark?: string,
  ): Promise<boolean> {
    return this.sendTemplateMessage({
      first: { value: title, color: '#173177' },
      keyword1: { value: date },
      keyword2: { value: content },
      remark: { value: remark || '点击查看详情' },
    });
  }
}
