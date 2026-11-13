# 類似 OSS との比較

gawa と似た発想の WebView ⇔ ネイティブブリッジ OSS を調査し、比較したメモ（2026-11 時点）。

gawa の特徴:

- 純ネイティブ（Swift / Kotlin）まで型が付く request / reply RPC とイベント（TypeScript のメソッドマップ、Codable、kotlinx.serialization）
- 新しい API を使う: iOS `WKScriptMessageHandlerWithReply` / Android `WebViewCompat.addWebMessageListener`
- バンドルしたファイルを実 origin から配信（`WKURLSchemeHandler` / `WebViewAssetLoader`）し、origin を検査
- ランタイム・プラグイン機構・CLI なし。既存アプリの WebView に後付けできる

## 比較表

「旧 handler」は返り値を直接返せない `WKScriptMessageHandler` のこと（返り値は `evaluateJavaScript` で別途送り返す）。

| | 型 | iOS の通信 | Android の通信 | ファイル配信 / origin 検査 | 既存アプリに後付け | 保守状況 |
|---|---|---|---|---|---|---|
| **gawa** | TS・Codable・kotlinx | WithReply | addWebMessageListener | ◯ / ◯ | ◯ | — |
| **Capacitor** | TS のみ（ネイティブ側は辞書） | 旧 handler + evaluateJS | addWebMessageListener（origin 規則あり） | ◯ / Android のみ確認 | 不明（フレームワーク） | 活発・約 17k★ |
| **Hotwire Native** | iOS の応答は Codable | 旧 handler | addWebMessageListener + 独自の origin 判定 | ✕ / ◯ | 単独で使えるかは不明 | 活発 |
| **Tauri v2 mobile** | 手で `invoke<T>` を指定（Rust は serde） | `ipc://` への fetch | `window.ipc.postMessage` | ◯ / capabilities で許可制 | ✕ | 活発・約 113k★ |
| **metabridge** | JSON Schema から 3 言語の型を生成 | 利用者が実装 | 利用者が実装 | ✕ / ✕ | ◯（通信路は自前） | 低速 |
| **Kamome** | TS 定義のみ（ネイティブ側は辞書） | 旧 handler | addJavascriptInterface | ✕ / ✕ | ◯ | 活発・約 39★ |
| **gronxb/webview-bridge** | tRPC 風に型を共有 | RN | RN | ✕ / ✕ | React Native 専用 | 活発・約 451★ |
| **safe-webview-bridge** | スキーマで型を共有 | RN | RN | ✕ / 許可 origin の指定が必須 | React Native 専用 | 活発 |
| **STMScriptMessageHandler** | なし | WithReply | — | ✕ / ✕ | ◯（iOS のみ） | 2023 年で停止 |
| **native-web-bridge** | 名ばかり（`any`） | 旧 handler | addJavascriptInterface | ✕ / ✕ | ◯ | 2026 年 5 月に集中して公開 |
| **@webviewkit/bridge** | TS（アプリのバージョン別に型） | 利用者が実装 | 利用者が実装 | ✕ / ✕ | Web 側のみ | 2024 年で停止 |
| **nrkno/nativebridge** | iOS のみ Codable | 旧 handler | addJavascriptInterface | ✕ / ✕ | ◯ | ほぼ停止 |
| **WebViewJavascriptBridge** | なし | iframe ハック | （非公式 fork のみ） | ✕ / ✕ | ◯ | 停止・約 14k★ |
| **WKBridge** | なし | 旧 handler | — | ✕ / ✕ | ◯（iOS のみ） | 2019 年で停止 |
| **lepont** | 呼び出しごとのジェネリクスのみ | RN | RN | ✕ / ✕ | React Native 専用 | 休眠 |

## 個別メモ

### フレームワーク系

