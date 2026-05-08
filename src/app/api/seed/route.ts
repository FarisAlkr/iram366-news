import { NextResponse, type NextRequest } from 'next/server'

import { ArticleStatus } from '@/domain/enums'
import { getPayloadClient } from '@/lib/payload'
import { logger } from '@/lib/logger'
import { RateLimits, enforce } from '@/lib/rate-limit'
import type { Payload } from 'payload'

// Gate the seed endpoint behind:
//   1. A secret header (SEED_SECRET in env), AND
//   2. NODE_ENV !== 'production' OR ALLOW_SEED_IN_PRODUCTION=1
//
// This prevents a public POST from wiping production data.

interface SeedCategory {
  name: string
  slug: string
  color: string
  description: string
}

interface SeedArticle {
  title: string
  excerpt: string
}

const CATEGORIES: SeedCategory[] = [
  { name: 'محلي', slug: 'local', color: '#2563eb', description: 'أخبار محلية من رهط والنقب' },
  { name: 'سياسة', slug: 'politics', color: '#7c3aed', description: 'أخبار سياسية' },
  { name: 'ميداني', slug: 'field', color: '#dc2626', description: 'تقارير ميدانية' },
  { name: 'رياضة', slug: 'sports', color: '#16a34a', description: 'أخبار رياضية' },
  { name: 'مجتمع', slug: 'society', color: '#ea580c', description: 'أخبار مجتمعية' },
  { name: 'اقتصاد', slug: 'economy', color: '#0891b2', description: 'أخبار اقتصادية' },
]

const SAMPLE_ARTICLES: Record<string, SeedArticle[]> = {
  local: [
    {
      title: 'بلدية رهط تعلن عن خطة تطوير شاملة للبنية التحتية',
      excerpt:
        'أعلنت بلدية رهط عن خطة تطوير شاملة تشمل تحسين شبكة الطرق والصرف الصحي وإنشاء مرافق عامة جديدة في عدة أحياء.',
    },
    {
      title: 'افتتاح مركز صحي جديد في حي الزيتون بمدينة رهط',
      excerpt:
        'تم افتتاح مركز صحي جديد ومجهز بأحدث التقنيات الطبية في حي الزيتون، لخدمة أكثر من عشرة آلاف مواطن.',
    },
    {
      title: 'مشروع تشجير واسع في النقب بمشاركة مئات المتطوعين',
      excerpt:
        'شارك مئات المتطوعين من المنطقة في حملة تشجير واسعة النطاق تهدف إلى زراعة آلاف الأشجار في منطقة النقب.',
    },
  ],
  politics: [
    {
      title: 'جلسة طارئة في الكنيست لمناقشة ميزانية التعليم في المجتمع العربي',
      excerpt:
        'عُقدت جلسة طارئة في الكنيست لمناقشة الفجوات في ميزانية التعليم المخصصة للمجتمع العربي ومطالب بزيادتها.',
    },
    {
      title: 'رؤساء بلديات النقب يطالبون بتخصيص ميزانيات إضافية للتطوير',
      excerpt:
        'اجتمع رؤساء بلديات عدة في النقب للمطالبة بتخصيص ميزانيات إضافية لمشاريع التطوير والبنية التحتية.',
    },
  ],
  field: [
    {
      title: 'تقرير ميداني: واقع التعليم في المدارس البدوية بالنقب',
      excerpt:
        'رصد ميداني شامل لواقع التعليم في المدارس البدوية، يكشف عن تحديات كبيرة وجهود مبذولة لتحسين المستوى التعليمي.',
    },
    {
      title: 'جولة ميدانية في سوق رهط الشعبي: تاريخ وحاضر',
      excerpt:
        'جولة توثيقية في سوق رهط الشعبي الذي يعد من أقدم الأسواق في المنطقة ويشهد إقبالاً كبيراً من السكان.',
    },
  ],
  sports: [
    {
      title: 'فريق هبوعيل رهط يحقق فوزاً كبيراً في الدوري',
      excerpt:
        'حقق فريق هبوعيل رهط فوزاً مستحقاً بنتيجة 3-1 في مباراة مثيرة ضمن منافسات الدوري، مؤكداً تصدره للترتيب.',
    },
    {
      title: 'بطولة كرة قدم للشباب في النقب تجمع 16 فريقاً',
      excerpt:
        'انطلقت بطولة كرة القدم للشباب في النقب بمشاركة 16 فريقاً من مختلف المدن والقرى في المنطقة.',
    },
  ],
  society: [
    {
      title: 'مبادرة تطوعية لتعليم كبار السن استخدام التكنولوجيا',
      excerpt:
        'أطلقت مجموعة من الشباب المتطوعين مبادرة لتعليم كبار السن في رهط استخدام الهواتف الذكية والتطبيقات الأساسية.',
    },
    {
      title: 'معرض فني يحتفي بالتراث البدوي في النقب',
      excerpt:
        'افتتح معرض فني يضم أعمالاً لفنانين محليين تحتفي بالتراث البدوي وتوثق الحياة التقليدية في منطقة النقب.',
    },
  ],
  economy: [
    {
      title: 'افتتاح منطقة صناعية جديدة في رهط توفر مئات فرص العمل',
      excerpt:
        'تم تدشين منطقة صناعية جديدة في مدينة رهط تضم عدة مصانع ومنشآت تجارية، ومن المتوقع أن توفر مئات فرص العمل.',
    },
    {
      title: 'ارتفاع ملحوظ في أسعار العقارات في مدن النقب',
      excerpt:
        'سجلت أسعار العقارات في مدن النقب ارتفاعاً ملحوظاً خلال الربع الأخير، مع تزايد الطلب على الشقق السكنية.',
    },
  ],
}

