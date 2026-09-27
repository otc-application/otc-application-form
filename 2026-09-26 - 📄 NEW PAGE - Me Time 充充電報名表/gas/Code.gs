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
 *    標題列由程式自動保護（見 unprotectHeader_()），所以「選取全部 → 清除內容」
 *    這種清空方式**不會**卡在權限上，重建流程照跑。
 *
 * ── 並行寫入 ──────────────────────────────────────────────────────────
 * 落表全程用 LockService 序列化（見 writeRow_）。要解決的是 appendRow 的
 * 競態：兩個並行執行若都讀到同一個 lastRow，會寫進同一橫，其中一筆報名**靜靜
 * 消失但回應仍是 ok:true**。鎖取不到時回 200 + {ok:false, code:"BUSY"}，
 * 前端會自動重試一次（BUSY 一定發生在寫入之前，所以重試不會產生重複列）。
 *
 * ⚠️ 鎖只包「讀標題列 → append 一列」，**寄信在鎖外**；用 tryLock 而非
 *    waitLock。改這段之前先讀 writeRow_() 的註解。
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
 * 落表互斥鎖（LockService）的等待時限，單位毫秒。
 *
 * 鎖只包住「讀標題列 → append 一列」，實際只需幾百毫秒，10 秒已經極寬鬆。
 * 之所以要一個上限而不是無限等：見下。
 *
 * ⚠️ 刻意用 `tryLock()` 而**不是** `waitLock()`。waitLock 會一直等到鎖被釋放，
 *    一旦有執行卡死（試算表 API 逾時、MailApp 慢），之後**所有**報名都會堆在
 *    這裡逾時，變成「為了防撞車而製造新故障」。取不到鎖就回暫時性錯誤，
 *    讓前端自己重試，見 BUSY_CODE。
 */
const LOCK_TIMEOUT_MS = 10000

/**
 * 取不到落表鎖時回報的代碼，供前端判斷「可以安全重試」。
 *
 * ⚠️ 必須與 web/src/lib/submission.js 的 BUSY_CODE 一致（後端拿不到前端檔案）。
 *    這個代碼**只在完全沒有寫入任何資料時**才會出現（throw 在 appendRow 之前），
 *    所以前端重試不會產生重複列 —— 這是重試得以安全的前提，不要改成在寫入
 *    之後才回 BUSY。
 */
const BUSY_CODE = 'BUSY'
const BUSY_MESSAGE = '系統忙碌中，請稍後再提交。'

/** 標題列保護的說明文字，會顯示在試算表「編輯權限 → 保護範圍」的清單裡。 */
const HEADER_PROTECTION_NOTE =
  '報名表標題列：由 Code.gs 自動保護，欄位順序不可改動。'

/**
 * 電郵通知的欄位名與選項值。
 * ⚠️ 必須與 web/src/data/formSchema.js 的 EMAIL_CONSENT 與 column 完全一致，
 *    兩邊不同步的結果是「勾了需要但收不到信」，而且不會報錯。
 */
const EMAIL_NOTIFY_COLUMN = '電郵通知'
const EMAIL_ADDRESS_COLUMN = '電郵地址'
const EMAIL_CONSENT_YES = '需要'

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

/**
 * 收費截止提示。
 *
 * ⚠️ 這是 web/src/data/event.js 裡 paymentNotice 的**另一份副本** —— Apps
 *    Script 讀不到前端的檔案。改收費日期時兩個檔案都要改。
 *
 * 保持「pricing[].deadline 只放純日期」的規則：這裡直接寫完整句子，句子裡
 * 就只出現一次「截止」。之前把「截止報名日期 10 月 25 日」整句塞進 deadline
 * 再接在「截止」後面，會變成「截止截止報名日期 10 月 25 日」。
 */
const PAYMENT_NOTICE = '早鳥優惠截止 10 月 18 日前報名，一般收費截止 10 月 25 日。'

/**
 * 名額安排提示。
 *
 * ⚠️ 與 web/src/data/event.js 的 `quota`、`notes`、拉筋班 `highlights` 是同一句
 *    話的另外三份副本 —— 後端拿不到前端檔案，Apps Script 也不會讀 event.js。
 *    改名額規則時四處都要改，否則信上與畫面上的安排對不上，且不會報錯。
 *
 * 這段是「軟承諾」而非執行依據：實際排序仍然由人手按報名先後處理，沒有任何
 * 程式會依它拒收或排序報名。語氣刻意用「優先考慮」而非「優先」，避免收信者
 * 當成硬性承諾。
 */
