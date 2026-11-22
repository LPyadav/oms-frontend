import { computed, ref, shallowRef } from 'vue'
import { createCustomer, deactivateCustomer, getCustomer, updateCustomer } from '../api/customers'

const profileFields = ['name', 'email', 'phone', 'address']

function profileDraft(customer = {}) {
  return Object.fromEntries(profileFields.map((field) => [field, customer[field] ?? '']))
}

function normalizeDraft(draft) {
  return Object.fromEntries(
    profileFields.map((field) => {
      const value = (draft[field] ?? '').trim()
      return [field, field === 'name' ? value : value || null]
    }),
  )
}

export function useCustomerProfile({ request, customerId, canManage, signal }) {
  const mode = ref(customerId === null ? 'create' : 'profile')
  const customer = shallowRef(null)
  const draft = ref(profileDraft())
  const loading = ref(false)
  const saving = ref(false)
  const readError = shallowRef(null)
  const writeError = shallowRef(null)

  const payload = computed(() => {
    const values = normalizeDraft(draft.value)
    if (mode.value === 'create') return values

    const original = normalizeDraft(profileDraft(customer.value ?? {}))
    return Object.fromEntries(
      Object.entries(values).filter(([field, value]) => value !== original[field]),
    )
  })
  const canSubmit = computed(() => {
    if (!canManage() || saving.value) return false
    if (mode.value === 'deactivate') return customer.value?.is_active === true
    return (
      ['create', 'edit'].includes(mode.value) &&
      !!draft.value.name?.trim() &&
      Object.keys(payload.value).length > 0
    )
  })

  async function load() {
    if (customerId === null || loading.value || signal.aborted) return
    loading.value = true
    readError.value = null

    try {
      const profile = await getCustomer(request, customerId, signal)
      if (!signal.aborted) customer.value = profile
    } catch (failure) {
      if (!signal.aborted && failure?.status !== 401) readError.value = failure
    } finally {
      loading.value = false
    }
  }

  function openEdit() {
    if (mode.value !== 'profile' || !customer.value || !canManage()) return
    draft.value = profileDraft(customer.value)
    mode.value = 'edit'
  }

  function openDeactivation() {
    if (mode.value !== 'profile' || !customer.value?.is_active || !canManage()) return
    mode.value = 'deactivate'
  }

  function showProfile() {
    if (saving.value || !customer.value) return
    writeError.value = null
    mode.value = 'profile'
  }

  async function save() {
    if (signal.aborted || !canSubmit.value) return null
    saving.value = true
    writeError.value = null
    const operation = mode.value

    try {
      let saved
      if (operation === 'create') saved = await createCustomer(request, payload.value, signal)
      else if (operation === 'edit') {
        saved = await updateCustomer(request, customer.value.id, payload.value, signal)
      } else {
        saved = await deactivateCustomer(request, customer.value.id, signal)
      }

      if (signal.aborted) return null
      customer.value = saved
      mode.value = 'profile'
      return saved
    } catch (failure) {
      if (!signal.aborted && failure?.status !== 401) writeError.value = failure
      return null
    } finally {
      saving.value = false
    }
  }

  return {
    mode,
    customer,
    draft,
    loading,
    saving,
    readError,
    writeError,
    canSubmit,
    load,
    openEdit,
    openDeactivation,
    showProfile,
    save,
  }
}
