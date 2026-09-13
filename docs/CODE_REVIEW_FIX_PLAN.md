# 程式碼審查修正計畫與品質閘門

日期：2026-09-12
依據：`docs/CODE_REVIEW_REPORT.md` 及 2026-09-12 的獨立唯讀驗證
範圍：F-01 至 F-06，以及報告列出的七項非阻擋重構建議

## 目標

先以小型、可獨立驗證的變更修正已確認的正確性與資料邊界問題，再處理測試可靠性及相依風險。結構重構必須在行為由測試鎖定後另行分批進行，不與缺陷修正混在同一個 pull request（PR）。

本計畫不授權重建或修改 `shapefile/` 原始資料，也不要求未經擁有腳本產生的手動資料異動。

## 優先級定義

為避免原報告將 P1 誤解為高安全嚴重度，本計畫使用以下定義：

- **P1／阻擋：** 會造成安全問題、資料損壞、錯誤路由，或使核心功能無法使用；修正前不得發佈。
- **P2／重要：** 已確認的行為、驗證或診斷錯誤，但目前沒有證據顯示會損壞資料或造成高風險安全影響；應在下一個正常修正週期完成。
- **P3／改善：** 低可達性風險、測試維護或非阻擋工程改善。

按此定義，F-01 至 F-04 為 P2，F-05 至 F-06 為 P3。若實作時發現低信心資料已進入正式路由，F-03 立即升為 P1，停止其他工作並先修正／重新驗證資料。

## 共通閘門

每個實作階段均須通過以下閘門，才能進入下一階段：

| 閘門 | 放行條件 | 未通過時的處理 |
| --- | --- | --- |
| G0 範圍 | 變更只涵蓋該階段列出的檔案與行為；沒有未解釋的產物差異 | 拆分或移除非必要變更 |
| G1 測試先行 | 至少一個新測試在舊實作上失敗，且失敗原因正是待修問題 | 修正測試，使其驗證外部行為而非實作細節 |
| G2 局部驗證 | 相關測試、TypeScript 與 lint 通過 | 不進入下一階段；先修正回歸 |
| G3 全域驗證 | `npm run build`、`npm run lint`、`npm test`、`npm run test:coverage`、`npm run release:verify` 通過 | 阻擋合併 |
| G4 專項驗證 | 可用時通過 `npm run test:e2e`；資料有變更且原始套件可用時通過 `npm run data:inspect`、`npm run data:check` | 若環境不適用，PR 必須記錄原因與替代 CI 證據 |
| G5 審查 | 沒有新增 React／Three.js 到 graph、routing 或資料處理層；文件與現況一致 | 阻擋合併並調整架構 |

原始 `shapefile/` 不存在時，資料專項命令標為不適用，不得為通過閘門而下載、修改或提交原始 GIS 資料。

## 階段 0：建立基準與校正報告

目的：確保後續差異只來自修正，並消除優先級歧義。

工作：

1. 在 `docs/CODE_REVIEW_REPORT.md` 加入 P1/P2/P3 定義，將 F-01 至 F-04 標為 P2、F-05 至 F-06 標為 P3。
2. 將 F-02 的「受排序影響」修正為「受 `graph.nodes` 巡覽順序影響」。
3. 精確描述 F-03：`routablePlaceCount`、`uniqueNameCount` 只驗整數；兩個 counts 只驗物件；四者均未重算比較。
4. 在 F-05 記錄：原審查並行執行曾超時，獨立驗證單跑通過，因此確認的是負載敏感風險，不是標準 CI 必然失敗。
5. 在 F-06 註明 advisory 內容來自 2026-09-09 的 `npm audit` 結果。
6. 執行現況基準：`npm run build`、`npm run lint`、`npm test`、`npm run test:coverage`、`npm run release:verify`、`npm run audit:prod`。

**Gate A — 基準可採信**

- 報告的優先級、證據與推論已明確區分。
- 所有可用基準命令結果均記錄在 PR。
- 若基準已失敗，先建立獨立問題並確認是否與本計畫有關；不得把既有失敗歸因於新修正。

## 階段 1：修正樓層呈現狀態（F-01）

預計檔案：

- `src/map/viewerPresentation.ts`
- `tests/stacked-elevation.test.ts`
- 視需要更新 `tests/viewer-controls.test.tsx`

實作策略：

1. 先新增 `floorViewMode === 'focused'` 且 `routeFloorIds` 非空的失敗測試。
2. 讓 `partitionVisibleFloors()` 先依 `floorViewMode` 決定語意：
   - `focused`：只強調可見的 `activeFloor`；
   - `route`：只強調 `visibleFloors` 內的路線樓層；
   - `stack`／`custom`：維持各自全部可見樓層的既有呈現語意。
