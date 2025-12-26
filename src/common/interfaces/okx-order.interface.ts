/**
 * OKX订单数据接口
 */
export interface OkxOrderData {
  instType: string; // 产品类型 SPOT、MARGIN、SWAP、FUTURES、OPTION
  instId: string; // 产品ID
  ordId: string; // 订单ID
  clOrdId: string; // 客户自定义订单ID
  tag: string; // 订单标签
  px: string; // 委托价格
  sz: string; // 委托数量
  ordType: string; // 订单类型
  side: string; // 订单方向 buy/sell
  posSide: string; // 持仓方向
  tdMode: string; // 交易模式
  accFillSz: string; // 累计成交数量
  fillPx: string; // 最新成交价格
  tradeId: string; // 最新成交ID
  fillSz: string; // 最新成交数量
  fillTime: string; // 最新成交时间
  state: string; // 订单状态
  avgPx: string; // 成交均价
  lever: string; // 杠杆倍数
  tpTriggerPx: string; // 止盈触发价
  tpOrdPx: string; // 止盈委托价
  slTriggerPx: string; // 止损触发价
  slOrdPx: string; // 止损委托价
  feeCcy: string; // 手续费币种
  fee: string; // 手续费
  rebateCcy: string; // 返佣币种
  rebate: string; // 返佣金额
  pnl: string; // 收益
  category: string; // 订单种类
  uTime: string; // 订单更新时间
  cTime: string; // 订单创建时间
  reqId: string; // 请求ID
  amendResult: string; // 修改结果
  code: string; // 错误码
  msg: string; // 错误信息
}

/**
 * OKX WebSocket消息接口
 */
export interface OkxWsMessage {
  arg?: {
    channel: string;
    instType?: string;
    instId?: string;
  };
  event?: string;
  data?: OkxOrderData[];
  code?: string;
  msg?: string;
}

/**
 * 订单状态映射
 */
export const ORDER_STATE_MAP: Record<string, string> = {
  canceled: '已撤销',
  live: '等待成交',
  partially_filled: '部分成交',
  filled: '完全成交',
  mmp_canceled: '做市商保护撤销',
};

/**
 * 订单方向映射
 */
export const ORDER_SIDE_MAP: Record<string, string> = {
  buy: '买入',
  sell: '卖出',
};

/**
 * 产品类型映射
 */
export const INST_TYPE_MAP: Record<string, string> = {
  SPOT: '现货',
  MARGIN: '杠杆',
  SWAP: '永续合约',
  FUTURES: '交割合约',
  OPTION: '期权',
};
