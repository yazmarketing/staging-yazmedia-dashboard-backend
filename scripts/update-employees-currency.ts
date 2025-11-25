import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateEmployeeCurrency() {
  try {
    console.log('Starting to update all employees currency to AED...');

    const result = await prisma.employee.updateMany({
      where: {
        currency: { not: 'AED' },
      },
      data: {
        currency: 'AED',
      },
    });

    console.log(`✅ Successfully updated ${result.count} employees to AED currency`);

    // Verify the update
    const allEmployees = await prisma.employee.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        currency: true,
      },
    });

    const aedCount = allEmployees.filter((emp) => emp.currency === 'AED').length;
    console.log(`\n📊 Verification: ${aedCount}/${allEmployees.length} employees have AED currency`);

    if (aedCount === allEmployees.length) {
      console.log('✅ All employees now have AED currency!');
    } else {
      console.log('⚠️ Some employees still have different currency');
    }
  } catch (error) {
    console.error('❌ Error updating employees:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateEmployeeCurrency();