3. 驗證有效路線仍保留，選樓只改變視圖，不清除 route 或 endpoint state。

**Gate B — 樓層模式一致**

- 新測試在修正前失敗、修正後通過。
- `focused + active route`、`route`、`stack`、`custom` 四種模式均有明確測試。
- 工具列選中狀態與 `MapScene` 的 active/context floors 一致。
- 通過 G0 至 G3；可用時以桌面及 mobile Chromium 各驗證一次選樓流程。

## 階段 2：修正圖形連通元件診斷（F-02）

預計檔案：

- `src/graph/validateGraph.ts`
- `tests/routing.test.ts`，或新增專用 `tests/graph-validation.test.ts`

實作策略：

1. 新增最小反例：節點順序為 B、A，只有 `A -> B` 單向邊；預期一個弱連通元件。
2. 由 `graph.edges` 建立局部雙向 adjacency，計算弱連通元件；不要改動路由所使用的有向 `graph.adjacency`。
3. 為決定性輸出排序 component 內的 node IDs，並在排序 components 後重新配置穩定的 component ID，避免 ID 與排序位置不一致。
4. 加入多元件、孤立節點、單向邊及輸入節點反序測試。

**Gate C — 診斷定義正確且決定性**

- 最小反例回報 1 個元件。
- 重排相同 nodes/edges 後，component 的內容與 ID 相同。
- `oneWayEdgeCount`、`isolatedNodeIds` 及路由方向性測試沒有回歸。
- 通過 G0 至 G3。

## 階段 3：強化 named-places 執行期資料邊界（F-03）

預計檔案：

- `src/schema/processed.ts`
- `tests/processed-schema.test.ts`
- 視需要新增 schema 內部的純函式 helper

實作策略：

1. 新增負向 fixture：`confidence: 'low'`、`reviewStatus: 'automatic'`、`routable: true` 必須被拒絕。
2. 明確保留經人工覆核的低信心資料政策：除非產品規格另有決定，不可推論所有 low confidence 均不可路由；測試應鎖定只有 automatic low 被禁止。
3. 從 `places` 重算並精確比較：
   - `placeCount`；
   - `routablePlaceCount`；
   - `uniqueNameCount`；
   - `attachmentConfidenceCounts`；
   - `componentCounts`。
4. 驗證 counts 的必要鍵、值型別、非負整數及額外鍵政策。
5. 不在本階段重算網路拓撲 component ID；那會引入 schema 與 graph 層的新依賴。若需驗證 componentId 對應拓撲，另寫設計決策與獨立工作項目。

**Gate D — 不變量不可繞過**

- automatic low + routable 被解析器拒絕。
- automatic low + non-routable 通過；reviewed low 的預期行為有明確測試與文件依據。
- 任一統計值、鍵或計數不一致均被拒絕。
- 已提交的 584 個 named places 可正常解析，且不需手動修改產物。
- 通過 G0 至 G3；若產物因規格修正而改變，必須由 owning script 重建並通過 G4。

## 階段 4：改用語意物件比較（F-04）

預計檔案：

- `src/schema/placeTranslations.ts`
- `src/schema/reviewedCustomNetwork.ts`
- 相關 schema 測試

實作策略：

1. 新增重排 `sourceCounts` 與 `coordinateSystem` 鍵順序後仍應通過的測試。
2. 以逐欄 schema 驗證或共用的排序鍵值比較取代 `JSON.stringify` 相等判斷。
3. 保留對缺少鍵、額外鍵、錯誤值、錯誤型別與非有限數值的拒絕。
4. helper 必須保持 schema 層內聚，不新增 React、Three.js 或 Node-only runtime 相依。

**Gate E — JSON 鍵順序不影響結果**

- 語意相同但鍵順序不同的物件通過。
- 缺少鍵、額外鍵或值不同的物件失敗，錯誤訊息指出正確欄位。
- 現有 committed datasets 仍可載入。
- 通過 G0 至 G3。

## 階段 5：降低路由 oracle 測試的負載敏感性（F-05）

預計檔案：

- `tests/human-golden-route.test.ts`
- 視需要新增獨立 benchmark 測試或調整 `scripts/verify-deployment.ts`

實作策略：

1. 保留 A* 與 Dijkstra 結果一致的核心 oracle。
2. 將最多 32 × 32 配對縮成決定性代表集合，至少涵蓋：同樓層、跨樓層、單向邊、可達及不可達／不同 component 情境。
3. 完整矩陣若仍有價值，移至不屬於一般 correctness suite 的效能或週期性工作。
4. 不以單純提高 timeout 作為唯一修正；效能預算繼續由 `release:verify` 的 benchmark 負責。

