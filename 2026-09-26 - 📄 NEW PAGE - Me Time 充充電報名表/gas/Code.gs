/**
 * 活動報名表後端（Google Apps Script）
 *
 * 職責：接收前端 POST 的 JSON，檢查／建立試算表標題列，然後 append 一列報名資料；
 *       最後在報名者勾選需要電郵通知時寄出一封確認信。
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
 * ⚠️ 改過 formSchema.js 的欄位之後，**必須清空目標試算表或重建標題列**，
 *    否則 ensureHeader_() 會逐欄比對發現順序不符而拒絕寫入。
 *
 * ── 寄信 ────────────────────────────────────────────────────────────
 * 確認信用 MailApp 寄出，寄件人就是這個專案的執行身分（教堂的 Google 帳號），
 * 無法自訂寄件網域。MailApp 需要 script.send_mail 權限，已宣告於
 * appsscript.json 的 oauthScopes。
 *
 * ⚠️ **必須由專案擁有者親自授權一次，否則每一封確認信都寄不出去。**
 *    未授權時 doPost 會記錄
 *    「你沒有呼叫 MailApp.sendEmail 的權限。必要權限：
 *     https://www.googleapis.com/auth/script.send_mail」
 *    而**報名本身仍會成功**（這是刻意的，見下），所以症狀是「有人報名成功
 *    但收不到信」，很容易被忽略。授權步驟見 testEmail() 的說明。
 *
 *    授權＝執行一次 testEmail()（編輯器內）→ 同意權限 → **重新部署**。
 *
 * 寄信是**附加動作**：資料已經寫入試算表之後才寄，失敗只記錄在執行紀錄，
 * 仍然回 ok:true。理由是報名資料絕不能因為寄信問題而遺失。
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
 * 這一點對電郵欄位尤其重要：任何人都能寫入任意電郵地址，
 * 但只有勾選「需要」時該地址才會收到信。
 */

/** 服務名稱，僅用於 doGet 的自我診斷回應。 */
const SERVICE_NAME = 'otc-application-form'

/**
 * 電郵通知的欄位名與選項值。
 * ⚠️ 必須與 web/src/data/formSchema.js 的 EMAIL_CONSENT 與 column 完全一致，
 *    兩邊不同步的結果是「勾了需要但收不到信」，而且不會報錯。
 */
const EMAIL_NOTIFY_COLUMN = '電郵通知'
const EMAIL_ADDRESS_COLUMN = '電郵地址'
const EMAIL_CONSENT_YES = '需要'

/** 確認信內文需要的欄位名，與 formSchema 的 column 對應。 */
const ATTENDEE_NAME_COLUMN = '參加者姓名'
const SESSIONS_COLUMN = '本人參加'

/**
 * 確認信的活動資訊。
 * ⚠️ 後端拿不到前端的 event.js，所以這些值在此重複維護一份。
 *    刻意不放進前端 payload：寄信內容必須由後端決定，不能被請求內容改寫。
 *    **換活動時要一併修改這幾行。**
 */
const EVENT_TITLE = 'Me Time 充充電報名表'
const ORGANIZER_NAME = '基督教宣道會愛荃堂'
const CONTACT_PHONE = '24114170'
const CONTACT_PERSON = '劉姑娘'

/** 部署後可用瀏覽器直接開啟 /exec 確認服務是否上線。 */
function doGet() {
  return jsonResponse_({ ok: true, service: SERVICE_NAME, sheet: describeSheet_() })
}

/**
 * 手動測試寄信 —— **同時也是完成授權的步驟**。
 *
 * 為什麼需要這個函式：MailApp 需要 script.send_mail 權限，而權限必須由
 * 專案擁有者親自同意，無法用程式碼繞過。未授權時症狀是「報名成功但收不到
 * 信」，因為寄信失敗被刻意降級成不影響報名（見檔頭說明），所以必須主動測試。
 *
 * ⚠️ 這個函式**不會**被 /exec 呼叫到：GAS 部署為網頁應用程式時只會把
 *    GET / POST 派發給 doGet / doPost。它只能在 Apps Script 編輯器手動執行，
 *    因此不會變成公開的寄信入口。
 *
 * 操作步驟（只需做一次，之後不再需要）：
 *   1. 把下面的 TEST_RECIPIENT 改成自己的電郵地址並儲存。
 *   2. 編輯器上方選單「執行」→ 選 testEmail →「執行」。
 *   3. 跳出權限視窗 → 選擇自己的 Google 帳號 →「允許」。
 *      若出現「Google 尚未驗證此應用程式」→ 進階 →「前往（不安全）」。
 *      **這是 Google 對所有自訂腳本的標準警告，不是異常。**
 *   4. 執行紀錄出現「測試信已寄出：…」即代表授權成功。
 *   5. **重新部署**（部署 → 管理部署 → 編輯 → 版本：新增版本 → 部署）。
 *      Web App 要以新的權限身分執行 doPost，只授權不重新部署仍會失敗。
 */
