# OKX 订单订阅服务

基于 NestJS 框架构建的 OKX 交易所订单订阅服务，通过 WebSocket 实时监听账户订单变化，并将订单通知转发到微信模板消息。

## 功能特性

- 🔗 通过 WebSocket 连接 OKX 私有频道
- 📦 实时监听账户订单状态变化
- 📱 自动将订单通知转发到微信
- 🔄 断线自动重连机制
- 💓 心跳保活机制

## 项目结构

```
src/
├── common/
│   └── interfaces/
│       └── okx-order.interface.ts  # OKX订单数据接口定义
├── okx/
│   ├── okx.module.ts               # OKX模块
│   └── okx.service.ts              # OKX WebSocket服务
├── wechat/
│   ├── wechat.module.ts            # 微信模块
│   └── wechat.service.ts           # 微信消息服务
├── app.controller.ts               # 应用控制器
├── app.module.ts                   # 应用模块
├── app.service.ts                  # 应用服务
└── main.ts                         # 入口文件
```

## 环境要求

- Node.js >= 16
- npm >= 8

## 安装

```bash
npm install
```

## 配置

复制 `.env.example` 到 `.env` 并填写配置：

```bash
cp .env.example .env
```

配置项说明：

| 环境变量           | 说明            | 示例                                                  |
| ------------------ | --------------- | ----------------------------------------------------- |
| OKX_API_KEY        | OKX API Key     | xxxxx                                                 |
| OKX_SECRET_KEY     | OKX API Secret  | xxxxx                                                 |
| OKX_PASSPHRASE     | OKX API 密码    | xxxxx                                                 |
| OKX_SIMULATED      | 是否使用模拟盘  | false                                                 |
| WECHAT_API_URL     | 微信消息API地址 | https://api.mccree.info/wxapi/wechat/message/template |
| WECHAT_OPENID      | 微信用户OpenID  | o1j7B2KKt8NLt2bX66I6qEXYpPb8                          |
| WECHAT_TEMPLATE_ID | 微信模板消息ID  | 3yV22yKxByPS6onC4kgUn7VRMi9JNXJL2XXX819N-8A           |

### 获取 OKX API Key

1. 登录 [OKX](https://www.okx.com)
2. 进入 API 管理页面
3. 创建 API Key，勾选 "读取" 权限
4. 记录 API Key、Secret Key 和 Passphrase

## 运行

### 开发模式

```bash
npm run start:dev
```

### 生产模式

```bash
npm run build
npm run start:prod
```

## 打包部署 (PM2)

### 单文件打包

直接使用 `npm run build` 会将所有代码和依赖打包成单个 `main.js` 文件：

```bash
npm run build
```

打包后只需要以下文件即可部署：

```
dist/main.js    # 打包后的单文件
.env            # 环境变量配置
```

### PM2 部署

```bash
# 直接运行
pm2 start dist/main.js --name okx-subscribe

# 或使用配置文件
pm2 start ecosystem.config.js

# 查看日志
pm2 logs okx-subscribe

# 重启服务
pm2 restart okx-subscribe

# 停止服务
pm2 stop okx-subscribe
```

### 服务器部署步骤

1. 上传文件到服务器：

   ```bash
   scp dist/main.js .env user@server:/path/to/app/
   ```

2. 在服务器上启动：
   ```bash
   cd /path/to/app
   pm2 start main.js --name okx-subscribe
   pm2 save
   ```

## API 端点

| 方法 | 路径    | 说明     |
| ---- | ------- | -------- |
| GET  | /       | 服务状态 |
| GET  | /health | 健康检查 |

## 订单通知格式

当收到订单更新时，会发送以下格式的微信通知：

- **标题**: 【OKX订单通知】买入/卖出 BTC-USDT - 完全成交
- **日期**: 2025-12-26 10:30:00
- **内容**: 类型: 现货 | 方向: 买入 | 数量: 0.1 | 均价: 95000
- **备注**: 盈亏: +100 | 手续费: -0.5 USDT | 订单ID: xxxxx

## 注意事项

1. 请确保 API Key 具有读取权限
2. 建议先使用模拟盘（OKX_SIMULATED=true）测试
3. 服务会自动重连，无需手动干预
4. 请妥善保管 API 密钥，不要泄露

## License

MIT
