import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LoggingService } from './logging.service';

@Controller('logs')
export class LoggingController {
  constructor(private readonly loggingService: LoggingService) {}

  /**
   * 获取最近的日志
   * @param lines 要获取的行数，默认 100
   */
  @Get()
  getRecentLogs(@Query('lines') lines?: string): {
    path: string;
    content: string;
  } {
    const lineCount = lines ? parseInt(lines, 10) : 100;
    return {
      path: this.loggingService.getLogFilePath(),
      content: this.loggingService.getRecentLogs(lineCount),
    };
  }

  /**
   * 获取日志文件路径
   */
  @Get('path')
  getLogPath(): { path: string } {
    return {
      path: this.loggingService.getLogFilePath(),
    };
  }

  /**
   * 清空日志
   */
  @Post('clear')
  @HttpCode(HttpStatus.OK)
  clearLogs(): { message: string } {
    this.loggingService.clearLogs();
    return { message: '日志已清空' };
  }
}

