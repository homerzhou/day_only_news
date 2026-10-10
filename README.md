# 日简

每天一份的新闻简报。手机上读。第一版的内容只来自喷嚏图卦，在电脑上整理。

设计说明在 `docs/`。下面是现在就能跑起来的用法。开发机是 Windows，不需要 Mac，也不需要 Apple 开发者会员。

## 先在电脑浏览器里看

```powershell
cd mobile
npm install
npx expo install @react-native-async-storage/async-storage react-native-safe-area-context react-native-web react-dom @expo/metro-runtime
npm run web
```

浏览器打开后：列表是最近几期喷嚏图卦，标题用图卦那句短语。点进去按编号阅读。点「感兴趣」或「不感兴趣」会记到「我的」，已定稿的这一期不会被改写。

## 装到自己的 iPhone

1. 手机从 App Store 安装 **Expo Go**。
2. 电脑和手机连同一个 Wi-Fi。
3. 在 `mobile` 目录运行 `npm start`。
4. 用 Expo Go 扫描终端里的二维码。

桌面上的图标是 Expo Go。要换成「日简」自己的图标，需要云端 Mac 打包，见 `docs/04-技术方案与真机安装.md`。

## 抓最近几期图卦

```powershell
cd collector
npm install
npm run collect
npm run serve
```

`collect` 只请求喷嚏图卦列表和最近几期正文。日期取自标题里的 `喷嚏图卦YYYYMMDD`。抓到的一期会定稿，已经定稿的日期不会改写。整理结果会写进 App 内置的 `mobile/src/data/tugua-library.json`。

手机上打开「我的」，把简报服务填成这台电脑的局域网地址。启动服务时终端会打印，例如 `http://10.0.88.174:8787`。手机和这台电脑要在同一网络里。填好后回列表下拉。

列表上是每一条的第一句。查看详情里是这一条更完整的文字，并链回这一期图卦。
