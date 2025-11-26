import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

interface CSVEmployee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  baseSalary: string;
  totalSalary: string;
  password?: string;
  personalEmail?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  molId?: string;
  role: string;
  userStatus: string;
  employeeId: string;
  departmentId: string;
  designation: string;
  employmentType: string;
  status: string;
  workMode: string;
  joinDate: string;
  probationPeriod?: string;
  confirmationDate?: string;
  contractDuration?: string;
  contractExpiryDate?: string;
  terminationDate?: string;
  managerId?: string;
  currency?: string;
  accommodationAllowance?: string;
  housingAllowance?: string;
  transportationAllowance?: string;
}

async function importEmployees() {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 IMPORT EMPLOYEES FROM CSV');
    console.log('='.repeat(70));

    // Read CSV file
    const csvPath = path.join(__dirname, '..', 'Employee-2.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found at: ${csvPath}`);
      process.exit(1);
    }

    console.log(`📂 Reading CSV file: ${csvPath}`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    const records: CSVEmployee[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`✅ Parsed ${records.length} employee records from CSV\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each employee
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Check if employee already exists
        const existing = await prisma.employee.findUnique({
          where: { id: record.id },
        });

        if (existing) {
          console.log(`⚠️  Row ${i + 2}: Employee ${record.firstName} ${record.lastName} (ID: ${record.id}) already exists, skipping...`);
          skippedCount++;
          continue;
        }

        // Check if email already exists
        const existingByEmail = await prisma.employee.findUnique({
          where: { email: record.email },
        });

        if (existingByEmail) {
          console.log(`⚠️  Row ${i + 2}: Employee with email ${record.email} already exists, skipping...`);
          skippedCount++;
          continue;
        }

        // Validate department exists
        const department = await prisma.department.findUnique({
          where: { id: record.departmentId },
        });

        if (!department) {
          console.log(`⚠️  Row ${i + 2}: Department ${record.departmentId} not found, skipping...`);
          skippedCount++;
          continue;
        }

        // Generate password if not provided
        let password = record.password;
        if (!password || password.trim() === '') {
          // Generate a default password: first name + last 4 digits of ID
          const defaultPassword = `${record.firstName.toLowerCase()}${record.id.slice(-4)}`;
          password = await bcrypt.hash(defaultPassword, 10);
          console.log(`   📝 Generated default password for ${record.firstName} ${record.lastName}`);
        } else {
          // Hash the provided password
          password = await bcrypt.hash(password, 10);
        }

        // Prepare employee data
        const employeeData: any = {
          id: record.id,
          firstName: record.firstName,
          lastName: record.lastName,
          email: record.email,
          password,
          personalEmail: record.personalEmail && record.personalEmail.trim() !== '' ? record.personalEmail : null,
          phone: record.phone && record.phone !== 'NULL' && record.phone.trim() !== '' ? record.phone : null,
          dateOfBirth: record.dateOfBirth && record.dateOfBirth !== 'NULL' ? new Date(record.dateOfBirth) : null,
          gender: record.gender && record.gender !== 'NULL' ? record.gender : null,
          address: record.address && record.address !== 'NULL' ? record.address : null,
          city: record.city && record.city !== 'NULL' ? record.city : null,
          state: record.state && record.state !== 'NULL' ? record.state : null,
          zipCode: record.zipCode && record.zipCode !== 'NULL' ? record.zipCode : null,
          country: record.country && record.country !== 'NULL' ? record.country : null,
          molId: record.molId && record.molId !== 'NULL' ? record.molId : null,
          role: record.role || 'EMPLOYEE',
          userStatus: record.userStatus || 'ACTIVE',
          employeeId: record.employeeId,
          departmentId: record.departmentId,
          designation: record.designation,
          employmentType: record.employmentType || 'FULL_TIME',
          status: record.status || 'ACTIVE',
          workMode: record.workMode || 'ON_SITE',
          joinDate: new Date(record.joinDate),
          probationPeriod: record.probationPeriod && record.probationPeriod !== 'NULL' ? record.probationPeriod : null,
          confirmationDate: record.confirmationDate && record.confirmationDate !== 'NULL' ? new Date(record.confirmationDate) : null,
          contractDuration: record.contractDuration && record.contractDuration !== 'NULL' ? record.contractDuration : null,
          contractExpiryDate: record.contractExpiryDate && record.contractExpiryDate !== 'NULL' ? new Date(record.contractExpiryDate) : null,
          terminationDate: record.terminationDate && record.terminationDate !== 'NULL' ? new Date(record.terminationDate) : null,
          managerId: record.managerId && record.managerId !== 'NULL' ? record.managerId : null,
          currency: record.currency || 'AED',
          baseSalary: parseFloat(record.baseSalary) || 0,
          telephoneAllowance: parseFloat(record.accommodationAllowance || '0') || 0, // Note: CSV uses accommodationAllowance but schema uses telephoneAllowance
          housingAllowance: parseFloat(record.housingAllowance || '0') || 0,
          transportationAllowance: parseFloat(record.transportationAllowance || '0') || 0,
          totalSalary: parseFloat(record.totalSalary) || 0,
        };

        // Create employee
        await prisma.employee.create({
          data: employeeData,
        });

        successCount++;
        console.log(`✅ Imported: ${record.firstName} ${record.lastName} (${record.email}) - ID: ${record.id}`);
      } catch (error: any) {
        errorCount++;
        const errorMsg = `Row ${i + 2}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ IMPORT COMPLETE');
    console.log('='.repeat(70));
    console.log(`📊 Summary:`);
    console.log(`  ✅ Successfully imported: ${successCount}`);
    console.log(`  ⚠️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log(`\n❌ Error details:`);
      errors.forEach((err) => console.log(`  - ${err}`));
    }
    
    console.log('');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

importEmployees();






