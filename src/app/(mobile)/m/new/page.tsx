import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getPayloadClient } from '@/lib/payload'
import { getMobileUser } from '../auth'
import { NewArticleForm } from './NewArticleForm'

export const dynamic = 'force-dynamic'

export default async function MobileNewArticlePage() {
  const user = await getMobileUser()
  if (!user) redirect('/m/login')

  const payload = await getPayloadClient()
  const cats = await payload.find({
    collection: 'categories',
    limit: 50,
    sort: 'name',
    depth: 0,
  })

  const categories = cats.docs.map((c) => ({
    id: String(c.id),
    name: c.name as string,
  }))

  return (
    <>
      <header className="m-topbar">
        <div className="m-topbar__brand">
          <img src="/splash-logo.jpeg" alt="" aria-hidden className="m-topbar__logo" />
          <span className="m-topbar__name">مقال جديد</span>
        </div>
        <Link href="/m" className="m-topbar__user" style={{ color: 'white', textDecoration: 'none' }}>
          إلغاء
        </Link>
      </header>

      <main className="m-main">
        <NewArticleForm categories={categories} />
      </main>
    </>
  )
}
