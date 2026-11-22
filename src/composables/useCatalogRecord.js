import { computed, ref, shallowRef } from 'vue'

export function useCatalogRecord({ id, canManage, signal, actions, makeDraft, preparePayload }) {
  const mode = ref(id === null ? 'create' : 'profile')
  const record = shallowRef(null)
  const draft = ref(makeDraft())
  const loading = ref(false)
  const saving = ref(false)
  const readError = shallowRef(null)
  const writeError = shallowRef(null)
  const payload = computed(() =>
    preparePayload(draft.value, mode.value === 'edit' ? record.value : null),
  )
  const canSubmit = computed(() => {
    if (!canManage() || saving.value) return false
    if (mode.value === 'deactivate') return record.value?.is_active === true
    return ['create', 'edit'].includes(mode.value) && Object.keys(payload.value ?? {}).length > 0
  })

  async function load() {
    if (id === null || loading.value || signal.aborted) return
    loading.value = true
    readError.value = null

    try {
      const profile = await actions.load(id, signal)
      if (!signal.aborted) record.value = profile
    } catch (failure) {
      if (!signal.aborted && failure?.status !== 401) readError.value = failure
    } finally {
      loading.value = false
    }
  }

  function openEdit() {
    if (mode.value !== 'profile' || !record.value || !canManage()) return
    draft.value = makeDraft(record.value)
    mode.value = 'edit'
  }

  function openDeactivation() {
    if (mode.value !== 'profile' || !record.value?.is_active || !canManage()) return
    mode.value = 'deactivate'
  }

  function showProfile() {
    if (saving.value || !record.value) return
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
      if (operation === 'create') saved = await actions.create(payload.value, signal)
      else if (operation === 'edit') {
        saved = await actions.edit(record.value.id, payload.value, signal)
      } else {
        saved = await actions.deactivate(record.value.id, signal)
      }

      if (signal.aborted) return null
      record.value = saved
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
    record,
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
