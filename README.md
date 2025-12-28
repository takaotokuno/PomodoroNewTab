# 🍅 Pomodoro BlockSite Timer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue.svg)](https://chrome.google.com/webstore)
[![Node.js](https://img.shields.io/badge/Node.js-v16+-green.svg)](https://nodejs.org/)

> 🎯 集中力向上のためのポモドーロタイマーとソーシャルメディアブロック機能を提供するブラウザ拡張機能です。

## 📖 概要

ポモドーロテクニックを使用して作業の集中力を向上させる拡張機能です。タイマー機能に加えて、作業中に気が散る原因となるソーシャルメディアサイトを自動的にブロックします。

## ✨ 主な機能

| 機能 | 説明 |
|------|------|
| 🍅 **ポモドーロタイマー** | 5分〜300分の範囲で時間を設定可能 |
| 🆕 **新しいタブ置き換え** | タイマーが新しいタブページに表示 |
| 🚫 **サイトブロック機能** | 作業中にソーシャルメディアサイトを自動ブロック |
| 💾 **状態保持** | ブラウザを閉じても経過時間を保持し、再開時にカウント継続 |

## 🛠️ 技術仕様

| 項目 | 詳細 |
|------|------|
| **対応ブラウザ** | Chrome, Edge（Manifest V3対応） |
| **必要な権限** | `storage`, `tabs`, `notifications`, `alarms`, `declarativeNetRequest` |
| **フレームワーク** | Vanilla JavaScript（ES6 Modules） |
| **ビルドツール** | esbuild |

## 🏪 リリース版のインストール

> [!WARNING]
> Chrome Web Storeからのインストールは準備中です。

Chrome Web Storeからインストール予定（準備中）

## 🔧 開発版のインストール

| 要件 | バージョン |
|------|------------|
| Node.js | v16以上推奨 |
| npm | 最新版 |

> [!NOTE]
> 開発版をインストールする場合は、以下の手順に従ってください。

1. **リポジトリをクローン**
   ```bash
   git clone <repository-url>
   cd pomodoro-new-tab
   ```

2. **依存関係をインストール**
   ```bash
   npm install
   ```

3. **拡張機能をビルド**
   ```bash
   npm run build
   ```

4. **Chromeで手動インストール**
   - ブラウザで `chrome://extensions/` を開く
   - 右上の「デベロッパーモード」を有効にする
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `dist/latest` ディレクトリを選択
   - 拡張機能が追加されたことを確認

## 📁 プロジェクト構造

```
pomodoro-new-tab/
├── src/               # ソースコード
│   ├── background/    # バックグラウンドスクリプト
│   ├── ui/            # ユーザーインターフェース
│   └── __test__/      # テストファイル
├── dist/              # ビルド出力
│   └── latest/        # 最新ビルド
├── scripts/           # ビルド・デプロイスクリプト
├── manifest.json
├── package.json
└── README.md
```

## 🚫 ブロックされるサイト

> [!IMPORTANT]
> 作業中は以下のサイトが自動的にブロックされます

| カテゴリ | サイト |
|----------|--------|
| 🎥 **動画** | YouTube, ニコニコ動画, TikTok |
| 📱 **SNS** | Twitter/X, Facebook, Instagram |
| 🎨 **エンタメ** | Pixiv, Reddit |
| 📚 **小説** | 小説家になろう |

## 🐛 バグ報告・機能要望

> [!TIP]
> 問題を発見した場合や新機能の要望がある場合は、GitHubのIssuesページで報告してください。

## 📄 ライセンス

このプロジェクトは**MITライセンス**の下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## 🙏 謝辞

このプロジェクトの開発には**AI支援ツール**を部分的に使用しています。

---

<div align="center">
**🍅 集中して、生産性を向上させましょう！**
</div>