**Gate F — 測試穩定且保留證明力**

- oracle 測試不再依賴自訂 20 秒 timeout。
- 相同測試連續執行至少 5 次均通過；這只是穩定性抽樣，不是效能保證。
- 代表集合的覆蓋理由寫在測試名稱或註解中。
- 路由效能仍通過 `npm run release:verify`。
- 通過 G0 至 G3。

## 階段 6：處理 `fflate` 相依風險（F-06）

預計檔案：

- `package.json`（只有需要調整直接相依版本範圍時）
- `package-lock.json`
- 視需要加入相依風險紀錄文件

實作策略：

1. 以 `npm audit --omit=dev`、npm registry 套件資料及 GHSA-px8p-9vwx-vf98 的官方 advisory 重新確認受影響與修正版範圍；不得猜測版本。
2. 優先升級帶入修正版 `fflate` 的直接上游 `@react-three/drei`／`three-stdlib`，避免手動覆寫不相容的 transitive dependency。
3. 檢查 bundle 是否仍只有一個必要的 production `fflate` 版本，並確認 Three.js viewer 行為沒有回歸。
4. 若沒有相容升級路徑，記錄目前沒有 ZIP 輸入路徑的程式碼證據、風險接受人、到期日及重新檢查條件；不可只因 `audit:prod` 的 high 門檻而忽略 moderate 結果。

**Gate G — 相依風險已消除或正式接受**

- 首選：`npm audit --omit=dev` 不再回報該 advisory，且 lockfile 差異只包含預期相依更新。
- 替代：有具期限、責任人及可達性證據的風險接受紀錄。
- `npm ci`、G3、可用時的 E2E 與容器驗證均通過。
- bundle 大小沒有超過專案既有 1 MB JavaScript chunk 上限。

## 階段 7：非阻擋重構工作流

此階段不得與 F-01 至 F-06 的修正 PR 混合。每個主題應各自建立 issue／PR，先量測或鎖定行為，再重構：

| 次序 | 主題 | 前置證據 | 專項閘門 |
| --- | --- | --- | --- |
| R1 | 統一 Facility destination category registry | 測試列出所有 public + destinationEligible 類別及 mapping | 新類別不會被靜默排除；資料產物決定性不變 |
| R2 | 預先建立雙語搜尋索引與 `id -> index` map | 584 places 的搜尋基準與中／日／英查詢 fixture | 搜尋排序、雙語結果與 accessibility attributes 不變；量測證明改善或至少無退化 |
| R3 | 縮小 `FloorViewer`／`ViewerControlsProps` 組裝介面 | 現有 viewer-controls 行為測試 | graph/routing 層仍不依賴 React；單一 PR 不同時重寫 UI 行為 |
| R4 | 拆分 `MapScene` 渲染層 | 幾何與 GPU dispose 測試、bundle／frame profile | 畫面圖層順序、route overlay、resource disposal 與 frameloop demand 行為不變 |
| R5 | 補設定對話框鍵盤行為 | Escape、初始焦點、焦點還原的失敗測試 | 非模態語意保留；不加入不必要的 focus trap；鍵盤與螢幕閱讀器流程通過 |
| R6 | 結構化產生日文 SEO 頁面 | 目前 `/`、`/ja/` metadata snapshot／release checks | canonical、hreflang、Open Graph、JSON-LD 與相對資產路徑全數通過 |
| R7 | bundle 預算與載入策略 | 2026-09-09 基準：`three` 718.13 kB、gzip 185.59 kB | 先量測初始載入；只有證據支持時才增加 dynamic import，且不得破壞離線靜態部署 |

**Gate H — 重構不改變產品語意**

- 每個重構 PR 只處理一個主題，或明確說明不可分割的依賴。
- 測試證明外部行為不變；若行為有意改變，先更新規格與 current guide。
- 新抽象能刪除重複接線或降低依賴，不能只搬動檔案或增加間接層。
- 通過 G0 至 G5。

## 最終發佈閘門

完成 F-01 至 F-06 後，必須執行：

```bash
npm ci
npm run build
npm run lint
npm test
npm run test:coverage
npm run audit:prod
npm run release:verify
npm run test:e2e
npm run docker:build
npm run container:verify -- http://127.0.0.1:8080
```

只有在本機原始資料套件存在且保持不變時，才另外執行：

```bash
npm run data:inspect
npm run data:check
```

**Gate I — 可發佈**

