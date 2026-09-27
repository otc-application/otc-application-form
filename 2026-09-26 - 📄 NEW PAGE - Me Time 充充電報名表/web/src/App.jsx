import { useState } from 'react'
import DescriptionSection from './components/DescriptionSection.jsx'
import RegistrationForm from './components/RegistrationForm.jsx'
import SuccessScreen from './components/SuccessScreen.jsx'
import { showSuccessPopup } from './components/SuccessPopup.jsx'
import PrintableSummary from './components/PrintableSummary.jsx'
import LoadingOverlay from './components/LoadingOverlay.jsx'
import { formSchema } from './data/formSchema.js'
import { eventInfo } from './data/event.js'
import { createInitialValues, submitApplication, validateForm } from './lib/submission.js'

export default function App() {
  const [values, setValues] = useState(() => createInitialValues(formSchema))
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitNotice, setSubmitNotice] = useState('')
  const [status, setStatus] = useState('idle')
  const [submitted, setSubmitted] = useState(null)

  const submitting = status === 'submitting'
  const succeeded = status === 'success'

  const handleChange = (name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    // 使用者修正欄位後即時移除該欄的錯誤訊息。
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nextErrors = validateForm(values, formSchema)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      // 焦點移到第一個錯誤欄位，方便手機使用者直接修正。
      requestAnimationFrame(() => {
        document.querySelector('[data-invalid="true"]')?.focus()
      })
      return
    }

    setStatus('submitting')
    setSubmitError('')
    setSubmitNotice('')
    try {
      // 後端忙碌時 submitApplication 會在重試前呼叫 onRetry，讓遮罩顯示
      // 「系統繁忙，正在重試…」而不是讓使用者對著「送出中…」乾等。
      await submitApplication(values, formSchema, {
        onRetry: () => setSubmitNotice('系統繁忙，正在重試…'),
      })
      setSubmitted(values)
      setStatus('success')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      showSuccessPopup(values)
    } catch (error) {
      console.error('[報名表] 送出失敗：', error)
      setStatus('idle')
      setSubmitNotice('')
      setSubmitError(error.message)
    }
  }

  const handleReset = () => {
    setValues(createInitialValues(formSchema))
    setErrors({})
    setSubmitError('')
    setSubmitNotice('')
    setSubmitted(null)
    setStatus('idle')
  }

  return (
    <div className="min-h-screen">
      {submitting && <LoadingOverlay notice={submitNotice} />}

      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
        <DescriptionSection />

        {succeeded ? (
          <SuccessScreen values={submitted} onReset={handleReset} />
        ) : (
          <RegistrationForm
            values={values}
            errors={errors}
            submitError={submitError}
            submitting={submitting}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
        )}

        <footer className="mt-10 border-t border-stone-200 pt-6 text-center text-xs leading-relaxed text-stone-500">
          <p>
            {eventInfo.organizer} · {eventInfo.venue}
          </p>
          <p className="mt-1">
            如有疑問請致電 {eventInfo.contact.phone}（{eventInfo.contact.person}）
          </p>
        </footer>
      </main>

      {submitted && <PrintableSummary values={submitted} />}
    </div>
  )
}
