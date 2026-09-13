# 全專案程式碼審查報告

日期：2026-09-09
範圍：應用程式、路由與資料模型、資料產生腳本、測試、建置、持續整合（CI）、容器及部署設定
基準：`main`，提交 `df3ccee`

## 結論

專案整體分層清楚，路由與資料處理沒有耦合 React 或 Three.js，TypeScript 嚴格檢查、資料來源可追溯性、決定性產物驗證及測試覆蓋率均屬良好。審查未發現重大（critical）或高嚴重度安全問題，但確認 4 項重要的正確性、驗證或診斷問題，以及 2 項改善項目。

建議合併判定：**需修改（Request changes）**。優先修正 F-01 至 F-03，再處理 F-04 至 F-06；重構項目可分批進行，毋須阻擋修正。

## 優先級與證據判讀

- **P1／阻擋：** 會造成安全問題、資料損壞、錯誤路由，或使核心功能無法使用；修正前不得發佈。
- **P2／重要：** 已確認的行為、驗證或診斷錯誤，但目前沒有證據顯示會損壞資料或造成高風險安全影響；應在下一個正常修正週期完成。
- **P3／改善：** 低可達性風險、測試維護或非阻擋工程改善。

本報告中的「確認」表示已由 repository 內的程式碼、測試或本機命令直接驗證；「推論」表示根據已驗證事實作出的判斷，並會明確標示，不能視為已證明的事實。依此定義，F-01 至 F-04 為 P2，F-05 至 F-06 為 P3。

## 已驗證結果

| 檢查 | 結果 | 備註 |
| --- | --- | --- |
| `npm run lint` | 通過 | 無 ESLint 錯誤 |
| `npm test` | 通過 | 42 個測試檔、188 個測試 |
| `npm run test:coverage` | 單獨重跑通過 | statements 88.97%、branches 78.38%、functions 98.61%、lines 97.70% |
| `npm run build` | 通過 | Vite 對 718.13 kB 的 `three` chunk 提示超過通用 500 kB 建議值 |
| `npm run release:verify` | 通過 | 17 個發佈檔、共 9.48 MB；A* 平均 6.019 ms/route；最大 JS 低於專案 1 MB 上限 |
| `npm run audit:prod` | 依專案門檻通過 | 仍有 1 項 moderate 弱點，詳見 F-06 |
| `npm run test:e2e` | 未能執行 | 本機為 macOS 12；Playwright 1.62 不支援在此平台安裝 Chromium，且沒有系統 Chrome/Chromium。14 個案例均在瀏覽器啟動前停止，不能據此判定案例通過或失敗 |
| `npm run data:inspect` / `npm run data:check` | 不適用 | 本機沒有忽略追蹤的原始 `shapefile/` 套件，依專案規則未嘗試重建或修改原始資料 |

## 階段 0 基準（2026-09-12）

| 檢查 | 結果 | 備註 |
| --- | --- | --- |
| `npm run build` | 通過 | 最大 JavaScript chunk 718.13 kB（gzip 185.59 kB）；仍有 Vite 的通用 500 kB 提示 |
| `npm run lint` | 通過 | 無 ESLint 錯誤 |
| `npm test` | 通過 | 42 個測試檔、188 個測試；37.20 秒 |
| `npm run test:coverage` | 通過 | statements 88.97%、branches 78.38%、functions 98.61%、lines 97.70% |
| `npm run release:verify` | 通過 | 17 個發佈檔、共 9.48 MB；A* 平均 2.054 ms/route；最大 JS 718.1 kB，低於 1 MB 預算 |
| `npm run audit:prod` | 依專案門檻通過 | 仍回報 F-06 所述的 1 項 moderate `fflate` advisory；第一次受限環境執行因 npm registry DNS 失敗，受控網路重跑後取得此結果 |

本機沒有 `shapefile/`，故依專案規則未執行 `npm run data:inspect` 或 `npm run data:check`。上述可用基準命令沒有產品程式碼或測試失敗；npm registry DNS 失敗屬執行環境的傳輸問題，已由成功的受控網路重跑排除，不能歸因於本修正計畫。

## 審查發現

### F-01 — P2：有效路線存在時，單樓層模式仍強調全部路線樓層

位置：`src/map/viewerPresentation.ts:10-20`、`src/hooks/useViewerNavigation.ts:109-119`、`tests/stacked-elevation.test.ts:26-34`

`selectFloor()` 會把 `floorViewMode` 設為 `focused`，但不會清除有效路線所產生的 `routeFloorIds`。`partitionVisibleFloors()` 卻只要 `routeFloorIds` 非空便先採用所有路線樓層，完全略過 `focused` 模式。結果是工具列顯示使用者已選定單一樓層，場景仍以完整細節強調路線經過的所有樓層，狀態與畫面不一致。

