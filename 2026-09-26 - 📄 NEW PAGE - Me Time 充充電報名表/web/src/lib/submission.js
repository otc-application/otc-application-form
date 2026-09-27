import { childrenColumnPrefix, formSchema } from '../data/formSchema.js'
import { eventInfo } from '../data/event.js'
import { GAS_API_URL, isGasConfigured, SUBMIT_ERROR_MESSAGE } from '../config.js'

/** 提交時間欄位名稱。 */
const SUBMITTED_AT_COLUMN = '提交時間'

/**
 * 展開 schema 中所有欄位，包含 radio 選項底下的條件式子欄位。
 * 條件式子欄位即使未顯示也會保留欄位（值留空），確保試算表欄位固定。
 */
function flattenFields(schema) {
  const flat = []
  for (const field of schema) {
    flat.push(field)
    for (const option of field.options ?? []) {
      for (const sub of option.fields ?? []) flat.push(sub)
    }
  }
  return flat
}

function toCellText(value) {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join('、')
  return String(value).trim()
}

/** 兒童區：每位子女呈現為「姓名（年齡歲）」，同一日期多人以「、」分隔。 */
function formatChildren(list) {
  if (!Array.isArray(list)) return ''
  return list
    .map((child) => {
      const name = (child?.name ?? '').trim()
      const age = (child?.age ?? '').trim()
      if (!name) return ''
      return age ? `${name}（${age}歲）` : name
    })
    .filter(Boolean)
    .join('、')
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/**
 * 試算表標題列。順序＝Questions.md 的問題順序，這是 GAS append 的依據。
 * 相同 column 只會出現一次（多個欄位共用時取外觀順序第一個）。
 */
export function buildColumns(schema = formSchema) {
  const columns = []
  for (const field of flattenFields(schema)) {
    if (field.column && !columns.includes(field.column)) columns.push(field.column)
    // childrenByDate 本身沒有 column，它每個日期各佔一欄，排在該欄位之後，
    // 讓試算表欄位順序與畫面欄位順序完全一致。
    if (field.type !== 'childrenByDate') continue
    for (const date of field.dates) {
      const column = childrenColumnPrefix + date.value
      if (!columns.includes(column)) columns.push(column)
    }
  }
  columns.push(SUBMITTED_AT_COLUMN)
  return columns
}

/**
 * 條件式子欄位是否應被略過。
 *
 * `dependsOn` 表示「父欄位必須是某個值才有意義」。典型例子是電郵地址：
 * 使用者勾「需要」才會輸入地址，之後改選「不需要」時，狀態樹裡仍留著
 * 剛才輸入的地址。若照樣送出，試算表就會留下一個沒人同意接收的地址。
 * 父欄位未選（空字串）時視為不滿足條件。
 */
function isSuppressed_(field, values) {
  const dependency = field.dependsOn
  if (!dependency) return false
  return values[dependency.field] !== dependency.value
}

/** 依 buildColumns 的順序產生一列資料。 */
export function buildRow(values, schema = formSchema) {
  const cells = new Map()
  // 第一個有值的欄位勝出，避免共用 column 被後面的空值蓋掉。
  const setCell = (column, text) => {
    if (!column || !text || cells.has(column)) return
    cells.set(column, text)
  }

  for (const field of flattenFields(schema)) {
    if (isSuppressed_(field, values)) continue
    setCell(field.column, toCellText(values[field.name]))
  }

  const children = values.childrenByDate ?? {}
  for (const field of schema) {
    if (field.type !== 'childrenByDate') continue
    for (const date of field.dates) {
      setCell(childrenColumnPrefix + date.value, formatChildren(children[date.value]))
    }
  }

  setCell(SUBMITTED_AT_COLUMN, formatTimestamp(new Date()))

  return buildColumns(schema).map((column) => cells.get(column) ?? '')
}

/** 依 schema 產生初始表單值。 */
export function createInitialValues(schema = formSchema) {
  const values = {}
  for (const field of flattenFields(schema)) {
    if (field.type === 'checkboxGroup') values[field.name] = []
    else if (field.type === 'childrenByDate') {
      values[field.name] = Object.fromEntries(field.dates.map((d) => [d.value, []]))
    } else if (!(field.name in values)) values[field.name] = ''
  }
  return values
}

/** 電郵格式：夠用即可，不追求完整 RFC。 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** text / tel / email 共用的必填與格式檢查。 */
function validateTextLike(field, value, errors) {
  const text = (value ?? '').trim()
  if (field.required && !text) {
    errors[field.name] = `請填寫「${field.label}」`
    return
  }
  if (!text) return
  if (field.type === 'tel' && text.replace(/\D/g, '').length < 8) {
    errors[field.name] = '請填寫有效的聯絡電話號碼'
  } else if (field.type === 'email' && !EMAIL_PATTERN.test(text)) {
    errors[field.name] = '請填寫有效的電郵地址'
  }
}

/**
 * 回傳 { fieldName: 錯誤訊息 }，空物件代表通過。
 *
 * radio 被選中時，會再檢查該選項底下的條件式子欄位（電郵地址即為一例）；
 * 未被選中的選項，其子欄位一律不檢查，也不送出。
 */
export function validateForm(values, schema = formSchema) {
  const errors = {}

  for (const field of schema) {
    if (field.type === 'text' || field.type === 'tel' || field.type === 'email') {
      validateTextLike(field, values[field.name], errors)
    } else if (field.type === 'radio') {
      if (field.required && !values[field.name]) {
        errors[field.name] = `請選擇「${field.label}」`
      } else if (values[field.name]) {
        const active = field.options.find((option) => option.value === values[field.name])
        for (const sub of active?.fields ?? []) {
          validateTextLike(sub, values[sub.name], errors)
        }
      }
    } else if (field.type === 'checkboxGroup' && field.required) {
      const picked = values[field.name] ?? []
      if (picked.length === 0) errors[field.name] = `請至少選擇一項「${field.label}」`
    } else if (field.type === 'childrenByDate') {
      const children = values[field.name] ?? {}
      for (const date of field.dates) {
        const list = children[date.value] ?? []
        if (list.length === 0) continue
        const missing = list.some((c) => !(c?.name ?? '').trim() || !(c?.age ?? '').trim())
        if (missing) errors[`${field.name}.${date.value}`] = `請填寫${date.label}的子女姓名與年齡`
      }
    }
  }

  return errors
}

/**
 * 後端回報「取不到落表鎖」的代碼。⚠️ 必須與 gas/Code.gs 的 BUSY_CODE 一致。
 *
 * 為什麼重試是安全的：後端只在**完全沒有寫入任何資料**的情況下回這個代碼
 * （throw 發生在 appendRow 之前）。所以重試不會產生重複列 —— 這個前提是後端
 * 那邊的約束，不要把 BUSY 改成寫入之後才回，否則重試就會造出重複報名。
 */
const BUSY_CODE = 'BUSY'

/** 重試前的等待時間，讓對方的鎖有機會釋放。 */
const BUSY_RETRY_DELAY_MS = 1000
const BUSY_MAX_ATTEMPTS = 2

/**
 * 取不到落表鎖、且重試也用盡時顯示給使用者的訊息。
 *
 * ⚠️ 刻意**不**套用「報名失敗：」前綴（一般錯誤才加）。BUSY 情境下**沒有任何
 * 失敗，也沒有任何資料遺失** —— 後端確定在 appendRow 之前就中止了，說「失敗」
 * 會令使用者誤以為要重填。同一段話也要說明「已填內容保留」，否則使用者可能
 * 重新輸入一遍（兒童區與電話欄尤其麻煩），反而提高重複報名的機會。
 *
 * 電話取自 eventInfo.contact.phone，與頁尾的查詢電話同一來源，不會漂移。
 */
const BUSY_USER_MESSAGE =
  `系統忙碌中，請稍候再按一次「送出報名資料」。你填寫的內容已保留，` +
  `請勿重複填寫；若持續出現，請致電 ${eventInfo.contact.phone} 協助。`

/**
 * 送出報名資料到 GAS Web App。
 *
 * 注意：GAS 的 doPost 即使內部錯誤也會回 200，所以除了 HTTP 狀態碼
 * 還要檢查回應 JSON 的 ok 欄位。
 *
 * `options.onRetry` 在**即將重試前**呼叫一次，用途是讓 UI 顯示「系統繁忙，
 * 正在重試…」，否則使用者只會對著全屏遮罩等待，不確定是否卡死。
 */
export async function submitApplication(values, schema = formSchema, options = {}) {
  if (!isGasConfigured) {
    throw new Error(
      '尚未設定報名 API（VITE_GAS_API_URL），請聯絡活動負責人協助報名。',
    )
  }

  // 送出時間只算一次：重試不應該改變「提交時間」欄位。
  const body = JSON.stringify({
    headers: buildColumns(schema),
    row: buildRow(values, schema),
  })

  let payload
  for (let attempt = 1; ; attempt++) {
    payload = await postOnce_(body)
    if (payload?.ok || !isBusy_(payload) || attempt >= BUSY_MAX_ATTEMPTS) break
    console.warn(`[報名] 後端忙碌中，第 ${attempt} 次嘗試，共 ${BUSY_MAX_ATTEMPTS} 次`)
    options.onRetry?.(attempt)
    await sleep_(BUSY_RETRY_DELAY_MS)
  }

  if (!payload?.ok) {
    if (isBusy_(payload)) throw new Error(BUSY_USER_MESSAGE)
    throw new Error(payload?.error ? `報名失敗：${payload.error}` : SUBMIT_ERROR_MESSAGE)
  }

  // 報名資料已寫入試算表，確認信寄不出去不影響報名結果，因此不向使用者示警。
  // 實際收件情況需查看 GAS 執行紀錄或 Apps Script 的 Cloud Logging。
  if (payload?.email?.status === 'failed') {
    console.warn('[報名] 確認信未寄出：', payload.email.error)
  }

  return payload
}

/** 送出一次並回傳解析後的 JSON；連線或格式問題在此就轉成使用者看得懂的訊息。 */
async function postOnce_(body) {
  let response
  try {
    response = await fetch(GAS_API_URL, {
      method: 'POST',
      mode: 'cors',
      // 這裡**必須**是 text/plain，不能是 application/json。
      // JSON 的 POST 屬於 CORS 的「非簡單請求」，瀏覽器會先送 OPTIONS 預檢，
      // 而 GAS 只把 GET/POST 派發給 doGet/doPost，預檢會拿到 405，報名就送不出去。
      // 純文字內容型態屬於簡單請求，不需要預檢，後端仍可 JSON.parse。
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    })
  } catch {
    throw new Error(SUBMIT_ERROR_MESSAGE)
  }

  if (!response.ok) throw new Error(SUBMIT_ERROR_MESSAGE)

  try {
    return await response.json()
  } catch {
    throw new Error(SUBMIT_ERROR_MESSAGE)
  }
}

/**
 * 回應是否代表「後端忙碌，什麼都還沒寫入」→ 可以安全重試。
 *
 * 兩個條件取 OR：任一邊被改壞都還有另一邊守住。重試若靜靜失效**不會報錯**，
 * 只是報名者平白見到一次紅字再去撳一次 —— 這類沒有症狀的退化正是本專案
 * 要防的東西，所以刻意留兩道。
 */
function isBusy_(payload) {
  return payload?.code === BUSY_CODE || String(payload?.error ?? '').includes('忙碌')
}

function sleep_(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
