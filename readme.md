# 基于XQUIC-webtransport的 node 服务端 Example

Fork From [webtransport-webclient-example](https://github.com/Sy0307/webtransport-webclient-example)

特别鸣谢[XQUIC](https://github.com/alibaba/xquic).

## Quick Start

1.进入`cert`目录，执行`./generate`，在系统中信任颁发的证书

2.终端运行

```bash
pnpm i
pnpm dev
```

3.访问`https://localhost:3000`

4.点击`Connect`按钮连接。

5.点击`Auto test`按钮自动测试。

## TODO

- [x] 使用 worker 进行通信，防止阻塞，提高通信效率
