# Daily News

适合手机浏览的个人资讯页：7 天天气、本地资讯、社会与国际新闻，以及新奇发现。页面由 GitHub Pages 托管，GitHub Actions 定时更新新闻，无需服务器或 API 密钥。

## 部署

1. `config.json` 中的城市默认为杭州，用于抓取本地资讯；天气城市可在网页上单独设置。
2. 将代码推送至 GitHub 的 `main` 分支。
3. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
4. 在 Actions 页面运行一次 **Update and deploy**，等待完成后通过 Pages 页面显示的网址访问。
5. iPhone 用 Safari 打开网址，点分享按钮 →「添加到主屏幕」。

工作流每小时尝试更新，也可在 Actions 中手动运行。定时任务可能延迟或失败，网页会显示数据更新时间。公开仓库的 Pages 内容是公开的，请勿放入秘密信息。平台免费额度和政策可能发生变化。

## 数据与配置

- 天气：默认杭州，由 GitHub Actions 定时请求 [Open-Meteo](https://open-meteo.com/) 并随页面发布；更新失败时显示上次成功的数据和时间。切换其他城市时浏览器直接请求接口，选择保存在当前浏览器。预报降雨/降温提示是简单计算结果，**不是官方气象预警**；请保留官方预警通知。
- 新闻：默认使用 Google News RSS 搜索结果，链接指向原始条目。来源、排序及可访问性受服务商影响。`config.json` 的 `feeds` 可替换为其他允许使用的 RSS/Atom 源。更新失败时页面保留上次成功的新闻，并提示失败；首次运行失败则对应栏目为空。
- 本地栏目取决于配置的城市和可用新闻源；不输入城市时会显示配置提示。
- 日期按上海时间显示；网页无需定位权限和账号。

## 配置 AI 摘要

摘要在 GitHub Actions 中生成，手机不直接调用模型。默认使用 MiniMax 国内平台的 `MiniMax-M3` 和 `https://api.minimax.cn/v1/chat/completions`，请求时关闭可选的 thinking。调用可能产生费用，免费额度及价格以 [MiniMax 官方价格](https://platform.minimaxi.com/docs/pricing/overview)及账户实际额度为准。在仓库 Settings → Secrets and variables → Actions 中配置：

1. 在 **Secrets** 新增 `LLM_API_KEY`：MiniMax API 密钥（不要提交到仓库）。
2. 在 Actions 中手动运行 **Update and deploy**。

可选：在 **Variables** 设置 `LLM_API_URL` 和 `LLM_MODEL` 覆盖默认值。国际平台的接口为 `https://api.minimax.io/v1/chat/completions`，密钥需与对应平台匹配。其他 OpenAI 兼容服务也可通过这两个变量配置。

每次运行最多请求 20 条，已成功的摘要随数据缓存复用；未配置、生成失败或超出本次限额的条目会显示状态，并在后续运行时重试。摘要需要订阅源提供足够的文章内容；Google News 的 RSS 通常只有标题及相关报道链接，因此这些条目会显示内容不足。可以在 `config.json` 中改用提供正文或较完整摘要、允许使用的 RSS 源。程序不会凭标题编造细节，也不会绕过付费墙。新闻材料会发送给你选择的模型服务商，生成的摘要会发布到公开网页。源内容仅用于生成，不写入公开页面数据；已生成的摘要可能有误，请以来源为准。

## 本地生成与预览

需要 Python 3.9 或以上，无第三方依赖：

```sh
python3 scripts/update.py
python3 scripts/summarize.py
python3 scripts/weather.py
python3 -m http.server 8000
```

打开 `http://localhost:8000`。`data/news.json` 是生成文件，工作流构建时自动生成；本地可重复运行更新。第三方源可能不可用，参见生成结果中的状态信息。
