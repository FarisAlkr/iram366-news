import type { GlobalConfig } from 'payload'

export const WeatherTowns: GlobalConfig = {
  slug: 'weather-towns',
  label: 'مدن الطقس',
  admin: {
    description:
      'إدارة قائمة المدن التي تظهر في قائمة اختيار الطقس أعلى الصفحة. اتركها فارغة لاستخدام القائمة الافتراضية المضمَّنة (٣٤ مدينة عربية في إسرائيل).',
  },
  access: {
    read: () => true,
    update: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'towns',
      type: 'array',
      label: 'المدن',
      admin: {
        description: 'كل صف يمثّل مدينة. الإحداثيات تُستخدم لاستعلام خدمة الطقس (Open-Meteo).',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'اسم المدينة',
          admin: { placeholder: 'مثال: رهط' },
        },
        {
          name: 'lat',
          type: 'number',
          required: true,
          label: 'خط العرض (Latitude)',
          admin: {
            description: 'مثال: ٣١.٣٩ (لرهط). نقطة عشرية بين ٢٩ و ٣٤.',
          },
        },
        {
          name: 'lon',
          type: 'number',
          required: true,
          label: 'خط الطول (Longitude)',
          admin: {
            description: 'مثال: ٣٤.٧٥ (لرهط). نقطة عشرية بين ٣٤ و ٣٦.',
          },
        },
        {
          name: 'region',
          type: 'select',
          required: true,
          label: 'المنطقة',
          options: [
            { label: 'الجليل', value: 'الجليل' },
            { label: 'المثلث', value: 'المثلث' },
            { label: 'النقب', value: 'النقب' },
            { label: 'المدن المختلطة', value: 'المدن المختلطة' },
            { label: 'مرتفعات الكرمل', value: 'مرتفعات الكرمل' },
          ],
        },
      ],
    },
  ],
}
