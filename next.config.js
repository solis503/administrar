/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Evita que otro sitio meta tu app dentro de un iframe (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // El navegador no "adivina" tipos de archivo
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No filtra la URL completa a otros sitios
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // La app no necesita cámara, micrófono ni ubicación
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Siempre HTTPS
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
]

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