const QUOTA_NOTICE = '名額有限，每堂最多 12 位，新朋友及報 4 堂或以上優先考慮。'

/**
 * ⚠️ 確認信**刻意不放任何圖片**，不要再加回來。
 *
 * 曾經用 CID 內嵌成功圖示（`MailApp.sendEmail({ ..., inlineImages: [...] })`
 * 搭配 `htmlBody` 裡的 `<img src="cid:...">`），結果每一封信都寄不出去：
 *
 *   [報名] 確認信未寄出： 下列引數無效：inlineImages
 *
 * 原因是 **`inlineImages` 不是 `MailApp` 的參數**。它是 Gmail API
 * `users.messages.send` 的欄位，`MailApp.sendEmail()` 只接受
 * `to / subject / body / htmlBody / replyTo / cc / bcc / attachments /
 * name / replyToName` 等。傳入未知引數不會被忽略，而是直接拋錯。
 *
 * 為什麼這個錯很難察覺：寄信失敗被刻意降級成不影響報名（見檔頭說明），
 * 所以報名照樣成功、畫面照樣跳彈窗，只有當事人的信箱裡什麼都沒有。
 * 順帶一提，`<img src="cid:...">` 在 `MailApp` 底下本來也不會有對應的
 * 附件可解析，就算參數過得去也只會是一個破圖。
 *
 * 真的需要視覺元素時，唯一穩定的做法是改成文字或表格樣式，不要碰圖片。
 */


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

    var written = writeRow_(headers, row)

    // 資料已落表，寄信失敗不回報給前端，避免報名者以為失敗而重複填寫。
    // ⚠️ 這裡**已經在鎖外**（writeRow_ 釋放了鎖）：MailApp 可以跑幾秒，
    //    鎖住它會令所有報名排隊，see LOCK_TIMEOUT_MS。
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
      headerCreated: written.headerCreated,
      row: written.lastRow,
      email: email,
    })
  } catch (error) {
    // 以 200 回應並帶 ok:false，前端才能讀到具體錯誤訊息（Google 會把
    // 非 2xx 轉成 HTML 錯誤頁，前端反而拿不到 JSON）。
    if (error && error.code === BUSY_CODE) {
      // 取不到鎖＝有人正在寫，資料一個字都還沒落地，因此可以安全重試。
      console.warn('[報名] 取不到落表鎖：' + errorMessage_(error))
      return jsonResponse_({ ok: false, code: BUSY_CODE, error: errorMessage_(error) })
    }
    return jsonResponse_({ ok: false, error: errorMessage_(error) })
  }
}

/**
 * 把一列報名資料寫入試算表，**整段用互斥鎖序列化**。回傳 {headerCreated, lastRow}。
 *
 * ⚠️ 為什麼要鎖：ensureHeader_ 讀 getLastRow()、appendRow 再依位置寫入，這是
 *    read-then-write，Apps Script **不保證**兩次呼叫之間沒有另一個執行插入。
 *    兩個並行執行都讀到同一個 lastRow 就會寫進同一橫，其中一筆報名會**靜靜
 *    消失，而回應仍是 ok:true** —— 報名者以為報了名，名單上卻沒有他。
 *    這是本專案最不能接受的失敗型態，理由與檔頭「寄信是附加動作」相同：
 *    寧可讓人重試一次，也不要讓報名資料憑空消失。
 *
 * ⚠️ 鎖**只包這個函式**。不要為了「順手」把寄信也包進來：MailApp 可以跑幾秒，
 *    由頭鎖到尾會令所有提交排隊，tryLock 大量超時 —— 為防撞車而製造新故障。
 *
 * ⚠️ 用 tryLock 而非 waitLock，理由見 LOCK_TIMEOUT_MS。
 *
 * 取不到鎖時丟出帶 BUSY_CODE 的錯誤，且**發生在任何寫入之前**，所以前端重試
 * 不會產生重複列。
 */
