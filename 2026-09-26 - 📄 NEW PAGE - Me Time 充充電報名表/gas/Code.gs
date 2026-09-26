/**
 * 活動報名表後端（Google Apps Script）
 *
 * 職責：接收前端 POST 的 JSON，檢查／建立試算表標題列，然後 append 一列報名資料。
 *
 * ⚠️ 部署方式（Apps Script 編輯器右上角「部署」→「新增部署」）
 *   1. 類型：網頁應用程式
 *   2. 執行身分：我
 *   3. 誰可以存取：任何人
 *   4. 部署後複製「網頁應用程式 URL」（結尾是 /exec，不是 /dev）
 *
 * ⚠️ 必須綁定試算表：這個專案要以「附加在試算表上」的方式建立
 *    （開啟目標試算表 → 擴充功能 → Apps Script），才能使用
 *    getActiveSpreadsheet() 取得試算表。
 *
 * ── 關於 CORS 的實作真相（不要憑印象改這裡）────────────────────────
 * Google 不允許從 ContentService 自訂 Access-Control-Allow-Origin 標頭，
 * 而且 GAS 只會把 GET / POST 派發給 doGet / doPost —— 就算寫了
 * doOptions() 也不會被呼叫，預檢（preflight）仍會拿到 405。
 *
 * 因此這裡的解法是**讓瀏覽器不需要預檢**：前端以
 * `Content-Type: text/plain;charset=utf-8` 送出 body（純文字但內容是 JSON），
 * 屬於 CORS 的「簡單請求」。Google 對 script.google.com 的回應會帶上
 * 允許跨讀的回應標頭，跨網域 POST 因此可以成功。
 *
 * **請勿在前端改回 `application/json`** —— 那會觸發預檢，報名將完全送不出去。
 *
 * ── 安全 取捨 ────────────────────────────────────────────────────────
 * 因為無法在 GAS 限制呼叫來源，任何拿到 /exec 網址的人都能寫入資料。
 * 公開活動報名表通常可接受；若試算表含敏感資料，請再加上共用的
 * 提交碼（token）比對，並把 /exec 網址視為密鑰不要公開。
 */

/** 服務名稱，僅用於 doGet 的自我診斷回應。 */
const SERVICE_NAME = 'otc-application-form'

/** 部署後可用瀏覽器直接開啟 /exec 確認服務是否上線。 */
function doGet() {
  return jsonResponse_({ ok: true, service: SERVICE_NAME, sheet: describeSheet_() })
}

/**
 * 接收報名資料。
 * 請求格式：{ "headers": string[], "row": string[] }
 */
function doPost(e) {
  try {
    var payload = parseBody_(e)
    var headers = requireStringArray_(payload.headers, 'headers')
    var row = requireStringArray_(payload.row, 'row')

    if (headers.length === 0) throw new Error('headers 不可為空')
    if (headers.length !== row.length) {
      throw new Error(
        '欄位數量與資料列不符（headers ' + headers.length + ' 欄，row ' + row.length + ' 欄）',
      )
    }

    var sheet = getSheet_()
    var header = ensureHeader_(sheet, headers)
    sheet.appendRow(row)

    return jsonResponse_({
      ok: true,
      service: SERVICE_NAME,
      headerCreated: header.created,
      row: sheet.getLastRow(),
    })
  } catch (error) {
    // 以 200 回應並帶 ok:false，前端才能讀到具體錯誤訊息（Google 會把
    // 非 2xx 轉成 HTML 錯誤頁，前端反而拿不到 JSON）。
    return jsonResponse_({ ok: false, error: errorMessage_(error) })
  }
}

/* ---------------------------------------------------------------- 內部函式 */

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('請求內容為空，請確認前端已正確送出表單資料。')
  }
  try {
    return JSON.parse(e.postData.contents)
  } catch (error) {
    throw new Error('請求內容不是合法的 JSON。')
  }
}

function requireStringArray_(value, name) {
  if (!Array.isArray(value)) throw new Error(name + ' 必須是陣列。')
  return value.map(function (cell) {
    return cell === null || cell === undefined ? '' : String(cell)
  })
}

function getSheet_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
  if (!spreadsheet) {
    throw new Error('找不到綁定的試算表，請確認本專案已附加在目標試算表上。')
  }
  var sheet = spreadsheet.getActiveSheet()
  if (!sheet) throw new Error('找不到目標工作表。')
  return sheet
}

function describeSheet_() {
  try {
    var sheet = getSheet_()
    return {
      name: sheet.getName(),
      lastRow: sheet.getLastRow(),
      lastColumn: sheet.getLastColumn(),
    }
  } catch (error) {
    return { error: errorMessage_(error) }
  }
}

/**
 * 沒有標題列就建立；有標題列則**逐欄比對順序**。
 *
 * 為什麼要嚴格比對：appendRow 是依位置寫入的，若前端欄位順序與試算表
 * 不一致，資料會安靜地寫錯欄位而不會報錯。與其靜默錯位，不如直接拒絕。
 */
function ensureHeader_(sheet, headers) {
  var isEmpty = sheet.getLastRow() === 0 || sheet.getLastColumn() === 0
  if (isEmpty) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    return { created: true }
  }

  var width = sheet.getLastColumn()
  var existing = sheet
    .getRange(1, 1, 1, width)
    .getValues()[0]
    .map(function (cell) {
      return String(cell).trim()
    })

  var mismatched = []
  for (var i = 0; i < headers.length; i++) {
    if (existing[i] !== headers[i]) {
      mismatched.push(
        '第 ' +
          (i + 1) +
          ' 欄應為「' +
          headers[i] +
          '」但目前是「' +
          (existing[i] || '空白') +
          '」',
      )
    }
  }

  if (mismatched.length > 0) {
    throw new Error(
      '試算表標題列與表單欄位順序不一致：' +
        mismatched.join('；') +
        '。請修正標題列後再試。',
    )
  }

  return { created: false }
}

function errorMessage_(error) {
  if (error && error.message) return error.message
  return String(error)
}

function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
