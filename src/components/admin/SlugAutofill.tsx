'use client'

import React from 'react'
import { useDocumentInfo, useForm, useFormFields } from '@payloadcms/ui'

import { slugify } from '@/lib/slug'

/**
 * Live slug auto-fill. Mounted as an invisible `ui` field next to the title
 * field on Articles (and other slug-bearing collections). When the title
 * changes, transliterates Arabic → Latin and writes that to the slug field —
 * but only while the slug looks "untouched" (empty, or still equal to the
 * last value we auto-generated). Once the editor types a custom slug, we
 * back off and never overwrite again.
 *
 * On existing published documents we don't auto-overwrite a non-empty slug —
 * that would silently break URLs. Auto-fill only kicks in when the slug is
 * empty (typically on a fresh "Create new article" form).
 */
export const SlugAutofill: React.FC = () => {
  const { id } = useDocumentInfo()
  const { dispatchFields } = useForm()

  const { title, slug } = useFormFields(([fields]) => ({
    title: fields?.title?.value,
    slug: fields?.slug?.value,
  }))

  // Track the last value we wrote, so we can tell "untouched by user"
  // (current slug equals our last write) from "user customized" (current
  // slug differs from our last write).
  const lastAutoWriteRef = React.useRef<string>('')

  React.useEffect(() => {
    if (typeof title !== 'string') return
    const titleStr = title.trim()
    if (!titleStr) return

    const computed = slugify(titleStr)
    if (!computed) return

    const currentSlug = typeof slug === 'string' ? slug.trim() : ''

    // For existing docs (id present and slug already populated), respect
    // the existing slug — don't auto-overwrite, even if the editor changes
    // the title. The hook in payload.config still backfills empty slugs on
    // first save.
    if (id && currentSlug && currentSlug !== lastAutoWriteRef.current) {
      return
    }

    // Skip writes when nothing would change
    if (currentSlug === computed) {
      lastAutoWriteRef.current = computed
      return
    }

    // Only write when the slug is empty OR matches our last auto-write.
    if (currentSlug && currentSlug !== lastAutoWriteRef.current) return

    dispatchFields({ type: 'UPDATE', path: 'slug', value: computed })
    lastAutoWriteRef.current = computed
  }, [title, slug, id, dispatchFields])

  // Invisible — purely a side-effect component
  return null
}

export default SlugAutofill