function writeRow_(headers, row) {
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(LOCK_TIMEOUT_MS)) throw busyError_()
  try {
    var sheet = getSheet_()
    var header = ensureHeader_(sheet, headers)
    sheet.appendRow(row)
    return { headerCreated: header.created, lastRow: sheet.getLastRow() }
  } finally {
    // 必須放，否則例外路徑會把整個表單永久鎖死。
    lock.releaseLock()
  }
}

/** 帶 BUSY_CODE 的錯誤，讓 doPost 能回出可供前端重試的回應。 */
function busyError_() {
  var error = new Error(BUSY_MESSAGE)
  error.code = BUSY_CODE
  return error
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

  var details = buildEmailDetails_(headers, row)
  var body = buildEmailText_(details)
  var html = buildEmailHtml_(details)

  MailApp.sendEmail({
    to: recipient,
    subject: '【' + EVENT_TITLE + '】報名成功',
    body: body,
    htmlBody: html,
  })

  return { status: 'sent', to: recipient }
}

/**
 * 從標題列與該列資料組出「報名資料」清單。
 *
 * 刻意**不**逐一 hardcode 欄位名，而是走訪標題列：這樣 schema 加欄位時
 * 確認信會自動跟著多一列，不會靜悄悄漏掉。（反面：不會列入的欄位就不會
 * 出現在信上，所以要略過的欄位必須在這裡明確排除。）
 *
 * 略過：提交時間（收信當下就是同一件事，純雜訊）、電郵通知與電郵地址
 * （收件人自己就是這個地址，寫在信上只會洩漏到寄件過程的記錄裡）。
 */
var EMAIL_DETAIL_EXCLUDE = ['提交時間', EMAIL_NOTIFY_COLUMN, EMAIL_ADDRESS_COLUMN]

function buildEmailDetails_(headers, row) {
  var details = []
  for (var i = 0; i < headers.length; i += 1) {
    var label = headers[i]
    if (EMAIL_DETAIL_EXCLUDE.indexOf(label) !== -1) continue
    var value = row[i]
    if (value === '' || value === null || value === undefined) continue
    details.push({ label: label, value: String(value) })
  }
  return details
}

function buildEmailText_(details) {
  var lines = [
    '報名成功！',
    '感謝您報名「' + EVENT_TITLE + '」。我們會以電話聯絡確認，請留意來電。',
    '',
    '報名資料',
  ]
  for (var i = 0; i < details.length; i += 1) {
    lines.push('・' + details[i].label + '：' + details[i].value)
  }
  lines.push('')
  lines.push('請留意：' + PAYMENT_NOTICE)
  lines.push('')
  lines.push('名額安排：' + QUOTA_NOTICE)
  lines.push('')
  lines.push('如需查詢請致電 ' + CONTACT_PHONE + '（' + CONTACT_PERSON + '）。')
  lines.push('')
  lines.push(ORGANIZER_NAME)
  return lines.join('\n')
}

/** HTML 內文：郵件客戶端會優先顯示這個，純文字 body 當降級備援。 */
function buildEmailHtml_(details) {
  var rows = ''
  for (var i = 0; i < details.length; i += 1) {
    rows +=
      '<tr>' +
      '<td style="padding:6px 12px 6px 0;color:#78716c;font-size:14px;white-space:nowrap;vertical-align:top;">' +
      escapeHtml_(details[i].label) +
      '</td>' +
      '<td style="padding:6px 0;color:#1c1917;font-size:14px;vertical-align:top;">' +
      escapeHtml_(details[i].value) +
      '</td>' +
      '</tr>'
  }

  return (
    '<div style="font-family:\'Noto Sans TC\',\'PingFang TC\',\'Microsoft JhengHei\',sans-serif;color:#1c1917;max-width:520px;">' +
    '<h1 style="font-size:20px;margin:0;">報名成功！</h1>' +
    '<p style="font-size:15px;line-height:1.7;margin:8px 0 0;">感謝您報名<span style="font-weight:600;color:#e11d48;text-decoration:underline;">「' +
    escapeHtml_(EVENT_TITLE) +
    '」</span>。我們會以電話聯絡確認，請留意來電。</p>' +
    '<h2 style="font-size:14px;letter-spacing:.05em;color:#78716c;margin:24px 0 0;">報名資料</h2>' +
    '<table style="border-collapse:collapse;width:100%;margin-top:4px;">' +
    rows +
    '</table>' +
    '<p style="font-size:14px;line-height:1.7;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;margin:20px 0 0;">' +
    '<strong>請留意：</strong>' +
    escapeHtml_(PAYMENT_NOTICE) +
    '</p>' +
    '<p style="font-size:14px;line-height:1.7;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;margin:10px 0 0;">' +
    '<strong>名額安排：</strong>' +
    escapeHtml_(QUOTA_NOTICE) +
    '</p>' +
    '<p style="font-size:14px;line-height:1.7;margin:20px 0 0;">如需查詢請致電 ' +
    escapeHtml_(CONTACT_PHONE) +
    '（' +
    escapeHtml_(CONTACT_PERSON) +
    '）。</p>' +
    '<p style="font-size:13px;color:#78716c;margin:16px 0 0;">' +
    escapeHtml_(ORGANIZER_NAME) +
    '</p>' +
    '</div>'
  )
}

