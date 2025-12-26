import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import * as crypto from 'crypto';
import { WechatService } from '../wechat/wechat.service';
import {
  OkxWsMessage,
  OkxOrderData,
  ORDER_STATE_MAP,
  ORDER_SIDE_MAP,
  INST_TYPE_MAP,
} from '../common/interfaces/okx-order.interface';

@Injectable()
export class OkxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OkxService.name);
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private shouldReconnect = true;

  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly passphrase: string;
  private readonly isSimulated: boolean;

  constructor(
    private configService: ConfigService,
    private wechatService: WechatService,
  ) {
    this.apiKey = this.configService.get<string>('OKX_API_KEY')!;
    this.secretKey = this.configService.get<string>('OKX_SECRET_KEY')!;
    this.passphrase = this.configService.get<string>('OKX_PASSPHRASE')!;
    this.isSimulated =
      this.configService.get<string>('OKX_SIMULATED') === 'true';
  }

  onModuleInit() {
    this.logger.log('OKX服务初始化...');
    this.connectWebSocket();
  }

  onModuleDestroy() {
    this.logger.log('OKX服务销毁...');
    this.shouldReconnect = false;
    this.cleanup();
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 生成签名
   */
  private sign(
    timestamp: string,
    method: string,
    requestPath: string,
    body: string = '',
  ): string {
    const prehash = timestamp + method + requestPath + body;
    const hmac = crypto.createHmac('sha256', this.secretKey);
    return hmac.update(prehash).digest('base64');
  }

  /**
   * 连接WebSocket
   */
  private connectWebSocket() {
    if (this.isConnecting) {
      this.logger.warn('正在连接中，跳过重复连接');
      return;
    }

    this.isConnecting = true;
    this.cleanup();

    // 使用正确的WebSocket地址
    const wsUrl = this.isSimulated
      ? 'wss://wspap.okx.com:8443/ws/v5/private?brokerId=9999'
      : 'wss://ws.okx.com:8443/ws/v5/private';

    this.logger.log(
      `连接到OKX WebSocket: ${wsUrl} (${this.isSimulated ? '模拟盘' : '实盘'})`,
    );

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.logger.log('WebSocket连接已建立');
      this.isConnecting = false;
      this.login();
      this.startPing();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error(`WebSocket错误: ${error.message}`);
      this.isConnecting = false;
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.logger.warn(
        `WebSocket连接关闭: code=${code}, reason=${reason.toString()}`,
      );
      this.isConnecting = false;
      this.scheduleReconnect();
    });
  }

  /**
   * 登录认证
   */
  private login() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const sign = this.sign(timestamp, 'GET', '/users/self/verify');

    const loginMessage = {
      op: 'login',
      args: [
        {
          apiKey: this.apiKey,
          passphrase: this.passphrase,
          timestamp: timestamp,
          sign: sign,
        },
      ],
    };

    this.logger.log('发送登录请求...');
    this.ws?.send(JSON.stringify(loginMessage));
  }

  /**
   * 订阅订单频道
   */
  private subscribeOrders() {
    const subscribeMessage = {
      op: 'subscribe',
      args: [
        {
          channel: 'orders',
          instType: 'ANY',
        },
      ],
    };

    this.logger.log('订阅订单频道...');
    this.ws?.send(JSON.stringify(subscribeMessage));
  }

  /**
   * 开始心跳
   */
  private startPing() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 25000); // 每25秒发送一次ping
  }

  /**
   * 计划重连
   */
  private scheduleReconnect() {
    if (!this.shouldReconnect) {
      return;
    }

    this.logger.log('5秒后尝试重连...');
    this.reconnectTimeout = setTimeout(() => {
      this.connectWebSocket();
    }, 5000);
  }

  /**
   * 处理WebSocket消息
   */
  private handleMessage(data: WebSocket.Data) {
    const messageStr = data.toString();

    // 处理pong响应
    if (messageStr === 'pong') {
      return;
    }

    try {
      const message: OkxWsMessage = JSON.parse(messageStr);

      // 处理登录响应
      if (message.event === 'login') {
        if (message.code === '0') {
          this.logger.log('登录成功');
          this.subscribeOrders();
        } else {
          this.logger.error(`登录失败: ${message.msg}`);
        }
        return;
      }

      // 处理订阅响应
      if (message.event === 'subscribe') {
        this.logger.log(`订阅成功: ${JSON.stringify(message.arg)}`);
        return;
      }

      // 处理错误
      if (message.event === 'error') {
        this.logger.error(`收到错误: ${message.msg} (code: ${message.code})`);
        return;
      }

      // 处理订单数据
      if (message.arg?.channel === 'orders' && message.data) {
        this.handleOrderData(message.data);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`解析消息失败: ${errorMessage}`);
    }
  }

  /**
   * 处理订单数据
   */
  private async handleOrderData(orders: OkxOrderData[]) {
    for (const order of orders) {
      this.logger.log(`收到订单更新: ${JSON.stringify(order)}`);

      // 格式化订单信息
      const title = this.formatOrderTitle(order);
      const date = this.formatDate(order.uTime);
      const content = this.formatOrderContent(order);
      const remark = this.formatOrderRemark(order);

      // 发送微信通知
      await this.wechatService.sendOrderNotification(
        title,
        date,
        content,
        remark,
      );
    }
  }

  /**
   * 格式化订单标题
   */
  private formatOrderTitle(order: OkxOrderData): string {
    const side = ORDER_SIDE_MAP[order.side] || order.side;
    const state = ORDER_STATE_MAP[order.state] || order.state;
    return `【OKX订单通知】${side} ${order.instId} - ${state}`;
  }

  /**
   * 格式化日期
   */
  private formatDate(timestamp: string): string {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * 格式化订单内容
   */
  private formatOrderContent(order: OkxOrderData): string {
    const instType = INST_TYPE_MAP[order.instType] || order.instType;
    const side = ORDER_SIDE_MAP[order.side] || order.side;
    const parts: string[] = [];

    parts.push(`类型: ${instType}`);
    parts.push(`方向: ${side}`);
    parts.push(`数量: ${order.sz}`);

    if (order.px && order.px !== '0') {
      parts.push(`价格: ${order.px}`);
    }

    if (order.avgPx && order.avgPx !== '0') {
      parts.push(`均价: ${order.avgPx}`);
    }

    if (order.accFillSz && order.accFillSz !== '0') {
      parts.push(`成交: ${order.accFillSz}`);
    }

    return parts.join(' | ');
  }

  /**
   * 格式化订单备注
   */
  private formatOrderRemark(order: OkxOrderData): string {
    const parts: string[] = [];

    if (order.pnl && order.pnl !== '0') {
      const pnl = parseFloat(order.pnl);
      const pnlText = pnl >= 0 ? `+${order.pnl}` : order.pnl;
      parts.push(`盈亏: ${pnlText}`);
    }

    if (order.fee && order.fee !== '0') {
      parts.push(`手续费: ${order.fee} ${order.feeCcy}`);
    }

    if (order.lever && order.lever !== '0') {
      parts.push(`杠杆: ${order.lever}x`);
    }

    parts.push(`订单ID: ${order.ordId}`);

    return parts.join(' | ');
  }
}
