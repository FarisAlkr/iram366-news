import React from 'react'

export const Logo: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '10px 4px',
    }}
  >
    <img
      src="/logo.svg"
      alt="إرم 366"
      style={{
        height: '44px',
        width: '44px',
        objectFit: 'contain',
      }}
    />
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
      <span
        style={{
          fontSize: '17px',
          fontWeight: 800,
          color: '#f1ede6',
          letterSpacing: '-0.01em',
        }}
      >
        إرم 366
      </span>
      <span
        style={{
          fontSize: '11.5px',
          color: '#8aa0a1',
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}
      >
        لوحة التحكم الإدارية
      </span>
    </div>
  </div>
)

export default Logo
