import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Hidden test account
  const hashedTest = await bcrypt.hash('dJVb22F$TF', 10)
  await prisma.user.upsert({
    where: { email: 'abacus-6200bb33@example.com' },
    update: { password: hashedTest, role: 'ADMIN' },
    create: { email: 'abacus-6200bb33@example.com', password: hashedTest, name: 'Admin Test', role: 'ADMIN' },
  })

  // Admin demo user for the client
  const hashedAdmin = await bcrypt.hash('Admin2026!', 10)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@repuestos.com' },
    update: { password: hashedAdmin, role: 'ADMIN' },
    create: { email: 'admin@repuestos.com', password: hashedAdmin, name: 'Administrador', role: 'ADMIN' },
  })

  // Sample articles
  const sampleArticles = [
    { articleNumber: 'REP-001', description: 'Filtro de aceite motor 5W30', manufacturer: 'Bosch', locationCode: '07A-A01-A-A01-ES' },
    { articleNumber: 'REP-002', description: 'Pastillas de freno delanteras', manufacturer: 'Brembo', locationCode: '07A-A02-B-A01-ES' },
    { articleNumber: 'REP-003', description: 'Bujía de encendido iridium', manufacturer: 'NGK', locationCode: '07A-A03-C-A01-ES' },
    { articleNumber: 'REP-004', description: 'Correa de distribución', manufacturer: 'Gates', locationCode: '08A-B01-A-A01-ES' },
    { articleNumber: 'REP-005', description: 'Amortiguador trasero', manufacturer: 'Monroe', locationCode: '08A-B02-B-A01-ES' },
    { articleNumber: 'REP-006', description: 'Radiador de aluminio 16"', manufacturer: 'Valeo', locationCode: '09A-C01-A-A01-ES' },
    { articleNumber: 'REP-007', description: 'Bomba de agua', manufacturer: 'SKF', locationCode: '09A-C02-B-A01-ES' },
    { articleNumber: 'REP-008', description: 'Alternador 12V 120A', manufacturer: 'Bosch', locationCode: '10A-D01-A-A01-ES' },
    { articleNumber: 'REP-009', description: 'Sensor de oxígeno lambda', manufacturer: 'Denso', locationCode: '10A-D02-B-A01-ES' },
    { articleNumber: 'REP-010', description: 'Kit de embrague completo', manufacturer: 'LuK', locationCode: '11A-E01-A-A01-ES' },
    { articleNumber: 'REP-011', description: 'Disco de freno ventilado', manufacturer: 'Brembo', locationCode: '07A-A02-C-A01-ES' },
    { articleNumber: 'REP-012', description: 'Batería 12V 60Ah', manufacturer: 'Varta', locationCode: '12A-F01-A-A01-ES' },
    { articleNumber: 'REP-013', description: 'Filtro de aire', manufacturer: 'Mann Filter', locationCode: '07A-A01-B-A01-ES' },
    { articleNumber: 'REP-014', description: 'Aceite sintético 5W40 4L', manufacturer: 'Castrol', locationCode: '13A-G01-A-A01-ES' },
    { articleNumber: 'REP-015', description: 'Limpiaparabrisas 22"', manufacturer: 'Bosch', locationCode: '14A-H01-A-A01-ES' },
  ]

  for (const a of sampleArticles) {
    await prisma.articleCatalog.upsert({
      where: { articleNumber: a.articleNumber },
      update: { description: a.description, manufacturer: a.manufacturer, locationCode: a.locationCode },
      create: a,
    })
  }

  const articles = await prisma.articleCatalog.findMany()

  // Create two daily snapshots: yesterday and today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  // Yesterday's upload
  const uploadYesterday = await prisma.dailyUpload.upsert({
    where: { snapshotDate: yesterday },
    update: { totalArticles: articles.length },
    create: {
      snapshotDate: yesterday,
      fileName: `STOCK_${formatDate(yesterday)}.xlsx`,
      totalArticles: articles.length,
      uploadedById: adminUser.id,
    },
  })

  // Today's upload
  const uploadToday = await prisma.dailyUpload.upsert({
    where: { snapshotDate: today },
    update: { totalArticles: articles.length },
    create: {
      snapshotDate: today,
      fileName: `STOCK_${formatDate(today)}.xlsx`,
      totalArticles: articles.length,
      uploadedById: adminUser.id,
    },
  })

  // Seed daily items for both days
  const stockValues = [25, 40, 100, 15, 8, 3, 12, 5, 20, 6, 30, 10, 50, 18, 45]
  const costs = [12.50, 45.00, 8.75, 35.00, 120.00, 85.00, 55.00, 180.00, 42.00, 250.00, 38.00, 95.00, 15.00, 32.00, 6.50]
  const prices = [18.99, 68.50, 12.99, 52.00, 175.00, 125.00, 79.00, 265.00, 63.50, 380.00, 56.00, 145.00, 22.50, 48.00, 9.99]
  const physicalYesterday = [25, 38, 100, 14, 8, 3, 10, 5, 18, 6, 29, 10, 50, 17, 45]
  const physicalToday = [24, 39, 98, 15, 7, 4, 11, 5, 19, 5, 30, 9, 49, 18, 44]

  for (let i = 0; i < articles.length; i++) {
    const a = articles[i]
    // Yesterday
    await prisma.dailyItem.upsert({
      where: { uploadId_articleId: { uploadId: uploadYesterday.id, articleId: a.id } },
      update: {},
      create: {
        uploadId: uploadYesterday.id,
        articleId: a.id,
        stockSystem: stockValues[i],
        costItem: costs[i],
        price: prices[i],
        stockPhysical: physicalYesterday[i],
        difference: physicalYesterday[i] - stockValues[i],
        countedById: adminUser.id,
        countedAt: new Date(yesterday.getTime() + 3600000 * (9 + i * 0.5)),
      },
    })
    // Today
    await prisma.dailyItem.upsert({
      where: { uploadId_articleId: { uploadId: uploadToday.id, articleId: a.id } },
      update: {},
      create: {
        uploadId: uploadToday.id,
        articleId: a.id,
        stockSystem: stockValues[i],
        costItem: costs[i],
        price: prices[i],
        stockPhysical: i < 10 ? physicalToday[i] : null,
        difference: i < 10 ? physicalToday[i] - stockValues[i] : null,
        countedById: i < 10 ? adminUser.id : null,
        countedAt: i < 10 ? new Date(today.getTime() + 3600000 * (9 + i * 0.5)) : null,
      },
    })
  }

  console.log('Seed completed: 2 users, 15 articles, 2 daily snapshots')
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