- **[Capacitor](https://github.com/ionic-team/capacitor)**（Ionic, MIT）: 範囲が最も重なる。iOS は `WKURLSchemeHandler` で `capacitor://localhost`、Android は独自の `WebViewLocalServer` で既定 `https://localhost` から配信。Android は `addWebMessageListener` に origin 規則を渡し、mainFrame のみ受け付け、非対応環境では `addJavascriptInterface` にフォールバック。iOS 側は旧 handler で、メッセージ受信時の origin 検査は確認できなかった。型は TS の interface を手書きして `registerPlugin<T>()` に渡し、ネイティブ側は `CAPPluginCall` から辞書で値を取り出す。CLI・プラグイン機構・専用の ViewController / Activity を持つ重量級。
- **[Hotwire Native](https://github.com/hotwired/hotwire-native-bridge)**（37signals, MIT）: Stimulus の `BridgeComponent` によるコンポーネント / イベント指向。iOS は `reply(to:with: Encodable)` で Codable に対応。Android は `addWebMessageListener(name, setOf("*"))` で受け、自前で mainFrame と信頼 origin を判定。リモートのサーバー描画アプリが前提で、ファイル配信はない。メソッド単位の型マップもない。
- **[Tauri v2 mobile](https://github.com/tauri-apps/tauri)**（Apache-2.0/MIT）: `invoke<T>` は Promise を返し、Rust の `Result::Err` で reject される。iOS は `tauri://localhost`、Android は `http://tauri.localhost`（設定で https）。capabilities / permissions でコマンドを許可制にできる。Rust コアと CLI が必須で、既存アプリへの後付けは想定していない。

### 型付きのネイティブ向けブリッジ

- **[daangn/metabridge](https://github.com/daangn/metabridge)**（Karrot）: JSON Schema から CLI で TS・Swift・Kotlin の型を生成する。TS は型付き SDK まで出るが、Swift / Kotlin は型クラスとメソッド名の enum のみで、ルーターや WebView 接続は生成されない。通信路は利用者が `MetaBridgeDriver` として実装する。gawa とは競合というより組み合わせられる関係。リポジトリに LICENSE ファイルがない。
- **[native-web-bridge](https://www.jsdelivr.com/package/npm/native-web-bridge)**（MIT）: npm パッケージに TS・Swift・Kotlin を同梱。汎用の `request<T>(action: string, payload?: any)` は型付けが弱く、ネイティブ側も `[String: Any]`。Android は `addJavascriptInterface` で origin 検査がないため、どのページからでも呼べる。バッテリー・位置情報などの組み込み機能が多い全部入り型。GitHub のリポジトリは不明。
- **[@webviewkit/bridge](https://github.com/minai621/webviewkit)**（MIT）: Web 側 TS のみで、ネイティブ実装はない。メソッドごとにアプリの semver 別の引数・戻り値の型を持てる。ネイティブからの `message` イベントで origin を検証しない。

### 軽量・古い世代のブリッジ

- **[Kamome](https://github.com/HituziANDO/kamome)**（MIT）: 純ネイティブ向けの軽量ライブラリでは最も近い。`KM.send()` が Promise を返し、ネイティブ → Web の呼び出しも可能。`KamomeError`（`RequestTimeout` / `Rejected` / `Canceled`）と呼び出しごとのタイムアウトがある。ネイティブ側は辞書 / JSONObject で型なし、README の例は `file://` での読み込み。
- **[STMScriptMessageHandler](https://github.com/DouKing/STMScriptMessageHandler)**: iOS（Obj-C）のみだが、gawa と同じく `WKScriptMessageHandlerWithReply` を使う。型なし。WebViewJavascriptBridge 互換モードあり。
- **[nrkno/nativebridge](https://github.com/nrkno/nativebridge)**（NRK, MIT）: topic + イベントバス型。iOS は Codable で topic ごとに型付けするが、JS 側に TS 定義はない。RPC はコールバック式でタイムアウトあり。
- **[WebViewJavascriptBridge](https://github.com/marcuswestin/WebViewJavascriptBridge)**（MIT）: この分野の古典。隠し iframe の URL を `decidePolicyForNavigationAction` で横取りする方式。型・エラーモデル・公式 Android 対応なし。
- **[WKBridge](https://github.com/lovesunstar/WKBridge)**（MIT）: iOS のみ、`[String: Any]` のコールバック式。

### React Native 向け

- **[gronxb/webview-bridge](https://github.com/gronxb/webview-bridge)**（MIT）: tRPC 風に RN 側の `bridge({...})` の型を web 側へ export して共有し、Standard Schema（Zod / Valibot / ArkType）で実行時検証もできる。`MethodNotFoundError`、タイムアウト、共有 state あり。origin 検証なし。
- **[safe-webview-bridge](https://www.npmjs.com/package/safe-webview-bridge)**（MIT）: 方向ごとの Standard Schema メッセージマップを型として共有。RN 側に `allowedOrigins`（完全一致）の指定が必須で、外れると `untrusted_origin`。片方向メッセージのみで、返り値付き RPC はない。
- **[kt3k/lepont](https://github.com/kt3k/lepont)**（MIT）: `react-native-webview` 上の小さなブリッジとプラグイン群。`register<T>` / `sendMessage<T>` のジェネリクスのみ。2022 年以降休眠。

## まとめ

「純ネイティブまで型付き」「新しい API（WithReply / addWebMessageListener）」「実 origin での配信と origin 検査」「後付けできる」を同時に満たすものは、調べた範囲にはなかった。

- 設計が最も近いのは Capacitor と Hotwire Native（Android 側の `addWebMessageListener` と origin 規則）。ただしどちらもフレームワークの一部で、ネイティブ側にメソッド単位の型はない。
- 軽量ライブラリでは Kamome が最も近いが、ネイティブ側は型なしで通信方式も古い。
- 型の共有に本気なのは metabridge（スキーマ生成）と RN 系（gronxb、safe-webview-bridge）。

gawa に取り入れられそうなもの:

- metabridge のようなスキーマからの型生成
- gronxb / safe-webview-bridge のような Standard Schema による実行時検証

## 調査上の注意

- capacitorjs.com などの公式ドキュメントには接続できず、Capacitor は npm で公開されているソースから確認した。既存アプリへの組み込み可否と iOS 側の origin 検査は未確認。
- スター数は概数。
