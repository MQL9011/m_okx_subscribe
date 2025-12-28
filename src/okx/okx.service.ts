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
import { LoggingService } from '../common/logging';
import {
  OkxWsMessage,
  OkxOrderData,
  ORDER_STATE_MAP,
  ORDER_SIDE_MAP,
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
    private loggingService: LoggingService,
  ) {
    this.apiKey = this.configService.get<string>('OKX_API_KEY')!;
    this.secretKey = this.configService.get<string>('OKX_SECRET_KEY')!;
    this.passphrase = this.configService.get<string>('OKX_PASSPHRASE')!;
    this.isSimulated =
      this.configService.get<string>('OKX_SIMULATED') === 'true';
  }

  async onModuleInit() {
    this.logger.log('OKX服务初始化...');
    await this.loggingService.logSystem('INFO', 'OKX服务初始化');
    this.connectWebSocket();
  }

  async onModuleDestroy() {
    this.logger.log('OKX服务销毁...');
    await this.loggingService.logSystem('INFO', 'OKX服务销毁');
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
  private async connectWebSocket() {
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

    const mode = this.isSimulated ? '模拟盘' : '实盘';
    this.logger.log(`连接到OKX WebSocket: ${wsUrl} (${mode})`);
    await this.loggingService.logConnection(`正在连接OKX WebSocket (${mode})`, {
      url: wsUrl,
    });

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', async () => {
      this.logger.log('WebSocket连接已建立');
      await this.loggingService.logConnection('WebSocket连接已建立', {
        url: wsUrl,
        mode,
      });
      this.isConnecting = false;
      this.login();
      this.startPing();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(data);
    });

    this.ws.on('error', async (error: Error) => {
      this.logger.error(`WebSocket错误: ${error.message}`);
      await this.loggingService.logError('CONNECTION', 'WebSocket连接错误', {
        error: error.message,
      });
      this.isConnecting = false;
    });

    this.ws.on('close', async (code: number, reason: Buffer) => {
      const reasonStr = reason.toString();
      this.logger.warn(`WebSocket连接关闭: code=${code}, reason=${reasonStr}`);
      await this.loggingService.logConnection('WebSocket连接关闭', {
        code,
        reason: reasonStr,
      });
      this.isConnecting = false;
      this.scheduleReconnect();
    });
  }

  /**
   * 登录认证
   */
  private async login() {
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
    await this.loggingService.logAuth('发送登录请求', true, {
      apiKey: this.apiKey.substring(0, 8) + '***',
    });
    this.ws?.send(JSON.stringify(loginMessage));
  }

  /**
   * 订阅订单频道
   */
  private async subscribeOrders() {
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
    await this.loggingService.logSubscribe('发送订阅请求', subscribeMessage);
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
  private async scheduleReconnect() {
    if (!this.shouldReconnect) {
      return;
    }

    this.logger.log('5秒后尝试重连...');
    await this.loggingService.logConnection('计划5秒后重连');
    this.reconnectTimeout = setTimeout(() => {
      this.connectWebSocket();
    }, 5000);
  }

  /**
   * 处理WebSocket消息
   */
  private async handleMessage(data: WebSocket.Data) {
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
          await this.loggingService.logAuth('登录成功', true);
          this.subscribeOrders();
        } else {
          this.logger.error(`登录失败: ${message.msg}`);
          await this.loggingService.logAuth('登录失败', false, {
            code: message.code,
            msg: message.msg,
          });
        }
        return;
      }

      // 处理订阅响应
      if (message.event === 'subscribe') {
        this.logger.log(`订阅成功: ${JSON.stringify(message.arg)}`);
        await this.loggingService.logSubscribe('订阅成功', message.arg);
        return;
      }

      // 处理错误
      if (message.event === 'error') {
        this.logger.error(`收到错误: ${message.msg} (code: ${message.code})`);
        await this.loggingService.logError('SYSTEM', '收到OKX错误', {
          code: message.code,
          msg: message.msg,
        });
        return;
      }

      // 处理订单数据
      if (message.arg?.channel === 'orders' && message.data) {
        await this.handleOrderData(message.data);
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`解析消息失败: ${errorMessage}`);
      await this.loggingService.logError('SYSTEM', '解析消息失败', {
        error: errorMessage,
        rawMessage: messageStr.substring(0, 500),
      });
    }
  }

  /**
   * 处理订单数据
   */
  private async handleOrderData(orders: OkxOrderData[]) {
    for (const order of orders) {
      this.logger.log(`收到订单更新: ${JSON.stringify(order)}`);

      // 记录订单日志
      await this.loggingService.logOrder('收到订单更新', {
        ordId: order.ordId,
        instId: order.instId,
        side: order.side,
        state: order.state,
        sz: order.sz,
        px: order.px,
        avgPx: order.avgPx,
        pnl: order.pnl,
      });

      // 格式化订单信息用于微信通知
      const time = this.formatDate(order.uTime);
      const instId = order.instId;
      const side = ORDER_SIDE_MAP[order.side] || order.side;
      const size = this.formatSize(order);
      const state = ORDER_STATE_MAP[order.state] || order.state;

      // 发送微信通知
      const success = await this.wechatService.sendOrderNotification(
        time,
        instId,
        side,
        size,
        state,
      );

      // 记录通知结果
      await this.loggingService.logNotify(
        success ? '微信通知发送成功' : '微信通知发送失败',
        success,
        {
          ordId: order.ordId,
          instId,
          side,
          size,
          state,
        },
      );
    }
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
   * 格式化成交数量（包含均价信息）
   */
  private formatSize(order: OkxOrderData): string {
    let result = order.sz;

    // 如果有成交均价，附加上
    if (order.avgPx && order.avgPx !== '0' && order.avgPx !== '') {
      result += ` @ ${order.avgPx}`;
    }

    return result;
  }
}
