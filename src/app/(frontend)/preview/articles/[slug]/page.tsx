export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getPayloadClient } from '@/lib/payload'
import type { Article, Category } from '@/types/payload'
import { ArticleLivePreview } from './ArticleLivePreview'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ secret?: string }>
}

export const metadata: Metadata = {
  title: 'معاينة مباشرة',
  robots: { index: false, follow: false },
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export default async function PreviewArticlePage({ params, searchParams }: Props) {
  const { slug } = await params
  const { secret } = await searchParams
  const validSecret = process.env.PAYLOAD_PREVIEW_SECRET
  if (!validSecret || secret !== validSecret) notFound()

  const payload = await getPayloadClient()

  const result = await payload.find({
    collection: 'articles',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 2,
    overrideAccess: true,
  })
  const article = result.docs[0] as unknown as Article | undefined
  if (!article) notFound()

  const categoriesResult = await payload.find({
    collection: 'categories',
    limit: 30,
    depth: 0,
  })
  const categories = categoriesResult.docs as unknown as Category[]

  return (
    <ArticleLivePreview
      initialData={article}
      categories={categories}
      serverURL={SITE_URL}
    />
  )
}
