import Field from './Field.jsx'
import { formSchema } from '../data/formSchema.js'
import { eventInfo } from '../data/event.js'
import { isGasConfigured } from '../config.js'

export default function RegistrationForm({
  values,
  errors,
  submitError,
  submitting,
  onChange,
  onSubmit,
}) {
  return (
    <section id="registration" className="mt-6 scroll-mt-4">
      <div className="card">
        <h2 className="text-lg font-bold text-stone-900">報名表</h2>
        <p className="mt-1 text-sm text-stone-600">
          標示 <span className="font-semibold text-rose-600">*</span> 者為必填。每位參加者請填寫一張報名表。
        </p>

        {!isGasConfigured && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"
          >
            <p className="font-semibold">⚠ 網上報名暫未開放</p>
            <p className="mt-1">
              網上報名系統未能連線，暫時無法送出。如需報名，請致電{' '}
              <span className="font-semibold">{eventInfo.contact.phone}</span>（{eventInfo.contact.person}）
              與我們聯絡。
            </p>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm leading-relaxed text-rose-900"
          >
            {submitError}
          </div>
        )}

        <form className="mt-6 space-y-8" onSubmit={onSubmit} noValidate>
          {formSchema.map((field, index) => (
            <div key={field.name}>
              <h3 className="mb-3 border-b border-stone-100 pb-2 text-[15px] font-bold text-stone-900">
                <span className="mr-2 text-rose-600">{index + 1}.</span>
                {field.label}
              </h3>
              <Field field={field} values={values} errors={errors} onChange={onChange} />
            </div>
          ))}

          <div className="border-t border-stone-100 pt-6">
            <button
              type="submit"
              disabled={submitting || !isGasConfigured}
              className="min-h-14 w-full rounded-full bg-rose-600 px-8 text-base font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none"
            >
              {submitting ? '送出中…' : '送出報名資料'}
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-stone-500">
              送出後將以電話聯絡確認，請確保填寫的聯絡電話正確。
            </p>
          </div>
        </form>
      </div>
    </section>
  )
}
