import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
export type LogCategory =
  | 'CONNECTION'
  | 'AUTH'
  | 'SUBSCRIBE'
  | 'ORDER'
  | 'NOTIFY'
  | 'SYSTEM';

export interface OkxLogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private readonly logDir: string;
  private readonly logFile: string;

  constructor() {
    // 日志目录设置为程序运行目录下的 logs 文件夹
    this.logDir = path.join(process.cwd(), 'logs');
    this.logFile = path.join(this.logDir, 'okx.log');
    this.ensureLogDir();
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDir(): void {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        this.logger.log(`创建日志目录: ${this.logDir}`);
      }
    } catch (error) {
      this.logger.error('创建日志目录失败', error);
    }
  }

  /**
   * 获取当前时间字符串
   */
  private getTimestamp(): string {
    return new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  /**
   * 写入日志（最新的放在最前面）
   */
  private async writeLog(entry: OkxLogEntry): Promise<void> {
    try {
      const logLine = this.formatLogEntry(entry);

      // 读取现有内容
      let existingContent = '';
      if (fs.existsSync(this.logFile)) {
        existingContent = fs.readFileSync(this.logFile, 'utf-8');
      }

      // 将新日志写在最前面
      const newContent = logLine + existingContent;

      // 限制日志文件大小（保留最近 10000 行）
      const lines = newContent.split('\n');
      const maxLines = 10000;
      const trimmedContent =
        lines.length > maxLines
          ? lines.slice(0, maxLines).join('\n')
          : newContent;

      fs.writeFileSync(this.logFile, trimmedContent, 'utf-8');
    } catch (error) {
      this.logger.error('写入日志失败', error);
    }
  }

  /**
   * 格式化日志条目
   */
  private formatLogEntry(entry: OkxLogEntry): string {
    const separator = '═'.repeat(80);
    const levelIcon = this.getLevelIcon(entry.level);
    const categoryIcon = this.getCategoryIcon(entry.category);

    const lines: string[] = [
      separator,
      `📅 ${entry.timestamp}`,
      `${levelIcon} [${entry.level}] ${categoryIcon} [${entry.category}]`,
      `💬 ${entry.message}`,
    ];

    if (entry.data !== undefined) {
      const dataStr = this.safeStringify(entry.data);
      // 截断过长的数据
      const maxLength = 2000;
      const truncated =
        dataStr.length > maxLength
          ? dataStr.substring(0, maxLength) + '...(已截断)'
          : dataStr;
      lines.push(`📦 数据: ${truncated}`);
    }

    lines.push(''); // 空行分隔

    return lines.join('\n') + '\n';
  }

  /**
   * 获取日志级别图标
   */
  private getLevelIcon(level: LogLevel): string {
    const icons: Record<LogLevel, string> = {
      INFO: '✅',
      WARN: '⚠️',
      ERROR: '❌',
      DEBUG: '🔍',
    };
    return icons[level] || '📝';
  }

  /**
   * 获取分类图标
   */
  private getCategoryIcon(category: LogCategory): string {
    const icons: Record<LogCategory, string> = {
      CONNECTION: '🔗',
      AUTH: '🔐',
      SUBSCRIBE: '📡',
      ORDER: '📦',
      NOTIFY: '📱',
      SYSTEM: '⚙️',
    };
    return icons[category] || '📋';
  }

  /**
   * 安全的 JSON 序列化
   */
  private safeStringify(obj: any): string {
    try {
      if (typeof obj === 'string') {
        return obj;
      }
      return JSON.stringify(obj, null, 0);
    } catch {
      return '[无法序列化]';
    }
  }

  // ========== 公共日志方法 ==========

  /**
   * 记录连接日志
   */
  async logConnection(message: string, data?: any): Promise<void> {
    await this.writeLog({
      timestamp: this.getTimestamp(),
      level: 'INFO',
      category: 'CONNECTION',
      message,
      data,
    });
  }

  /**
   * 记录认证日志
   */
  async logAuth(message: string, success: boolean, data?: any): Promise<void> {
    await this.writeLog({
      timestamp: this.getTimestamp(),
      level: success ? 'INFO' : 'ERROR',
      category: 'AUTH',
      message,
      data,
    });
  }

  /**
   * 记录订阅日志
   */
  async logSubscribe(message: string, data?: any): Promise<void> {
    await this.writeLog({
      timestamp: this.getTimestamp(),
      level: 'INFO',
      category: 'SUBSCRIBE',
      message,
      data,
    });
  }

  /**
   * 记录订单日志
   */
  async logOrder(message: string, orderData?: any): Promise<void> {
    await this.writeLog({
      timestamp: this.getTimestamp(),
      level: 'INFO',
      category: 'ORDER',
      message,
      data: orderData,
    });
  }

  /**
   * 记录通知日志
   */
  async logNotify(
    message: string,
    success: boolean,
    data?: any,
  ): Promise<void> {
    await this.writeLog({
      timestamp: this.getTimestamp(),
      level: success ? 'INFO' : 'ERROR',
      category: 'NOTIFY',
      message,
      data,
    });
  }

  /**
   * 记录系统日志
   */
  async logSystem(level: LogLevel, message: string, data?: any): Promise<void> {
    await this.writeLog({
      timestamp: this.getTimestamp(),
      level,
      category: 'SYSTEM',
      message,
      data,
    });
  }

  /**
   * 记录错误日志
   */
  async logError(
    category: LogCategory,
    message: string,
    error?: any,
  ): Promise<void> {
    await this.writeLog({
      timestamp: this.getTimestamp(),
      level: 'ERROR',
      category,
      message,
      data: error instanceof Error ? error.message : error,
    });
  }

  // ========== 日志管理方法 ==========

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logFile;
  }

  /**
   * 读取最近的日志
   */
  getRecentLogs(lines: number = 100): string {
    try {
      if (!fs.existsSync(this.logFile)) {
        return '暂无日志';
      }
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const allLines = content.split('\n');
      return allLines.slice(0, lines).join('\n');
    } catch (error) {
      this.logger.error('读取日志失败', error);
      return '读取日志失败';
    }
  }

  /**
   * 清空日志
   */
  clearLogs(): void {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, '', 'utf-8');
        this.logger.log('日志已清空');
      }
    } catch (error) {
      this.logger.error('清空日志失败', error);
    }
  }
}
