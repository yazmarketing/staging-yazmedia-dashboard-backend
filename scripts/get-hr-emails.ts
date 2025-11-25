import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function getHREmails() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('📧 FETCHING HR/MANAGEMENT EMAIL ADDRESSES');
    console.log('='.repeat(70));
    console.log('');

    // Fetch HR and Management employees
    const hrManagementEmployees = await prisma.employee.findMany({
      where: {
        role: {
          in: ['HR', 'MANAGEMENT'],
        },
        userStatus: 'ACTIVE',
        status: {
          not: 'TERMINATED',
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        userStatus: true,
        status: true,
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' },
        { firstName: 'asc' },
      ],
    });

    if (hrManagementEmployees.length === 0) {
      console.log('⚠️  No HR/Management employees found!');
      console.log('');
      console.log('Criteria:');
      console.log('  - role IN ["HR", "MANAGEMENT"]');
      console.log('  - userStatus = "ACTIVE"');
      console.log('  - status ≠ "TERMINATED"');
      console.log('');
    } else {
      // Separate HR and Management
      const hrEmployees = hrManagementEmployees.filter(emp => emp.role === 'HR');
      const managementEmployees = hrManagementEmployees.filter(emp => emp.role === 'MANAGEMENT');

      console.log(`📊 Found ${hrManagementEmployees.length} HR/Management employee(s):\n`);

      // Display HR employees
      if (hrEmployees.length > 0) {
        console.log('👔 HR EMPLOYEES:');
        console.log('-'.repeat(70));
        hrEmployees.forEach((emp, index) => {
          const emailStatus = emp.email ? '✅' : '❌ NO EMAIL';
          console.log(`${index + 1}. ${emp.firstName} ${emp.lastName}`);
          console.log(`   Email: ${emp.email || 'N/A'} ${emailStatus}`);
          console.log(`   Role: ${emp.role}`);
          console.log(`   Department: ${emp.department?.name || 'N/A'}`);
          console.log(`   Status: ${emp.status} | User Status: ${emp.userStatus}`);
          console.log('');
        });
      }

      // Display Management employees
      if (managementEmployees.length > 0) {
        console.log('👑 MANAGEMENT EMPLOYEES:');
        console.log('-'.repeat(70));
        managementEmployees.forEach((emp, index) => {
          const emailStatus = emp.email ? '✅' : '❌ NO EMAIL';
          console.log(`${index + 1}. ${emp.firstName} ${emp.lastName}`);
          console.log(`   Email: ${emp.email || 'N/A'} ${emailStatus}`);
          console.log(`   Role: ${emp.role}`);
          console.log(`   Department: ${emp.department?.name || 'N/A'}`);
          console.log(`   Status: ${emp.status} | User Status: ${emp.userStatus}`);
          console.log('');
        });
      }

      // Extract valid emails
      const validEmails = hrManagementEmployees
        .map(emp => emp.email)
        .filter((email): email is string => email !== null && email !== '');

      console.log('='.repeat(70));
      console.log('📧 EMAIL ADDRESSES FOR NOTIFICATIONS:');
      console.log('='.repeat(70));
      console.log(`Total valid email addresses: ${validEmails.length}\n`);

      if (validEmails.length > 0) {
        validEmails.forEach((email, index) => {
          console.log(`   ${index + 1}. ${email}`);
        });
        console.log('');
        console.log('These emails will receive leave request notifications.');
      } else {
        console.log('⚠️  No valid email addresses found!');
        console.log('   Employees without emails will NOT receive notifications.');
      }
      console.log('');
    }

    console.log('='.repeat(70));
    console.log('✅ Done!');
    console.log('='.repeat(70));
    console.log('');

  } catch (error) {
    console.error('\n❌ Error fetching HR emails:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
getHREmails()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to fetch HR emails:', error);
    process.exit(1);
  });