const TEST_RECIPIENT = 'your-email@example.com' // ← 改成自己的電郵地址

function testEmail() {
  if (TEST_RECIPIENT === 'your-email@example.com') {
    throw new Error('請先把 Code.gs 頂部的 TEST_RECIPIENT 改成自己的電郵地址。')
  }

  MailApp.sendEmail({
    to: TEST_RECIPIENT,
    subject: '【' + EVENT_TITLE + '】寄信測試',
    body: [
      '這是「' + EVENT_TITLE + '」報名系統的寄信測試。',
      '',
      '如果你收到這封信，代表 script.send_mail 權限已授權，',
      '報名者勾選「需要電郵通知」時就能收到確認信。',
      '',
      '時間：' + new Date().toString(),
      '時區：' + Session.getScriptTimeZone(),    ].join('\n'),
  })

  console.log('測試信已寄出：' + TEST_RECIPIENT)
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

    // 資料已落表，寄信失敗不回報給前端，避免報名者以為失敗而重複填寫。
    var email = { status: 'not-attempted' }
    try {
      email = sendConfirmationEmail_(headers, row)
    } catch (mailError) {
      email = { status: 'failed', error: errorMessage_(mailError) }
    }
    console.log('[email] 報名確認信：' + JSON.stringify(email))

    return jsonResponse_({
      ok: true,
      service: SERVICE_NAME,
      headerCreated: header.created,
      row: sheet.getLastRow(),
      email: email,
    })
  } catch (error) {
    // 以 200 回應並帶 ok:false，前端才能讀到具體錯誤訊息（Google 會把
    // 非 2xx 轉成 HTML 錯誤頁，前端反而拿不到 JSON）。
    return jsonResponse_({ ok: false, error: errorMessage_(error) })
  }
}

/* ---------------------------------------------------------------- 內部函式 */

/**
 * 依欄位名取出該列的值。欄位不存在回傳空字串。
 *
 * 位置式 payload 的必然結果：後端只能靠標題列文字認欄位，
 * 這也是欄位名必須前後端一致的原因。
 */
function pickCell_(headers, row, column) {
  var index = headers.indexOf(column)
  if (index === -1) return ''
  var cell = row[index]
  if (cell === null || cell === undefined) return ''
  return String(cell).trim()
}

/**
 * 寄出報名確認信。
 *
 * 必須在 appendRow 之後呼叫：資料已寫入，寄信就只是附加動作。
 *
 * 回傳 { status, to?, error?, reason? }：
 *   sent    已寄出
 *   skipped 未勾選「需要」、欄位不存在、或沒填地址
 *   failed  MailApp 擲出例外（由呼叫端捕捉）
 */
function sendConfirmationEmail_(headers, row) {
  if (pickCell_(headers, row, EMAIL_NOTIFY_COLUMN) !== EMAIL_CONSENT_YES) {
    return { status: 'skipped', reason: 'not-requested' }
  }
  if (headers.indexOf(EMAIL_ADDRESS_COLUMN) === -1) {
    return { status: 'skipped', reason: 'missing-column' }
  }

  var recipient = pickCell_(headers, row, EMAIL_ADDRESS_COLUMN)
  if (!recipient) return { status: 'skipped', reason: 'no-address' }

  var attendee = pickCell_(headers, row, ATTENDEE_NAME_COLUMN)
  var sessions = pickCell_(headers, row, SESSIONS_COLUMN)

  MailApp.sendEmail({
    to: recipient,
    subject: '【' + EVENT_TITLE + '】已收到您的報名',
    body: [
      attendee + ' 您好：',
      '',
      '已收到您「' + EVENT_TITLE + '」的報名。',
      '',
      '・參加者姓名：' + attendee,
      '・參加場次：' + sessions,
      '',
      '我們會以電話聯絡確認報名詳情，如需查詢請致電 ' +
        CONTACT_PHONE +
        '（' +
        CONTACT_PERSON +
        '）。',
      '',
      ORGANIZER_NAME,
    ].join('\n'),
  })

  return { status: 'sent', to: recipient }
}

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