const SAMPLE_BODY = {
  root: {
    type: 'root',
    direction: 'rtl',
    format: '',
    indent: 0,
    version: 1,
    children: [
      {
        type: 'paragraph',
        direction: 'rtl',
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'text',
            text: 'هذا نص تجريبي للمقال. سيتم استبداله بمحتوى حقيقي لاحقاً. المقال يتناول موضوعاً مهماً يتعلق بالحياة اليومية في منطقة النقب ومدينة رهط.',
          },
        ],
      },
      {
        type: 'paragraph',
        direction: 'rtl',
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'text',
            text: 'يُعد هذا التقرير جزءاً من تغطية إرم 366 الإخبارية الشاملة للأحداث المحلية والإقليمية.',
          },
        ],
      },
    ],
  },
}

async function upsertCategories(payload: Payload, log: string[]): Promise<Map<string, string | number>> {
  const map = new Map<string, string | number>()
  for (const cat of CATEGORIES) {
    try {
      const existing = await payload.find({
        collection: 'categories',
        where: { slug: { equals: cat.slug } },
        limit: 1,
      })
      if (existing.docs[0]) {
        map.set(cat.slug, existing.docs[0].id)
        log.push(`⚠️  Category exists: ${cat.name}`)
      } else {
        const created = await payload.create({ collection: 'categories', data: cat })
        map.set(cat.slug, created.id)
        log.push(`✅ Category: ${cat.name}`)
      }
    } catch (err) {
      logger.error('seed.category_failed', { err, slug: cat.slug })
      log.push(`❌ Category error (${cat.slug}): ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }
  return map
}

async function createSampleArticles(
  payload: Payload,
  categoryMap: Map<string, string | number>,
  log: string[],
): Promise<void> {
  for (const [catSlug, articles] of Object.entries(SAMPLE_ARTICLES)) {
    const categoryId = categoryMap.get(catSlug)
    if (!categoryId) continue
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]!
      try {
        await payload.create({
          collection: 'articles',
          data: {
            title: article.title,
            slug: `${catSlug}-${Date.now()}-${i}`,
            excerpt: article.excerpt,
            body: SAMPLE_BODY as never,
            category: categoryId,
            status: ArticleStatus.Published,
            publishedAt: new Date(Date.now() - i * 3600_000).toISOString(),
            isFeatured: i === 0 && catSlug === 'local',
            isBreaking: catSlug === 'local' && i === 0,
            views: Math.floor(Math.random() * 500),
          },
        })
        log.push(`✅ Article: ${article.title.substring(0, 40)}...`)
      } catch (err) {
        logger.error('seed.article_failed', { err, title: article.title })
        log.push(`❌ Article error: ${err instanceof Error ? err.message : 'unknown'}`)
      }
    }
  }
}

async function updateSiteSettings(payload: Payload, log: string[]): Promise<void> {
  try {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        siteName: 'إرم 366 الإخبارية',
        siteDescription:
          'منصة إخبارية مستقلة برؤية مختلفة — نواكب الأحداث لحظة بلحظة من رهط والنقب',
        socialLinks: {
          whatsapp: 'https://whatsapp.com/channel/0029VbAizv9Jpe8aQ7OlYl1a',
          instagram: 'https://www.instagram.com/iram.news.366',
          tiktok: 'https://www.tiktok.com/@iram_news366',
          facebook: 'https://www.facebook.com/share/1B8Kk321Ds/',
          email: 'iramnews366@gmail.com',
        },
        footerText: 'جميع الحقوق محفوظة © 2025 لشركة إرم 366 الإخبارية م.ض',
      },
    })
    log.push('✅ Site settings updated')
  } catch (err) {
    logger.error('seed.site_settings_failed', { err })
    log.push(`❌ Site settings error: ${err instanceof Error ? err.message : 'unknown'}`)
  }
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.SEED_SECRET
  if (!expected) return false
  const provided = request.headers.get('x-seed-secret')
  if (!provided) return false
  // Constant-time-ish comparison; avoids exposing length via early return.
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

export async function POST(request: NextRequest) {
  const limited = enforce(request, RateLimits.seed)
  if (limited) return limited

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_IN_PRODUCTION !== '1') {
    return NextResponse.json({ error: 'Seeding is disabled in production' }, { status: 403 })
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayloadClient()
  const log: string[] = []

  const categoryMap = await upsertCategories(payload, log)
  await createSampleArticles(payload, categoryMap, log)
  await updateSiteSettings(payload, log)

  logger.info('seed.completed', { entries: log.length })
  return NextResponse.json({ success: true, log })
}
