import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding clients and projects...');

  try {
    // Create clients
    const client1 = await prisma.client.upsert({
      where: { name: 'Acme Corporation' },
      update: {},
      create: {
        name: 'Acme Corporation',
        email: 'contact@acme.com',
        phone: '+1-555-0123',
        address: '123 Business Ave',
        city: 'New York',
        country: 'USA',
        description: 'Leading technology solutions provider',
        isActive: true,
      },
    });
    console.log('✅ Created client:', client1.name);

    const client2 = await prisma.client.upsert({
      where: { name: 'Tech Innovations Inc' },
      update: {},
      create: {
        name: 'Tech Innovations Inc',
        email: 'info@techinnovations.com',
        phone: '+1-555-0456',
        address: '456 Tech Park',
        city: 'San Francisco',
        country: 'USA',
        description: 'Cloud solutions and AI development',
        isActive: true,
      },
    });
    console.log('✅ Created client:', client2.name);

    const client3 = await prisma.client.upsert({
      where: { name: 'Digital Solutions Ltd' },
      update: {},
      create: {
        name: 'Digital Solutions Ltd',
        email: 'hello@digitalsolutions.com',
        phone: '+44-20-7946-0958',
        address: '789 Digital Street',
        city: 'London',
        country: 'UK',
        description: 'Web and mobile development agency',
        isActive: true,
      },
    });
    console.log('✅ Created client:', client3.name);

    // Create projects for each client
    const project1 = await prisma.project.upsert({
      where: { name_clientId: { name: 'Website Redesign', clientId: client1.id } },
      update: {},
      create: {
        name: 'Website Redesign',
        clientId: client1.id,
        description: 'Complete redesign of company website',
        startDate: new Date('2025-09-01'),
        endDate: new Date('2025-12-31'),
        isActive: true,
      },
    });
    console.log('✅ Created project:', project1.name);

    const project2 = await prisma.project.upsert({
      where: { name_clientId: { name: 'Mobile App Development', clientId: client1.id } },
      update: {},
      create: {
        name: 'Mobile App Development',
        clientId: client1.id,
        description: 'Native iOS and Android app',
        startDate: new Date('2025-10-01'),
        endDate: null,
        isActive: true,
      },
    });
    console.log('✅ Created project:', project2.name);

    const project3 = await prisma.project.upsert({
      where: { name_clientId: { name: 'Cloud Migration', clientId: client2.id } },
      update: {},
      create: {
        name: 'Cloud Migration',
        clientId: client2.id,
        description: 'Migrate on-premise infrastructure to AWS',
        startDate: new Date('2025-11-01'),
        endDate: new Date('2026-02-28'),
        isActive: true,
      },
    });
    console.log('✅ Created project:', project3.name);

    const project4 = await prisma.project.upsert({
      where: { name_clientId: { name: 'AI Integration', clientId: client2.id } },
      update: {},
      create: {
        name: 'AI Integration',
        clientId: client2.id,
        description: 'Integrate AI/ML models into existing platform',
        startDate: new Date('2025-10-15'),
        endDate: null,
        isActive: true,
      },
    });
    console.log('✅ Created project:', project4.name);

    const project5 = await prisma.project.upsert({
      where: { name_clientId: { name: 'E-commerce Platform', clientId: client3.id } },
      update: {},
      create: {
        name: 'E-commerce Platform',
        clientId: client3.id,
        description: 'Build full-featured e-commerce platform',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2026-03-31'),
        isActive: true,
      },
    });
    console.log('✅ Created project:', project5.name);

    const project6 = await prisma.project.upsert({
      where: { name_clientId: { name: 'API Development', clientId: client3.id } },
      update: {},
      create: {
        name: 'API Development',
        clientId: client3.id,
        description: 'RESTful API for third-party integrations',
        startDate: new Date('2025-09-15'),
        endDate: null,
        isActive: true,
      },
    });
    console.log('✅ Created project:', project6.name);

    console.log('\n✨ Seeding completed successfully!');
    console.log('\n📋 Created:');
    console.log('   - 3 Clients');
    console.log('   - 6 Projects');
    console.log('\n🎯 You can now use these client and project IDs in overtime requests:');
    console.log(`   Client 1 ID: ${client1.id}`);
    console.log(`   Client 2 ID: ${client2.id}`);
    console.log(`   Client 3 ID: ${client3.id}`);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