現有測試只涵蓋 `focused` 且 `routeFloorIds` 為空的情況，因此沒有捕捉此組合。

建議：先按 `floorViewMode` 分支；只有 `route` 模式使用 `routeFloorIds`，`focused` 模式只使用 `activeFloor`。新增「有效路線 + focused」單元測試及一次控制列整合測試。

### F-02 — P2：圖形驗證器的連通元件計算會受單向邊及 `graph.nodes` 巡覽順序影響

位置：`src/graph/validateGraph.ts:32-54`、`tests/routing.test.ts:13-37`；正確的無向參考實作見 `scripts/import-official-network.ts:80-96`

`validateGraph()` 以路由用的有向 `graph.adjacency` 做深度優先搜尋，卻把結果命名為 connected components。對 `A -> B` 而言，若 `graph.nodes` 先巡覽 B，便可能把原本同一個弱連通元件計成兩個；這既不是弱連通元件，也不是強連通元件，且結果會受 `graph.nodes` 巡覽順序影響。

影響目前主要在診斷報告，不會直接改變 A* 路由，但可能錯報斷裂網路並誤導資料審核。現有 fixture 恰好由可到達的起點開始，未覆蓋反向節點順序。

建議：明確定義為弱連通元件，從 `graph.edges` 建立雙向鄰接表；若產品真正需要強連通性，另以 Tarjan 或 Kosaraju 演算法回報。加入只有單向邊且節點反序的回歸測試。

### F-03 — P2：執行期 named-places 驗證未落實路由安全不變量及統計一致性

位置：`src/schema/processed.ts:313-365`、`src/routing/routeService.ts:38-44`、`scripts/build-named-places.ts:303-315`

資料產生規則明確寫明「低信心（low-confidence）的自動附著點不可路由」，但 `parseNamedPlaces()` 只確認 `routable` 是 boolean，沒有驗證 `access.confidence === 'low' && access.reviewStatus === 'automatic'` 時必須為 `false`。`planRoute()` 隨後只信任 `routable`，因此經竄改、手動編輯或版本不一致的資料可讓低信心自動附著點進入路由。

同一解析器只重算 `placeCount`；`routablePlaceCount` 與 `uniqueNameCount` 只驗證為整數，`attachmentConfidenceCounts` 與 `componentCounts` 只驗證為物件。這四項都沒有從 `places` 重算並比較，因此錯誤統計仍會被接受。這與架構文件所述的執行期資料邊界不一致。

建議：在解析後集中執行跨欄位不變量檢查，並從 `places` 重算及逐欄比較所有統計。為低信心自動附著、人工覆核低信心、錯誤統計及未知 component 加入負向測試。

### F-04 — P2：以 `JSON.stringify` 比較物件，使語意相同的 JSON 因屬性順序不同而被拒絕

位置：`src/schema/placeTranslations.ts:148-160`、`src/schema/reviewedCustomNetwork.ts:80-90`

JSON 物件的屬性順序不具語意，但兩個解析器以序列化字串判斷 `sourceCounts` 或 `coordinateSystem` 是否相同。只要生產者以不同順序輸出完全相同的鍵值，驗證便會失敗。現有受控產物順序固定，因此目前檔案可載入；問題存在於公開的執行期驗證邊界。

建議：逐一比較必要欄位及值，或以排序後的 `Object.entries()` 比較。加入重排屬性後仍應通過的測試，以及缺少鍵、額外鍵或值不同時應失敗的測試。

### F-05 — P3：完整網路正確性測試使用固定 20 秒牆鐘門檻，負載下會不穩定

位置：`tests/human-golden-route.test.ts:46-57`

此測試對最多 32 × 32 個端點組合各自執行 A* 與 Dijkstra，並把正確性斷言和 20 秒 timeout 綁在一起。原審查與其他建置工作並行時曾超時；2026-09-12 的獨立唯讀驗證單獨重跑則在 3.429 秒通過。因此確認的是負載敏感風險，尚無證據顯示標準 CI 必然失敗。

建議：用決定性的代表性端點集合做正確性測試，將完整矩陣移至獨立效能測試；或至少依 CI 資源調高 timeout。效能退化應由 `benchmarkRoute` / `release:verify` 的明確預算偵測，而不是讓功能測試依賴牆鐘時間。

### F-06 — P3：生產相依鏈包含一項 moderate 的 `fflate` 弱點

位置：`package-lock.json`（`three-stdlib` → `fflate`）

