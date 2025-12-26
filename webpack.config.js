const path = require('path');
const webpack = require('webpack');

module.exports = (options) => {
  return {
    ...options,
    entry: './src/main.ts',
    target: 'node',
    output: {
      ...options.output,
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
    },
    // 将所有依赖打包进单文件
    externals: [],
    // 优化配置
    optimization: {
      minimize: false, // 不压缩代码，方便调试
    },
    plugins: [
      ...(options.plugins || []),
      // 忽略一些可选依赖的警告
      new webpack.IgnorePlugin({
        checkResource(resource) {
          // 这些是一些可选的原生模块，在 NestJS 中可能不需要
          const lazyImports = [
            '@nestjs/microservices',
            '@nestjs/websockets',
            '@nestjs/platform-fastify',
            '@nestjs/microservices/microservices-module',
            '@nestjs/websockets/socket-module',
            'class-transformer/storage',
            'cache-manager-redis-store',
            'ioredis',
            'bufferutil',
            'utf-8-validate',
          ];
          if (!lazyImports.includes(resource)) {
            return false;
          }
          try {
            require.resolve(resource);
          } catch (err) {
            return true;
          }
          return false;
        },
      }),
    ],
    // 解析配置
    resolve: {
      ...options.resolve,
      extensions: ['.ts', '.js', '.json'],
    },
  };
};
