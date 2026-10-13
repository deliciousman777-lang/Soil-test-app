# SoilNote 共有データベース設定

SoilNote は端末内保存を残したまま、Supabase を使って複数人で工事データを共有できます。

## 構成

- Supabase Auth: 各利用者のメールアドレス＋パスワード認証
- `workspaces`: 会社・試験室ごとの共有スペース
- `workspace_members`: 共有メンバー
- `projects`: 工事件名1件を1レコードとして保存（試験データは JSONB）
- RLS: 共有スペースのメンバーだけ閲覧・編集可能
- Realtime: 別端末の更新を自動反映
- localStorage: 圏外時・未設定時も従来どおり端末保存

## 初回セットアップ

1. Supabase でプロジェクトを作成する。
2. SQL Editor で `supabase-schema.sql` を実行する。
3. Project URL と Publishable key を確認する。
4. `supabase-config.js` に次の2項目だけ設定する。

```js
window.SOILNOTE_SUPABASE = {
  url: 'https://YOUR_PROJECT.supabase.co',
  publishableKey: 'YOUR_PUBLISHABLE_KEY'
};
```

**service_role key は絶対にブラウザ側へ入れないこと。**

## 使い方

1. SoilNote の「端末保存 / データ共有」ボタンを開く。
2. 吉村さん側で初回登録・ログインする。
3. 「土質試験室」などの共有スペースを作成する。
4. 表示された8桁の共有コードを後輩へ伝える。
5. 後輩も自分のメールアドレスで初回登録・ログインする。
6. 共有コードを入力して参加する。
7. 以後、保存した工事件名・試験データが両端末で同期される。

## データ移行

既存の端末データは削除しません。最初のクラウド同期時に、端末側とクラウド側を `updatedAt / createdAt` で比較し、新しい方を採用します。クラウドに存在しない端末データはアップロードされます。

## 削除

工事件名を通常の「削除」ボタンから削除した場合、共有中はクラウド側の同じ工事も削除します。

## 将来拡張

利用人数や同時編集が増えたら、現在の「工事単位 JSONB」から「試験単位テーブル」へ段階的に正規化できます。現在の設計は最初の2〜数名での共有を短期間で安全に開始するための構成です。