此 advisory 的內容來自 2026-09-09 執行的 `npm audit --omit=dev`：`fflate` 0.6.0–0.6.10 的 GHSA-px8p-9vwx-vf98 指出惡意 ZIP64 資料可能造成無限迴圈。專案目前的 `audit:prod` 只在 high 或以上失敗，所以命令仍通過。

目前程式碼沒有處理使用者提供 ZIP 的路徑，因此判斷實際可達性偏低；這是根據程式碼與相依鏈作出的推論，不等同於已證明不可達。

建議：更新可帶入修正版 `fflate` 的上游套件／鎖定檔，並在無法立即升級時於相依風險紀錄中註明不可達理由及重新檢查日期。

## 結構與重構建議

以下項目未證明為目前缺陷，應在上述正確性問題之後處理。

1. **縮小 UI 組裝介面。** `FloorViewer.tsx:89-234` 同時負責資料衍生、路由、顯示偏好、相機、互動訊息與大量 prop 接線；`ViewerControlsProps` 在 `src/components/ViewerControls.tsx:18-74` 有五十多個欄位。建議按 `planner`、`navigation`、`display` 建立具名 view model，讓組裝層傳遞少量高內聚物件，並保持 domain hooks 不依賴 React 元件。

2. **拆分 Three.js 場景層。** `src/map/MapScene.tsx` 約 436 行，混合幾何建立、材質／GPU 資源生命週期、網路與路線圖層、設施標記及彈出 UI。建議按 floor/space/fixture/network/route/marker 拆成渲染層，將純幾何函式移至可單測模組。現有 `useMemo` 與 `dispose()` 應保留；先 profile，再決定是否快取按樓層與樣式建立的不可變幾何。

3. **統一設施類別的單一事實來源。** `src/data/indoorMapCategories.ts` 已有 `destinationEligible`，但 `scripts/build-named-places.ts:21-25` 另維護 `FACILITY_PLACE_CATEGORIES`。目前產物一致，未發現遺漏；未來新增 eligible 類別時仍可能被 mapping 靜默排除。建議把 named-place category 納入正式 registry，或加入測試要求所有公開且 eligible 的 Facility 類別都有明確 mapping／排除理由。

4. **預先建立雙語搜尋索引。** `src/features/route-planner/placeSearch.ts:17-41` 每次輸入都重新正規化每個地點的所有名稱；`src/components/ViewerControls.tsx:169-171` 又對每個可見選項執行 `findIndex`。現有 584 個地點，暫非瓶頸；建議以 places/translations 為鍵 memoize 搜尋文件，並建立 `id -> index` map，避免日後資料量成長時退化。

5. **讓日文 SEO 頁面採結構化產生。** `vite.config.ts:7-22` 依賴一串精確字串取代。現有 release 驗證會檢查主要輸出，但 HTML 文案或格式改動容易留下局部英文。建議使用共用模板資料產生兩個頁面，或以 HTML-aware 轉換取代脆弱的字串鏈。

6. **補齊非模態（non-modal）設定對話框的鍵盤行為。** `src/components/MapToolbar.tsx:127-148` 有正確的 dialog label 與關閉按鈕，但未處理 Escape、開啟後初始焦點及關閉後焦點還原。建議補齊這三項及對應 Testing Library／Playwright 測試；因為是非模態對話框，不應強制焦點鎖定（focus trap）。

7. **追蹤 bundle 預算而非只接受警告。** `three` chunk 為 718.13 kB（gzip 185.59 kB），仍低於專案 1 MB 限制，但 Vite 已提示超過通用門檻。建議把 gzip 大小與初始載入路徑一併記錄；只有實際啟動效能不達標時，再評估更細的 dynamic import 或移除未用的 Drei/Three 匯入。

## 建議執行順序

1. 修正 F-01、F-02，加入最小回歸測試。
2. 強化 named-places 與物件相等驗證（F-03、F-04）。
3. 將路由全矩陣測試與功能測試拆開（F-05）。
4. 更新或記錄 `fflate` 風險（F-06）。
5. 以小型 PR 逐步完成 UI 組裝、MapScene、類別 registry 與搜尋索引重構。

## 審查限制

- 本報告以 repository 內的程式碼、文件、鎖定檔及可在本機執行的驗證為一手依據，未使用次級網路來源。
- 未取得本機專用原始 shapefile，因此沒有重新產生資料；已檢查已提交的處理後資料、產生器與驗證流程。
- 端對端測試受 macOS 12／Playwright 瀏覽器支援限制，需以支援的 macOS、Linux CI 或專案既有 GitHub Actions browser job 補驗。
- 除新增本報告外，沒有修改產品程式碼或資料產物。