/**
 * HTML 逸出。
 *
 * 寄信內容全部走 innerHTML 組字串，姓名／電話／電郵是使用者輸入，不能直接
 * 插進去 —— 一個叫 `<img onerror=...>` 的姓名就會變成寄給自己的惡意郵件。
 */
function escapeHtml_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
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
    // ⚠️ 必須先解除保護：「清除內容」不會移除第 1 橫的保護，於是
    //    「清空試算表 → 重建標題列」這個改 schema 流程會撞上
    //    「你無法編輯這個範圍」而失敗。
    unprotectHeader_(sheet, headers.length)
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    protectHeader_(sheet, headers.length)
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

  // 標題列正確也補上保護（自我修復）：這份試算表可能建立於本機制之前，
  // 或者有人手動解除過。讓「改壞標題列就拒絕寫入」這個保護不只活在程式碼裡。
  protectHeader_(sheet, width)

  return { created: false }
}

/**
 * 保護標題列（第 1 橫）。
 *
 * 為什麼值得保護：ensureHeader_ 逐欄比對標題列，**只要順序不對就拒絕所有寫入**
 * —— 有人插入一欄、重新排序、刪掉標題列或改錯欄名，之後每一次報名都會失敗，
 * 畫面只顯示「標題列與表單欄位順序不一致」，要人手搶修。插入欄位與排序都必然
 * 觸及第 1 橫，所以保護第 1 橫就能擋住這類結構性意外。
 *
 * 為什麼**只**保護第 1 橫而不保護整張表：appendRow 不碰第 1 橫，資料照樣寫得
 * 進去，因此不必依賴「擁有者可繞過保護」這個沒寫在文件裡的行為。整張表保護
 * 還會擋住人手修正個別資料，效益不划算。
 *
 * ⚠️ 保護失敗**絕對不可以令報名失敗**：保護只是防手滑，不是報名的前置條件。
 *    這裡吞掉所有例外並只記錄 —— 反過來說，也不要為了「保證有保護」而把
 *    保護的例外往外丟。
 */
function protectHeader_(sheet, width) {
  try {
    var range = sheet.getRange(1, 1, 1, width)
    if (range.getProtections(SpreadsheetApp.ProtectionType.RANGE).length > 0) return
    range.protect().setDescription(HEADER_PROTECTION_NOTE).setWarningOnly(false)
    console.log('[報名] 已保護標題列（第 1 橫）')
  } catch (error) {
    console.warn('[報名] 保護標題列失敗，報名不受影響：' + errorMessage_(error))
  }
}

/**
 * 寫入標題列前，解除任何涵蓋第 1 橫的保護（範圍保護與整張表保護都包括）。
 *
 * 只在「試算表是空的、要重建標題列」時呼叫。若人手在介面保護了整張表，這裡
 * 會把它也解除 —— 這是刻意的：這條路徑正是 AGENTS.md 指定的「改 schema 後
 * 清空試算表重建標題列」流程，讓它因為權限而失敗，代價（要回頭手動重設保護）
 * 大於它避免的麻煩。解除後 protectHeader_() 會補上第 1 橫保護。
 */
function unprotectHeader_(sheet, width) {
  var removed = 0
  sheet
    .getRange(1, 1, 1, width)
    .getProtections()
    .forEach(function (protection) {
      protection.remove()
      removed++
    })
  if (removed > 0) {
    console.log('[報名] 重建標題列前解除保護（' + removed + ' 個）')
  }
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
