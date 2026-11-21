# Daily News

适合手机浏览的个人资讯页：7 天天气、本地资讯、社会与国际新闻，以及新奇发现。页面由 GitHub Pages 托管，GitHub Actions 定时更新新闻，无需服务器或 API 密钥。

## 部署

1. 修改 `config.json` 中的 `city` 为你的城市，例如 `杭州`。它用于抓取本地资讯；天气城市可在网页上单独设置。
2. 将代码推送至 GitHub 的 `main` 分支。
3. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
4. 在 Actions 页面运行一次 **Update and deploy**，等待完成后通过 Pages 页面显示的网址访问。
5. iPhone 用 Safari 打开网址，点分享按钮 →「添加到主屏幕」。

工作流每小时尝试更新，也可在 Actions 中手动运行。定时任务可能延迟或失败，网页会显示数据更新时间。公开仓库的 Pages 内容是公开的，请勿放入秘密信息。平台免费额度和政策可能发生变化。

## 数据与配置

- 天气：浏览器直接请求 [Open-Meteo](https://open-meteo.com/) 地理编码和天气预报接口。首次输入城市并选择匹配地点后，位置保存在当前浏览器。预报降雨/降温提示是简单计算结果，**不是官方气象预警**；请保留官方预警通知。
- 新闻：默认使用 Google News RSS 搜索结果，链接指向原始条目。来源、排序及可访问性受服务商影响。`config.json` 的 `feeds` 可替换为其他允许使用的 RSS/Atom 源。更新失败时页面保留上次成功的新闻，并提示失败；首次运行失败则对应栏目为空。
- 本地栏目取决于配置的城市和可用新闻源；不输入城市时会显示配置提示。
- 日期按上海时间显示；网页无需定位权限和账号。

## 本地生成与预览

需要 Python 3.9 或以上，无第三方依赖：

```sh
python3 scripts/update.py
python3 -m http.server 8000
```

打开 `http://localhost:8000`。`data/news.json` 是生成文件，工作流构建时自动生成；本地可重复运行更新。第三方源可能不可用，参见生成结果中的状态信息。