## 修正與重構執行狀態（2026-09-13）

本節保留原始發現作為審查脈絡，並記錄其後已完成的修正；不以本節改寫或刪除上方的歷史證據。各項變更均有測試先行證據，詳細命令結果與仍待外部環境執行的項目見 `docs/CODE_REVIEW_FIX_PLAN.md` 的 execution ledger。

| 項目 | 狀態 | 實作與對應測試 |
| --- | --- | --- |
| F-01 | 已修正 | `src/map/viewerPresentation.ts` 先依 floor view mode 決定強調樓層；`tests/stacked-elevation.test.ts` 與 `tests/viewer-controls.test.tsx` 鎖定 active route 下的 focused、route、stack、custom 行為。 |
| F-02 | 已修正 | `src/graph/validateGraph.ts` 從 edges 建立局部雙向 adjacency，輸出弱連通元件並在排序後重新編號；`tests/graph-validation.test.ts` 驗證 B,A 節點順序、A→B 單向邊與重排決定性。 |
| F-03 | 已修正 | `src/schema/processed.ts` 拒絕 automatic + low + routable，並由 places 重算五項 statistics；`tests/processed-schema.test.ts` 覆蓋 reviewed low 與統計鍵、值、額外鍵及不一致資料。 |
| F-04 | 已修正 | `src/schema/placeTranslations.ts`、`src/schema/reviewedCustomNetwork.ts` 改為逐欄語意驗證；`tests/place-translations.test.ts`、`tests/reviewed-custom-network.test.ts` 覆蓋鍵重排、缺鍵、額外鍵、錯型與非有限值。 |
| F-05 | 已修正 | `tests/human-golden-route.test.ts` 保留 A*/Dijkstra oracle，改以決定性代表集合覆蓋同樓層、跨樓層、方向性與可達性，並連續執行驗證，不再把一般正確性綁定自訂 20 秒 timeout。 |
| F-06 | 已修正 | `package-lock.json` 已更新受影響的上游相依；以 `npm audit --omit=dev`、`npm ls fflate` 與 production audit 驗證，沒有採用無證據的 transitive override。 |
| R1 | 已完成 | `src/data/indoorMapCategories.ts` 的明確 destination policy registry 成為單一決策來源；`tests/facility-destination-categories.test.ts` 要求每個 destination-eligible 類別有 mapping 或明確 exclusion（包括 F038）。 |
| R2 | 已完成 | `src/features/route-planner/placeSearch.ts` 提供 immutable bilingual search index 與 `id -> index`；`src/components/ViewerControls.tsx` 在 composition 層依 places/translations identity 建一次並共用；`tests/place-search-index.test.ts` 鎖定查詢與排序。 |
| R3 | 已完成 | `src/components/viewerViewModels.ts` 將 planner、navigation、display、feedback、legend 組成具名 readonly contracts，`FloorViewer` 與子控制項只接收所需群組。 |
| R4 | 已完成 | `src/map/sceneGeometry.ts` 承擔純幾何／選擇；`sceneLayers.tsx`、`sceneLinePrimitives.tsx`、`sceneMarkerLayers.tsx` 承擔高內聚渲染層，`MapScene` 保留 composition 與資源生命週期；`tests/scene-geometry.test.ts` 佐證純邊界。 |
| R5 | 已完成 | `src/components/MapToolbar.tsx` 在開啟時聚焦完成按鈕、Escape 關閉並將焦點還原到仍連接的 summary trigger；維持 `aria-modal="false"` 且未加入 focus trap；`tests/viewer-controls.test.tsx` 驗證完整焦點序列。 |
| R6 | 已完成 | `src/seo/staticPage.ts` 用 `SEO_METADATA`、fallback locale 資料與結構化模板生成 `/`、`/ja/`；`tests/static-seo-page.test.ts` 驗證 metadata、JSON-LD、escaping、fallback 與相對資產。 |
| R7 | 已完成 | `scripts/release-budgets.ts` 與 `scripts/verify-deployment.ts` 逐一量測 JS raw/gzip、強制單檔預算並寫入 generated release status；`tests/release-budgets.test.ts` 分別驗證 raw、gzip 超限與正常 artifact fixture。 |

R7 的依賴分析確認：`App` 雖以 `lazy()` 載入 `FloorViewer`，但首屏立即 render 該 boundary，Vite entry 的 dynamic-import dependency map 亦列出 `FloorViewer` 與 `three`。這是由 import graph 與 bundle 輸出得到的推論，而非瀏覽器 waterfall 量測；因此沒有把核心地圖改成更晚載入。
