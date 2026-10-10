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

桌面上的图标是 Expo Go。要换成「日简」自己的图标，用下面的 Flutter 工程交给 Codemagic 打包，见 `docs/04-技术方案与真机安装.md`。网页版继续留着：改完内容或界面，先在浏览器里看这一版。

## 抓最近几期图卦

```powershell
cd collector
npm install
npm run collect
npm run serve
```

`collect` 只请求喷嚏图卦列表和最近几期正文。日期取自标题里的 `喷嚏图卦YYYYMMDD`。抓到的一期会定稿，已经定稿的日期不会改写。整理结果会写进网页版、Flutter 和 Vercel 用的 `public/tugua/`。

整理仍在这台 Windows 上跑。跑完把仓库推到 GitHub，Vercel 会按这次提交重新发布简报和图片。

## 部署到 Vercel

仓库根目录已经是 Vercel 项目：`api/library.js` 提供简报，`api/preferences.js` 接收兴趣，`public/tugua/` 提供图片。

1. 在 Vercel 里导入 GitHub 仓库 `homerzhou/day_only_news`。框架选 Other，根目录用仓库根，不用改构建命令。
2. 在该项目里创建一个 Blob 存储。Vercel 会写入 `BLOB_READ_WRITE_TOKEN`。没有这块存储时，简报和图片仍然可用，兴趣只留在手机上。
3. 部署完成后，在手机或网页版的「我的」里填 `https://你的项目.vercel.app`，回到列表下拉。
4. 想让下一次整理用上手机里点过的兴趣：在 `collector` 目录放一行地址的 `api-base.txt`（这个文件不进仓库），或设置环境变量 `RIJIAN_API_URL`，然后再 `npm run collect`。

本机仍可用 `npm run serve` 在 `http://127.0.0.1:8787` 看同一套接口。网页预览继续用 `http://127.0.0.1:8081/`，不填服务地址也能看已经带在页面里的图卦。

列表上是每一条的第一句。查看详情里是这一条更完整的文字，并链回这一期图卦。

## Flutter 安装包（Codemagic）

网页版仍是改完后先看效果的地方，不要删。要编成能装到 iPhone 的独立 App，用 `flutter_app/`。仓库根目录的 `codemagic.yaml` 会在 Codemagic 的 Mac 上补齐 iOS 工程，应用名写成「日简」，然后打出安装包。本机不需要安装 Flutter，也不需要 Mac。

在 Codemagic 里连上 GitHub 仓库 `homerzhou/day_only_news`，选工作流「日简 iOS」。签名要用 Apple Developer Program 里的证书：在 Codemagic 的团队设置里加上 Apple 集成，包名是 `com.homerzhou.rijian`，分发方式是 Ad Hoc，并登记这台 iPhone 的 UDID。没有付费会员时，这一步会停在签名，网页预览不受影响。

改界面时：先改 `mobile/` 并用 `npm run web` 看浏览器效果。确认后再把同样的交互写进 `flutter_app/`。只改图卦内容时，跑一次 `collector` 的 `npm run collect`，两套界面会一起更新。
