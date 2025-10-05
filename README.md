# ポモドーロタイマー拡張機能

集中力向上のためのポモドーロタイマーとソーシャルメディアブロック機能を同時に提供するブラウザ拡張機能です。

## 概要

この拡張機能は、ポモドーロテクニックを使用して作業の集中力を向上させることを目的としています。
タイマー機能に加えて、作業中に気が散る原因となるソーシャルメディアサイトを自動的にブロックします。

### 主な機能

- **ポモドーロタイマー**: 5 分~300 分の範囲で時間を設定し、25 分の作業時間と 5 分の休憩時間の経過を通知します。
- **新しいタブ置き換え**: 上記タイマーは「新しいタブ」で表示されます。
- **サイトブロック機能**: 作業中に YouTube、Twitter、Facebook、Instagram、Pixiv などのサイトをブロックします。
- **状態保持**: ブラウザを閉じた場合、経過時間は保持され、ブラウザを再び開くとカウントを再開します。

### 技術仕様

- **対応ブラウザ**: Chrome（Manifest V3対応）
- **必要な権限**: storage, tabs, notifications, alarms, declarativeNetRequest
- **フレームワーク**: Vanilla JavaScript（ES6 Modules）

## 使用方法

1. 新しいタブを開くとポモドーロタイマーが表示されます
2. タイマーの時間を設定（5分〜300分）
3. 「開始」ボタンでタイマーを開始
4. 作業中は指定されたサイトが自動的にブロックされます
5. タイマー終了時に通知が表示されます

## インストール方法

### Chrome での手動インストール

1. ブラウザで `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」をクリックする
4. このプロジェクトのルートディレクトリを選択する
5. 拡張機能が追加されたことを確認する

## 開発環境のセットアップ

### 前提条件

- Node.js (v16以上推奨)
- npm

### セットアップ手順

1. リポジトリをクローン
```bash
git clone <repository-url>
cd pomodoro-new-tab
```

2. 依存関係をインストール
```bash
npm install
```

3. 開発用スクリプト
```bash
# テスト実行
npm test

# テスト（ウォッチモード）
npm run test:watch

# ESLintでコードチェック
npm run lint

# ESLintで自動修正
npm run lint:fix

# Prettierでコードフォーマット
npm run format
```

## プロジェクト構造

```
pomodoro-new-tab/
├── src/
│   ├── background/          # バックグラウンドスクリプト
│   │   ├── index.js         # メインのサービスワーカー
│   │   ├── events.js        # イベントハンドラー
│   │   ├── notification.js  # 通知機能
│   │   ├── setup-alarms.js  # アラーム設定
│   │   ├── sites-guard.js   # サイトブロック機能
│   │   └── timer-store.js   # タイマー状態管理
│   ├── ui/                  # ユーザーインターフェース
│   │   ├── ui.html          # メインHTML
│   │   ├── ui.js            # UI制御JavaScript
│   │   ├── ui.css           # スタイルシート
│   │   ├── bg-client.js     # バックグラウンドとの通信
│   │   └── timer-ticker.js  # タイマー表示制御
│   ├── __test__/            # テストファイル
│   ├── constants.js         # 定数定義
│   └── timer-state.js       # タイマー状態管理
├── manifest.json            # 拡張機能マニフェスト
├── package.json             # Node.js設定
└── README.md               # このファイル
```

### ブロックされるサイト

作業中は以下のサイトが自動的にブロックされます：

- YouTube
- ニコニコ動画
- Twitter/X
- Facebook
- Instagram
- Pixiv
- Reddit
- TikTok
- 小説家になろう

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。詳細は[LICENSE](LICENSE)ファイルを参照してください。

## バグ報告・機能要望

問題を発見した場合や新機能の要望がある場合は、GitHubのIssuesページで報告してください。