- F-01 至 F-06 各有對應測試或正式風險接受紀錄。
- 所有必要命令通過；任何不適用項目均附具體環境原因與 CI 替代證據。
- 沒有 raw shapefile、`shapefile.zip`、本機參考 PDF 或未登記的 raw-data derivative 進入 `public/` 或 Git。
- 產物只由 owning scripts 產生，決定性檢查通過。
- `docs/CODE_REVIEW_REPORT.md` 更新為已修正／已接受狀態，並連結對應測試與 PR。

## Execution ledger（2026-09-13）

本 ledger 是本計畫各階段的執行紀錄；原始策略與 gate 定義保留在上文，以便追溯。除 Gate I 的外部環境檢查外，下列階段均由主審放行。所有修正均未手動修改資料產物或 `shapefile/`。

| Gate／階段 | 狀態 | 已驗證的交付物或決策 |
| --- | --- | --- |
| Gate A／階段 0 | 已通過 | 基準與報告校正完成；文件 whitespace 已逐檔檢查。 |
| Gate B／F-01 | 已通過 | focused active-route regression 先紅後綠，四種樓層模式均有測試。 |
| Gate C／F-02 | 已通過 | 反序 B,A + A→B fixture 證明弱連通元件與 IDs 對重排具決定性。 |
| Gate D／F-03 | 已通過 | automatic low 路由限制、reviewed low 行為與五項 statistics runtime boundary 均有負向測試。 |
| Gate E／F-04 | 已通過 | 物件鍵重排可通過，缺鍵、額外鍵、錯值、錯型與非有限數值會被精確拒絕。 |
| Gate F／F-05 | 已通過 | oracle 改用決定性代表集合；完整矩陣不再是一般 correctness gate。 |
| Gate G／F-06 | 已通過 | 官方 advisory、registry/audit 與上游 metadata 已核對；相容上游更新移除 advisory，沒有 transitive override。 |
| Gate H／R1 | 已通過 | Facility destination policy registry 完整覆蓋 eligible code set，F038 為明確 exclusion，產物保持不變。 |
| Gate H／R2 | 已通過 | 一次 shared bilingual index 與 id map；搜尋語意、順序與 accessibility attributes 維持不變。 |
| Gate H／R3 | 已通過 | readonly view-model contracts 取代大型 flat prop surface，未讓 domain hooks 依賴 UI。 |
| Gate H／R4a、R4b | 已通過 | 純幾何與 React/Three layer 依責任拆分；JSX 順序、render order、dispose ownership 與 demand frameloop 維持。 |
| Gate H／R5 | 已通過 | non-modal settings dialog 的初始焦點、Escape 與 trigger restore 已由 Testing Library 鎖定，未加入 focus trap。 |
| Gate H／R6 | 已通過 | 兩語 SEO 由結構化模板生成，release checks 驗證 canonical、hreflang、Open Graph、JSON-LD 與相對資產。 |
| Gate H／R7 | 已通過 | 每個 JS chunk 的 raw/gzip 預算可執行；viewer/three 為首屏 import graph 依賴，故保留既有 lazy chunk，而不增加 dynamic import。 |
| Gate I | **pending external CI** | 本機應跑的最終命令另行記錄於本次結果；E2E 與 Docker/container 若本機環境不可用，必須由支援的 CI runner 補驗，不能標為通過。 |

Gate I 的完成條件仍是上文所列全部項目。特別是 `test:e2e` 與 container 驗證必須在可啟動 localhost 與 Docker 的外部 CI 或等效受支援環境取得成功結果，才可將此列由 **pending external CI** 改為已通過。

本機最終紀錄：`npm ci`、build、lint、unit tests、coverage、受控網路重跑的 production audit 與 `release:verify` 已通過；`test:e2e` 在 Playwright server 綁定 `127.0.0.1:4173` 時收到 `EPERM`，Docker CLI 不存在，故 `docker:build` 與 `container:verify` 未執行。原始 `shapefile/` 目錄不存在，`data:inspect` 與 `data:check` 依專案規則不適用。這些是環境限制，不是通過結果。

## PR 建議切分

1. **PR 1 — 報告校正與 F-01：** 文件優先級、focused floor 行為及回歸測試。
2. **PR 2 — F-02：** 弱連通元件診斷及決定性測試。
3. **PR 3 — F-03/F-04：** schema 不變量、統計一致性與語意物件比較；兩者共享資料邊界測試，可在 diff 保持可審查時合併。
4. **PR 4 — F-05：** 路由 oracle 測試取樣與 benchmark 職責分離。
5. **PR 5 — F-06：** 相依升級或具期限的風險接受紀錄。
6. **後續 PR：** R1 至 R7 各自獨立，不阻擋前五個修正 PR。

每個 PR 應控制在可有效審查的大小；若超過約 400 行實質變更，優先按行為或模組再拆分。
